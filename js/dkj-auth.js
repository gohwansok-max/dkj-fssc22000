/**
 * 동김제농협 로그인·역할 기반 권한관리.
 *
 * - 모든 업무 화면은 로그인 후 사용한다. 회사소개서는 고객 공유용으로 공개한다.
 * - Firebase Authentication은 본인 확인을, RTDB system/users는 역할 저장을 담당한다.
 * - 시스템 관리자(emp4343)만 사용자 역할을 변경할 수 있다.
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
  function rootUrl(path) {
    var c = config();
    var root = String(c.databaseURL || '').replace(/\/$/, '') + '/' + (c.root || 'dkj-fssc22000');
    return root + (path ? '/' + path : '') + '.json?auth=' + encodeURIComponent(state.token || '');
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
    if (!state.token) throw new Error('NO_SESSION');
    var r = await fetchWithTimeout(rootUrl(path), {
      method: method || 'GET', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data)
    });
    if (r.status === 401) {
      if (retried) throw authError('SESSION_EXPIRED');
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
  function loadStaff() {
    if (staffCache) return Promise.resolve(staffCache);
    if (global.DKJ_STAFF_ROLES) {
      staffCache = global.DKJ_STAFF_ROLES.staff || {};
      return Promise.resolve(staffCache);
    }
    var root = scriptRoot();
    return fetch(root + 'data/staff-roles.json')
      .then(function (r) { if (!r.ok) throw new Error('staff-roles'); return r.json(); })
      ['catch'](function () {
        return new Promise(function (resolve) {
          var s = document.createElement('script');
          s.src = root + 'js/staff-roles.bundle.js';
          s.onload = function () { resolve(global.DKJ_STAFF_ROLES || { staff: {} }); };
          s.onerror = function () { resolve({ staff: {} }); };
          document.head.appendChild(s);
        });
      })
      .then(function (d) {
        staffCache = (d && d.staff) || {};
        try { document.dispatchEvent(new CustomEvent('dkj:staff-loaded')); } catch (e) {}
        return staffCache;
      });
  }

  async function loadAssignedRole() {
    if (!configured() || !state.uid) return state.role;
    try {
      var profile = await request('system/users/' + encodeURIComponent(state.uid), 'GET');
      if (!profile) {
        profile = {
          uid: state.uid,
          empId: state.empId,
          name: state.name || '',
          role: defaultRole(state.empId),
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        };
        await request('system/users/' + encodeURIComponent(state.uid), 'PUT', profile);
      } else {
        profile.role = normalizeRole(profile.role);
        profile.lastLoginAt = new Date().toISOString();
        try { await request('system/users/' + encodeURIComponent(state.uid), 'PATCH', { lastLoginAt: profile.lastLoginAt }); } catch (e) {}
      }
      persist(state.empId, profile.name || state.name, state.token, null, state.uid, profile.role);
    } catch (e) {
      // Firebase 보안 규칙이 아직 게시되지 않은 초기 전환 기간에는 기본 역할로 화면을 연다.
      // 역할 변경 저장만 막히며, 설정 화면에서 이유를 안내한다.
      state.role = defaultRole(state.empId);
    }
    return state.role;
  }

  async function login(empId, password) {
    if (!configured()) throw new Error('NOT_CONFIGURED');
    var id = normId(empId), d = await signIn(id, password), name = d.displayName || '';
    if (!name) {
      try {
        var st = await loadStaff();
        if (st && st[id] && st[id].name) name = st[id].name;
      } catch (e) {}
    }
    persist(id, name || id, d.idToken, d.refreshToken, d.localId, defaultRole(id));
    await loadAssignedRole();
    if (global.DkjCloudSync) global.DkjCloudSync.start();
    return user();
  }

  async function resume() {
    if (!configured()) throw new Error('NOT_CONFIGURED');
    var sess = readJson('sessionStorage', SESSION_KEY, null);
    if (sess && sess.token) {
      persist(sess.empId, sess.name, sess.token, null, sess.uid, sess.role);
      await loadAssignedRole();
      if (global.DkjCloudSync) global.DkjCloudSync.start();
      return state;
    }
    var last = readJson('localStorage', USER_KEY, readJson('localStorage', LEGACY_USER_KEY, null));
    if (!last || !last.empId) throw new Error('NO_SESSION');
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
      showLogin(''); throw e;
    });
  }

  global.DkjAuth = {
    login: login, logout: logout, resume: resume, reauth: reauth, requireLogin: requireLogin,
    configured: configured, user: user, token: function () { return state.token; }, role: function () { return state.role; },
    roleLabel: roleLabel, roles: function () { return ROLES; }, isSystemAdmin: isSystemAdmin,
    request: request, loadAssignedRole: loadAssignedRole, loadStaff: loadStaff, staff: function () { return staffCache; },
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
