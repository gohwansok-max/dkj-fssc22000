/* 동김제농협 시스템 설정 — 시스템 관리자(emp4343) 전용 사용자 권한관리 */
(function () {
  'use strict';
  var roles = {
    system_admin: '시스템 관리자',
    responsible: '책임자',
    manager: '관리자',
    worker: '작업자'
  };
  var users = {};
  var auditRows = [];

  function $(id) { return document.getElementById(id); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>'"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]; }); }
  function fmt(iso) { try { return iso ? new Date(iso).toLocaleString('ko-KR', { hour12: false }) : '—'; } catch (e) { return '—'; } }
  function setStatus(text, type) { var el = $('systemStatus'); if (!el) return; el.textContent = text; el.className = 'system-status ' + (type || ''); }
  function optionTags(selected) {
    return Object.keys(roles).map(function (key) { return '<option value="' + key + '"' + (key === selected ? ' selected' : '') + '>' + roles[key] + '</option>'; }).join('');
  }

  function renderUsers() {
    var target = $('userRows');
    var rows = Object.keys(users).map(function (uid) { return users[uid]; }).sort(function (a, b) {
      if (a.empId === '4343') return -1;
      if (b.empId === '4343') return 1;
      return String(a.empId || '').localeCompare(String(b.empId || ''));
    });
    $('registeredCount').textContent = rows.length;
    if (!rows.length) {
      target.innerHTML = '<tr><td colspan="6" class="empty">아직 로그인한 사용자가 없습니다. 직원이 처음 로그인하면 여기에 자동 등록됩니다.</td></tr>';
      return;
    }
    target.innerHTML = rows.map(function (row) {
      var locked = String(row.empId) === '4343';
      return '<tr data-uid="' + esc(row.uid) + '">' +
        '<td><strong>' + esc(row.empId || '—') + '</strong></td>' +
        '<td><input class="user-name" maxlength="30" value="' + esc(row.name || '') + '" placeholder="표시 이름"></td>' +
        '<td><select class="user-role"' + (locked ? ' disabled' : '') + '>' + optionTags(row.role || 'worker') + '</select></td>' +
        '<td>' + esc(roles[row.role] || roles.worker) + '</td>' +
        '<td>' + esc(fmt(row.lastLoginAt)) + '</td>' +
        '<td><button class="save-role" type="button"' + (locked ? ' disabled title="시스템 관리자는 고정됩니다"' : '') + '>저장</button></td>' +
      '</tr>';
    }).join('');
    Array.prototype.forEach.call(target.querySelectorAll('.save-role'), function (btn) {
      btn.addEventListener('click', function () { saveUser(btn.closest('tr')); });
    });
  }

  function renderAudit() {
    var target = $('roleAudit');
    if (!auditRows.length) { target.innerHTML = '<p class="empty">아직 역할 변경 이력이 없습니다.</p>'; return; }
    target.innerHTML = auditRows.slice(0, 20).map(function (row) {
      return '<div class="audit-row"><span>' + esc(fmt(row.at)) + '</span><strong>' + esc(row.targetEmpId || '—') + '</strong><span>' + esc(roles[row.beforeRole] || '—') + ' → <b>' + esc(roles[row.afterRole] || '—') + '</b></span><span>' + esc(row.actorEmpId || '') + ' 변경</span></div>';
    }).join('');
  }

  async function saveUser(tr) {
    var uid = tr.getAttribute('data-uid'), current = users[uid];
    if (!current || current.empId === '4343') return;
    var name = tr.querySelector('.user-name').value.trim();
    var role = tr.querySelector('.user-role').value;
    if (!roles[role]) { setStatus('역할을 다시 선택하세요.', 'bad'); return; }
    var btn = tr.querySelector('.save-role');
    btn.disabled = true;
    try {
      var next = {
        uid: current.uid,
        empId: current.empId,
        name: name,
        role: role,
        createdAt: current.createdAt || new Date().toISOString(),
        lastLoginAt: current.lastLoginAt || ''
      };
      await window.DkjAuth.request('system/users/' + encodeURIComponent(uid), 'PUT', next);
      var me = window.DkjAuth.user();
      var at = new Date().toISOString();
      var auditId = 'role_' + Date.now() + '_' + uid.slice(0, 8);
      var audit = {
        actorUid: me.uid,
        actorEmpId: me.empId,
        targetUid: uid,
        targetEmpId: current.empId,
        beforeRole: current.role || 'worker',
        afterRole: role,
        at: at
      };
      await window.DkjAuth.request('system/role_audit/' + auditId, 'PUT', audit);
      users[uid] = next;
      auditRows.unshift(audit);
      renderUsers(); renderAudit();
      setStatus(current.empId + '번 사용자의 권한을 ' + roles[role] + '(으)로 저장했습니다.', 'ok');
    } catch (e) {
      setStatus('권한 저장에 실패했습니다. Firebase 보안 규칙 게시 여부를 확인하세요. (' + e.message + ')', 'bad');
    } finally { if (btn.isConnected) btn.disabled = false; }
  }

  async function loadData() {
    var auth = window.DkjAuth;
    if (!auth || !auth.isSystemAdmin || !auth.isSystemAdmin()) {
      $('systemContent').hidden = true;
      $('systemDenied').hidden = false;
      setStatus('시스템 관리자 권한이 필요합니다. 사번 4343으로 로그인하세요.', 'bad');
      return;
    }
    $('systemDenied').hidden = true;
    $('systemContent').hidden = false;
    setStatus('사용자 권한 정보를 불러오는 중입니다.', '');
    try {
      var result = await Promise.all([
        auth.request('system/users', 'GET'),
        auth.request('system/role_audit', 'GET')
      ]);
      users = result[0] || {};
      auditRows = Object.keys(result[1] || {}).map(function (key) { return result[1][key]; }).sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
      renderUsers(); renderAudit();
      setStatus('시스템 관리자 ' + (auth.user().name || auth.user().empId) + '님으로 로그인했습니다.', 'ok');
    } catch (e) {
      $('userRows').innerHTML = '<tr><td colspan="6" class="empty">사용자 정보를 불러올 수 없습니다.</td></tr>';
      setStatus('사용자 권한 저장소에 접근할 수 없습니다. Firebase 보안 규칙을 게시한 뒤 다시 확인하세요. (' + e.message + ')', 'bad');
    }
  }

  function boot() {
    if (!window.DkjAuth) return;
    document.addEventListener('dkj:auth-ready', loadData);
    if (window.DkjAuth.user()) loadData();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
