const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/dkj-store.js'), 'utf8');

// 테스트 전용 최소 IndexedDB. 요청 성공과 commit을 별도 tick으로 분리하고
// commit 전 오류 시 임시 변경을 버려 브라우저 트랜잭션 경계를 검증한다.
function fakeIndexedDB() {
  const values = new Map();
  const state = { opens: 0, closed: 0, failOpen: false, blocked: false,
    failRequest: false, abortCommit: false, throwPut: false, holdCommit: false };
  let exists = false;
  const db = {
    objectStoreNames: { contains: () => exists },
    createObjectStore() { exists = true; },
    close() { state.closed++; },
    transaction(name, mode) {
      assert.equal(name, 'entries');
      const pending = new Map(values);
      const tx = { error: null, aborted: false,
        abort() { tx.aborted = true; setImmediate(() => tx.onabort()); },
        objectStore() {
          function request(action) {
            const req = {};
            setImmediate(() => {
              if (state.failRequest) {
                req.error = new Error('요청 실패');
                req.onerror();
                tx.error = req.error;
                tx.onabort();
                return;
              }
              req.result = action();
              req.onsuccess();
              const commit = () => setImmediate(() => {
                if (tx.aborted || state.abortCommit) {
                  tx.error = new Error('commit 중단'); tx.onabort(); return;
                }
                if (mode === 'readwrite') {
                  values.clear(); pending.forEach((v, k) => values.set(k, v));
                }
                tx.oncomplete();
              });
              if (state.holdCommit) state.commit = commit;
              else commit();
            });
            return req;
          }
          return {
            get: key => request(() => pending.get(key)),
            put(value, key) {
              if (state.throwPut) throw new Error('put 예외');
              return request(() => { pending.set(key, value); return key; });
            },
            delete: key => request(() => { pending.delete(key); }),
            getAllKeys: () => request(() => [...pending.keys()].sort())
          };
        }
      };
      return tx;
    }
  };
  return { state, values, db, open(name, version) {
    assert.equal(name, 'dkj-store'); assert.equal(version, 1);
    state.opens++;
    const req = {};
    setImmediate(() => {
      if (state.failOpen) { req.error = new Error('연결 실패'); req.onerror(); return; }
      req.result = db;
      if (state.blocked) req.onblocked();
      if (!exists) req.onupgradeneeded();
      req.onsuccess();
    });
    return req;
  } };
}
function load(indexedDB = fakeIndexedDB(), storage) {
  const context = { indexedDB, navigator: { storage } };
  context.window = context;
  Object.defineProperty(context, 'localStorage', { get() { throw new Error('localStorage 접근 금지'); } });
  vm.runInNewContext(source, context);
  return { store: context.DkjStore, idb: indexedDB };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('스크립트 로드만으로 DB를 열거나 영구 저장을 요청하지 않는다', () => {
  let called = false;
  const { idb } = load(undefined, { persist() { called = true; } });
  assert.equal(idb.state.opens, 0); assert.equal(called, false);
});
test('문자열 원문·사진·감사이력·삭제 표식을 변형 없이 저장하고 다시 읽는다', async () => {
  const { store } = load();
  const raw = ' [{"rows":[{"photo":"data:image/png;base64,AAAA"}],"audit":[{"hash":"abc"}],"deleted":true}] ';
  await store.set('dkj:records:test:list:v1', raw);
  assert.equal(await store.get('dkj:records:test:list:v1'), raw);
  await store.set('empty', ''); assert.equal(await store.get('empty'), '');
  await store.set('empty', '새 값'); assert.equal(await store.get('empty'), '새 값');
});
test('없는 키·키 목록·삭제·반복 삭제', async () => {
  const { store } = load();
  assert.equal(await store.get('missing'), undefined);
  await store.set('b', '2'); await store.set('a', '1');
  assert.deepEqual(Array.from(await store.keys()), ['a', 'b']);
  await store.remove('a'); await store.remove('a');
  assert.equal(await store.get('a'), undefined);
  assert.deepEqual(Array.from(await store.keys()), ['b']);
});
test('병렬 최초 읽기는 DB 연결을 공유한다', async () => {
  const { store, idb } = load();
  await Promise.all([store.get('a'), store.get('b'), store.keys()]);
  assert.equal(idb.state.opens, 1);
});
test('요청 성공 후에도 commit 전에는 쓰기 성공을 반환하지 않는다', async () => {
  const { store, idb } = load(); idb.state.holdCommit = true;
  let settled = false;
  const writing = store.set('a', '1').then(() => { settled = true; });
  while (!idb.state.commit) await tick();
  assert.equal(settled, false); assert.equal(idb.values.has('a'), false);
  idb.state.commit(); await writing;
  assert.equal(idb.values.get('a'), '1');
});
test('commit 중단 시 성공으로 보고하지 않으며 기존 값을 보존한다', async () => {
  const { store, idb } = load(); await store.set('a', 'old');
  idb.state.abortCommit = true;
  await assert.rejects(store.set('a', 'new'), /commit 중단/);
  assert.equal(idb.values.get('a'), 'old');
});
test('요청 실패와 동기 put 예외를 reject한다', async () => {
  const { store, idb } = load(); idb.state.failRequest = true;
  await assert.rejects(store.get('a'), /요청 실패/);
  idb.state.failRequest = false; idb.state.throwPut = true;
  await assert.rejects(store.set('a', '1'), /put 예외/);
  assert.equal(idb.values.size, 0);
});
test('연결 실패 후 다시 연결할 수 있다', async () => {
  const { store, idb } = load(); idb.state.failOpen = true;
  await assert.rejects(store.keys(), /연결 실패/);
  idb.state.failOpen = false; await store.keys(); assert.equal(idb.state.opens, 2);
});
test('blocked 연결은 reject하고 늦게 열린 연결을 닫는다', async () => {
  const { store, idb } = load(); idb.state.blocked = true;
  await assert.rejects(store.keys(), /다른 창/); assert.equal(idb.state.closed, 1);
  idb.state.blocked = false; await store.keys(); assert.equal(idb.state.opens, 2);
});
test('버전 변경 또는 비정상 종료 후 재연결한다', async () => {
  const { store, idb } = load(); await store.keys();
  idb.db.onversionchange(); await store.keys();
  idb.db.onclose(); await store.keys(); assert.equal(idb.state.opens, 3);
});
test('IndexedDB 미지원은 명시적으로 실패하고 localStorage로 우회하지 않는다', async () => {
  const { store } = load(null); await assert.rejects(store.keys(), /사용할 수 없습니다/);
});
test('잘못된 키·값은 Promise 거부로 처리한다', async () => {
  const { store } = load();
  await assert.rejects(store.get(''), /키/);
  await assert.rejects(store.remove(1), /키/);
  await assert.rejects(store.set('a', {}), /값/);
});
test('용량 추정은 origin 추정값을 반환하며 미지원은 null이다', async () => {
  const expected = { usage: 100, quota: 200 };
  assert.equal(await load(undefined, { estimate: async () => expected }).store.estimate(), expected);
  assert.equal(await load().store.estimate(), null);
  await assert.rejects(load(undefined, { estimate: async () => { throw new Error('추정 실패'); } }).store.estimate(), /추정 실패/);
});
test('영구 저장 승인·거부·미지원·예외 모두 처리하고 거부 후에도 저장한다', async () => {
  assert.equal(await load(undefined, { persist: async () => true }).store.requestPersistence(), true);
  for (const storage of [undefined, { persist: async () => false }, { persist() { throw new Error('거부'); } }]) {
    const { store } = load(undefined, storage);
    assert.equal(await store.requestPersistence(), false);
    await store.set('a', '1'); assert.equal(await store.get('a'), '1');
  }
});
