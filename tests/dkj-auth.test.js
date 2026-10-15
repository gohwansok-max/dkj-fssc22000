const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const authSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'dkj-auth.js'), 'utf8');

function response(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(data)
  };
}

function memoryStorage(throwOnWrite) {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      if (throwOnWrite) throw new Error('storage unavailable');
      values.set(key, String(value));
    },
    removeItem(key) { values.delete(key); }
  };
}

function loadAuth(fetchImpl, throwOnWrite, directorySeed) {
  const document = {
    readyState: 'loading',
    addEventListener() {},
    dispatchEvent() {},
    getElementsByTagName() { return []; }
  };
  const localStorage = memoryStorage(throwOnWrite);
  if (directorySeed) localStorage.setItem('dkj:auth:directory:v3', JSON.stringify(directorySeed));
  const context = {
    AbortController,
    CustomEvent: function CustomEvent() {},
    DKJ_FIREBASE: {
      apiKey: 'test-key',
      databaseURL: 'https://database.test',
      emailDomain: '@test.invalid',
      root: 'root'
    },
    console,
    document,
    fetch: fetchImpl,
    location: { pathname: '/index.html' },
    localStorage,
    sessionStorage: memoryStorage(throwOnWrite),
    setTimeout,
    clearTimeout,
    URL
  };
  context.window = context;
  context.addEventListener = function () {};
  vm.runInContext(authSource, vm.createContext(context));
  return context.DkjAuth;
}

test('normalizes a short employee number and tolerates unavailable Safari storage', async () => {
  let submittedEmail = '';
  const auth = loadAuth(async (url, options) => {
    if (url.includes('signInWithPassword')) {
      submittedEmail = JSON.parse(options.body).email;
      return response(200, {
        displayName: 'Test worker',
        idToken: 'token-1',
        refreshToken: 'refresh-1',
        localId: 'uid-1'
      });
    }
    if (url.includes('/system/users/uid-1.json')) {
      return options.method === 'GET'
        ? response(200, { name: 'Test worker', role: 'worker' })
        : response(200, {});
    }
    throw new Error('Unexpected request: ' + url);
  }, true);

  const user = await auth.login('1', 'test-password');
  assert.equal(submittedEmail, 'emp0001@test.invalid');
  assert.equal(user.empId, '0001');
});

test('maps fetch failures to a stable network error', async () => {
  const auth = loadAuth(async () => { throw new TypeError('offline'); }, false);
  await assert.rejects(auth.login('0001', 'test-password'), (err) => {
    assert.equal(err.code, 'NETWORK_ERROR');
    return true;
  });
});

test('retries an unauthorized database request only once', async () => {
  let protectedRequests = 0;
  const auth = loadAuth(async (url, options) => {
    if (url.includes('signInWithPassword')) {
      return response(200, {
        displayName: 'Test worker',
        idToken: 'token-1',
        refreshToken: 'refresh-1',
        localId: 'uid-1'
      });
    }
    if (url.includes('securetoken.googleapis.com')) {
      return response(200, { id_token: 'token-2', refresh_token: 'refresh-2', user_id: 'uid-1' });
    }
    if (url.includes('/system/users/uid-1.json')) {
      return options.method === 'GET'
        ? response(200, { name: 'Test worker', role: 'worker' })
        : response(200, {});
    }
    if (url.includes('/protected.json')) {
      protectedRequests += 1;
      return response(401, { error: 'unauthorized' });
    }
    throw new Error('Unexpected request: ' + url);
  }, false);

  await auth.login('0001', 'test-password');
  await assert.rejects(auth.request('protected'), (err) => {
    assert.equal(err.code, 'SESSION_EXPIRED');
    return true;
  });
  assert.equal(protectedRequests, 2);
});


test('managed accounts require the exact directory password and cannot fall back to legacy Firebase auth', async () => {
  let firebaseAttempts = 0;
  const auth = loadAuth(async (url) => {
    if (url.includes('/system/users.json')) return response(200, {});
    if (url.includes('signInWithPassword')) {
      firebaseAttempts += 1;
      return response(200, {
        displayName: 'Test worker',
        idToken: 'token-1',
        refreshToken: 'refresh-1',
        localId: 'uid-1'
      });
    }
    throw new Error('Unexpected request: ' + url);
  }, false, {
    '0001': { uid: 'uid-0001', empId: '0001', name: 'Test worker', role: 'worker', password: 'strict-pass!' }
  });

  await assert.rejects(auth.login('1', 'strict-pass'), (err) => {
    assert.equal(err.message, 'INVALID_LOGIN_CREDENTIALS');
    return true;
  });
  assert.equal(firebaseAttempts, 0);

  const user = await auth.login('1', 'strict-pass!');
  assert.equal(user.empId, '0001');
  assert.equal(firebaseAttempts, 0);
});

test('managed accounts without a configured password do not accept arbitrary input', async () => {
  let firebaseAttempts = 0;
  const auth = loadAuth(async (url) => {
    if (url.includes('/system/users.json')) return response(200, {});
    if (url.includes('signInWithPassword')) {
      firebaseAttempts += 1;
      return response(200, { idToken: 'token-1', refreshToken: 'refresh-1', localId: 'uid-1' });
    }
    throw new Error('Unexpected request: ' + url);
  }, false, {
    '0002': { uid: 'uid-0002', empId: '0002', name: 'No password worker', role: 'worker' }
  });

  await assert.rejects(auth.login('2', 'any-input'), (err) => {
    assert.equal(err.message, 'INVALID_LOGIN_CREDENTIALS');
    return true;
  });
  assert.equal(firebaseAttempts, 0);
});
