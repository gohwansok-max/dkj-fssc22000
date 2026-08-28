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
  vm.runInContext(consoleSource, vm.createContext(context));
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

test('temperature draft is 작성 중 and is not shown in the archive', () => {
  const key = 'dkj:records:DKJ-S-02-05:draft:v1';
  const localStorage = storage({
    [key]: JSON.stringify({ rows: [temperatureRow(21, '12')], info: { month: '2026년 8월' } })
  });
  const api = loadConsole(localStorage);
  const form = { code: 'DKJ-S-02-05', check: { mode: 'dayRow', dayKey: 'day' } };
  const result = api.evaluate(form, new Date(2026, 7, 21));
  assert.equal(result.state, 'part');
  assert.equal(loadExport(localStorage).collect().length, 0);
});

test('saved temperature record is completed and appears in the archive', () => {
  const key = 'dkj:records:DKJ-S-02-05:list:v1';
  const localStorage = storage({
    [key]: JSON.stringify([{
      id: 'r-temperature-1',
      formId: 'DKJ-S-02-05',
      rows: [temperatureRow(21, '12')],
      locked: true,
      createdAt: '2026-08-21T01:00:00.000Z',
      updatedAt: '2026-08-21T01:00:00.000Z'
    }])
  });
  const api = loadConsole(localStorage);
  const form = { code: 'DKJ-S-02-05', check: { mode: 'dayRow', dayKey: 'day' } };
  assert.equal(api.evaluate(form, new Date(2026, 7, 21)).state, 'done');
  const records = loadExport(localStorage).collect();
  assert.equal(records.length, 1);
  assert.equal(records[0].formId, 'DKJ-S-02-05');
  assert.equal(records[0].id, 'r-temperature-1');
});
