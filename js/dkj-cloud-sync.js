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
  function recordStorage() { return window.DkjStorage || window.localStorage; }

  if (global.DkjCloudSync) return;

  var CFG = global.DKJ_FIREBASE || {};
  var KEY_RE = /^dkj:records:([^:]+):list:v1$/;
  var LAST_SYNC_KEY = 'dkj:cloud:last_sync:v2';
  var POLL_MS = 30000;
  var schemaMode = null; // 'legacy' | 'v2'
  var writingLocal = false, timers = {}, poller = null, started = false;
  // 메모리 캐시는 이 화면에서 확인한 변경 번호 + 이 기기 기록 원문이다. 새로 열었을 때는
  // 아래 REV_CACHE_KEY 에 남긴 번호를 쓰되, 이 기기 기록의 SHA-256 이 같을 때만 믿는다
  // (기록이 없어졌거나 바뀌었으면 믿지 않고 전체를 받아 검증한다).
  var legacyCache = Object.create(null), localVersions = Object.create(null);
  // 화면을 새로 열 때마다 위 메모리 캐시가 비워져 모든 서식의 기록을 처음부터 다시 받던 것이
  // 한 달 45GB 다운로드의 원인이었다(저장량은 5MB). 키별로 '마지막으로 확인한 클라우드 변경
  // 번호'와 '그때 이 기기 기록의 SHA-256'을 IndexedDB 에 남겨, 새로 열었을 때 둘 다 그대로면
  // 다운로드를 건너뛴다. 해시가 다르면(기록이 없어졌거나 바뀜) 예전처럼 전체를 받아 검증한다.
  var REV_CACHE_KEY = 'dkj:cache:cloud-revisions:v1';
  var revMap = null, revDirty = false;
  function sha(raw) {
    var M = global.DkjStorageMigration;
    return (M && typeof M.hash === 'function' && global.crypto && global.crypto.subtle && typeof raw === 'string')
      ? M.hash(raw) : Promise.resolve(null);
  }
  async function loadRevMap() {
    if (revMap) return revMap;
    revMap = Object.create(null);
    try {
      var raw = global.DkjStore && typeof global.DkjStore.get === 'function' ? await global.DkjStore.get(REV_CACHE_KEY) : null;
      var saved = raw ? JSON.parse(raw) : null;
      if (saved && typeof saved === 'object') Object.keys(saved).forEach(function (k) { revMap[k] = saved[k]; });
    } catch (e) { /* 캐시가 없거나 깨졌으면 예전처럼 전체를 받는다 */ }
    return revMap;
  }
  async function rememberRevision(key, revision, raw) {
    var hash = await sha(raw);
    if (!hash) return;
    (await loadRevMap())[key] = { revision: revision, localHash: hash };
    revDirty = true;
  }
  async function flushRevMap() {
    if (!revDirty || !revMap || !global.DkjStore || typeof global.DkjStore.set !== 'function') return;
    revDirty = false;
    try { await global.DkjStore.set(REV_CACHE_KEY, JSON.stringify(revMap)); } catch (e) { revDirty = true; }
  }
  var syncFlight = null, operationTail = Promise.resolve();
  function visible() { return typeof document === 'undefined' || document.visibilityState !== 'hidden'; }
  function exclusive(work) {
    var result = operationTail.then(work, work);
    operationTail = result.catch(function () {});
    return result;
  }
  function localChanged(key) {
    localVersions[key] = (localVersions[key] || 0) + 1;
    delete legacyCache[key];
    pendingKeys[key] = localVersions[key];
    notifyStatus();
  }

  // 화면 안내용 메모리 상태. 기록·동기화 저장 형식은 변경하지 않는다.
  var syncStatus = 'waiting', pendingKeys = Object.create(null), activeSyncs = 0;
  function notifyStatus() {
    try { global.dispatchEvent(new CustomEvent('dkj:sync-status')); } catch (e) {}
  }
  function observeSync(work, key) {
    var versions = Object.assign({}, localVersions);
    activeSyncs++;
    notifyStatus();
    return Promise.resolve(work).then(function (value) {
      if (key) {
        if (pendingKeys[key] === versions[key]) delete pendingKeys[key];
      } else {
        Object.keys(pendingKeys).forEach(function (k) {
          if (pendingKeys[k] === versions[k]) delete pendingKeys[k];
        });
      }
      syncStatus = 'success';
      return value;
    }, function (error) { syncStatus = 'error'; throw error; }).finally(function () {
      activeSyncs--; notifyStatus();
    });
  }
  async function describeStatus() {
    var last = null;
    try { last = await recordStorage().getItem(LAST_SYNC_KEY); } catch (e) {}
    var label = !ready() ? '클라우드 동기화 사용 안 함 (설정·로그인 확인)' :
      ((global.navigator && global.navigator.onLine === false) ? '오프라인 · 동기화 대기' :
      (activeSyncs ? '클라우드 동기화 진행 중' :
      (syncStatus === 'error' ? '클라우드 동기화 실패 · 재시도 필요' :
      (Object.keys(pendingKeys).length ? '변경 기록 동기화 대기' :
      (syncStatus === 'success' ? '클라우드 동기화 성공' : '클라우드 동기화 확인 대기')))));
    return label + ' · 마지막 전체 동기화 성공: ' +
      (last ? new Date(last).toLocaleString('ko-KR', {timeZone:'Asia/Seoul'}) : '확인 이력 없음');
  }

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
      el.style.cssText = 'position:fixed;left:18px;bottom:calc(96px + var(--dkj-pwa-bar-h, 0px));z-index:2147483647;padding:7px 12px;' +
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

  async function request(path, method, data, retried, shallow) {
    if (global.DkjStorage) await global.DkjStorage.ready();
    var root = String(CFG.databaseURL || '').replace(/\/$/, '') + '/' + (CFG.root || 'dkj-fssc22000');
    var token = auth().token();
    var authParam = isRealToken(token) ? ('?auth=' + encodeURIComponent(token)) : '';
    // 다른 기기가 방금 올린 내용이 브라우저(또는 중간 프록시)의 GET 캐시에 걸려서
    // "동기화 성공"인데 실제로는 옛 응답을 그대로 다시 보여주는 상황을 막는다 —
    // cache:'no-store'만으로는 프록시 캐시까지 못 뚫는 경우가 있어 타임스탬프도 같이 붙인다.
    var bust = (authParam ? '&' : '?') + '_=' + Date.now();
    var url = root + (path ? '/' + path : '') + '.json' + authParam + bust + (shallow ? '&shallow=true' : '');
    // Bound both response headers and JSON body parsing so one hung request
    // cannot hold the serialized save queue forever. Race also covers browsers
    // without AbortController (or transports that ignore its signal).
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    // Without cancellation, a timed-out PUT could finish after a newer save.
    // Fail closed for writes on such old browsers; local records stay intact.
    if (!controller && method && method !== 'GET') throw new Error('AbortController required for safe cloud writes');
    var timeoutId, r;
    var transport = (async function () {
      var response = await fetch(url, {
        method: method || 'GET',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: data === undefined ? undefined : JSON.stringify(data),
        signal: controller ? controller.signal : undefined
      });
      return { status: response.status, ok: response.ok,
        payload: response.ok ? await response.json() : null };
    })();
    var timeout = new Promise(function (resolve, reject) {
      timeoutId = setTimeout(function () {
        reject(new Error('Cloud request timed out after 15000ms'));
        if (controller) controller.abort();
      }, 15000);
    });
    try { r = await Promise.race([transport, timeout]); }
    finally { clearTimeout(timeoutId); }
    if (r.status === 401) {
      /* 로컬 계정 세션(가짜 토큰)이면 재인증할 진짜 Firebase 자격이 애초에 없으므로 재시도해도
       * 똑같이 401이 난다 — 무한 재시도 루프를 막기 위해 한 번만 시도하고, 진짜 토큰이었을 때만
       * 재인증을 건다. */
      if (retried || !isRealToken(token)) throw new Error('HTTP 401');
      await auth().reauth();
      return request(path, method, data, true, shallow);
    }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.payload;
  }

  async function readSchemaMode() {
    if (schemaMode) return schemaMode;
    var raw = await request('sync_meta/schemaVersion', 'GET');
    schemaMode = Number(raw) === 2 ? 'v2' : 'legacy';
    return schemaMode;
  }

  // 클라우드 병합으로 이 기기의 기록이 다른 내용으로 바뀌면, 바뀌기 전 버전을 이력에 남긴다
  // (updatedAt 이 더 늦은 쪽이 통째로 이기므로, 사진·시간이 빠진 사본이 이겨도 되살릴 수 있게).
  async function archiveReplaced(key, expectedRaw, mergedList) {
    var H = global.DkjRecordStore && global.DkjRecordStore.History;
    var m = key.match(KEY_RE);
    if (!H || !m || !global.DkjStore || !expectedRaw) return;
    try {
      var before = JSON.parse(expectedRaw);
      var nextById = {};
      mergedList.forEach(function (r) { if (r && r.id) nextById[r.id] = r; });
      var replaced = (Array.isArray(before) ? before : []).filter(function (r) {
        return r && r.id && !r.deleted && nextById[r.id] && JSON.stringify(nextById[r.id]) !== JSON.stringify(r);
      });
      if (!replaced.length) return;
      var hk = H.key(m[1]);
      var cur = await global.DkjStore.get(hk);
      await global.DkjStore.set(hk, JSON.stringify(H.add(H.parse(cur), replaced, 'sync')));
    } catch (e) { console.error('[DkjCloudSync] 병합 전 버전 보관 실패', e); }
  }

  async function writeLocal(key, list, expected) {
    if (global.DkjStorage) {
      return global.DkjStorage.exclusive(async function () {
        if (await global.DkjStorage.getItem(key) !== expected) return false;
        await archiveReplaced(key, expected, list);
        writingLocal = true;
        try { await global.DkjStorage.setItem(key, JSON.stringify(list)); }
        finally { writingLocal = false; }
        return true;
      });
    }
    writingLocal = true;
    try { localStorage.setItem(key, JSON.stringify(list)); }
    finally { writingLocal = false; }
    return true;
  }
  async function markSynced() {
    try { (await recordStorage().setItem(LAST_SYNC_KEY, new Date().toISOString())); } catch (e) {}
  }

  /* ------------------------------ 기존 배열 스키마 ------------------------------ */

  /* ------------------------------ 월 시트 셀 단위 병합 ------------------------------
   * 월 단위 대장(DKJ-S-02-05 등)은 한 달 치가 기록 한 건이다. 기록 단위로 'updatedAt 이 늦은 쪽이
   * 통째로 이기면', 태블릿이 1일 칸을 쓰고 PC가 2일 칸을 쓴 뒤 동기화될 때 한쪽 입력이 통째로
   * 사라진다(오래 열어 둔 화면이 저장해도 마찬가지). 그래서 행 고정 대장은 저장할 때 바뀐 칸에만
   * 시각(cellStamps['행|열'] = epoch ms)을 남기고, 병합은 칸마다 시각이 늦은 쪽을 고른다.
   * 두 쪽 모두 cellStamps 가 있는 기록에만 적용하고(옛 기록은 종전 규칙), 어느 한쪽이 작성완료
   * (잠금)이거나 행 수·점검 월이 다르면 종전처럼 기록 단위로 고른다. */
  var Sheet = {
    ok: function (rec) {
      return !!rec && typeof rec === 'object' && !rec.deleted && Array.isArray(rec.rows) &&
        !!rec.cellStamps && typeof rec.cellStamps === 'object';
    },
    sk: function (ri, key) { return ri + '|' + key; },
    eq: function (a, b) { return String(a == null ? '' : a) === String(b == null ? '' : b); },
    /** local.rows 중 base 와 달라진 칸에 now 를 찍는다(local.cellStamps 를 제자리에서 갱신). */
    stamp: function (base, local, now) {
      if (!Array.isArray(base) || !Array.isArray(local.rows) || base.length !== local.rows.length) return 0;
      if (!local.cellStamps || typeof local.cellStamps !== 'object') local.cellStamps = {};
      var n = 0;
      local.rows.forEach(function (row, ri) {
        Object.keys(row || {}).forEach(function (k) {
          if (!Sheet.eq(row[k], (base[ri] || {})[k])) { local.cellStamps[Sheet.sk(ri, k)] = now; n++; }
        });
      });
      return n;
    },
    /** 두 사본을 칸 단위로 합친 새 기록. 합칠 수 없으면 null(기록 단위 규칙으로). */
    merge: function (a, b) {
      if (!Sheet.ok(a) || !Sheet.ok(b) || a.locked || b.locked) return null;
      if (a.rows.length !== b.rows.length) return null;
      var ma = a.info && a.info.month, mb = b.info && b.info.month;
      if (ma != null && mb != null && String(ma) !== String(mb)) return null;
      var ta = at(a), tb = at(b);
      var win = ta !== tb ? (ta > tb ? a : b) : (JSON.stringify(a) >= JSON.stringify(b) ? a : b);
      var out = clone(win), stamps = {};
      out.rows.forEach(function (row, ri) {
        var other = (win === a ? b : a).rows[ri] || {};
        var keys = Object.keys(Object.assign({}, other, row));
        keys.forEach(function (k) {
          var id = Sheet.sk(ri, k), sw = win.cellStamps[id] || 0, so = (win === a ? b : a).cellStamps[id] || 0;
          if (so > sw) { row[k] = other[k]; stamps[id] = so; }
          else if (sw) stamps[id] = sw;
        });
      });
      out.cellStamps = stamps;
      return out;
    },
    /** 화면 갱신용: local 에서 base 와 같은(=이 화면에서 안 바꾼) 칸만 stored 의 값으로 바꾸고
     *  base 도 같이 맞춘다. 바꾼 칸의 (행, 열) 목록을 돌려준다. */
    absorb: function (base, local, stored) {
      var hits = [];
      if (!Array.isArray(base) || !Array.isArray(local.rows) || base.length !== local.rows.length) return hits;
      if (!stored || stored.deleted || !Array.isArray(stored.rows) || stored.rows.length !== local.rows.length) return hits;
      if (!local.cellStamps || typeof local.cellStamps !== 'object') local.cellStamps = {};
      local.rows.forEach(function (row, ri) {
        var theirs = stored.rows[ri] || {}, mine = base[ri] || (base[ri] = {});
        Object.keys(Object.assign({}, theirs, row)).forEach(function (k) {
          if (!Sheet.eq(row[k], mine[k])) return;          // 이 화면에서 바꾼 칸
          if (Sheet.eq(row[k], theirs[k])) return;
          row[k] = mine[k] = theirs[k] == null ? '' : theirs[k];
          var id = Sheet.sk(ri, k), st = stored.cellStamps && stored.cellStamps[id];
          if (st) local.cellStamps[id] = st; else delete local.cellStamps[id];
          hits.push([ri, k]);
        });
      });
      return hits;
    },
    /** 저장 직전: base(화면에 불러올 때·마지막 저장 때의 rows)와 비교해 이 화면에서 바꾼 칸만 남기고,
     *  바꾸지 않은 칸은 저장소의 최신 값을 받는다. local 을 제자리에서 고치고 받아온 칸 수를 돌려준다. */
    rebase: function (base, local, stored, now) {
      if (!Array.isArray(base) || !Array.isArray(local.rows) || base.length !== local.rows.length) return 0;
      Sheet.stamp(base, local, now);
      var got = 0;
      if (stored && !stored.deleted && Array.isArray(stored.rows) && stored.rows.length === local.rows.length) {
        local.rows.forEach(function (row, ri) {
          var theirs = stored.rows[ri] || {};
          Object.keys(Object.assign({}, theirs, row)).forEach(function (k) {
            var id = Sheet.sk(ri, k);
            if (local.cellStamps && local.cellStamps[id] === now) return; // 이 화면에서 방금 바꾼 칸
            if (Sheet.eq(row[k], theirs[k])) return;
            row[k] = theirs[k] == null ? '' : theirs[k];
            var st = stored.cellStamps && stored.cellStamps[id];
            if (st) local.cellStamps[id] = st; else delete local.cellStamps[id];
            got++;
          });
        });
      }
      return got;
    }
  };

  function mergeRecords(a, b) {
    var byId = {}, order = [];
    function take(list) {
      (Array.isArray(list) ? list : []).forEach(function (rec) {
        if (!rec || typeof rec !== 'object') return;
        var id = rec.id || JSON.stringify(rec);
        var cur = byId[id];
        if (!cur) { byId[id] = rec; order.push(id); return; }
        var cells = Sheet.merge(cur, rec);
        if (cells) byId[id] = cells;
        else if (at(rec) > at(cur)) byId[id] = rec;
      });
    }
    take(a); take(b);
    return order.map(function (id) { return byId[id]; }).sort(function (x, y) {
      return (Date.parse(y.createdAt || 0) || 0) - (Date.parse(x.createdAt || 0) || 0);
    });
  }

  async function legacyPushKey(key) {
    if (!isSyncKey(key)) return;
    var raw = (await recordStorage().getItem(key));
    var value = parse(raw);
    if (!Array.isArray(value)) return;
    var version = localVersions[key] || 0;
    delete legacyCache[key];
    var stamp = Date.now();
    await request('records/' + nodeKey(key), 'PUT', {
      value: value,
      updatedAt: stamp,
      updatedBy: (auth().user() && auth().user().name) || '',
      device: navigator.userAgent.slice(0, 120)
    });
    // 방금 올린 내용이 곧 클라우드의 최신본이다. 캐시를 지운 채 두면 30초 뒤 동기화가
    // 내가 올린 목록 전체를 다시 내려받는다. 올리는 동안 기록이 바뀌지 않았을 때만 기억한다.
    if ((localVersions[key] || 0) === version && (await recordStorage().getItem(key)) === raw) {
      legacyCache[key] = { revision: stamp, localRaw: raw };
      await rememberRevision(key, stamp, raw);
      await flushRevMap();
    }
    // 실시간 알림 — 다른 기기가 sync_pings 를 구독하고 있으면 이 번호를 보고 바로 이 서식만 받아 간다.
    // 규칙이 아직 열려 있지 않거나 실패해도 기록 저장에는 영향이 없다(30초 주기 확인이 그대로 받쳐 준다).
    request('sync_pings/' + nodeKey(key), 'PUT', stamp).catch(function () {});
  }

  function storageKeys() {
    if (global.DkjStorage) return global.DkjStorage.keys();
    var keys = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k != null) keys.push(k);
      }
    } catch (e) {}
    return keys;
  }

  async function localSnapshot() {
    var out = Object.create(null);
    (await DkjAsync.forEach((await storageKeys()), async function (key) {
      if (isSyncKey(key)) out[key] = { raw: (await recordStorage().getItem(key)), version: localVersions[key] || 0 };
    }));
    return out;
  }
  async function unchangedSince(snapshot, key) {
    var initial = snapshot[key] || { raw: null, version: 0 };
    return (await recordStorage().getItem(key)) === initial.raw && (localVersions[key] || 0) === initial.version;
  }

  /* 서식 하나(키 하나)만 클라우드와 맞춘다 — 전체 동기화 루프와 실시간 알림 수신이 함께 쓴다. */
  async function legacyPullOne(encodedKey, key, initialLocal, stats, knownRevision) {
      var revision = knownRevision !== undefined ? knownRevision : await request('records/' + encodedKey + '/updatedAt', 'GET');
      if (!(await unchangedSince(initialLocal, key))) return;
      var before = (await recordStorage().getItem(key));
      var localVal = parse(before);
      var cached = legacyCache[key];
      var hasRevision = (typeof revision === 'number' && isFinite(revision)) ||
        (typeof revision === 'string' && revision.length > 0);
      if (!cached && hasRevision && Array.isArray(localVal) && before) {
        var saved = (await loadRevMap())[key];
        if (saved && saved.localHash && saved.revision === revision && (await sha(before)) === saved.localHash) {
          legacyCache[key] = { revision: revision, localRaw: before };
          return;
        }
      }
      if (hasRevision && cached && cached.revision === revision &&
          Array.isArray(localVal) && before === cached.localRaw) return;
      var version = localVersions[key] || 0;
      var row = await request('records/' + encodedKey, 'GET');
      // A save/removal during the network read must not be replaced by a stale merge.
      if ((localVersions[key] || 0) !== version || (await recordStorage().getItem(key)) !== before) return;
      localVal = Array.isArray(localVal) ? localVal : [];
      if (!row || !Array.isArray(row.value)) {
        // 클라우드 쪽 value 가 배열이 아니다 — 예전 버그로 빈 배열([])이 올라갔다가
        // RTDB 가 빈 배열 속성 자체를 지워버린 경우가 여기 걸린다. 이 상태로 두면
        // 이 서식은 어느 기기가 동기화를 돌려도 영원히 건너뛰기만 해서 스스로 못 고친다.
        // 이 기기에 유효한 기록이 있으면 그걸로 덮어써 복구한다.
        if (localVal.length) { await legacyPushKey(key); stats.pushedUpdated++; }
        return;
      }
      var merged = mergeRecords(localVal, row.value);
      if (!same(merged, localVal)) { if (!await writeLocal(key, merged, before)) return; stats.touched++; }
      var mergedRaw = (await recordStorage().getItem(key));
      if (!same(merged, row.value)) { await legacyPushKey(key); stats.pushedUpdated++; }
      else if (hasRevision && row.updatedAt === revision &&
          (localVersions[key] || 0) === version && (await recordStorage().getItem(key)) === mergedRaw) {
        legacyCache[key] = { revision: revision, localRaw: mergedRaw };
        await rememberRevision(key, revision, mergedRaw);
      }
  }

  async function legacySyncAll(silent) {
    var initialLocal = (await localSnapshot());
    var cloud = (await request('records', 'GET', undefined, false, true)) || {};
    var stats = { touched: 0, pushedUpdated: 0 }, pushedNew = 0;
    var keys = Object.keys(cloud);
    var cloudKeyCount = 0;
    for (var i = 0; i < keys.length; i++) {
      var encodedKey = keys[i];
      var key = readNodeKey(encodedKey);
      if (!isSyncKey(key)) continue;
      cloudKeyCount++;
      await legacyPullOne(encodedKey, key, initialLocal, stats);
    }
    var localKeys = (await storageKeys());
    for (var i = 0; i < localKeys.length; i++) {
      var k = localKeys[i];
      if (isSyncKey(k) && !cloud[nodeKey(k)]) { await legacyPushKey(k); pushedNew++; }
    }
    (await flushRevMap());
    (await markSynced());
    var touched = stats.touched, pushedUpdated = stats.pushedUpdated;
    if (touched) {
      try { global.dispatchEvent(new CustomEvent('dkj:records-changed', { detail: { source: 'cloud', mode: 'legacy' } })); } catch (e) {}
    }
    if (!silent) toast('☁️ 클라우드 동기화 성공');
    if (touched && !sessionStorage.getItem('dkj_cloud_reloaded')) {
      sessionStorage.setItem('dkj_cloud_reloaded', '1');
      setTimeout(function () { location.reload(); }, 700);
    }
    return { mode: 'legacy', cloudKeyCount: cloudKeyCount, pulled: touched, pushedNew: pushedNew, pushedUpdated: pushedUpdated };
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
    var before = (await recordStorage().getItem(key)), version = localVersions[key] || 0;
    // V2 approvals/audit can change without workflow/data timestamps changing.
    // Keep full reads until all writers provide a reliable aggregate revision.
    var remoteRaw = remoteForm || (await request('records_v2/' + nodeKey(formId), 'GET')) || {};
    if ((localVersions[key] || 0) !== version || (await recordStorage().getItem(key)) !== before) return false;
    var local = parse((await recordStorage().getItem(key))) || [];
    var remote = [];
    Object.keys(remoteRaw || {}).forEach(function (encodedId) {
      var rec = decodeRecord(formId, readNodeKey(encodedId), remoteRaw[encodedId]);
      if (rec) remote.push(rec);
    });
    var merged = mergeV2Records(local, remote);
    if (!same(merged, local) && !await writeLocal(key, merged, before)) return false;

    var byRemoteId = {};
    Object.keys(remoteRaw || {}).forEach(function (encodedId) { byRemoteId[readNodeKey(encodedId)] = remoteRaw[encodedId]; });
    for (var i = 0; i < merged.length; i++) await pushV2Record(formId, merged[i], byRemoteId[merged[i].id]);
    return !same(merged, local);
  }

  async function v2SyncAll(silent) {
    var initialLocal = (await localSnapshot());
    var cloud = (await request('records_v2', 'GET')) || {};
    var forms = {}, touched = false;
    Object.keys(cloud).forEach(function (encodedForm) { forms[readNodeKey(encodedForm)] = cloud[encodedForm]; });
    var storageKeyList = (await storageKeys());
    for (var i = 0; i < storageKeyList.length; i++) {
      var key = storageKeyList[i], formId = formIdOf(key);
      if (formId) forms[formId] = forms[formId] || null;
    }
    var ids = Object.keys(forms);
    for (var j = 0; j < ids.length; j++) {
      if (!(await unchangedSince(initialLocal, listKey(ids[j])))) continue;
      if (await v2SyncForm(ids[j], forms[ids[j]])) touched = true;
    }
    (await markSynced());
    if (touched) {
      try { global.dispatchEvent(new CustomEvent('dkj:records-changed', { detail: { source: 'cloud', mode: 'v2' } })); } catch (e) {}
    }
    if (!silent) toast('☁️ 레코드 단위 동기화 완료');
    if (touched && !sessionStorage.getItem('dkj_cloud_v2_reloaded')) {
      sessionStorage.setItem('dkj_cloud_v2_reloaded', '1');
      setTimeout(function () { location.reload(); }, 700);
    }
  }

  function syncAll(silent) {
    if (!ready() || (silent && !visible())) return Promise.resolve();
    if (syncFlight) return syncFlight;
    syncFlight = observeSync(exclusive(async function () {
      if (!ready() || (silent && !visible())) return;
      var mode = await readSchemaMode();
      return mode === 'v2' ? v2SyncAll(silent) : legacySyncAll(silent);
    }));
    var flight = syncFlight;
    flight.then(function () { if (syncFlight === flight) syncFlight = null; },
      function () { if (syncFlight === flight) syncFlight = null; });
    return flight;
  }

  function syncKey(key) {
    return observeSync(exclusive(async function () {
      if (!ready() || !isSyncKey(key)) return;
      var mode = await readSchemaMode();
      if (mode === 'legacy') return legacyPushKey(key);
      return v2SyncForm(formIdOf(key));
    }), key);
  }

  function queue(key) {
    if (!ready()) return;
    clearTimeout(timers[key]);
    timers[key] = setTimeout(function () {
      syncKey(key).then(function () { toast('☁️ 저장·동기화 완료'); })
        .catch(function (err) {
          console.info('[DkjCloudSync] 기기에 안전하게 저장됨 (클라우드 동기화 대기):', err && err.message);
        });
    }, 250);
  }

  async function removeRecordNow(formId, record) {
    if (!ready() || !record || !record.id) return;
    var mode = await readSchemaMode();
    if (mode === 'legacy') {
      /* 기존 배열 스키마는 다음 push에서 삭제된 배열 전체를 반영한다. */
      return legacyPushKey(listKey(formId));
    }
    if (record.locked) throw new Error('잠금 기록은 클라우드에서 삭제할 수 없습니다.');
    await request('records_v2/' + nodeKey(formId) + '/' + nodeKey(record.id), 'DELETE');
  }

  function removeRecord(formId, record) {
    return exclusive(function () { return removeRecordNow(formId, record); });
  }


  /* ------------------------------ 실시간 알림 수신 ------------------------------
   * RTDB 의 sync_pings/<서식키> = 마지막 저장 시각(숫자) 한 줄만 서버-전송 이벤트로 구독한다.
   * 기록 본문은 흘려보내지 않으므로(첫 연결도 80줄 남짓의 숫자뿐) 다운로드가 늘지 않는다.
   * 알림이 오면 내가 아는 번호와 다를 때만 그 서식 하나를 받아 병합한다. 구독이 끊기거나
   * 규칙이 없어 거부되면 조용히 멈추고 30초 주기 확인이 그대로 일한다. */
  var stream = null, streamOpenedOnce = false, streamRetry = null, pullPending = Object.create(null);
  function streamUrl() {
    var root = String(CFG.databaseURL || '').replace(/\/$/, '') + '/' + (CFG.root || 'dkj-fssc22000');
    var token = auth().token();
    return root + '/sync_pings.json' + (isRealToken(token) ? ('?auth=' + encodeURIComponent(token)) : '');
  }
  function pullFromPing(encodedKey, rev) {
    var key = readNodeKey(encodedKey);
    if (!isSyncKey(key) || typeof rev !== 'number') return;
    var known = legacyCache[key];
    if (known && known.revision === rev) return;      // 내가 올린 것이거나 이미 받은 것
    if (pullPending[key] === rev) return;
    pullPending[key] = rev;
    exclusive(async function () {
      if (!ready() || schemaMode === 'v2') return;
      var snap = Object.create(null);
      snap[key] = { raw: (await recordStorage().getItem(key)), version: localVersions[key] || 0 };
      var stats = { touched: 0, pushedUpdated: 0 };
      await legacyPullOne(encodedKey, key, snap, stats, rev);
      await flushRevMap();
      if (stats.touched) {
        try { global.dispatchEvent(new CustomEvent('dkj:records-changed', { detail: { source: 'cloud', mode: 'legacy', key: key, live: true } })); } catch (e) {}
      }
    }).catch(function () {}).then(function () { if (pullPending[key] === rev) delete pullPending[key]; });
  }
  function onPing(ev) {
    var msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
    if (!msg || typeof msg.path !== 'string' || msg.path === '/') return; // 첫 스냅샷은 시작 동기화가 맡는다
    pullFromPing(msg.path.replace(/^\//, '').split('/')[0], msg.data);
  }
  function stopStream(retryMs) {
    if (stream) { try { stream.close(); } catch (e) {} stream = null; }
    clearTimeout(streamRetry);
    if (retryMs) streamRetry = setTimeout(startStream, retryMs);
  }
  function startStream() {
    if (stream || !ready() || !global.EventSource) return;
    var es;
    try { es = new EventSource(streamUrl()); } catch (e) { return; }
    stream = es;
    es.addEventListener('put', onPing);
    es.addEventListener('patch', onPing);
    es.addEventListener('cancel', function () { stopStream(60000); });
    es.addEventListener('auth_revoked', function () { stopStream(60000); });
    es.onopen = function () {
      // 끊겼다가 다시 이어졌다면 그 사이 놓친 변경을 한 번 따라잡는다
      if (streamOpenedOnce && visible()) syncAll(true).catch(function () {});
      streamOpenedOnce = true;
    };
    es.onerror = function () {
      // CLOSED 면 브라우저가 재연결을 포기한 것(규칙 거부 등) — 1분 뒤 다시 시도
      if (es.readyState === 2) stopStream(60000);
    };
  }

  function startPoll() {
    clearInterval(poller);
    poller = setInterval(function () { if (ready() && visible()) syncAll(true).catch(function () {}); }, POLL_MS);
  }
  function start() {
    if (started || !ready()) return;
    started = true;
    syncAll(true).catch(function (err) {
      /* 오프라인-퍼스트: 연결 실패 시 붉은 경고창 대신 콘솔에만 기록하고 로컬 모드로 조용히 유지 */
      console.info('[DkjCloudSync] 오프라인 또는 로컬 모드로 동작 중입니다.', err && err.message);
    });
    startPoll();
    startStream();


    /* 태블릿·스마트폰은 화면이 꺼지거나 다른 앱으로 전환되면 브라우저가 배터리
       절약을 위해 setInterval 타이머를 그대로 멈춰 버린다. 화면을 다시 켜거나
       탭으로 돌아왔을 때 즉시 한 번 동기화하지 않으면, 그 사이 다른 기기가 올린
       변경사항(새 기록·삭제 모두)을 다음 타이머 재개까지 무기한 놓치게 된다 —
       "PC에서 저장했는데 스마트폰엔 안 뜬다"의 흔한 원인 중 하나. */
    var lastResumeSync = Date.now();
    function resumeSync() {
      if (!ready() || !visible()) return;
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
    global.addEventListener('online', resumeSync);
    global.addEventListener('pageshow', resumeSync);
    global.addEventListener('focus', resumeSync);
  }

  global.addEventListener('dkj:storage-changed', function (event) {
    var key = event.detail && event.detail.key;
    if (isSyncKey(key) && !writingLocal) { localChanged(key); if (ready()) queue(key); }
  });

  /* 각 서식이 저장소 공용 API를 거치므로, 여기서 한 번만 감시하면 된다. */
  var nativeSet = Storage.prototype.setItem;
  var nativeRemove = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (key, value) {
    nativeSet.call(this, key, value);
    if (this === localStorage && !writingLocal && isSyncKey(key)) {
      localChanged(key);
      if (ready()) queue(key);
    }
  };
  Storage.prototype.removeItem = function (key) {
    nativeRemove.call(this, key);
    if (this === localStorage && !writingLocal && isSyncKey(key)) {
      localChanged(key);
      if (ready()) queue(key);
    }
  };

  global.DkjCloudSync = {
    start: start,
    ready: ready,
    describeStatus: describeStatus,
    sync: function () { return syncAll(false); },
    lastSync: async function () { try { return (await recordStorage().getItem(LAST_SYNC_KEY)); } catch (e) { return null; } },
    isSyncKey: isSyncKey,
    mergeRecords: mergeRecords,
    sheet: Sheet,
    archiveReplaced: archiveReplaced,
    schemaMode: function () { return schemaMode; },
    removeRecord: removeRecord,
    nodeKey: nodeKey,
    readNodeKey: readNodeKey
  };
})(window);
