const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'dkj-date-autoload.js'), 'utf8');

function load(list, draft, search) {
  const context = {
    URLSearchParams,
    location: { search: search || '' },
    DkjRecordStore: {
      list: async () => list,
      loadDraft: async () => draft
    }
  };
  context.window = context;
  vm.runInNewContext(source, context);
  return context.DkjDateLoad;
}

const rec = (id, workDate, updatedAt, extra) => Object.assign({ id, workDate, updatedAt }, extra);

test('?date= 는 YYYY-MM-DD 형식만 받는다', () => {
  assert.equal(load([], null, '?date=2026-10-19').queryDate(), '2026-10-19');
  assert.equal(load([], null, '?date=abc').queryDate(), '');
  assert.equal(load([], null, '').queryDate(), '');
});

test('같은 날짜가 여럿이면 마지막 저장본, 삭제 표식은 제외', async () => {
  const dl = load([
    rec('a', '2026-10-19', '2026-10-19T01:00:00Z'),
    rec('b', '2026-10-19', '2026-10-19T05:00:00Z'),
    rec('c', '2026-10-19', '2026-10-19T09:00:00Z', { deleted: true }),
    rec('d', '2026-10-18', '2026-10-18T05:00:00Z')
  ], null);
  const hit = await dl.resolve('X', '2026-10-19');
  assert.equal(hit.kind, 'record');
  assert.equal(hit.data.id, 'b');
});

test('기록이 없는 날짜는 none', async () => {
  const hit = await load([rec('a', '2026-10-18', '2026-10-18T01:00:00Z')], null).resolve('X', '2026-10-19');
  assert.equal(hit.kind, 'none');
});

test('같은 날짜 임시본이 기록보다 나중이면 임시본, 아니면 기록', async () => {
  const list = [rec('a', '2026-10-19', '2026-10-19T05:00:00Z')];
  const newer = { workDate: '2026-10-19', _savedAt: '2026-10-19T06:00:00Z' };
  const older = { workDate: '2026-10-19', _savedAt: '2026-10-19T04:00:00Z' };
  assert.equal((await load(list, newer).resolve('X', '2026-10-19')).kind, 'draft');
  assert.equal((await load(list, older).resolve('X', '2026-10-19')).kind, 'record');
  assert.equal((await load([], newer).resolve('X', '2026-10-19')).kind, 'draft');
  assert.equal((await load(list, { workDate: '2026-10-18', _savedAt: '2026-10-20T00:00:00Z' }).resolve('X', '2026-10-19')).kind, 'record');
});
