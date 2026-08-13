/**
 * 동김제농협 로그인 — 직원별 Firebase 계정.
 *
 * 설계 원칙
 *  - 공용 비밀번호를 배포본에 넣지 않는다. 직원마다 자기 계정으로 로그인한다.
 *  - 계정은 Firebase 콘솔에서 관리자가 미리 만든다(공개 가입은 콘솔에서 차단).
 *    이메일은 emp<사번>@dkj-fssc.internal 형식, 표시이름(displayName)에 실명을 넣으면
 *    기록의 작성자/결재자 이름으로 그대로 쓰인다.
 *  - 비밀번호는 이 코드 어디에도 저장하지 않는다. Firebase 가 발급한 refreshToken 만
 *    기기에 남겨 다음 접속 때 자동 로그인한다.
 *
 * records/ 아래 기록 서식은 로그인해야 열린다(작성자 없는 기록을 막기 위함).
 */
(function (global) {
  'use strict';
  if (global.DkjAuth) return;

  var CFG = global.DKJ_FIREBASE || {};
  var SESSION_KEY = 'dkj:auth:session:v1';     // sessionStorage — idToken 등
  var USER_KEY = 'dkj:auth:user:v1';           // localStorage — 표시용(사번/이름)
  function refreshKey(empId) { return 'dkj:auth:refreshtoken:emp' + empId + ':v1'; }

  var state = { token: '', uid: '', empId: '', name: '' };

  function configured() {
    return !!(CFG.apiKey && CFG.databaseURL);
  }

  function email(empId) {
    return 'emp' + String(empId).trim() + (CFG.emailDomain || '@dkj-fssc.internal');
  }

  function readJson(store, key, fallback) {
    try {
      var raw = store.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  function persist(empId, name, idToken, refreshToken, uid) {
    state = { token: idToken, uid: uid, empId: String(empId), name: name || String(empId) };
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: idToken, uid: uid, empId: state.empId, name: state.name }));
      localStorage.setItem(USER_KEY, JSON.stringify({ empId: state.empId, name: state.name }));
      if (refreshToken) localStorage.setItem(refreshKey(empId), refreshToken);
    } catch (e) {}
  }

  async function signIn(empId, password) {
    var r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + CFG.apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email(empId), password: password, returnSecureToken: true })
    });
    var d = await r.json();
    if (!r.ok) throw new Error((d.error && d.error.message) || 'SIGNIN_FAILED');
    return d;
  }

  async function refresh(refreshToken) {
    var r = await fetch('https://securetoken.googleapis.com/v1/token?key=' + CFG.apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(refreshToken)
    });
    var d = await r.json();
    if (!r.ok) throw new Error((d.error && d.error.message) || 'REFRESH_FAILED');
    return { idToken: d.id_token, refreshToken: d.refresh_token, uid: d.user_id };
  }

  async function login(empId, password) {
    if (!configured()) throw new Error('NOT_CONFIGURED');
    var d = await signIn(empId, password);
    persist(empId, d.displayName || String(empId), d.idToken, d.refreshToken, d.localId);
    if (global.DkjCloudSync) global.DkjCloudSync.start();
    return { empId: state.empId, name: state.name };
  }

  /** 저장된 refreshToken 으로 조용히 세션을 잇는다(로그인 화면 없이). */
  async function resume() {
    if (!configured()) throw new Error('NOT_CONFIGURED');
    var sess = readJson(sessionStorage, SESSION_KEY, null);
    if (sess && sess.token) {
      state = { token: sess.token, uid: sess.uid, empId: sess.empId, name: sess.name };
      if (global.DkjCloudSync) global.DkjCloudSync.start();
      return state;
    }
    var last = readJson(localStorage, USER_KEY, null);
    if (!last || !last.empId) throw new Error('NO_SESSION');
    var saved = null;
    try { saved = localStorage.getItem(refreshKey(last.empId)); } catch (e) {}
    if (!saved) throw new Error('NO_SESSION');
    var d = await refresh(saved);
    persist(last.empId, last.name, d.idToken, d.refreshToken || saved, d.uid);
    if (global.DkjCloudSync) global.DkjCloudSync.start();
    return state;
  }

  function logout() {
    var empId = state.empId;
    state = { token: '', uid: '', empId: '', name: '' };
    try {
      sessionStorage.removeItem(SESSION_KEY);
      if (empId) localStorage.removeItem(refreshKey(empId));
    } catch (e) {}
    location.reload();
  }

  /** 만료된 idToken 을 refreshToken 으로 갱신 — 동기화 모듈이 401 을 만나면 부른다. */
  async function reauth() {
    if (!state.empId) throw new Error('NO_SESSION');
    var saved = localStorage.getItem(refreshKey(state.empId));
    if (!saved) throw new Error('NO_SESSION');
    var d = await refresh(saved);
    persist(state.empId, state.name, d.idToken, d.refreshToken || saved, d.uid);
    return state.token;
  }

  // ── 로그인 화면 ────────────────────────────────────────────────
  function styles() {
    if (document.getElementById('dkj-auth-style')) return;
    var s = document.createElement('style');
    s.id = 'dkj-auth-style';
    s.textContent = [
      '.dkj-auth-mask{position:fixed;inset:0;z-index:2147483000;background:#0f172a;',
      'display:flex;align-items:center;justify-content:center;padding:20px;',
      "font-family:'Noto Sans KR',sans-serif}",
      '.dkj-auth-card{background:#fff;border-radius:18px;padding:32px 28px;width:100%;max-width:380px;',
      'box-shadow:0 18px 50px #0006}',
      '.dkj-auth-card h1{margin:0 0 6px;font-size:20px;color:#0f172a}',
      '.dkj-auth-card p{margin:0 0 22px;font-size:13px;color:#64748b;line-height:1.6}',
      '.dkj-auth-card label{display:block;font-size:13px;font-weight:700;color:#334155;margin:0 0 6px}',
      '.dkj-auth-card input{width:100%;box-sizing:border-box;padding:13px 14px;font-size:16px;',
      'border:1.5px solid #cbd5e1;border-radius:10px;margin:0 0 16px}',
      '.dkj-auth-card input:focus{outline:none;border-color:#009a44}',
      '.dkj-auth-card button{width:100%;padding:14px;font-size:16px;font-weight:700;color:#fff;',
      'background:#009a44;border:0;border-radius:10px;cursor:pointer}',
      '.dkj-auth-card button:disabled{background:#94a3b8;cursor:default}',
      '.dkj-auth-err{margin:14px 0 0;font-size:13px;color:#b91c1c;line-height:1.6;min-height:1em}',
      '.dkj-auth-bar{display:flex;align-items:center;gap:10px;justify-content:flex-end;',
      'padding:6px 14px;font-size:12px;color:#475569;background:#f1f5f9;border-bottom:1px solid #e2e8f0}',
      '.dkj-auth-bar b{color:#0f172a}',
      '.dkj-auth-bar button{border:1px solid #cbd5e1;background:#fff;border-radius:6px;',
      'padding:3px 10px;font-size:12px;cursor:pointer;color:#475569}',
      '@media print{.dkj-auth-bar,.dkj-auth-mask{display:none!important}}'
    ].join('');
    document.head.appendChild(s);
  }

  function showLogin(reason) {
    styles();
    var mask = document.createElement('div');
    mask.className = 'dkj-auth-mask';
    mask.innerHTML =
      '<form class="dkj-auth-card">' +
        '<h1>동김제농협 스마트 HACCP</h1>' +
        '<p>기록을 작성하려면 로그인이 필요합니다.<br>사번과 비밀번호를 입력하세요.</p>' +
        '<label for="dkjEmpId">사번</label>' +
        '<input id="dkjEmpId" inputmode="numeric" autocomplete="username" required>' +
        '<label for="dkjPw">비밀번호</label>' +
        '<input id="dkjPw" type="password" autocomplete="current-password" required>' +
        '<button type="submit">로그인</button>' +
        '<p class="dkj-auth-err">' + (reason || '') + '</p>' +
      '</form>';
    document.body.appendChild(mask);
    var form = mask.querySelector('form');
    var err = mask.querySelector('.dkj-auth-err');
    var btn = mask.querySelector('button');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var id = mask.querySelector('#dkjEmpId').value.trim();
      var pw = mask.querySelector('#dkjPw').value;
      if (!id || !pw) return;
      btn.disabled = true;
      err.textContent = '';
      login(id, pw).then(function () {
        mask.remove();
        renderBar();
      }).catch(function (ex) {
        btn.disabled = false;
        err.textContent = ex.message === 'NOT_CONFIGURED'
          ? '클라우드 설정이 아직 안 됐습니다 — js/dkj-firebase-config.js 를 채워주세요.'
          : (ex.message === 'INVALID_LOGIN_CREDENTIALS' || ex.message.indexOf('PASSWORD') >= 0 || ex.message.indexOf('EMAIL') >= 0)
            ? '사번 또는 비밀번호가 맞지 않습니다.'
            : '로그인 실패: ' + ex.message;
      });
    });
    mask.querySelector('#dkjEmpId').focus();
  }

  function renderBar() {
    if (!state.empId || document.querySelector('.dkj-auth-bar')) return;
    styles();
    var bar = document.createElement('div');
    bar.className = 'dkj-auth-bar';
    bar.innerHTML = '<span>작성자 <b>' + (state.name || state.empId) + '</b></span>' +
                    '<button type="button">로그아웃</button>';
    bar.querySelector('button').addEventListener('click', logout);
    document.body.insertBefore(bar, document.body.firstChild);
  }

  /** 기록 서식 페이지에서 호출 — 로그인 안 돼 있으면 로그인 화면을 띄운다. */
  function requireLogin() {
    return resume().then(function () {
      renderBar();
      return state;
    }).catch(function (e) {
      if (e.message === 'NOT_CONFIGURED') {
        // 설정 전에는 기존처럼 기기 저장만으로 동작(파일럿 준비 중 화면이 막히지 않도록)
        console.warn('[DkjAuth] 클라우드 미설정 — 로컬 저장으로만 동작합니다.');
        return null;
      }
      showLogin('');
      throw e;
    });
  }

  global.DkjAuth = {
    login: login,
    logout: logout,
    resume: resume,
    reauth: reauth,
    requireLogin: requireLogin,
    configured: configured,
    user: function () { return state.empId ? { empId: state.empId, name: state.name } : null; },
    token: function () { return state.token; }
  };

  // records/ 아래 기록 서식은 자동으로 로그인을 요구한다
  function boot() {
    if (/\/records\//.test(location.pathname)) requireLogin().catch(function () {});
    else resume().then(renderBar).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
