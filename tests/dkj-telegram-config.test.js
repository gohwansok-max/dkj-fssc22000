const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const telegramSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'dkj-telegram-config.js'), 'utf8');
const STORAGE_KEY = 'dkj:telegram:config:v1';

function memoryStorage(initial) {
  const values = new Map(Object.entries(initial || {}));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function loadTelegram(options) {
  const storage = memoryStorage(options && options.localConfig ? {
    [STORAGE_KEY]: JSON.stringify(options.localConfig)
  } : {});
  const request = options && options.request ? options.request : async () => null;
  const context = {
    console,
    document: { title: '시험 화면', addEventListener() {} },
    fetch: async () => { throw new Error('unexpected fetch'); },
    localStorage: storage,
    location: { href: 'https://example.test/index.html' },
    navigator: { onLine: true, userAgent: 'test' },
    DkjAuth: {
      configured: () => true,
      token: () => 'local-token-4343',
      request
    }
  };
  context.window = context;
  vm.runInContext(telegramSource, vm.createContext(context));
  return { api: context.DkjTelegram, storage };
}

test('waits for cloud storage and verifies the Telegram config by reading it back', async () => {
  let remote = null;
  const calls = [];
  const app = loadTelegram({
    request: async (pathName, method, data) => {
      calls.push({ pathName, method });
      if (method === 'PUT') remote = { ...data };
      if (method === 'GET') return remote;
      return null;
    }
  });

  const result = await app.api.saveConfig({ botToken: 'token-1', chatId: 'chat-1' });

  assert.equal(result.localSaved, true);
  assert.equal(result.cloudSaved, true);
  assert.deepEqual(calls, [
    { pathName: 'system/settings/telegram', method: 'PUT' },
    { pathName: 'system/settings/telegram', method: 'GET' }
  ]);
  assert.equal(JSON.parse(app.storage.getItem(STORAGE_KEY)).botToken, 'token-1');
});

test('restores a complete cloud config on a browser without local Telegram settings', async () => {
  const app = loadTelegram({
    request: async () => ({ botToken: 'cloud-token', chatId: 'cloud-chat', enabled: true })
  });

  const config = await app.api.syncFromCloud();

  assert.equal(config.botToken, 'cloud-token');
  assert.equal(config.chatId, 'cloud-chat');
  assert.equal(JSON.parse(app.storage.getItem(STORAGE_KEY)).chatId, 'cloud-chat');
});

test('does not let an empty cloud response erase a complete local config', async () => {
  const app = loadTelegram({
    localConfig: { botToken: 'local-token', chatId: 'local-chat', enabled: true },
    request: async () => ({ botToken: '', chatId: '' })
  });

  const config = await app.api.syncFromCloud();

  assert.equal(config.botToken, 'local-token');
  assert.equal(config.chatId, 'local-chat');
});

test('does not let a blank save request erase an existing local config', async () => {
  const app = loadTelegram({
    localConfig: { botToken: 'local-token', chatId: 'local-chat', enabled: true }
  });

  const result = await app.api.saveConfig({ botToken: '', chatId: '' });

  assert.equal(result.error, 'INCOMPLETE_CONFIG');
  assert.equal(result.localSaved, false);
  assert.equal(JSON.parse(app.storage.getItem(STORAGE_KEY)).botToken, 'local-token');
  assert.equal(JSON.parse(app.storage.getItem(STORAGE_KEY)).chatId, 'local-chat');
});

test('keeps the local config and reports clearly when cloud storage fails', async () => {
  const app = loadTelegram({ request: async () => { throw new Error('offline'); } });

  const result = await app.api.saveConfig({ botToken: 'token-2', chatId: 'chat-2' });

  assert.equal(result.localSaved, true);
  assert.equal(result.cloudSaved, false);
  assert.equal(result.error, 'CLOUD_SAVE_FAILED');
  assert.equal(JSON.parse(app.storage.getItem(STORAGE_KEY)).chatId, 'chat-2');
});
