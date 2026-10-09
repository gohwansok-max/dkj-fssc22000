const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'dkj-console.js'), 'utf8');

function storage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function loadConsole(isAdmin, request = async () => ({})) {
  const listeners = {};
  const context = {
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
    DkjAuth: {
      isSystemAdmin: () => isAdmin,
      token: () => isAdmin ? 'token' : '',
      user: () => ({ empId: '4343', name: '관리자' }),
      request
    },
    document: {
      readyState: 'loading',
      addEventListener() {},
      getElementById() { return null; }
    },
    localStorage: storage(),
    setTimeout,
    clearTimeout,
    addEventListener(type, handler) { listeners[type] = handler; },
    dispatchEvent() {},
    console,
    fetch: async () => ({ ok: true, json: async () => ({}) })
  };
  context.window = context;
  vm.createContext(context);
  ['dkj-operation-calendar-model.js', 'dkj-record-evaluator.js'].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context);
  });
  vm.runInContext(source, context);
  return context.DkjConsole;
}

test('date overrides take precedence over the weekday rule and can be reset', async () => {
  const consoleApi = loadConsole(true);
  const sunday = new Date(2026, 7, 23);
  assert.equal(consoleApi.isProductionDay(sunday), false);

  await consoleApi.setOperationDate(sunday, 'production');
  assert.equal(consoleApi.isProductionDay(sunday), true);

  await consoleApi.setOperationDate(sunday, 'default');
  assert.equal(consoleApi.isProductionDay(sunday), false);
});

test('non-admin users cannot change the shared operation calendar', async () => {
  const consoleApi = loadConsole(false);
  const weekday = new Date(2026, 7, 24);
  await assert.rejects(consoleApi.setOperationDate(weekday, 'nonProduction'), (err) => {
    assert.equal(err.message, 'ADMIN_REQUIRED');
    return true;
  });
  assert.equal(consoleApi.isProductionDay(weekday), true);
});

test('failed calendar writes retain the local date override for offline use', async () => {
  const api = loadConsole(true, async () => { throw new Error('OFFLINE'); });
  const sunday = new Date(2026, 7, 23);
  await assert.rejects(api.setOperationDate(sunday, 'production'), /OFFLINE/);
  assert.equal(api.isProductionDay(sunday), true);
});

test('a pending calendar retries after reconnect and preserves administrator metadata', async () => {
  let online = false;
  const writes = [];
  const api = loadConsole(true, async (path, method, payload) => {
    if (!online) throw new Error('OFFLINE');
    if (method === 'PUT') writes.push(payload);
    return {};
  });
  const sunday = new Date(2026, 7, 23);
  await assert.rejects(api.setOperationDate(sunday, 'production'), /OFFLINE/);
  online = true;
  await api.loadOperationCalendar();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].value.calendar.productionDates[0], '2026-08-23');
  assert.equal(api.operationCalendar().updatedBy, '관리자');
  assert.ok(api.operationCalendar().updatedAt);
  assert.equal(api.isProductionDay(sunday), true);
});
