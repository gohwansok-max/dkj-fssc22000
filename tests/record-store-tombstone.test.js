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

test('이전 버전에서 삭제된 기록의 본문도 기기당 한 번 비운다', () => {
  const mem = {};
  const fat = { id: 'r_old', formId: 'DKJ-H-01-01', deleted: true, deletedAt: '2026-10-15T00:00:00.000Z', updatedAt: '2026-10-15T00:00:00.000Z',
    rows: [{ photo: 'data:image/jpeg;base64,' + 'A'.repeat(100000) }] };
  const alive = { id: 'r_live', formId: 'DKJ-H-01-01', workDate: '2026-10-16', rows: [{ photo: 'data:image/jpeg;base64,' + 'B'.repeat(50000) }] };
  mem['dkj:records:DKJ-H-01-01:list:v1'] = JSON.stringify([fat, alive]);
  const localStorage = {
    get length() { return Object.keys(mem).length; },
    key: (i) => Object.keys(mem)[i],
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; }
  };
  const context = { localStorage, console, setTimeout, clearTimeout, CustomEvent: function () {}, document: { readyState: 'complete', addEventListener() {} } };
  context.window = context;
  context.dispatchEvent = () => {};
  vm.runInNewContext(source, context);
  const list = JSON.parse(mem['dkj:records:DKJ-H-01-01:list:v1']);
  assert.equal(list[0].rows, undefined);
  assert.equal(list[0].deleted, true);
  assert.ok(list[0].updatedAt > '2026-10-15T00:00:00.000Z');
  assert.ok(list[1].rows[0].photo.length > 50000, '삭제되지 않은 기록은 그대로');
});
