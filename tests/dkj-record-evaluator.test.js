const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// Deliberately omit document, storage and authentication: evaluation is pure.
const context = vm.createContext({});
context.window = context;
for (const file of ['dkj-operation-calendar-model.js', 'dkj-record-evaluator.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context);
}
const model = context.DkjOperationCalendarModel;
const date = new Date(2026, 7, 21);
const production = (day) => model.isProductionDay(model.normalize({}), day);
function evaluate(check, records = [], draft = null, extra = {}, isProductionDay = production) {
  return context.DkjRecordEvaluator.evaluate({ check, ...extra }, date, records, draft, isProductionDay);
}

test('daily records distinguish missing, draft, saved and nonconforming entries', () => {
  const check = { mode: 'perDay' };
  const saved = { checkDate: '2026-08-21' };
  assert.equal(evaluate(check).state, 'todo');
  assert.equal(evaluate(check, [], saved).state, 'part');
  assert.equal(evaluate(check, [saved]).state, 'done');
  assert.equal(evaluate(check, [{ info: saved, judge: '부적합' }]).state, 'ng');
});

test('deleted and empty records do not satisfy a daily obligation', () => {
  assert.equal(evaluate({ mode: 'perDay' }, [null, { checkDate: '2026-08-21', deleted: true }]).state, 'todo');
});

test('nonproduction days remove daily duties before inspecting the record', () => {
  assert.equal(evaluate({ mode: 'perDay' }, [], null, { _dailyDuty: true }, () => false).state, 'off');
});

test('weekly and monthly records keep their existing period boundaries', () => {
  const weekly = { mode: 'perPeriod', period: 'week' };
  assert.equal(evaluate(weekly, [{ checkDate: '2026-08-16' }]).state, 'todo');
  assert.equal(evaluate(weekly, [{ checkDate: '2026-08-17' }]).state, 'done');
  const monthly = { mode: 'perPeriod', period: 'month' };
  assert.equal(evaluate(monthly, [{ checkDate: '2026-07-21' }]).state, 'todo');
  assert.equal(evaluate(monthly, [{ checkDate: '2026-08-01' }]).state, 'done');
});

test('matrix columns preserve partial input and nonconformance precedence', () => {
  const check = { mode: 'dayColumn' };
  const record = (a, b) => ({ days: ['2026-08-21'], checks: { a: [a], b: [b] } });
  assert.equal(evaluate(check, [record('', '')]).state, 'todo');
  assert.equal(evaluate(check, [record('O', '')]).state, 'part');
  assert.equal(evaluate(check, [record('O', 'O')]).state, 'done');
  assert.equal(evaluate(check, [record('O', 'O'), record('O', 'X')]).state, 'ng');
  assert.equal(evaluate(check, [], record('O', 'O')).state, 'part');
});

test('weekly matrix uses the configured week start and waits for monthly completion', () => {
  const check = { mode: 'dayColumn', dayMode: 'week', weekStartDay: 5 };
  const days = ['2026-08-14', '2026-08-21', '2026-08-28'];
  assert.equal(evaluate(check, [{ days, checks: { a: ['', 'O', ''] } }]).state, 'part');
  assert.equal(evaluate(check, [{ days, checks: { a: ['O', 'O', 'O'] } }]).state, 'done');
});

test('ledger rows match the month and retain nonconformance and draft status', () => {
  const check = { mode: 'dayRow' };
  const record = (month, value) => ({ info: { month }, rows: [{ day: '21일', dow: '금', result: value }] });
  assert.equal(evaluate(check, [record('2026 . 07', 'O')]).state, 'todo');
  assert.equal(evaluate(check, [record('2026 . 08', 'O')]).state, 'done');
  assert.equal(evaluate(check, [record('2026년 8월', '부')]).state, 'ng');
  assert.equal(evaluate(check, [], record('2026년 8월', 'O')).state, 'part');
});

test('monthly ledger counts production days and does not mutate inputs', () => {
  const check = { mode: 'monthRows' };
  const saved = [{ info: { month: '2026-08' }, rows: [{ day: '21', result: 'O' }] }];
  const before = JSON.stringify(saved);
  const result = evaluate(check, saved);
  assert.equal(result.state, 'part');
  assert.match(result.note, /1\/21 완료/);
  assert.equal(evaluate(check, saved, null, {}, (day) => day.getDate() === 21).state, 'done');
  assert.equal(JSON.stringify(saved), before);
});

test('event records retain recent timestamp and unknown checks retain none', () => {
  assert.equal(evaluate({ mode: 'event' }).note, '발생 기록 없음');
  assert.equal(evaluate({ mode: 'event' }, [{ updatedAt: '2026-08-20T00:00:00Z' }]).note, '최근 2026-08-20');
  assert.equal(evaluate({ mode: 'unknown' }).state, 'none');
});

test('calendar normalizes overrides without mutating data and prefers production dates', () => {
  const source = { workdays: ['5', 1, 1, 7], productionDates: [' 2026-08-23 ', '2026-08-23', 'bad'], nonProductionDates: ['2026-08-23', '2026-08-21'], updatedAt: 'saved', updatedBy: 'operator' };
  const before = JSON.stringify(source);
  const calendar = model.normalize(source);
  assert.equal(JSON.stringify(calendar.workdays), '[1,5]');
  assert.equal(JSON.stringify(calendar.productionDates), '["2026-08-23"]');
  assert.equal(JSON.stringify(calendar.nonProductionDates), '["2026-08-21"]');
  assert.equal(model.isProductionDay(calendar, new Date(2026, 7, 23)), true);
  assert.equal(model.isProductionDay(calendar, date), false);
  assert.equal(calendar.updatedAt, 'saved');
  assert.equal(calendar.updatedBy, 'operator');
  assert.equal(JSON.stringify(source), before);
});
