const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'dkj-record-store.js'), 'utf8');

function loadStore() {
  const mem = {};
  const localStorage = {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; }
  };
  const context = { localStorage, console, setTimeout, clearTimeout, CustomEvent: function () {}, document: { addEventListener() {} } };
  context.window = context;
  context.dispatchEvent = () => {};
  context.addEventListener = () => {};
  vm.runInNewContext(source, context);
  return { store: context.DkjRecordStore, mem };
}

test('삭제 표식에는 사진·본문을 남기지 않는다(저장 공간 확보)', () => {
  const { store, mem } = loadStore();
  const photo = 'data:image/jpeg;base64,' + 'A'.repeat(200000);
  const rec = store.save('DKJ-H-01-01', { workDate: '2026-10-16', title: 'CCP-1BC x', rows: [{ photo }] });
  assert.ok(mem['dkj:records:DKJ-H-01-01:list:v1'].length > 200000);
  store.remove('DKJ-H-01-01', rec.id);
  const raw = mem['dkj:records:DKJ-H-01-01:list:v1'];
  assert.ok(raw.length < 3000, 'tombstone should be small, got ' + raw.length);
  const row = JSON.parse(raw)[0];
  assert.equal(row.deleted, true);
  assert.equal(row.id, rec.id);
  assert.equal(row.rows, undefined);
  assert.equal(store.list('DKJ-H-01-01').length, 0);
});
