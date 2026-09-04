/**
 * 동김제농협 로그인·역할 기반 권한관리.
 *
 * - 모든 업무 화면은 로그인 후 사용한다. 회사소개서는 고객 공유용으로 공개한다.
 * - 로그인 계정은 Firebase Authentication이 아니라 이 파일이 관리하는 로컬
 *   디렉터리(dkj:auth:directory:v3, 시스템 설정 화면에서 등록·수정)가 정본이다.
 *   RTDB system/users는 그 디렉터리를 기기 간에 맞추는 사본일 뿐이다(비밀번호는
 *   해시로만 올라간다). database.rules.json도 이에 맞춰 인증 없이 열려 있다 —
 *   운영 안정화 후 별도로 계정별 보안을 다시 강화할 예정이다.
 */
(function (global) {
  'use strict';
  if (global.DkjAuth) return;

  var CFG = global.DKJ_FIREBASE || {};
  var SESSION_KEY = 'dkj:auth:session:v2';
  var USER_KEY = 'dkj:auth:user:v2';
  var LEGACY_USER_KEY = 'dkj:auth:user:v1';
  var ADMIN_EMP_ID = '4343';
  var REQUEST_TIMEOUT_MS = 15000;
  var ROLES = {
    system_admin: { label: '시스템 관리자', stages: ['writer', 'reviewer', 'approver'] },
    responsible: { label: '책임자', stages: ['writer', 'reviewer', 'approver'] },
    manager: { label: '관리자', stages: ['writer', 'reviewer'] },
    worker: { label: '작업자', stages: ['writer'] }
  };
  var state = { token: '', uid: '', empId: '', name: '', role: 'worker' };
  var staffCache = null;

  function refreshKey(empId) { return 'dkj:auth:refreshtoken:emp' + empId + ':v1'; }
  function config() { return global.DKJ_FIREBASE || CFG || {}; }
  function configured() { var c = config(); return !!(c.apiKey && c.databaseURL); }
  function normalizeRole(value) { return ROLES[value] ? value : 'worker'; }
  function roleLabel(value) { return (ROLES[normalizeRole(value)] || ROLES.worker).label; }
  function defaultRole(empId) { return normId(empId) === ADMIN_EMP_ID ? 'system_admin' : 'worker'; }
  function isSystemAdmin() { return state.empId === ADMIN_EMP_ID && state.role === 'system_admin'; }

  function normId(empId) {
    var v = String(empId == null ? '' : empId).trim();
    return /^[0-9]{1,3}$/.test(v) ? ('000' + v).slice(-4) : v;
  }
  function email(empId) { var c = config(); return 'emp' + normId(empId) + (c.emailDomain || '@dkj-fssc.internal'); }
  function storage(name) {
    try { return global[name] || null; } catch (e) { return null; }
  }
  function readJson(name, key, fallback) {
    var store = storage(name);
    try { var raw = store && store.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
  }
  function getStored(name, key) {
    var store = storage(name);
    try { return store ? store.getItem(key) : null; } catch (e) { return null; }
  }
  function setStored(name, key, value) {
    var store = storage(name);
    try { if (store) store.setItem(key, value); } catch (e) { /* Safari private mode may reject storage writes. */ }
  }
  function removeStored(name, key) {
    var store = storage(name);
    try { if (store) store.removeItem(key); } catch (e) {}
  }

  /** 비밀번호는 이 기기(localStorage)에는 그대로, 클라우드(RTDB)에는 해시로만 올린다 —
   * RTDB 규칙이 인증 없이 열려 있어 누구나 읽을 수 있으므로, 평문이 그대로 올라가면 안 된다. */
  function sha256Hex(text) {
    if (!(global.crypto && global.crypto.subtle && global.crypto.subtle.digest && global.TextEncoder)) {
      return Promise.resolve(''); // http:// 이외(구형 브라우저 등) 환경 — 해시를 못 만들면 클라우드에 비밀번호를 아예 안 올린다
    }
    var bytes = new global.TextEncoder().encode(String(text == null ? '' : text));
    return global.crypto.subtle.digest('SHA-256', bytes).then(function (buf) {
      var arr = new Uint8Array(buf), hex = '';
      for (var i = 0; i < arr.length; i++) hex += (arr[i] < 16 ? '0' : '') + arr[i].toString(16);
      return hex;
    })['catch'](function () { return ''; });
  }

  /** RTDB system/users 에 올릴 사용자 프로필 — password 필드를 빼고 passwordHash 로 바꾼다.
   * 이 기기에 평문이 없으면(다른 기기에서 등록된 계정을 이름·역할만 고쳐 저장하는 경우)
   * 절대 새로 해시를 계산하지 않는다 — item.password 가 없으면 빈 문자열의 해시가 나와서,
   * 그대로 올리면 실제 비밀번호가 지워진 것처럼 돼 버린다. 그럴 땐 이미 알고 있는 해시를
   * 그대로 유지한다. */
  function cloudUserPayload(item) {
    var payload = {};
    Object.keys(item || {}).forEach(function (k) { if (k !== 'password') payload[k] = item[k]; });
    if (item && item.password) {
      return sha256Hex(item.password).then(function (hash) {
        if (hash) payload.passwordHash = hash;
        return payload;
      });
    }
    if (item && item.passwordHash) payload.passwordHash = item.passwordHash;
    return Promise.resolve(payload);
  }

  /** 로그인 시 비밀번호 대조 — 이 기기에 평문이 있으면 그걸로, 없고 해시만 있으면(다른
   * 기기에서 등록된 뒤 클라우드로 넘어온 계정) 해시로 비교한다. 아예 비밀번호가 없는
   * 레코드는(과거 동작 유지) 통과시킨다. */
  function passwordMatches(localUser, password) {
    if (!localUser) return Promise.resolve(false);
    if (localUser.password !== undefined && localUser.password !== '') {
      return Promise.resolve(localUser.password === password);
    }
    if (localUser.passwordHash) {
      return sha256Hex(password).then(function (hash) { return !!hash && hash === localUser.passwordHash; });
    }
    return Promise.resolve(true);
  }
  /** 'local-token-…'는 이 사이트 안에서만 쓰는 표식이지 Firebase 가 아는 진짜 토큰이 아니다.
   * RTDB REST API 는 auth= 파라미터에 뭐가 오든(빈 값이 아닌 한) 유효한 토큰인지부터
   * 검사해서, 이걸 그대로 보내면 규칙이 열려 있어도 401 로 거부된다. 그래서 로컬 로그인일
   * 때는 auth= 자체를 아예 안 보낸다(=로그인 전과 똑같이 익명 요청) — RTDB 쪽에서 "누가
   * 로그인했는지"는 어차피 못 가리므로 잃는 게 없다. */
  function isRealToken(t) { return !!t && t.indexOf('local-token-') !== 0; }
  function rootUrl(path) {
    var c = config();
    var root = String(c.databaseURL || '').replace(/\/$/, '') + '/' + (c.root || 'dkj-fssc22000');
    var authParam = isRealToken(state.token) ? ('?auth=' + encodeURIComponent(state.token)) : '';
    return root + (path ? '/' + path : '') + '.json' + authParam;
  }
  function authError(code, cause) {
    var err = new Error(code);
    err.code = code;
    if (cause) err.cause = cause;
    return err;
  }
  function fetchWithTimeout(url, options) {
    var opts = options || {}, requestOpts = {}, controller = null, timer;
    Object.keys(opts).forEach(function (key) { requestOpts[key] = opts[key]; });
    if (typeof global.AbortController === 'function') {
      controller = new global.AbortController();
      requestOpts.signal = controller.signal;
    }
    var request = fetch(url, requestOpts)['catch'](function (err) {
      if (err && err.name === 'AbortError') throw authError('NETWORK_TIMEOUT', err);
      throw authError('NETWORK_ERROR', err);
    });
    var timeout = new Promise(function (_, reject) {
      timer = setTimeout(function () {
        if (controller) controller.abort();
        reject(authError('NETWORK_TIMEOUT'));
      }, REQUEST_TIMEOUT_MS);
    });
    return Promise.race([request, timeout]).then(function (response) {
      clearTimeout(timer);
      return response;
    }, function (err) {
      clearTimeout(timer);
      throw err;
    });
  }
  function responseJson(response) {
    return response.text().then(function (text) {
      if (!text) return {};
      try { return JSON.parse(text); } catch (e) { throw authError('INVALID_RESPONSE', e); }
    })['catch'](function (err) {
      if (err && err.code) throw err;
      throw authError('INVALID_RESPONSE', err);
    });
  }
  function emitReady() {
    try { document.dispatchEvent(new CustomEvent('dkj:auth-ready', { detail: user() })); } catch (e) {}
  }

  function persist(empId, name, idToken, refreshToken, uid, role) {
    state = {
      token: idToken || '',
      uid: uid || '',
      empId: String(empId || ''),
      name: name || String(empId || ''),
      role: normalizeRole(role || defaultRole(empId))
    };
    var saved = { token: state.token, uid: state.uid, empId: state.empId, name: state.name, role: state.role };
    setStored('sessionStorage', SESSION_KEY, JSON.stringify(saved));
    setStored('localStorage', USER_KEY, JSON.stringify({ empId: state.empId, name: state.name, role: state.role }));
    if (refreshToken) setStored('localStorage', refreshKey(state.empId), refreshToken);
  }

  async function signIn(empId, password) {
    var r = await fetchWithTimeout('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + config().apiKey, {
      method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email(empId), password: password, returnSecureToken: true })
    });
    var d = await responseJson(r);
    if (!r.ok) throw new Error((d.error && d.error.message) || 'SIGNIN_FAILED');
    return d;
  }
  async function refresh(refreshToken) {
    var r = await fetchWithTimeout('https://securetoken.googleapis.com/v1/token?key=' + config().apiKey, {
      method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(refreshToken)
    });
    var d = await responseJson(r);
    if (!r.ok) throw new Error((d.error && d.error.message) || 'REFRESH_FAILED');
    return { idToken: d.id_token, refreshToken: d.refresh_token, uid: d.user_id };
  }
  async function request(path, method, data, retried) {
    // RTDB 규칙이 인증 없이 열려 있으므로(파이어베이스 로그인 없이도 동기화되게 하려고),
    // 로그인 전이라도(state.token 없어도) 요청은 보낸다 — 로그인 화면 뜨기 전에 사용자
    // 목록을 미리 받아오는 데도 쓰인다.
    if (!configured()) throw new Error('NOT_CONFIGURED');
    var r = await fetchWithTimeout(rootUrl(path), {
      method: method || 'GET', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data)
    });
    if (r.status === 401) {
      /* 로컬 계정 세션(가짜 토큰)은 재인증할 진짜 Firebase 자격이 없다 — 재시도해도 다시 401만
       * 나므로(그리고 옛날 흔적이 남아 있으면 그걸로 세션이 깨진 진짜 토큰으로 바뀌는 부작용까지
       * 생긴다), 진짜 토큰이었을 때만 재인증을 시도한다. */
      if (retried || !state.empId || !isRealToken(state.token)) throw authError('SESSION_EXPIRED');
      await reauth();
      return request(path, method, data, true);
    }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return responseJson(r);
  }

  function scriptRoot() {
    var all = document.getElementsByTagName('script');
    for (var i = all.length - 1; i >= 0; i--) {
      var src = all[i].src || '';
      if (src.indexOf('dkj-auth.js') !== -1) return src.split('?')[0].replace(/js\/dkj-auth\.js$/, '');
    }
    return '';
  }
  var DIRECTORY_KEY = 'dkj:auth:directory:v3';
  var DEFAULT_DIRECTORY = {
    '4343': { empId: '4343', name: '고환석', role: 'system_admin', password: '4343', createdAt: '2026-08-01T00:00:00.000Z' }
  };

  function getDirectory() {
    var stored = readJson('localStorage', DIRECTORY_KEY, null);
    if (!stored || typeof stored !== 'object') {
      stored = Object.assign({}, DEFAULT_DIRECTORY);
      setStored('localStorage', DIRECTORY_KEY, JSON.stringify(stored));
    }
    if (!stored['4343']) {
      stored['4343'] = Object.assign({}, DEFAULT_DIRECTORY['4343']);
    }
    return stored;
  }

  function saveDirectory(dir) {
    if (!dir || typeof dir !== 'object') return;
    setStored('localStorage', DIRECTORY_KEY, JSON.stringify(dir));
    if (!staffCache) staffCache = {};
    Object.keys(dir).forEach(function (id) {
      var item = dir[id];
      staffCache[id] = {
        name: item.name || id,
        role: item.role || 'worker',
        stages: (ROLES[normalizeRole(item.role)] || ROLES.worker).stages
      };
    });
    try { document.dispatchEvent(new CustomEvent('dkj:staff-loaded')); } catch (e) {}
  }

  function addUser(data) {
    var id = normId(data.empId);
    if (!id) throw new Error('사번(ID)을 입력하세요.');
    var dir = getDirectory();
    if (dir[id]) throw new Error('이미 등록된 사번입니다: ' + id);
    var item = {
      uid: 'uid-' + id,
      empId: id,
      name: String(data.name || id).trim(),
      role: normalizeRole(data.role || 'worker'),
      password: String(data.password || id).trim(),
      createdAt: new Date().toISOString(),
      lastLoginAt: ''
    };
    dir[id] = item;
    saveDirectory(dir);
    if (configured() && state.token) {
      cloudUserPayload(item).then(function (payload) {
        return request('system/users/' + encodeURIComponent(item.uid), 'PUT', payload);
      })['catch'](function () {});
    }
    return item;
  }

  function saveUser(empId, data) {
    var oldId = normId(empId);
    var dir = getDirectory();
    if (!dir[oldId]) throw new Error('사용자를 찾을 수 없습니다.');
    var item = dir[oldId];

    // ID(사번) 변경 처리
    var newId = data.newEmpId || data.empId;
    if (newId) {
      newId = normId(newId);
      if (newId !== oldId) {
        if (oldId === ADMIN_EMP_ID) throw new Error('시스템 관리자(4343)의 아이디는 변경할 수 없습니다.');
        if (dir[newId]) throw new Error('이미 사용 중인 아이디/사번입니다: ' + newId);
        delete dir[oldId];
        item.empId = newId;
        item.uid = 'uid-' + newId;
        dir[newId] = item;
        if (state.empId === oldId) {
          state.empId = newId;
          persist(newId, item.name || newId, state.token, null, item.uid, item.role);
        }
      }
    }

    if (data.name !== undefined) item.name = String(data.name).trim();
    if (data.role !== undefined && item.empId !== ADMIN_EMP_ID) item.role = normalizeRole(data.role);
    if (data.password) item.password = String(data.password).trim();
    item.updatedAt = new Date().toISOString();

    var currentId = item.empId || oldId;
    dir[currentId] = item;
    saveDirectory(dir);
    if (configured() && state.token) {
      var uidToWrite = item.uid || ('uid-' + currentId);
      cloudUserPayload(item).then(function (payload) {
        return request('system/users/' + encodeURIComponent(uidToWrite), 'PUT', payload);
      })['catch'](function () {});
    }
    return item;
  }

  function deleteUser(empId) {
    var id = normId(empId);
    if (id === ADMIN_EMP_ID) throw new Error('시스템 관리자(4343) 계정은 삭제할 수 없습니다.');
    var dir = getDirectory();
    if (!dir[id]) return;
    var uid = dir[id].uid || ('uid-' + id);
    delete dir[id];
    saveDirectory(dir);
    if (configured() && state.token) {
      request('system/users/' + encodeURIComponent(uid), 'DELETE').catch(function () {});
    }
  }

  function loadStaff() {
    var dir = getDirectory();
    staffCache = {};
    Object.keys(dir).forEach(function (id) {
      var item = dir[id];
      staffCache[id] = {
        name: item.name || id,
        role: item.role || 'worker',
        stages: (ROLES[normalizeRole(item.role)] || ROLES.worker).stages
      };
    });
    try { document.dispatchEvent(new CustomEvent('dkj:staff-loaded')); } catch (e) {}
    return Promise.resolve(staffCache);
  }

  function loadUsers() {
    var dir = getDirectory();
    loadStaff();
    if (!configured()) return Promise.resolve(dir);
    return request('system/users', 'GET').then(function (remoteUsers) {
      var rows = remoteUsers || {};
      var tasks = Object.keys(rows).map(function (uid) {
        var row = rows[uid] || {};
        var eid = normId(row.empId || uid.replace(/^uid-/, ''));
        if (!eid) return null;
        if (!dir[eid]) {
          dir[eid] = {
            uid: uid,
            empId: eid,
            name: row.name || eid,
            role: row.role || 'worker',
            // 새 기기가 이 계정을 처음 보는 경우 평문 비밀번호는 없다 — 클라우드에는
            // 해시만 올라가므로, 있으면 해시로 로그인을 검증한다(passwordMatches 참고).
            passwordHash: row.passwordHash || '',
            createdAt: row.createdAt || new Date().toISOString(),
            lastLoginAt: row.lastLoginAt || ''
          };
          return null;
        }
        if (row.name) dir[eid].name = row.name;
        if (row.role && eid !== ADMIN_EMP_ID) dir[eid].role = row.role;
        if (row.lastLoginAt) dir[eid].lastLoginAt = row.lastLoginAt;
        if (!row.passwordHash) return null;
        // 이 기기에 남아 있는 평문이 클라우드 해시와 다르면, 다른 기기에서 비밀번호가
        // 바뀐 것이다 — 옛 평문을 버리고 새 해시를 따라간다(옛 비밀번호가 계속 통하면 안 됨).
        if (dir[eid].password) {
          return sha256Hex(dir[eid].password).then(function (localHash) {
            if (localHash !== row.passwordHash) {
              delete dir[eid].password;
              dir[eid].passwordHash = row.passwordHash;
            }
          });
        }
        dir[eid].passwordHash = row.passwordHash;
        return null;
      });
      return Promise.all(tasks).then(function () {
        saveDirectory(dir);
        return dir;
      });
    }).catch(function () {
      return dir;
    });
  }

  async function loadAssignedRole() {
    var dir = getDirectory();
    var localUser = dir[state.empId];
    if (localUser && localUser.role) {
      state.role = normalizeRole(localUser.role);
    }
    if (!configured() || !state.uid) return state.role;
    try {
      var profile = await request('system/users/' + encodeURIComponent(state.uid), 'GET');
      if (profile && profile.role) {
        state.role = normalizeRole(profile.role);
      }
    } catch (e) {}
    return state.role;
  }

  async function login(empId, password) {
    var raw = String(empId == null ? '' : empId).trim();
    var id = normId(raw);
    var dir = getDirectory();
    var localUser = dir[raw] || dir[id] || dir[raw.toLowerCase()];

    /* 이 기기가 방금 캐시 삭제 등으로 로컬 디렉터리를 잃었으면, 여기 dir 는 아직
     * DEFAULT_DIRECTORY 의 하드코딩된 기본값(4343 비밀번호="4343")뿐이다. 진짜 최신
     * 비밀번호 해시는 loadUsers() 가 system/users 에서 백그라운드로 받아오는데, 로그인
     * 화면은 그걸 기다리지 않고 바로 뜬다(느린 회선 배려) — 그래서 화면이 뜨자마자
     * 바로 로그인을 시도하면 그 백그라운드 동기화가 아직 안 끝나 있을 수 있다. 그 순간
     * 비밀번호 대조가 실패하면 곧장 2번(옛 Firebase 인증) 경로로 새 버려, 실제로는
     * 정식 로컬 계정인데도 깨진 레거시 인증을 타서 이후 요청마다 401이 나는 원인이 됐다.
     * 그래서 로컬 대조가 처음에 실패하면, 폴백으로 쓰지 말고 클라우드에서 한 번 더
     * 받아와서 다시 대조해 본다. */
    if (!(localUser && await passwordMatches(localUser, password)) && configured()) {
      try {
        dir = await loadUsers();
        localUser = dir[raw] || dir[id] || dir[raw.toLowerCase()];
      } catch (e) { /* 오프라인이면 기존 로컬 값으로 계속 진행 */ }
    }

    // 1. 로컬(=시스템 설정에서 등록한) 사용자 디렉터리로 로그인한다 — 이게 정식 경로다.
    if (localUser && await passwordMatches(localUser, password)) {
      var activeId = localUser.empId || id;
      localUser.lastLoginAt = new Date().toISOString();
      saveDirectory(dir);
      /* 과거(콘솔에서 직접 만든 계정 시절)의 진짜 Firebase 갱신 토큰이 이 기기에 남아 있으면,
       * 아래 request()의 401 재인증 로직이 그 흔적을 집어 들고 로컬 세션을 깨진 진짜 토큰으로
       * 덮어써 버린다 — 로컬 로그인이 확정되는 순간 그 흔적을 지운다. */
      removeStored('localStorage', refreshKey(activeId));
      persist(activeId, localUser.name || activeId, 'local-token-' + activeId, null, 'uid-' + activeId, localUser.role);
      if (global.DkjCloudSync) global.DkjCloudSync.start();
      return user();
    }

    // 2. Firebase 원격 인증 시도 — 과거에 콘솔에서 직접 만든 계정이 남아 있을 때만 쓰인다.
    if (configured()) {
      var d = await signIn(id, password);
      var name = d.displayName || (localUser && localUser.name) || id;
      persist(id, name, d.idToken, d.refreshToken, d.localId, (localUser && localUser.role) || defaultRole(id));
      await loadAssignedRole();
      if (global.DkjCloudSync) global.DkjCloudSync.start();
      return user();
    }

    throw new Error('INVALID_LOGIN_CREDENTIALS');
  }

  async function resume() {
    if (!configured()) throw new Error('NOT_CONFIGURED');
    /* 로컬 디렉터리(시스템 설정에서 등록한 계정)에 있는 사번은 항상 로컬 세션으로 복원한다 —
     * 예전(진짜 Firebase Auth 시절)에 저장된 세션·갱신 토큰 흔적이 sessionStorage/localStorage에
     * 남아 있어도 그걸 절대 신뢰하지 않는다. 그 흔적이 깨진 토큰이면 매번 재인증→401을 반복하는
     * 루프의 원인이 되므로, 여기서 아예 그 경로 자체를 막는다. */
    var dir = getDirectory();
    var sess = readJson('sessionStorage', SESSION_KEY, null);
    if (sess && sess.token) {
      var sessLocalUser = dir[sess.empId];
      if (sessLocalUser && isRealToken(sess.token)) {
        removeStored('localStorage', refreshKey(sess.empId));
        persist(sess.empId, sessLocalUser.name || sess.empId, 'local-token-' + sess.empId, null, 'uid-' + sess.empId, sessLocalUser.role);
      } else {
        persist(sess.empId, sess.name, sess.token, null, sess.uid, sess.role);
      }
      await loadAssignedRole();
      if (global.DkjCloudSync) global.DkjCloudSync.start();
      return state;
    }
    var last = readJson('localStorage', USER_KEY, readJson('localStorage', LEGACY_USER_KEY, null));
    if (!last || !last.empId) throw new Error('NO_SESSION');
    var lastLocalUser = dir[last.empId];
    if (lastLocalUser) {
      removeStored('localStorage', refreshKey(last.empId));
      persist(last.empId, lastLocalUser.name || last.empId, 'local-token-' + last.empId, null, 'uid-' + last.empId, lastLocalUser.role);
      await loadAssignedRole();
      if (global.DkjCloudSync) global.DkjCloudSync.start();
      return state;
    }
    var saved = getStored('localStorage', refreshKey(last.empId));
    if (!saved) throw new Error('NO_SESSION');
    var d = await refresh(saved);
    persist(last.empId, last.name, d.idToken, d.refreshToken || saved, d.uid, last.role || defaultRole(last.empId));
    await loadAssignedRole();
    if (global.DkjCloudSync) global.DkjCloudSync.start();
    return state;
  }

  function logout() {
    var empId = state.empId;
    state = { token: '', uid: '', empId: '', name: '', role: 'worker' };
    removeStored('sessionStorage', SESSION_KEY);
    removeStored('localStorage', USER_KEY);
    removeStored('localStorage', LEGACY_USER_KEY);
    if (empId) removeStored('localStorage', refreshKey(empId));
    var bar = document.querySelector('.dkj-auth-bar');
    if (bar) bar.remove();
    emitReady();
    if (isPublicPage()) return;
    showLogin('로그아웃되었습니다. 다른 사번으로 로그인할 수 있습니다.');
  }
  async function reauth() {
    if (!state.empId) throw new Error('NO_SESSION');
    var saved = getStored('localStorage', refreshKey(state.empId));
    if (!saved) throw new Error('NO_SESSION');
    var d = await refresh(saved);
    persist(state.empId, state.name, d.idToken, d.refreshToken || saved, d.uid, state.role);
    return state.token;
  }

  function can(stageKey, who) {
    var u = who === undefined ? (state.empId ? state : null) : who;
    if (!u || !u.empId) return !configured();
    if (who === undefined || (u.empId === state.empId && state.role)) return ROLES[normalizeRole(state.role)].stages.indexOf(stageKey) !== -1;
    if (!staffCache || !Object.keys(staffCache).length) return true;
    var row = staffCache[u.empId];
    if (!row) return false;
    if (row.role && ROLES[row.role]) return ROLES[row.role].stages.indexOf(stageKey) !== -1;
    return (row.stages || []).indexOf(stageKey) !== -1;
  }
  function denyReason(stageKey, who) {
    if (can(stageKey, who)) return '';
    var u = who === undefined ? state : who;
    return ((u && (u.name || u.empId)) || '현재 사용자') + ' 님에게는 ' + stageKey + ' 권한이 없습니다.';
  }
  function user() { return state.empId ? { uid: state.uid, empId: state.empId, name: state.name, role: state.role, roleLabel: roleLabel(state.role) } : null; }

  function styles() {
    if (document.getElementById('dkj-auth-style')) return;
    var s = document.createElement('style');
    s.id = 'dkj-auth-style';
    s.textContent = [
      '.dkj-auth-mask{position:fixed;inset:0;z-index:2147483000;background:#0f172a;display:flex;align-items:center;justify-content:center;padding:20px;font-family:"Noto Sans KR",sans-serif}',
      '.dkj-auth-card{background:#fff;border-radius:18px;padding:32px 28px;width:100%;max-width:380px;box-shadow:0 18px 50px #0006}',
      '.dkj-auth-card h1{margin:0 0 6px;font-size:20px;color:#0f172a}.dkj-auth-card p{margin:0 0 22px;font-size:13px;color:#64748b;line-height:1.6}',
      '.dkj-auth-card label{display:block;font-size:13px;font-weight:700;color:#334155;margin:0 0 6px}.dkj-auth-card input{width:100%;box-sizing:border-box;padding:13px 14px;font-size:16px;border:1.5px solid #cbd5e1;border-radius:10px;margin:0 0 16px}',
      '.dkj-auth-card input:focus{outline:none;border-color:#009a44}.dkj-auth-card button{width:100%;padding:14px;font-size:16px;font-weight:700;color:#fff;background:#009a44;border:0;border-radius:10px;cursor:pointer}',
      '.dkj-auth-card button:disabled{background:#94a3b8;cursor:default}.dkj-auth-err{margin:14px 0 0;font-size:13px;color:#b91c1c;line-height:1.6;min-height:1em}',
      '.dkj-auth-bar{display:flex;align-items:center;gap:9px;justify-content:flex-end;padding:6px 14px;font-size:12px;color:#475569;background:#f1f5f9;border-bottom:1px solid #e2e8f0}.dkj-auth-bar b{color:#0f172a}.dkj-auth-role{color:#007a35;font-weight:800}',
      '.dkj-auth-bar button{border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:3px 10px;font-size:12px;cursor:pointer;color:#475569}@media print{.dkj-auth-bar,.dkj-auth-mask{display:none!important}}'
    ].join('');
    document.head.appendChild(s);
  }
  function showLogin(reason) {
    styles();
    var current = document.querySelector('.dkj-auth-mask');
    if (current) return;
    var mask = document.createElement('div');
    mask.className = 'dkj-auth-mask';
    mask.innerHTML = '<form class="dkj-auth-card"><h1>동김제농협 스마트 HACCP</h1><p>업무 콘솔을 이용하려면 로그인이 필요합니다.<br>사번과 비밀번호를 입력하세요.</p><label for="dkjEmpId">사번</label><input id="dkjEmpId" inputmode="numeric" autocomplete="username" required><label for="dkjPw">비밀번호</label><input id="dkjPw" type="password" autocomplete="current-password" required><button type="submit">로그인</button><p class="dkj-auth-err">' + (reason || '') + '</p></form>';
    document.body.appendChild(mask);
    var form = mask.querySelector('form'), err = mask.querySelector('.dkj-auth-err'), btn = mask.querySelector('button');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var id = mask.querySelector('#dkjEmpId').value.trim(), pw = mask.querySelector('#dkjPw').value;
      if (!id || !pw) return;
      btn.disabled = true; err.textContent = '';
      login(id, pw).then(function () {
        mask.remove(); renderBar(); emitReady();
      }).catch(function (ex) {
        btn.disabled = false;
        var code = String((ex && (ex.code || ex.message)) || 'UNKNOWN_ERROR');
        err.textContent = code === 'NOT_CONFIGURED' ? '클라우드 설정이 아직 완료되지 않았습니다.' :
          (code === 'NETWORK_TIMEOUT' || code === 'NETWORK_ERROR') ? '인터넷 연결을 확인한 뒤 다시 시도하세요.' :
          code === 'INVALID_RESPONSE' ? '로그인 서버 응답이 올바르지 않습니다. 다시 시도하세요.' :
          code === 'SESSION_EXPIRED' ? '로그인이 만료되었습니다. 다시 로그인해 주세요.' :
          (code === 'INVALID_LOGIN_CREDENTIALS' || code.indexOf('PASSWORD') >= 0 || code.indexOf('EMAIL') >= 0) ? '사번 또는 비밀번호가 맞지 않습니다.' :
          '로그인에 실패했습니다. 잠시 후 다시 시도하세요.';
      });
    });
    mask.querySelector('#dkjEmpId').focus();
  }
  function renderBar() {
    if (!state.empId || document.querySelector('.dkj-auth-bar')) return;
    styles();
    var bar = document.createElement('div');
    bar.className = 'dkj-auth-bar';
    bar.innerHTML = '<span>로그인: <b>' + (state.name || state.empId) + '</b></span><span class="dkj-auth-role">' + roleLabel(state.role) + '</span><button type="button">로그아웃</button>';
    bar.querySelector('button').addEventListener('click', logout);
    document.body.insertBefore(bar, document.body.firstChild);
    Array.prototype.forEach.call(document.querySelectorAll('[data-system-admin]'), function (el) { el.hidden = !isSystemAdmin(); });
  }
  function isPublicPage() { return /\/company-profile\.html$/i.test(location.pathname); }
  function requireLogin() {
    return resume().then(function () { renderBar(); emitReady(); return state; }).catch(function (e) {
      if (e.message === 'NOT_CONFIGURED') { console.warn('[DkjAuth] 클라우드 미설정 — 로컬 저장으로만 동작합니다.'); return null; }
      // 로그인 화면은 네트워크를 기다리지 않고 바로 띄운다(느린 회선에서 화면이 몇 초씩
      // 멈춰 보이면 안 된다). 최신 사용자 목록은 뒤에서 조용히 받아온다 — 관리자가 다른
      // 기기에서 방금 등록한 직원도, 그 요청이 화면을 다 그리기 전에 끝나면 바로 로그인된다.
      showLogin('');
      loadUsers()['catch'](function () {});
      throw e;
    });
  }

  global.DkjAuth = {
    login: login, logout: logout, resume: resume, reauth: reauth, requireLogin: requireLogin,
    configured: configured, user: user, token: function () { return state.token; }, role: function () { return state.role; },
    roleLabel: roleLabel, roles: function () { return ROLES; }, isSystemAdmin: isSystemAdmin,
    request: request, loadAssignedRole: loadAssignedRole, loadStaff: loadStaff, loadUsers: loadUsers, staff: function () { return staffCache; },
    getDirectory: getDirectory, addUser: addUser, saveUser: saveUser, deleteUser: deleteUser,
    can: can, denyReason: denyReason
  };

  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    if (/\/records\//.test(location.pathname)) loadStaff()['catch'](function () {});
    if (isPublicPage()) resume().then(function () { renderBar(); emitReady(); }).catch(function () {});
    else requireLogin().catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  // 일부 모바일 PWA에서 DOMContentLoaded 감지가 늦는 경우를 대비한 안전망이다.
  global.addEventListener('load', boot);
})(window);
