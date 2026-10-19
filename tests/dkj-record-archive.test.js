const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const consoleSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'dkj-console.js'), 'utf8');
const exportSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'dkj-export.js'), 'utf8');

function storage(initial) {
  const values = new Map(Object.entries(initial || {}));
  return {
    get length() { return values.size; },
    key(index) { return Array.from(values.keys())[index] || null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function loadConsole(localStorage) {
  const context = {
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
    document: { readyState: 'loading', addEventListener() {}, getElementById() { return null; } },
    localStorage,
    setTimeout,
    clearTimeout,
    addEventListener() {},
    dispatchEvent() {},
    console,
    fetch: async () => ({ ok: true, json: async () => ({}) })
  };
  context.window = context;
  vm.createContext(context);
  ['dkj-operation-calendar-model.js', 'dkj-record-evaluator.js'].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context);
  });
  vm.runInContext(consoleSource, context);
  return context.DkjConsole;
}

function loadExport(localStorage) {
  const context = {
    document: { createElement() { return { click() {}, remove() {} }; }, body: { appendChild() {} } },
    localStorage,
    URL,
    Blob,
    console,
    DKJ_RECORD_CATALOG: { records: [{ code: 'DKJ-S-02-05', title: '작업장 온도' }] }
  };
  context.window = context;
  vm.runInContext(exportSource, vm.createContext(context));
  return context.DkjExport;
}

function temperatureRow(day, value) {
  return { day: String(day), dow: '금', z1_am: value || '' };
}

test('internal alert settings are excluded without changing storage or hiding uncatalogued business records', async () => {
  const initial = {
    'dkj:records:PERIODIC-ALERTS:list:v1': JSON.stringify([{id:'alert'}]),
    'dkj:records:PERIODIC-ALERT-SETTINGS:list:v1': JSON.stringify([{id:'settings'}]),
    'dkj:records:DKJ-QC-001:list:v1': JSON.stringify([{id:'qc',locked:true}])
  };
  const store = storage(initial);
  const rows = await loadExport(store).collect();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].formId, 'DKJ-QC-001');
  for (const [key,value] of Object.entries(initial)) assert.equal(store.getItem(key), value);
});

test('record identity distinguishes LOT and rounds without altering source records', async () => {
  const key='dkj:records:DKJ-QC-001:list:v1';
  const rows=[
    {id:'first',workDate:'2026-10-19',lot:'LOT-A',roundNo:1,createdAt:'2026-10-19T00:00:00Z',updatedAt:'2026-10-19T03:00:00Z'},
    {id:'second',workDate:'2026-10-19',lot:'LOT-A',roundNo:2,createdAt:'2026-10-19T01:00:00Z',updatedAt:'2026-10-19T02:00:00Z'},
    {id:'other-lot',workDate:'2026-10-19',lot:'LOT-B',createdAt:'2026-10-19T04:00:00Z'}
  ];
  const raw=JSON.stringify(rows), store=storage({[key]:raw});
  const result=await loadExport(store).collect();
  const a=result.find(r=>r.id==='first'),b=result.find(r=>r.id==='second'),c=result.find(r=>r.id==='other-lot');
  assert.equal(a.mostRecentlyUpdated,true);assert.equal(b.mostRecentlyUpdated,false);
  assert.equal(a.displaySequence,1);assert.equal(b.displaySequence,2);
  assert.equal(a.round,'1');assert.equal(b.round,'2');assert.equal(c.round,'');
  assert.equal(c.sameContextCount,1);assert.equal(store.getItem(key),raw);
});

test('temperature draft is 작성 중 and is not shown in the archive', async () => {
  const key = 'dkj:records:DKJ-S-02-05:draft:v1';
  const localStorage = storage({
    [key]: JSON.stringify({ rows: [temperatureRow(21, '12')], info: { month: '2026년 8월' } })
  });
  const api = loadConsole(localStorage);
  const form = { code: 'DKJ-S-02-05', check: { mode: 'dayRow', dayKey: 'day' } };
  const result = await api.evaluate(form, new Date(2026, 7, 21));
  assert.equal(result.state, 'part');
  assert.equal((await loadExport(localStorage).collect()).length, 0);
});

test('saved temperature record is completed and appears in the archive', async () => {
  const key = 'dkj:records:DKJ-S-02-05:list:v1';
  const localStorage = storage({
    [key]: JSON.stringify([{
      id: 'r-temperature-1',
      formId: 'DKJ-S-02-05',
      info: { month: '2026년 8월' },
      rows: [temperatureRow(21, '12')],
      locked: true,
      createdAt: '2026-08-21T01:00:00.000Z',
      updatedAt: '2026-08-21T01:00:00.000Z'
    }])
  });
  const api = loadConsole(localStorage);
  const form = { code: 'DKJ-S-02-05', check: { mode: 'dayRow', dayKey: 'day' } };
  assert.equal((await api.evaluate(form, new Date(2026, 7, 21))).state, 'done');
  const records = await loadExport(localStorage).collect();
  assert.equal(records.length, 1);
  assert.equal(records[0].formId, 'DKJ-S-02-05');
  assert.equal(records[0].id, 'r-temperature-1');
});

test('previous-month saved row does not complete the same day in the current month', async () => {
  const key = 'dkj:records:DKJ-S-02-05:list:v1';
  const localStorage = storage({
    [key]: JSON.stringify([{
      id: 'r-temperature-previous-month',
      formId: 'DKJ-S-02-05',
      info: { month: '2026년 8월' },
      rows: [temperatureRow(21, '12')],
      locked: true,
      createdAt: '2026-08-21T01:00:00.000Z',
      updatedAt: '2026-08-21T01:00:00.000Z'
    }])
  });
  const api = loadConsole(localStorage);
  const form = { code: 'DKJ-S-02-05', check: { mode: 'dayRow', dayKey: 'day' } };
  assert.equal((await api.evaluate(form, new Date(2026, 8, 21))).state, 'todo');
});
