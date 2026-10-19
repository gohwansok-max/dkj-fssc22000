/** IndexedDB 읽기 전환과 초기화 장벽. 기존 localStorage 기록은 백업으로 유지한다. */
(function (global) {
  'use strict';
  var initialized = false, pending = null;
  var tail = Promise.resolve();
  var RECORD_KEY = /^dkj:records:.+:(list|draft):v1$/;
  function exclusive(work) {
    var next = tail.then(function () {
      if (global.navigator && global.navigator.locks) {
        return global.navigator.locks.request('dkj-indexeddb-records', work);
      }
      throw new Error('안전한 저장을 위한 Web Locks를 사용할 수 없습니다. 브라우저를 업데이트하세요.');
    });
    tail = next.catch(function () {});
    return next;
  }
  function ready() {
    if (!pending) {
      pending = exclusive(async function () {
        await global.DkjStorageMigration.migrate(global.localStorage, global.DkjStore);
        await reconcileLegacy();
        initialized = true;
        return true;
      }).catch(function (error) { pending = null; initialized = false; throw error; });
    }
    return pending;
  }
  async function getItem(key) {
    await ready();
    // 계정·UI 설정은 기존 동기 작성자와의 호환을 유지한다. 기록은 IndexedDB만 읽는다.
    if (!RECORD_KEY.test(key)) {
      var local = global.localStorage.getItem(key);
      return local;
    }
    var value = await global.DkjStore.get(key);
    return value === undefined ? null : value;
  }
  async function setItem(key, raw) {
    await ready();
    await global.DkjStore.set(key, String(raw));
    if (!RECORD_KEY.test(key)) global.localStorage.setItem(key, String(raw));
    changed(key);
  }
  async function removeItem(key) {
    await ready();
    await global.DkjStore.remove(key);
    if (!RECORD_KEY.test(key)) global.localStorage.removeItem(key);
    changed(key);
  }
  var channel = typeof global.BroadcastChannel === 'function' ? new global.BroadcastChannel('dkj-indexeddb-records') : null;
  function changed(key) {
    if (channel) channel.postMessage({key: key});
    global.dispatchEvent(new CustomEvent('dkj:storage-changed', {detail: {key: key}}));
  }
  async function keys() {
    await ready();
    var out = new Set(await global.DkjStore.keys());
    for (var i = 0; i < global.localStorage.length; i++) {
      var key = global.localStorage.key(i);
      if (key && !RECORD_KEY.test(key)) out.add(key);
    }
    out.delete(global.DkjStorageMigration.markerKey);
    return Array.from(out).sort();
  }
  async function reconcileLegacy() {
    var marker = JSON.parse(await global.DkjStore.get(global.DkjStorageMigration.markerKey));
    var baseline = Object.create(null), updates = Object.create(null);
    marker.entries.forEach(function (entry) { baseline[entry.key] = entry; });
    for (var i = 0; i < global.localStorage.length; i++) {
      var key = global.localStorage.key(i);
      if (!RECORD_KEY.test(key)) continue;
      var raw = global.localStorage.getItem(key), hash = await global.DkjStorageMigration.hash(raw);
      if (baseline[key] && baseline[key].hash === hash) continue;
      var current = await global.DkjStore.get(key), incoming = JSON.parse(raw);
      if (/:list:v1$/.test(key)) {
        if (!Array.isArray(incoming)) throw new Error('이전 버전 기록 배열 오류');
        if (current === undefined) updates[key] = raw;
        else {
          if (!global.DkjCloudSync) throw new Error('이전 버전 기록 병합 모듈을 기다리는 중입니다.');
          updates[key] = JSON.stringify(global.DkjCloudSync.mergeRecords(JSON.parse(current), incoming));
        }
      } else if (current === undefined || String(incoming && incoming._savedAt || '') > String(JSON.parse(current)._savedAt || '')) {
        updates[key] = raw;
      }
      baseline[key] = {key: key, length: raw.length, hash: hash};
    }
    if (Object.keys(updates).length) {
      marker.entries = Object.keys(baseline).sort().map(function (key) { return baseline[key]; });
      updates[global.DkjStorageMigration.markerKey] = JSON.stringify(marker);
      await global.DkjStore.batch(updates);
    }
    return Object.keys(updates).filter(function (key) {return RECORD_KEY.test(key);});
  }
  if (channel) channel.onmessage = function (event) {
    var key = event.data && event.data.key;
    if (typeof key !== 'string') return;
    global.dispatchEvent(new CustomEvent('dkj:storage-changed', {detail: {key: key, source: 'other-tab'}}));
    global.dispatchEvent(new CustomEvent('dkj:records-changed', {detail: {key: key, source: 'other-tab'}}));
  };
  global.addEventListener('storage', function (event) {
    if (!RECORD_KEY.test(event.key || '')) return;
    ready().then(function () {return exclusive(reconcileLegacy);}).then(function (keys) {
      keys.forEach(function (key) { changed(key); });
      if (keys.length) global.dispatchEvent(new CustomEvent('dkj:records-changed', {detail: {source: 'legacy-tab'}}));
    }).catch(showError);
  });
  function showError(error) {
    status('처리를 완료하지 못했습니다. 저장 여부를 확인하고 다시 시도하세요. ' + (error && error.message || ''), true);
  }
  function status(message, bad) {
    if (!global.document || !global.document.body) return;
    var el = global.document.getElementById('dkj-storage-status');
    if (!el) {
      el = global.document.createElement('div'); el.id = 'dkj-storage-status'; el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9998;max-width:340px;padding:7px 12px;border-radius:8px;font-size:12px;background:#eef7f0;color:#205b32;';
      global.document.body.appendChild(el);
    }
    el.textContent = message;
    if (bad) { el.style.background = '#fff0eb'; el.style.color = '#8b260d'; }
  }
  // 저장 실패는 입력한 사진·시간이 저장되지 않았다는 뜻이다. 다음 저장이 성공할 때까지
  // 화면 위에 경고를 남기고, 그 사이 화면을 닫거나 새로고침하려 하면 확인을 받는다.
  var failedOps = Object.create(null);
  function failing() { return Object.keys(failedOps).length > 0; }
  function renderFailure(error) {
    if (!global.document || !global.document.body || !global.document.createElement) return;
    var el = global.document.getElementById('dkj-write-failure');
    if (!failing()) { if (el && el.parentNode) el.parentNode.removeChild(el); return; }
    if (!el) {
      el = global.document.createElement('div'); el.id = 'dkj-write-failure'; el.setAttribute('role', 'alert');
      el.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:10000;padding:12px 16px;font-size:14px;font-weight:700;background:#b42318;color:#fff;text-align:center;';
      global.document.body.appendChild(el);
    }
    el.textContent = '저장에 실패했습니다. 입력한 사진·시간이 저장되지 않았습니다. 이 화면을 닫거나 새로고침하지 말고 다시 저장한 뒤, 계속 실패하면 관리자에게 알려 주세요.' +
      (error && error.message ? ' (' + error.message + ')' : '');
  }
  function reportWrite(op, ok, error) {
    if (ok) delete failedOps[op]; else failedOps[op] = true;
    renderFailure(error);
  }
  global.addEventListener('beforeunload', function (event) {
    if (!failing()) return;
    event.preventDefault();
    event.returnValue = '';
  });
  function startStatus() {
    ready().then(async function () {
      var persisted = await global.DkjStore.requestPersistence();
      status(persisted ? '기기 저장소 준비됨 · 영구 보관 허용' : '기기 저장소 준비됨 · 정기 백업을 권장합니다.');
      return checkQuota();
    }).catch(showError);
  }
  // origin 전체 추정치 기준이다. 80% 이상이면 기록 저장이 막히기 전에 백업·정리를 안내한다.
  var QUOTA_WARN_RATIO = 0.8;
  async function checkQuota() {
    var est = await global.DkjStore.estimate();
    if (!est || !est.quota || !(est.usage >= 0)) return null;
    var ratio = est.usage / est.quota;
    if (ratio >= QUOTA_WARN_RATIO) {
      status('기기 저장 공간 ' + Math.round(ratio * 100) + '% 사용 중입니다. 기록보관함에서 JSON 백업을 받고 관리자에게 알려 주세요.', true);
    }
    return ratio;
  }
  if (global.document && global.document.addEventListener) {
    if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', startStatus);
    else startStatus();
  }
  global.addEventListener('unhandledrejection', function (event) { showError(event.reason); });
  // 정리 기능은 호출마다 실행 플래그와 별도 승인 문자열, 현재 원문 일치를 요구한다.
  // 시작 코드·이벤트에서 호출하지 않는다. 삭제 대상은 기록 목록/초안으로 한정한다.
  async function cleanup(options) {
    if (!options || options.enabled !== true || options.confirm !== 'LOCALSTORAGE_RECORDS_DELETE_APPROVED') {
      return {enabled: false, removed: 0};
    }
    await ready();
    return exclusive(async function () {
      var list = [];
      for (var i = 0; i < global.localStorage.length; i++) {
        var key = global.localStorage.key(i);
        if (RECORD_KEY.test(key)) list.push(key);
      }
      var marker = JSON.parse(await global.DkjStore.get(global.DkjStorageMigration.markerKey));
      var baseline = Object.create(null), originals = Object.create(null);
      marker.entries.forEach(function (entry) {baseline[entry.key] = entry;});
      for (var key of list) {
        var raw = global.localStorage.getItem(key), current = await global.DkjStore.get(key);
        originals[key] = raw;
        if (!baseline[key] || baseline[key].hash !== await global.DkjStorageMigration.hash(raw)) {
          throw new Error('이전 후 원본 변경 발견: 정리를 중단합니다.');
        }
        if (/:list:v1$/.test(key)) {
          var oldRows = JSON.parse(raw), rows = current === undefined ? null : JSON.parse(current);
          if (!Array.isArray(oldRows) || !Array.isArray(rows) || !oldRows.every(function (old) {
            return old && old.id && rows.some(function (row) {return row && row.id === old.id;});
          })) throw new Error('기록 또는 삭제 표식 보존 확인 실패: 정리를 중단합니다.');
        } else if (current === undefined && await global.DkjStore.get(key.replace(':draft:v1', ':list:v1')) === undefined) {
          throw new Error('초안 처리 결과 확인 실패: 정리를 중단합니다.');
        }
      }
      // 승인 전 다른 탭을 닫아야 한다. 검사 중 변경된 원문은 삭제하지 않는다.
      for (var key of list) {
        if (global.localStorage.getItem(key) !== originals[key]) throw new Error('검사 중 원본 변경: 정리를 중단합니다.');
      }
      for (var key of list) global.localStorage.removeItem(key);
      return {enabled: true, removed: list.length};
    });
  }
  global.DkjStorage = { ready: ready, getItem: getItem, setItem: setItem, removeItem: removeItem,
    keys: keys, notify: changed, exclusive: exclusive, initialized: function () { return initialized; }, cleanup: cleanup, checkQuota: checkQuota, reportWrite: reportWrite, writeFailing: failing };
})(window);
