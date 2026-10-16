/** IndexedDB 저장 어댑터. 앱 연결·localStorage 이전은 후속 단계에서 수행한다. */
(function (global) {
  'use strict';
  var DB_NAME = 'dkj-store';
  var STORE_NAME = 'entries';
  var opening = null;

  function open() {
    if (opening) return opening;
    var promise = new Promise(function (resolve, reject) {
      var request;
      var cancelled = false;
      try {
        if (!global.indexedDB) throw new Error('IndexedDB를 사용할 수 없습니다.');
        request = global.indexedDB.open(DB_NAME, 1);
      } catch (error) { reject(error); return; }
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onblocked = function () {
        cancelled = true;
        reject(new Error('다른 창이 저장소 연결을 막고 있습니다. 다른 창을 닫고 다시 시도하세요.'));
      };
      request.onerror = function () { reject(request.error || new Error('저장소 연결 실패')); };
      request.onsuccess = function () {
        var db = request.result;
        if (cancelled) { db.close(); return; }
        db.onversionchange = function () { db.close(); if (opening === promise) opening = null; };
        db.onclose = function () { if (opening === promise) opening = null; };
        resolve(db);
      };
    });
    opening = promise;
    promise.catch(function () { if (opening === promise) opening = null; });
    return promise;
  }

  // 요청 성공만으로 쓰기 성공을 보고하지 않는다. 트랜잭션 commit 후에만 반환한다.
  function run(mode, action) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx, result;
        try {
          tx = db.transaction(STORE_NAME, mode);
          tx.oncomplete = function () { resolve(result); };
          tx.onabort = function () { reject(tx.error || new Error('저장소 트랜잭션 중단')); };
          tx.onerror = function () { reject(tx.error || new Error('저장소 트랜잭션 실패')); };
          var request = action(tx.objectStore(STORE_NAME));
          request.onsuccess = function () { result = request.result; };
          request.onerror = function () { reject(request.error || new Error('저장소 요청 실패')); };
        } catch (error) {
          if (tx) { try { tx.abort(); } catch (_) {} }
          reject(error);
        }
      });
    });
  }

  function validKey(key) {
    if (typeof key !== 'string' || !key.length) throw new TypeError('저장소 키는 빈 문자열이 아닌 문자열이어야 합니다.');
  }
  function keyed(key, mode, action) {
    return Promise.resolve().then(function () { validKey(key); return run(mode, action); });
  }
  global.DkjStore = {
    // 값은 원본 문자열 그대로 저장한다. 없는 키는 undefined다.
    get: function (key) { return keyed(key, 'readonly', function (store) { return store.get(key); }); },
    set: function (key, value) {
      return Promise.resolve().then(function () {
        validKey(key);
        if (typeof value !== 'string') throw new TypeError('저장소 값은 문자열이어야 합니다.');
        return run('readwrite', function (store) { return store.put(value, key); });
      }).then(function () {});
    },
    remove: function (key) {
      return keyed(key, 'readwrite', function (store) { return store.delete(key); }).then(function () {});
    },
    batch: function (changes) {
      return Promise.resolve().then(function () {
        var keys = Object.keys(changes);
        keys.forEach(function (key) {
          validKey(key);
          if (changes[key] !== null && typeof changes[key] !== 'string') throw new TypeError('일괄 저장 값은 문자열 또는 null이어야 합니다.');
        });
        if (!keys.length) return;
        return run('readwrite', function (store) {
          var last;
          keys.forEach(function (key) { last = changes[key] === null ? store.delete(key) : store.put(changes[key], key); });
          return last;
        });
      }).then(function () {});
    },
    keys: function () { return run('readonly', function (store) { return store.getAllKeys(); }); },
    // 브라우저 origin 전체 추정치다. IndexedDB만의 점유량이나 보장 용량이 아니다.
    estimate: function () {
      return Promise.resolve().then(function () {
        var storage = global.navigator && global.navigator.storage;
        return storage && typeof storage.estimate === 'function' ? storage.estimate() : null;
      });
    },
    requestPersistence: function () {
      return Promise.resolve().then(function () {
        var storage = global.navigator && global.navigator.storage;
        return storage && typeof storage.persist === 'function' ? storage.persist() : false;
      }).then(function (granted) { return !!granted; }, function () { return false; });
    }
  };
})(window);
