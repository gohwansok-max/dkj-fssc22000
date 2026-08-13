/**
 * 동김제농협 기록 클라우드 동기화 (Firebase Realtime Database).
 *
 * 왜 필요한가 — 기록이 태블릿 브라우저(localStorage)에만 있으면 캐시 정리·기기 교체
 * 한 번에 전부 사라진다. HACCP 기록은 보존 대상이라 그러면 안 된다.
 *
 * 동기화 대상: dkj:records:<서식>:list:v1  (저장 완료된 기록)
 *   - 작성 중 임시저장(:draft:v1)은 제외 — 기기별 작업 중 상태라 섞이면 오히려 위험하다.
 *
 * 병합 방식: 키 통째로 덮어쓰지 않고 기록 1건 단위로 합친다.
 *   같은 id 가 양쪽에 있으면 updatedAt 이 나중인 쪽을 남긴다. 태블릿 두 대에서
 *   서로 다른 기록을 쓰는 게 정상 상황이라, 통째 덮어쓰기는 기록 유실을 만든다.
 *
 * 인증: js/dkj-auth.js 의 직원별 로그인 세션을 그대로 쓴다(비밀번호는 여기 없음).
 */
(function (global) {
  'use strict';
  if (global.DkjCloudSync) return;

  var CFG = global.DKJ_FIREBASE || {};
  var KEY_RE = /^dkj:records:[^:]+:list:v1$/;
  var LAST_SYNC_KEY = 'dkj:cloud:last_sync:v1';
  var POLL_MS = 30000;

  var writingLocal = false, timers = {}, poller = null, started = false;

  function auth() { return global.DkjAuth; }
  function ready() { return !!(CFG.apiKey && CFG.databaseURL && auth() && auth().token()); }
  function isSyncKey(k) { return !!k && KEY_RE.test(k); }

  function enc(key) {
    return btoa(unescape(encodeURIComponent(key)))
      .replace(/\//g, '_').replace(/\+/g, '-').replace(/=+$/, '');
  }
  function dec(key) {
    try {
      var s = key.replace(/_/g, '/').replace(/-/g, '+');
      while (s.length % 4) s += '=';
      return decodeURIComponent(escape(atob(s)));
    } catch (e) { return ''; }
  }
  function parse(raw) { try { return JSON.parse(raw); } catch (e) { return null; } }

  function toast(msg, bad) {
    var el = document.getElementById('dkj-cloud-status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dkj-cloud-status';
      el.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483647;padding:7px 12px;' +
        'border-radius:18px;color:#fff;font:600 12px "Noto Sans KR",sans-serif;box-shadow:0 2px 10px #0004';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.background = bad ? '#b91c1c' : '#009a44';
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.display = 'none'; }, 3000);
  }

  async function request(path, method, data) {
    var url = CFG.databaseURL + '/' + (CFG.root || 'dkj-fssc22000') + '/records/' + path +
              '.json?auth=' + encodeURIComponent(auth().token());
    var r = await fetch(url, {
      method: method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data)
    });
    if (r.status === 401) {
      await auth().reauth();
      return request(path, method, data);   // 갱신된 토큰으로 한 번만 재시도
    }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  /** 기록 배열 두 개를 id 기준으로 합친다 — 같은 id 는 updatedAt 이 최신인 쪽. */
  function mergeRecords(a, b) {
    var byId = {}, order = [];
    function take(list) {
      (Array.isArray(list) ? list : []).forEach(function (rec) {
        if (!rec || typeof rec !== 'object') return;
        var id = rec.id || JSON.stringify(rec);
        var cur = byId[id];
        if (!cur) { byId[id] = rec; order.push(id); return; }
        var curAt = Date.parse(cur.updatedAt || cur.createdAt || 0) || 0;
        var newAt = Date.parse(rec.updatedAt || rec.createdAt || 0) || 0;
        if (newAt > curAt) byId[id] = rec;
      });
    }
    take(a); take(b);
    return order.map(function (id) { return byId[id]; }).sort(function (x, y) {
      return (Date.parse(y.createdAt || 0) || 0) - (Date.parse(x.createdAt || 0) || 0);
    });
  }

  function sameLength(a, b) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length;
  }

  async function pushKey(key) {
    if (!ready() || !isSyncKey(key)) return;
    var value = parse(localStorage.getItem(key));
    if (!Array.isArray(value)) return;
    await request(enc(key), 'PUT', {
      value: value,
      updatedAt: Date.now(),
      updatedBy: (auth().user() && auth().user().name) || '',
      device: navigator.userAgent.slice(0, 120)
    });
    try { localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString()); } catch (e) {}
  }

  function queue(key) {
    clearTimeout(timers[key]);
    timers[key] = setTimeout(function () {
      pushKey(key).then(function () { toast('☁️ 저장·동기화 완료'); })
        .catch(function () { toast('☁️ 동기화 실패 — 기기에는 저장됨', true); });
    }, 600);
  }

  /** 클라우드 ↔ 이 기기 전체 병합. */
  async function syncAll(silent) {
    if (!ready()) return;
    var cloud = (await request('', 'GET')) || {};
    var touched = 0;

    // 1) 클라우드에 있는 키 → 로컬과 병합
    for (var ek in cloud) {
      if (!Object.prototype.hasOwnProperty.call(cloud, ek)) continue;
      var key = dec(ek), row = cloud[ek];
      if (!isSyncKey(key) || !row) continue;
      var localVal = parse(localStorage.getItem(key)) || [];
      var merged = mergeRecords(localVal, row.value);
      if (!sameLength(merged, localVal)) {
        writingLocal = true;
        localStorage.setItem(key, JSON.stringify(merged));
        writingLocal = false;
        touched++;
      }
      if (!sameLength(merged, row.value)) await pushKey(key);
    }

    // 2) 이 기기에만 있는 키 → 올린다
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (isSyncKey(k) && !cloud[enc(k)]) await pushKey(k);
    }

    try { localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString()); } catch (e) {}
    if (!silent) toast('☁️ 기기 동기화 완료');
    if (touched && !sessionStorage.getItem('dkj_cloud_reloaded')) {
      sessionStorage.setItem('dkj_cloud_reloaded', '1');
      setTimeout(function () { location.reload(); }, 700);
    }
  }

  function startPoll() {
    clearInterval(poller);
    poller = setInterval(function () {
      if (ready()) syncAll(true).catch(function () {});
    }, POLL_MS);
  }

  function start() {
    if (started || !ready()) return;
    started = true;
    syncAll(false).catch(function () {
      toast('☁️ 연결 실패 — 오프라인으로 계속 사용됩니다', true);
    });
    startPoll();
    global.addEventListener('online', function () { syncAll(true).catch(function () {}); });
  }

  // localStorage 저장을 가로채 자동으로 올린다(각 서식 코드는 손댈 필요 없음)
  var nativeSet = Storage.prototype.setItem;
  var nativeRemove = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (key, value) {
    nativeSet.call(this, key, value);
    if (this === localStorage && !writingLocal && isSyncKey(key) && ready()) queue(key);
  };
  Storage.prototype.removeItem = function (key) {
    nativeRemove.call(this, key);
    if (this === localStorage && !writingLocal && isSyncKey(key) && ready()) {
      request(enc(key), 'DELETE').catch(function () {});
    }
  };

  global.DkjCloudSync = {
    start: start,
    sync: function () { return syncAll(false); },
    lastSync: function () { try { return localStorage.getItem(LAST_SYNC_KEY); } catch (e) { return null; } },
    isSyncKey: isSyncKey,
    mergeRecords: mergeRecords
  };
})(window);
