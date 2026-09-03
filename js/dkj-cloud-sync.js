/**
 * 동김제농협 기록 클라우드 동기화 (Firebase Realtime Database).
 *
 * 동기화 구조는 두 단계를 거친다.
 * - 스키마 1(기존): records/<서식별-배열-키>에 서식 전체 배열을 저장한다.
 * - 스키마 2(전환 후): records_v2/<서식>/<기록>에 기록을 독립 노드로 저장한다.
 *
 * 실제 RTDB의 sync_meta/schemaVersion 값이 2가 되기 전까지는 반드시 기존 방식을 쓴다.
 * 따라서 이 파일을 먼저 배포해도 기존 클라우드 기록이 사라지거나 새 경로로 섞이지 않는다.
 * V2 전환은 scripts/migrate-rtdb-v1-to-v2.py와 docs/RTDB_V2_MIGRATION.md 절차를 따른다.
 */
(function (global) {
  'use strict';
  if (global.DkjCloudSync) return;

  var CFG = global.DKJ_FIREBASE || {};
  var KEY_RE = /^dkj:records:([^:]+):list:v1$/;
  var LAST_SYNC_KEY = 'dkj:cloud:last_sync:v2';
  var POLL_MS = 30000;
  var schemaMode = null; // 'legacy' | 'v2'
  var writingLocal = false, timers = {}, poller = null, started = false;

  function auth() { return global.DkjAuth; }
  /* 로그인은 시스템 설정에서 등록한 로컬 계정으로 하고(Firebase Authentication 안 씀),
   * RTDB 규칙도 그에 맞춰 인증 없이 열려 있다 — 그래서 "진짜 Firebase 토큰"인지는 더 이상
   * 안 가리고, 이 화면에 로그인된 사람이 있는지만 본다. */
  function ready() { return !!(CFG.apiKey && CFG.databaseURL && auth() && auth().user()); }
  function isSyncKey(k) { return !!k && KEY_RE.test(k); }
  function formIdOf(key) {
    var m = String(key || '').match(KEY_RE);
    return m ? m[1] : '';
  }
  function listKey(formId) { return 'dkj:records:' + formId + ':list:v1'; }

  /* RTDB 키에는 . # $ [ ] / 를 쓸 수 없으므로, 로컬 키·서식·기록 ID 모두 URL 안전 Base64로 쓴다. */
  function nodeKey(value) {
    return btoa(unescape(encodeURIComponent(String(value || ''))))
      .replace(/\//g, '_').replace(/\+/g, '-').replace(/=+$/, '');
  }
  function readNodeKey(value) {
    try {
      var s = String(value || '').replace(/_/g, '/').replace(/-/g, '+');
      while (s.length % 4) s += '=';
      return decodeURIComponent(escape(atob(s)));
    } catch (e) { return ''; }
  }
  function parse(raw) { try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function values(obj) {
    var out = [];
    Object.keys(obj || {}).forEach(function (k) { out.push(obj[k]); });
    return out;
  }
  function at(record) { return Date.parse((record && (record.updatedAt || record.createdAt)) || 0) || 0; }
  function same(a, b) { return JSON.stringify(a || null) === JSON.stringify(b || null); }

  function toast(msg, bad) {
    if (bad) {
      console.info('[DkjCloudSync] 기기에 안전하게 저장됨 (클라우드 대기):', msg);
      return; // 오프라인/로컬 저장 시 사용자 화면에 불필요한 빨간 경고창을 띄우지 않음
    }
    var el = document.getElementById('dkj-cloud-status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dkj-cloud-status';
      el.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483647;padding:7px 12px;' +
        'border-radius:18px;color:#fff;font:600 12px "Noto Sans KR",sans-serif;box-shadow:0 2px 10px #0004';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.background = '#009a44';
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.display = 'none'; }, 3500);
  }

  /** 'local-token-…'는 이 사이트만의 표식이지 Firebase 가 아는 진짜 토큰이 아니다. RTDB REST
   * API 는 auth= 에 뭐가 오든(빈 값이 아닌 한) 유효성부터 검사해서, 이걸 그대로 보내면
   * 규칙이 열려 있어도 401 로 거부된다. 로컬 로그인이면 auth= 자체를 빼고 익명으로 보낸다. */
  function isRealToken(t) { return !!t && String(t).indexOf('local-token-') !== 0; }

  async function request(path, method, data, retried) {
    var root = String(CFG.databaseURL || '').replace(/\/$/, '') + '/' + (CFG.root || 'dkj-fssc22000');
    var token = auth().token();
    var authParam = isRealToken(token) ? ('?auth=' + encodeURIComponent(token)) : '';
    var url = root + (path ? '/' + path : '') + '.json' + authParam;
    var r = await fetch(url, {
      method: method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data)
    });
    if (r.status === 401) {
      /* 로컬 계정 세션(가짜 토큰)이면 재인증할 진짜 Firebase 자격이 애초에 없으므로 재시도해도
       * 똑같이 401이 난다 — 무한 재시도 루프를 막기 위해 한 번만 시도하고, 진짜 토큰이었을 때만
       * 재인증을 건다. */
      if (retried || !isRealToken(token)) throw new Error('HTTP 401');
      await auth().reauth();
      return request(path, method, data, true);
    }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  async function readSchemaMode() {
    if (schemaMode) return schemaMode;
    var raw = await request('sync_meta/schemaVersion', 'GET');
    schemaMode = Number(raw) === 2 ? 'v2' : 'legacy';
    return schemaMode;
  }

  function writeLocal(key, list) {
    writingLocal = true;
    try { localStorage.setItem(key, JSON.stringify(list)); }
    finally { writingLocal = false; }
  }
  function markSynced() {
    try { localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString()); } catch (e) {}
  }

  /* ------------------------------ 기존 배열 스키마 ------------------------------ */

  function mergeRecords(a, b) {
    var byId = {}, order = [];
    function take(list) {
      (Array.isArray(list) ? list : []).forEach(function (rec) {
        if (!rec || typeof rec !== 'object') return;
        var id = rec.id || JSON.stringify(rec);
        var cur = byId[id];
        if (!cur) { byId[id] = rec; order.push(id); return; }
        if (at(rec) > at(cur)) byId[id] = rec;
      });
    }
    take(a); take(b);
    return order.map(function (id) { return byId[id]; }).sort(function (x, y) {
      return (Date.parse(y.createdAt || 0) || 0) - (Date.parse(x.createdAt || 0) || 0);
    });
  }

  async function legacyPushKey(key) {
    if (!isSyncKey(key)) return;
    var value = parse(localStorage.getItem(key));
    if (!Array.isArray(value)) return;
    await request('records/' + nodeKey(key), 'PUT', {
      value: value,
      updatedAt: Date.now(),
      updatedBy: (auth().user() && auth().user().name) || '',
      device: navigator.userAgent.slice(0, 120)
    });
  }

  function storageKeys() {
    var keys = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k != null) keys.push(k);
      }
    } catch (e) {}
    return keys;
  }

  async function legacySyncAll(silent) {
    var cloud = (await request('records', 'GET')) || {};
    var touched = 0;
    var keys = Object.keys(cloud);
    for (var i = 0; i < keys.length; i++) {
      var encodedKey = keys[i];
      var key = readNodeKey(encodedKey);
      if (!isSyncKey(key)) continue;
      var row = cloud[encodedKey];
      if (!row || !Array.isArray(row.value)) continue;
      var localVal = parse(localStorage.getItem(key)) || [];
      var merged = mergeRecords(localVal, row.value);
      if (!same(merged, localVal)) { writeLocal(key, merged); touched++; }
      if (!same(merged, row.value)) await legacyPushKey(key);
    }
    var localKeys = storageKeys();
    for (var i = 0; i < localKeys.length; i++) {
      var k = localKeys[i];
      if (isSyncKey(k) && !cloud[nodeKey(k)]) await legacyPushKey(k);
    }
    markSynced();
    if (touched) {
      try { global.dispatchEvent(new CustomEvent('dkj:records-changed', { detail: { source: 'cloud', mode: 'legacy' } })); } catch (e) {}
    }
    if (!silent) toast('☁️ 기존 동기화 완료 · 보안 전환 준비 중');
    if (touched && !sessionStorage.getItem('dkj_cloud_reloaded')) {
      sessionStorage.setItem('dkj_cloud_reloaded', '1');
      setTimeout(function () { location.reload(); }, 700);
    }
  }

  /* ----------------------------- 레코드 단위 V2 스키마 ----------------------------- */

  function dataOf(record) {
    var out = clone(record) || {};
    delete out.audit;
    delete out.signoff;
    delete out.locked;
    delete out._sync;
    return out;
  }
  function auditId(entry, index) {
    if (entry && entry.id) return String(entry.id);
    return 'a_' + nodeKey((entry && (entry.hash || entry.at || entry.action)) || index).slice(0, 36);
  }
  function approvalOf(record) { return (record && record.signoff) || {}; }

  function normalizeAudit(record) {
    var out = {};
    ((record && record.audit) || []).forEach(function (entry, index) {
      if (!entry || typeof entry !== 'object') return;
      var row = clone(entry);
      row.id = auditId(row, index);
      out[row.id] = row;
    });
    return out;
  }

  function decodeRecord(formId, recordId, raw) {
    if (!raw || !raw.data) return null;
    var rec = clone(raw.data) || {};
    rec.id = rec.id || recordId;
    rec.formId = rec.formId || formId;
    rec.locked = !!(raw.workflow && raw.workflow.locked);
    rec.signoff = {};
    Object.keys(raw.approvals || {}).forEach(function (encodedStage) {
      rec.signoff[readNodeKey(encodedStage)] = clone(raw.approvals[encodedStage]);
    });
    rec.audit = values(raw.audit || {}).sort(function (a, b) { return String(a.at || '').localeCompare(String(b.at || '')); });
    var workAt = raw.workflow && raw.workflow.updatedAt;
    if (workAt && (!rec.updatedAt || Date.parse(workAt) > Date.parse(rec.updatedAt))) rec.updatedAt = workAt;
    return rec;
  }

  function mergeSidecars(local, remote) {
    var result = clone(local) || {};
    var localAudit = normalizeAudit(result);
    var remoteAudit = normalizeAudit(remote);
    Object.keys(remoteAudit).forEach(function (id) {
      if (!localAudit[id]) localAudit[id] = remoteAudit[id];
    });
    result.audit = values(localAudit).sort(function (a, b) { return String(a.at || '').localeCompare(String(b.at || '')); });

    result.signoff = clone(result.signoff || {});
    Object.keys((remote && remote.signoff) || {}).forEach(function (stage) {
      if (!result.signoff[stage]) result.signoff[stage] = clone(remote.signoff[stage]);
    });
    result.locked = !!(result.locked || (remote && remote.locked));
    return result;
  }

  function mergeV2Records(localList, remoteList) {
    var map = {}, order = [];
    function take(list, remote) {
      (Array.isArray(list) ? list : []).forEach(function (rec) {
        if (!rec || !rec.id) return;
        var id = rec.id;
        if (!map[id]) { map[id] = clone(rec); order.push(id); return; }
        var cur = map[id];
        var winner = at(rec) > at(cur) ? clone(rec) : cur;
        var other = winner === cur ? rec : cur;
        map[id] = mergeSidecars(winner, other);
        if (remote) map[id] = mergeSidecars(map[id], rec);
      });
    }
    take(localList, false);
    take(remoteList, true);
    return order.map(function (id) { return map[id]; }).sort(function (a, b) {
      return (Date.parse(b.createdAt || 0) || 0) - (Date.parse(a.createdAt || 0) || 0);
    });
  }

  async function putIfMissing(path, current, next) {
    if (!current) await request(path, 'PUT', next);
  }

  async function pushV2Record(formId, record, remoteRaw) {
    if (!record || !record.id) return;
    var base = 'records_v2/' + nodeKey(formId) + '/' + nodeKey(record.id);
    var localData = dataOf(record);
    var remoteData = remoteRaw && remoteRaw.data;
    var remoteRecord = decodeRecord(formId, record.id, remoteRaw);

    /* 내용(data)은 작성자만 수정할 수 있다. 최신 시각이 같은 경우에는 서버 데이터를 우선한다. */
    if (!remoteData) {
      var lockAfterCreate = !!record.locked;
      var initialApprovals = {}, initialAudit = {};
      Object.keys(approvalOf(record)).forEach(function (stage) {
        initialApprovals[nodeKey(stage)] = approvalOf(record)[stage];
      });
      var initialAudits = normalizeAudit(record);
      Object.keys(initialAudits).forEach(function (id) {
        initialAudit[nodeKey(id)] = initialAudits[id];
      });
      await request(base, 'PUT', {
        data: localData,
        workflow: {
          createdByUid: record.createdByUid || '',
          createdAt: record.createdAt || new Date().toISOString(),
          updatedAt: record.updatedAt || new Date().toISOString(),
          locked: false
        },
        approvals: initialApprovals,
        audit: initialAudit
      });
      if (lockAfterCreate) {
        await request(base + '/workflow/updatedAt', 'PUT', new Date().toISOString());
        await request(base + '/workflow/locked', 'PUT', true);
      }
      return;
    } else if (at(record) > at(remoteRecord) && !same(localData, remoteData)) {
      await request(base + '/data', 'PUT', localData);
    }

    var workflow = (remoteRaw && remoteRaw.workflow) || {};
    if (record.locked && !workflow.locked) {
      await request(base + '/workflow/updatedAt', 'PUT', new Date().toISOString());
      await request(base + '/workflow/locked', 'PUT', true);
    }

    var remoteApprovals = (remoteRaw && remoteRaw.approvals) || {};
    var approvals = approvalOf(record), stages = Object.keys(approvals);
    for (var i = 0; i < stages.length; i++) {
      var stage = stages[i], stageKey = nodeKey(stage);
      if (!remoteApprovals[stageKey]) await request(base + '/approvals/' + stageKey, 'PUT', approvals[stage]);
    }

    var remoteAudit = (remoteRaw && remoteRaw.audit) || {};
    var audits = normalizeAudit(record), ids = Object.keys(audits);
    for (var j = 0; j < ids.length; j++) {
      var id = ids[j], auditKey = nodeKey(id);
      if (!remoteAudit[auditKey]) await request(base + '/audit/' + auditKey, 'PUT', audits[id]);
    }
  }

  async function v2SyncForm(formId, remoteForm) {
    var key = listKey(formId);
    var local = parse(localStorage.getItem(key)) || [];
    var remoteRaw = remoteForm || (await request('records_v2/' + nodeKey(formId), 'GET')) || {};
    var remote = [];
    Object.keys(remoteRaw || {}).forEach(function (encodedId) {
      var rec = decodeRecord(formId, readNodeKey(encodedId), remoteRaw[encodedId]);
      if (rec) remote.push(rec);
    });
    var merged = mergeV2Records(local, remote);
    if (!same(merged, local)) writeLocal(key, merged);

    var byRemoteId = {};
    Object.keys(remoteRaw || {}).forEach(function (encodedId) { byRemoteId[readNodeKey(encodedId)] = remoteRaw[encodedId]; });
    for (var i = 0; i < merged.length; i++) await pushV2Record(formId, merged[i], byRemoteId[merged[i].id]);
    return !same(merged, local);
  }

  async function v2SyncAll(silent) {
    var cloud = (await request('records_v2', 'GET')) || {};
    var forms = {}, touched = false;
    Object.keys(cloud).forEach(function (encodedForm) { forms[readNodeKey(encodedForm)] = cloud[encodedForm]; });
    var storageKeyList = storageKeys();
    for (var i = 0; i < storageKeyList.length; i++) {
      var key = storageKeyList[i], formId = formIdOf(key);
      if (formId) forms[formId] = forms[formId] || null;
    }
    var ids = Object.keys(forms);
    for (var j = 0; j < ids.length; j++) {
      if (await v2SyncForm(ids[j], forms[ids[j]])) touched = true;
    }
    markSynced();
    if (touched) {
      try { global.dispatchEvent(new CustomEvent('dkj:records-changed', { detail: { source: 'cloud', mode: 'v2' } })); } catch (e) {}
    }
    if (!silent) toast('☁️ 레코드 단위 동기화 완료');
    if (touched && !sessionStorage.getItem('dkj_cloud_v2_reloaded')) {
      sessionStorage.setItem('dkj_cloud_v2_reloaded', '1');
      setTimeout(function () { location.reload(); }, 700);
    }
  }

  async function syncAll(silent) {
    if (!ready()) return;
    var mode = await readSchemaMode();
    return mode === 'v2' ? v2SyncAll(silent) : legacySyncAll(silent);
  }

  async function syncKey(key) {
    if (!ready() || !isSyncKey(key)) return;
    var mode = await readSchemaMode();
    if (mode === 'legacy') return legacyPushKey(key);
    return v2SyncForm(formIdOf(key));
  }

  function queue(key) {
    if (!ready()) return;
    clearTimeout(timers[key]);
    timers[key] = setTimeout(function () {
      syncKey(key).then(function () { toast('☁️ 저장·동기화 완료'); })
        .catch(function (err) {
          console.info('[DkjCloudSync] 기기에 안전하게 저장됨 (클라우드 동기화 대기):', err && err.message);
        });
    }, 600);
  }

  async function removeRecord(formId, record) {
    if (!ready() || !record || !record.id) return;
    var mode = await readSchemaMode();
    if (mode === 'legacy') {
      /* 기존 배열 스키마는 다음 push에서 삭제된 배열 전체를 반영한다. */
      return legacyPushKey(listKey(formId));
    }
    if (record.locked) throw new Error('잠금 기록은 클라우드에서 삭제할 수 없습니다.');
    await request('records_v2/' + nodeKey(formId) + '/' + nodeKey(record.id), 'DELETE');
  }

  function startPoll() {
    clearInterval(poller);
    poller = setInterval(function () { if (ready()) syncAll(true).catch(function () {}); }, POLL_MS);
  }
  function start() {
    if (started || !ready()) return;
    started = true;
    syncAll(false).catch(function (err) {
      /* 오프라인-퍼스트: 연결 실패 시 붉은 경고창 대신 콘솔에만 기록하고 로컬 모드로 조용히 유지 */
      console.info('[DkjCloudSync] 오프라인 또는 로컬 모드로 동작 중입니다.', err && err.message);
    });
    startPoll();
    global.addEventListener('online', function () { syncAll(true).catch(function () {}); });

    /* 태블릿·스마트폰은 화면이 꺼지거나 다른 앱으로 전환되면 브라우저가 배터리
       절약을 위해 setInterval 타이머를 그대로 멈춰 버린다. 화면을 다시 켜거나
       탭으로 돌아왔을 때 즉시 한 번 동기화하지 않으면, 그 사이 다른 기기가 올린
       변경사항(새 기록·삭제 모두)을 다음 타이머 재개까지 무기한 놓치게 된다 —
       "PC에서 저장했는데 스마트폰엔 안 뜬다"의 흔한 원인 중 하나. */
    var lastResumeSync = 0;
    function resumeSync() {
      var now = Date.now();
      if (now - lastResumeSync < 3000) return; // 짧은 간격으로 여러 번 겹쳐 뜨는 것 방지
      lastResumeSync = now;
      if (ready()) syncAll(true).catch(function () {});
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') resumeSync();
      });
    }
    global.addEventListener('pageshow', resumeSync);
    global.addEventListener('focus', resumeSync);
  }

  /* 각 서식이 저장소 공용 API를 거치므로, 여기서 한 번만 감시하면 된다. */
  var nativeSet = Storage.prototype.setItem;
  var nativeRemove = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (key, value) {
    nativeSet.call(this, key, value);
    if (this === localStorage && !writingLocal && isSyncKey(key) && ready()) queue(key);
  };
  Storage.prototype.removeItem = function (key) {
    nativeRemove.call(this, key);
    if (this === localStorage && !writingLocal && isSyncKey(key) && ready()) queue(key);
  };

  global.DkjCloudSync = {
    start: start,
    ready: ready,
    sync: function () { return syncAll(false); },
    lastSync: function () { try { return localStorage.getItem(LAST_SYNC_KEY); } catch (e) { return null; } },
    isSyncKey: isSyncKey,
    mergeRecords: mergeRecords,
    schemaMode: function () { return schemaMode; },
    removeRecord: removeRecord,
    nodeKey: nodeKey,
    readNodeKey: readNodeKey
  };
})(window);
