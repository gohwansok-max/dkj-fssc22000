const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const path = require('node:path');
function setup() {
  const source = new Map([['dkj:records:T:list:v1', '[{"id":"a","deleted":true,"audit":[{"hash":"h"}]}]'], ['dkj:auth:directory:v3', '{"test":true}'], ['draft', '']]);
  const target = new Map();
  const storage = { get length() { return source.size; }, key: i => [...source.keys()][i] ?? null,
    getItem: k => source.get(k) ?? null };
  const store = { get: async k => target.get(k), set: async (k,v) => target.set(k,v), keys: async () => [...target.keys()] };
  const context = { crypto: webcrypto, TextEncoder, Uint8Array }; context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/dkj-storage-migration.js'), 'utf8'), context);
  return { migration: context.DkjStorageMigration, storage, store, source, target };
}
test('전체 키 원문을 복사하고 건수·길이·SHA-256 일치 후에만 표식을 남긴다', async () => {
  const {migration, storage, store, source, target} = setup();
  const before = [...source]; const report = await migration.migrate(storage, store);
  assert.equal(report.equal, true); assert.equal(report.sourceCount, 3);
  for (const [k,v] of source) assert.equal(target.get(k), v);
  assert.deepEqual([...source], before);
  assert.ok(target.has(migration.markerKey));
  assert.equal((await migration.migrate(storage, store)).alreadyMigrated, true);
});
test('길이가 같은 오염도 해시 대조에서 실패하고 완료 표식을 남기지 않는다', async () => {
  const {migration, storage, store, target} = setup();
  const original = store.set;
  store.set = async (k,v) => original(k, k === 'draft' ? 'x' : v.replace('"a"', '"b"'));
  await assert.rejects(migration.migrate(storage, store), /대조 실패/);
  assert.equal(target.has(migration.markerKey), false);
});
test('중간 중단 뒤 재실행하면 원본을 보존하며 복사를 마친다', async () => {
  const {migration, storage, store, target} = setup();
  const original = store.set; let writes = 0;
  store.set = async (k,v) => { if (++writes === 2) throw new Error('중단'); return original(k,v); };
  await assert.rejects(migration.migrate(storage, store), /중단/);
  assert.equal(target.has(migration.markerKey), false);
  store.set = original; assert.equal((await migration.migrate(storage, store)).equal, true);
});
test('이전 도중 원본이 바뀌면 표식을 기록하지 않는다', async () => {
  const {migration, storage, store, source, target} = setup();
  const original = store.set;
  store.set = async (k,v) => { await original(k,v); source.set('draft', '새 초안'); };
  await assert.rejects(migration.migrate(storage, store), /대조 실패/);
  assert.equal(target.has(migration.markerKey), false);
});
test('대조 보고서는 키별 길이·해시와 누락·추가 키를 구분한다', async () => {
  const {migration, storage, store, target} = setup();
  target.set('extra', '1'); const report = await migration.compare(storage, store);
  assert.equal(report.equal, false); assert.equal(report.sourceCount, 3); assert.equal(report.targetCount, 1);
  assert.equal(report.entries[0].targetHash, null); assert.deepEqual(Array.from(report.extraKeys), ['extra']);
});
