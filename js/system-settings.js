/* 동김제농협 시스템 설정 — 시스템 관리자(4343) 전용 사용자 및 계정 관리 */
(function () {
  'use strict';
  var roles = {
    system_admin: '시스템 관리자',
    responsible: '책임자',
    manager: '관리자',
    worker: '작업자'
  };
  var AUDIT_KEY = 'dkj:auth:role_audit:v2';
  var auditRows = [];

  function $(id) { return document.getElementById(id); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>'"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]; }); }
  function fmt(iso) { try { return iso ? new Date(iso).toLocaleString('ko-KR', { hour12: false }) : '—'; } catch (e) { return '—'; } }
  function setStatus(text, type) { var el = $('systemStatus'); if (!el) return; el.textContent = text; el.className = 'system-status ' + (type || ''); }
  
  function optionTags(selected) {
    return Object.keys(roles).map(function (key) {
      return '<option value="' + key + '"' + (key === selected ? ' selected' : '') + '>' + roles[key] + '</option>';
    }).join('');
  }

  function loadLocalAudit() {
    try {
      var raw = localStorage.getItem(AUDIT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function saveLocalAudit(list) {
    try {
      localStorage.setItem(AUDIT_KEY, JSON.stringify(list.slice(0, 50)));
    } catch (e) {}
  }

  function addAudit(actionText, targetEmpId, detail) {
    var me = (window.DkjAuth && window.DkjAuth.user && window.DkjAuth.user()) || { empId: '4343' };
    var item = {
      at: new Date().toISOString(),
      actorEmpId: me.empId || '4343',
      targetEmpId: targetEmpId,
      action: actionText,
      detail: detail || ''
    };
    auditRows.unshift(item);
    saveLocalAudit(auditRows);
    if (window.DkjAuth && window.DkjAuth.configured() && window.DkjAuth.token()) {
      var auditId = 'audit_' + Date.now() + '_' + String(targetEmpId);
      window.DkjAuth.request('system/role_audit/' + auditId, 'PUT', item).catch(function () {});
    }
    renderAudit();
  }

  function renderUsers() {
    var target = $('userRows');
    var dir = (window.DkjAuth && window.DkjAuth.getDirectory && window.DkjAuth.getDirectory()) || {};
    var rows = Object.keys(dir).map(function (id) { return dir[id]; }).sort(function (a, b) {
      if (a.empId === '4343') return -1;
      if (b.empId === '4343') return 1;
      return String(a.empId || '').localeCompare(String(b.empId || ''));
    });

    $('registeredCount').textContent = rows.length;
    if (!rows.length) {
      target.innerHTML = '<tr><td colspan="6" class="empty">등록된 사용자가 없습니다. 위의 신규 등록 폼에서 직원을 추가하세요.</td></tr>';
      return;
    }

    target.innerHTML = rows.map(function (row) {
      var isRootAdmin = String(row.empId) === '4343';
      // 다른 기기에서 등록된 뒤 클라우드에서 넘어온 계정은 이 기기에 평문 비밀번호가 없다
      // (클라우드엔 해시만 있음) — 임의값(사번 등)으로 채우면 그대로 저장 시 실제 비밀번호가
      // 조용히 바뀌어 버리므로, 빈 칸 + 안내문구로 두고 바꿀 때만 새로 입력하게 한다.
      var currentPw = row.password || '';
      var pwPlaceholder = currentPw ? '비밀번호' : '변경하려면 새 비밀번호 입력';
      return '<tr data-emp-id="' + esc(row.empId) + '">' +
        '<td>' +
          (isRootAdmin
            ? '<input type="text" class="user-id" maxlength="20" value="4343" disabled style="background:#edf6f0;font-weight:800;color:#006b3f;">'
            : '<input type="text" class="user-id" maxlength="20" value="' + esc(row.empId) + '" placeholder="아이디/사번">') +
        '</td>' +
        '<td><input type="text" class="user-name" maxlength="20" value="' + esc(row.name || '') + '" placeholder="성명"></td>' +
        '<td><select class="user-role"' + (isRootAdmin ? ' disabled' : '') + '>' + optionTags(row.role || 'worker') + '</select></td>' +
        '<td>' +
          '<div class="pw-wrap">' +
            '<input type="text" class="user-pw pw-input" maxlength="30" placeholder="' + esc(pwPlaceholder) + '" value="' + esc(currentPw) + '">' +
            '<button type="button" class="btn-pw-eye" title="비밀번호 숨기기/보기">🔒</button>' +
          '</div>' +
        '</td>' +
        '<td><span style="font-size:12px;color:#555;">' + esc(fmt(row.lastLoginAt || row.createdAt)) + '</span></td>' +
        '<td>' +
          '<div class="action-cell">' +
            '<button type="button" class="btn-save btn-save-user">저장</button>' +
            '<button type="button" class="btn-del btn-del-user"' + (isRootAdmin ? ' disabled title="시스템 관리자는 삭제할 수 없습니다"' : '') + '>삭제</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
    }).join('');

    // 이벤트 바인딩
    Array.prototype.forEach.call(target.querySelectorAll('.btn-save-user'), function (btn) {
      btn.addEventListener('click', function () { saveRow(btn.closest('tr')); });
    });
    Array.prototype.forEach.call(target.querySelectorAll('.btn-del-user'), function (btn) {
      btn.addEventListener('click', function () { deleteRow(btn.closest('tr')); });
    });
    Array.prototype.forEach.call(target.querySelectorAll('.btn-pw-eye'), function (btn) {
      btn.addEventListener('click', function () {
        var input = btn.closest('.pw-wrap').querySelector('.user-pw');
        if (!input) return;
        if (input.type === 'password') {
          input.type = 'text';
          btn.textContent = '🔒';
          btn.title = '비밀번호 숨기기';
        } else {
          input.type = 'password';
          btn.textContent = '👁️';
          btn.title = '비밀번호 보기';
        }
      });
    });
  }

  function renderAudit() {
    var target = $('roleAudit');
    if (!auditRows.length) {
      target.innerHTML = '<p class="empty">아직 변경 이력이 없습니다.</p>';
      return;
    }
    target.innerHTML = auditRows.slice(0, 20).map(function (row) {
      return '<div class="audit-row">' +
        '<span>' + esc(fmt(row.at)) + '</span>' +
        '<strong>' + esc(row.targetEmpId || '—') + '</strong>' +
        '<span>' + esc(row.action) + (row.detail ? ' (' + esc(row.detail) + ')' : '') + '</span>' +
        '<span>' + esc(row.actorEmpId || '4343') + ' 관리자</span>' +
      '</div>';
    }).join('');
  }

  function handleCreateUser() {
    var empId = $('newEmpId').value.trim();
    var name = $('newName').value.trim();
    var role = $('newRole').value;
    var password = $('newPassword').value.trim();

    if (!empId) { setStatus('사번(아이디)을 입력하세요.', 'bad'); $('newEmpId').focus(); return; }
    if (!name) { setStatus('성명(표시 이름)을 입력하세요.', 'bad'); $('newName').focus(); return; }
    if (!password) { setStatus('초기 비밀번호를 입력하세요.', 'bad'); $('newPassword').focus(); return; }

    try {
      window.DkjAuth.addUser({
        empId: empId,
        name: name,
        role: role,
        password: password
      });

      addAudit('사용자 계정 신규 추가', empId, name + ' · ' + roles[role] + ' · 비밀번호 설정');
      $('newEmpId').value = '';
      $('newName').value = '';
      $('newPassword').value = '';
      renderUsers();
      setStatus('사용자 ' + name + '(' + empId + ') 계정을 성공적으로 등록했습니다! 비밀번호: [' + password + ']', 'ok');
    } catch (e) {
      setStatus('사용자 등록 실패: ' + e.message, 'bad');
    }
  }

  function saveRow(tr) {
    var oldEmpId = tr.getAttribute('data-emp-id');
    if (!oldEmpId) return;
    var newEmpId = tr.querySelector('.user-id').value.trim();
    var name = tr.querySelector('.user-name').value.trim();
    var role = tr.querySelector('.user-role').value;
    var pw = tr.querySelector('.user-pw').value.trim();

    if (!newEmpId) { setStatus('사번(아이디)을 입력하세요.', 'bad'); return; }
    if (!name) { setStatus('성명을 입력하세요.', 'bad'); return; }
    if (!pw) { setStatus('비밀번호를 입력하세요.', 'bad'); return; }

    try {
      var updateData = { newEmpId: newEmpId, name: name, role: role, password: pw };
      var detail = name + ' · ' + roles[role];
      if (newEmpId !== oldEmpId) {
        detail += ' · 아이디 변경(' + oldEmpId + '→' + newEmpId + ')';
      }
      detail += ' · 비밀번호 저장(' + pw + ')';

      window.DkjAuth.saveUser(oldEmpId, updateData);
      addAudit('사용자 계정 정보 수정', newEmpId, detail);
      renderUsers();
      setStatus('사용자 ' + name + '(' + newEmpId + ') 계정 정보를 저장했습니다. (비밀번호: ' + pw + ')', 'ok');
    } catch (e) {
      setStatus('저장 실패: ' + e.message, 'bad');
    }
  }

  function deleteRow(tr) {
    var empId = tr.getAttribute('data-emp-id');
    if (!empId || empId === '4343') {
      alert('시스템 관리자(4343) 계정은 삭제할 수 없습니다.');
      return;
    }
    var name = tr.querySelector('.user-name').value.trim();
    if (!confirm('정말 [' + name + ' (' + empId + ')] 사용자를 삭제하시겠습니까?\n삭제 후에는 해당 사번으로 로그인할 수 없습니다.')) {
      return;
    }

    try {
      window.DkjAuth.deleteUser(empId);
      addAudit('사용자 계정 삭제', empId, name);
      renderUsers();
      setStatus(name + '(' + empId + ') 사용자를 삭제했습니다.', 'ok');
    } catch (e) {
      setStatus('삭제 실패: ' + e.message, 'bad');
    }
  }

  async function loadTelegramConfig() {
    if (!window.DkjTelegram) return;
    if (window.DkjTelegram.syncFromCloud) {
      try {
        await window.DkjTelegram.syncFromCloud();
      } catch (e) {}
    }
    var cfg = window.DkjTelegram.getConfig();
    if ($('tgBotToken')) $('tgBotToken').value = cfg.botToken || '';
    if ($('tgChatId')) $('tgChatId').value = cfg.chatId || '';
  }

  async function handleSaveTelegram() {
    if (!window.DkjTelegram) return;
    var botToken = $('tgBotToken').value.trim();
    var chatId = $('tgChatId').value.trim();
    var statusEl = $('tgStatusMsg');
    var saveBtn = $('btnSaveTelegram');

    if (!botToken || !chatId) {
      alert('봇 토큰과 Chat ID를 모두 입력해야 저장할 수 있습니다. 기존 설정은 변경하지 않았습니다.');
      return;
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '⏳ 클라우드에 저장 중...';
    }
    if (statusEl) {
      statusEl.textContent = '이 기기와 클라우드에 설정을 저장하고 확인하고 있습니다...';
      statusEl.style.color = '#0284c7';
    }

    try {
      var result = await window.DkjTelegram.saveConfig({
        botToken: botToken,
        chatId: chatId
      });

      if (result && result.cloudSaved) {
        if (statusEl) {
          statusEl.textContent = '✅ 클라우드 영구 저장 완료 — 다음 접속부터 자동으로 불러옵니다.';
          statusEl.style.color = '#006b3f';
        }
        addAudit('텔레그램 알림 설정 변경', '시스템', 'Bot Token 및 Chat ID 클라우드 영구 저장');
      } else if (result && result.localSaved) {
        if (statusEl) {
          statusEl.textContent = '⚠️ 이 기기에는 저장됐지만 클라우드 저장을 확인하지 못했습니다. 인터넷 연결 후 다시 저장해주세요.';
          statusEl.style.color = '#b45309';
        }
      } else if (statusEl) {
        statusEl.textContent = '❌ 설정을 저장하지 못했습니다. 브라우저 저장 권한을 확인해주세요.';
        statusEl.style.color = '#b42318';
      }
    } catch (e) {
      if (statusEl) {
        statusEl.textContent = '❌ 설정 저장 중 오류가 발생했습니다. 입력값은 그대로 유지됩니다.';
        statusEl.style.color = '#b42318';
      }
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 텔레그램 설정 저장';
      }
    }
  }

  async function handleTestTelegram() {
    if (!window.DkjTelegram) return;
    var botToken = $('tgBotToken').value.trim();
    var chatId = $('tgChatId').value.trim();
    var statusEl = $('tgStatusMsg');
    var btnTest = $('btnTestTelegram');

    if (!botToken || !chatId) {
      alert('봇 토큰과 Chat ID를 모두 입력한 후 테스트를 진행해주세요.');
      return;
    }

    if (btnTest) {
      btnTest.disabled = true;
      btnTest.textContent = '⏳ 발송 중...';
    }
    if (statusEl) {
      statusEl.textContent = '텔레그램으로 테스트 메시지를 전송하고 있습니다...';
      statusEl.style.color = '#0284c7';
    }

    try {
      var res = await window.DkjTelegram.sendMessage({
        botToken: botToken,
        chatId: chatId,
        category: '🔔 관리자 연동 테스트 알림',
        message: '동김제농협 스마트 HACCP · FSSC22000 시스템과 텔레그램 연동이 성공적으로 완료되었습니다! 🎉\n직원들이 챗봇으로 접수한 불편사항이 이 채팅방으로 실시간 전송됩니다.'
      });

      if (res.success) {
        if (statusEl) {
          statusEl.textContent = '🎉 테스트 메시지 발송 성공! 텔레그램 앱에서 확인하세요.';
          statusEl.style.color = '#006b3f';
        }
      } else {
        if (statusEl) {
          statusEl.textContent = '❌ 발송 실패: ' + res.message;
          statusEl.style.color = '#b42318';
        }
      }
    } catch (e) {
      if (statusEl) {
        statusEl.textContent = '❌ 오류: ' + e.message;
        statusEl.style.color = '#b42318';
      }
    } finally {
      if (btnTest) {
        btnTest.disabled = false;
        btnTest.textContent = '🔔 테스트 메시지 즉시 발송';
      }
    }
  }

  function renderLastBackupStatus() {
    var el = $('lastBackupStatus');
    if (!el || !window.DkjExport) return;
    var last = window.DkjExport.lastBackupAt();
    el.textContent = last ? ('마지막 백업: ' + fmt(last)) : '아직 전체 백업을 한 번도 받지 않았습니다.';
  }

  function handleFullBackup() {
    var msgEl = $('fullBackupMsg');
    try {
      var result = window.DkjExport.toFullBackup();
      if (msgEl) { msgEl.style.color = '#006b3f'; msgEl.textContent = '✅ 백업 파일을 내려받았습니다 (기록 ' + result.records + '종 · 설정 ' + result.settings + '건).'; }
      addAudit('전체 데이터 백업 다운로드', '시스템', '기록 ' + result.records + '종 · 설정 ' + result.settings + '건');
      renderLastBackupStatus();
    } catch (e) {
      if (msgEl) { msgEl.style.color = '#b42318'; msgEl.textContent = '❌ 백업 실패: ' + e.message; }
    }
  }

  function handleFullRestoreFile() {
    var file = this.files && this.files[0];
    if (!file) return;
    if (!confirm('백업 파일로 복원하시겠습니까?\n기록은 최신 것만 남도록 병합되고, 설정값은 백업 시점 값으로 되돌아갑니다.')) {
      this.value = '';
      return;
    }
    var msgEl = $('fullBackupMsg');
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var result = window.DkjExport.restoreFullBackup(String(reader.result));
        if (msgEl) { msgEl.style.color = '#006b3f'; msgEl.textContent = '✅ 복원 완료 — 새 기록 ' + result.records + '건, 설정 ' + result.settings + '건 반영.'; }
        addAudit('전체 데이터 복원', '시스템', '새 기록 ' + result.records + '건 · 설정 ' + result.settings + '건');
        alert('복원이 완료됐습니다. 화면을 새로고침하면 반영된 내용을 볼 수 있습니다.');
      } catch (e) {
        if (msgEl) { msgEl.style.color = '#b42318'; msgEl.textContent = '❌ 복원 실패 — 백업 파일이 아니거나 손상됐습니다.'; }
      }
    };
    reader.readAsText(file);
    this.value = '';
  }

  async function loadData() {
    var auth = window.DkjAuth;
    var me = auth && auth.user ? auth.user() : null;
    
    // Check if system administrator (4343)
    if (!me || String(me.empId) !== '4343') {
      $('systemContent').hidden = true;
      $('systemDenied').hidden = false;
      setStatus('시스템 관리자 권한이 필요합니다. 사번 4343으로 로그인하세요.', 'bad');
      return;
    }

    $('systemDenied').hidden = true;
    $('systemContent').hidden = false;
    setStatus('시스템 관리자 ' + (me.name || me.empId) + '님 환영합니다. 사용자 계정을 바로 관리할 수 있습니다.', 'ok');

    auditRows = loadLocalAudit();
    
    if (auth.loadUsers) {
      try {
        await auth.loadUsers();
      } catch (e) {}
    }

    renderUsers();
    renderAudit();
    await loadTelegramConfig();
    renderLastBackupStatus();
  }

  function boot() {
    var btnCreate = $('btnCreateUser');
    if (btnCreate) {
      btnCreate.addEventListener('click', handleCreateUser);
    }
    var btnSaveTg = $('btnSaveTelegram');
    if (btnSaveTg) {
      btnSaveTg.addEventListener('click', handleSaveTelegram);
    }
    var btnTestTg = $('btnTestTelegram');
    if (btnTestTg) {
      btnTestTg.addEventListener('click', handleTestTelegram);
    }
    var btnFullBackup = $('btnFullBackup');
    if (btnFullBackup) {
      btnFullBackup.addEventListener('click', handleFullBackup);
    }
    var btnFullRestore = $('btnFullRestore');
    var fullRestoreFile = $('fullRestoreFile');
    if (btnFullRestore && fullRestoreFile) {
      btnFullRestore.addEventListener('click', function () { fullRestoreFile.click(); });
      fullRestoreFile.addEventListener('change', handleFullRestoreFile);
    }
    document.addEventListener('dkj:auth-ready', loadData);
    if (window.DkjAuth && window.DkjAuth.user && window.DkjAuth.user()) {
      loadData();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
