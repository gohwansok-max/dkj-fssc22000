(function () {
  'use strict';

  var FORM_ID = 'PERIODIC-ALERTS';
  var EMAIL_SETTINGS_FORM_ID = 'PERIODIC-ALERT-SETTINGS';
  var EMAIL_SETTINGS_ID = 'pa-email-settings';
  var SETTINGS_KEY = 'dkj:periodic-alerts:settings:v1';
  var SEEN_KEY = 'dkj:periodic-alerts:seen:v1';
  var CHECK_MS = 30000;
  var state = { initialized: false, items: [], alerts: [], email: null, emailDirty: false, excelResult: null, timer: null };
  var $ = function (id) { return document.getElementById(id); };

  var DEFAULT_ITEMS = [
    { id: 'pa-default-calibration', type: 'calibration', name: '계측기 검교정', target: '', owner: '품질관리팀', dueDate: '', cycleDays: 365, leadDays: 7, link: 'records/FR-027.html', memo: '계측기별로 관리번호·다음 검교정일을 등록하세요.', active: true },
    { id: 'pa-default-self-quality', type: 'self-quality', name: '자가품질검사', target: '', owner: '품질관리팀', dueDate: '', cycleDays: 30, leadDays: 7, link: '', memo: '제품·검사항목별 다음 의뢰일을 등록하세요.', active: true },
    { id: 'pa-default-personal-hygiene', type: 'environment', name: '작업자 개인위생 점검', target: '', owner: '품질관리팀', dueDate: '', cycleDays: 30, leadDays: 7, link: 'records/FR-038.html', memo: '환경모니터링 계획 기준에 맞춰 예정일을 등록하세요.', active: true },
    { id: 'pa-default-settle-plate', type: 'environment', name: '낙하균 검사', target: '', owner: '품질관리팀', dueDate: '', cycleDays: 30, leadDays: 7, link: 'records/FR-038.html', memo: '채취지점 또는 구역별로 항목을 추가 등록할 수 있습니다.', active: true },
    { id: 'pa-default-equipment-hygiene', type: 'environment', name: '설비위생점검', target: '', owner: '품질관리팀', dueDate: '', cycleDays: 30, leadDays: 7, link: '', memo: '설비 또는 구역별로 항목을 추가 등록할 수 있습니다.', active: true },
    { id: 'pa-default-water-test', type: 'environment', name: '용수검사', target: '', owner: '품질관리팀', dueDate: '', cycleDays: 90, leadDays: 7, link: 'records/FR-038.html', memo: '용수 종류·채수 지점을 대상란에 기입하세요.', active: true },
    { id: 'pa-default-health-certificate', type: 'health-certificate', name: '보건증', target: '', owner: '인사·품질관리팀', dueDate: '', cycleDays: 365, leadDays: 7, link: '', memo: '작업자별로 성명을 넣어 개별 등록하세요.', active: true }
  ];

  function esc(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&quot;').replace(/'/g, '&#39;');
  }
  function readJson(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
  }
  function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function dateOf(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
    var d = new Date(String(value) + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }
  function dateInputValue(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
  function addDays(date, days) { var d = new Date(date.getTime()); d.setDate(d.getDate() + Number(days || 0)); return d; }
  function dayDiff(date) { return Math.round((date.getTime() - today().getTime()) / 86400000); }
  function typeName(type) {
    return ({ calibration: '계측기 검교정', 'self-quality': '자가품질검사', environment: '환경모니터링', 'health-certificate': '보건증' })[type] || '기타';
  }
  function statusOf(item) {
    if (!item.active) return { key: 'inactive', label: '관리 제외', order: 6 };
    var due = dateOf(item.dueDate);
    if (!due) return { key: 'date-missing', label: '예정일 미등록', order: 5 };
    var diff = dayDiff(due), lead = Math.max(0, Number(item.leadDays == null ? 7 : item.leadDays));
    if (diff < 0) return { key: 'overdue', label: Math.abs(diff) + '일 지남', order: 1, diff: diff };
    if (diff === 0) return { key: 'today', label: '오늘 실시', order: 2, diff: diff };
    if (diff <= lead) return { key: 'soon', label: diff + '일 후', order: 3, diff: diff };
    return { key: 'scheduled', label: diff + '일 후', order: 4, diff: diff };
  }
  function itemSort(a, b) {
    var sa = statusOf(a), sb = statusOf(b);
    if (sa.order !== sb.order) return sa.order - sb.order;
    return String(a.dueDate || '9999-12-31').localeCompare(String(b.dueDate || '9999-12-31')) || String(a.name || '').localeCompare(String(b.name || ''));
  }
  function loadItems() {
    try { return (window.DkjRecordStore && window.DkjRecordStore.list(FORM_ID)) || []; } catch (e) { return []; }
  }
  function saveItem(item) {
    if (!window.DkjRecordStore) throw new Error('저장소를 불러오지 못했습니다.');
    return window.DkjRecordStore.save(FORM_ID, item);
  }
  function ensureDefaults() {
    var existing = loadItems(), ids = {};
    existing.forEach(function (item) { ids[item.id] = true; });
    DEFAULT_ITEMS.forEach(function (template) {
      if (!ids[template.id]) saveItem(Object.assign({}, template));
    });
  }
  function settings() {
    var saved = readJson(SETTINGS_KEY, {});
    return { browserEnabled: saved.browserEnabled === true };
  }
  function saveSettings(next) { writeJson(SETTINGS_KEY, next); }
  function defaultEmailSettings() {
    return { id: EMAIL_SETTINGS_ID, kind: 'periodic_email_settings', recipients: [], dispatchTime: '08:30', enabled: true, levels: { overdue: true, today: true, soon: true } };
  }
  function loadEmailSettings() {
    try {
      var rows = (window.DkjRecordStore && window.DkjRecordStore.list(EMAIL_SETTINGS_FORM_ID)) || [];
      var saved = rows.find(function (row) { return row && row.id === EMAIL_SETTINGS_ID; });
      var base = defaultEmailSettings();
      if (!saved) return base;
      return Object.assign(base, saved, { recipients: Array.isArray(saved.recipients) ? saved.recipients : [], levels: Object.assign({}, base.levels, saved.levels || {}) });
    } catch (e) { return defaultEmailSettings(); }
  }
  function saveEmailSettings(config) {
    if (!window.DkjRecordStore) throw new Error('저장소를 불러오지 못했습니다.');
    return window.DkjRecordStore.save(EMAIL_SETTINGS_FORM_ID, Object.assign({}, state.email || {}, config, { id: EMAIL_SETTINGS_ID, kind: 'periodic_email_settings' }));
  }
  function browserPermission() { return 'Notification' in window ? Notification.permission : 'unsupported'; }
  function toast(text, bad) {
    var el = $('paToast'); if (!el) return;
    el.textContent = text; el.className = 'pa-toast show' + (bad ? ' bad' : '');
    clearTimeout(el._timer); el._timer = setTimeout(function () { el.className = 'pa-toast'; }, 4300);
  }
  function setStatus(text, bad) {
    var el = $('paStatus'); if (!el) return;
    el.textContent = text; el.className = 'pa-status show' + (bad ? ' bad' : '');
    clearTimeout(el._timer); el._timer = setTimeout(function () { el.className = 'pa-status'; }, 5200);
  }
  function renderSummary() {
    var active = state.items.filter(function (item) { return item.active; });
    var counts = { overdue: 0, today: 0, soon: 0 };
    active.forEach(function (item) { var key = statusOf(item).key; if (Object.prototype.hasOwnProperty.call(counts, key)) counts[key]++; });
    $('paOverdueCount').textContent = counts.overdue;
    $('paTodayCount').textContent = counts.today;
    $('paSoonCount').textContent = counts.soon;
    $('paManagedCount').textContent = active.length;
  }
  function alertDetail(item, status) {
    var due = item.dueDate || '예정일 미등록';
    var target = item.target ? ' · 대상: ' + item.target : '';
    return '예정일 ' + due + target + ' · ' + status.label;
  }
  function alertRow(item, modal) {
    var status = statusOf(item);
    return '<div class="pa-alert-row ' + esc(status.key) + '"><i aria-hidden="true"></i><div class="pa-alert-main"><b>' + esc(item.name) + '</b><small>' + esc(typeName(item.type) + ' · ' + alertDetail(item, status)) + '</small></div>' +
      '<button type="button" class="pa-btn outline" data-alert-action="edit" data-id="' + esc(item.id) + '">관리</button></div>';
  }
  function renderAlerts() {
    state.alerts = state.items.filter(function (item) {
      var key = statusOf(item).key;
      return item.active && (key === 'overdue' || key === 'today' || key === 'soon');
    }).sort(itemSort);
    $('paAlertList').innerHTML = state.alerts.length ? state.alerts.map(function (item) { return alertRow(item, false); }).join('') :
      '<div class="pa-empty">현재 7일 이내에 예정된 정기 관리 항목이 없습니다. 다음 예정일을 등록하면 자동으로 확인합니다.</div>';
    $('paModalAlerts').innerHTML = state.alerts.length ? state.alerts.map(function (item) { return alertRow(item, true); }).join('') :
      '<div class="pa-empty">현재 기한 경과·당일·7일 이내 사전 알림 항목이 없습니다.</div>';
    $('paAlertDialogDesc').textContent = state.alerts.length ? '기한 경과 ' + state.alerts.filter(function (x) { return statusOf(x).key === 'overdue'; }).length + '건, 오늘 실시 ' + state.alerts.filter(function (x) { return statusOf(x).key === 'today'; }).length + '건, 7일 이내 ' + state.alerts.filter(function (x) { return statusOf(x).key === 'soon'; }).length + '건입니다.' : '현재 확인이 필요한 정기 관리 항목이 없습니다.';
  }
  function renderTable() {
    var type = $('paTypeFilter').value, filter = $('paStateFilter').value;
    var items = state.items.filter(function (item) {
      var status = statusOf(item).key;
      return (type === 'all' || item.type === type) && (filter === 'all' || status === filter);
    }).sort(itemSort);
    $('paRows').innerHTML = items.length ? items.map(function (item) {
      var status = statusOf(item), cycle = Number(item.cycleDays || 0);
      var target = item.target || item.owner || '-';
      return '<tr><td><span class="pa-type ' + esc(item.type) + '">' + esc(typeName(item.type)) + '</span></td>' +
        '<td><b>' + esc(item.name) + '</b>' + (item.memo ? '<small>' + esc(item.memo) + '</small>' : '') + '</td>' +
        '<td>' + esc(target) + (item.target && item.owner ? '<small>담당: ' + esc(item.owner) + '</small>' : '') + '</td>' +
        '<td>' + esc(item.dueDate || '-') + '</td><td>' + (cycle ? esc(cycle + '일') : '-') + '<small>사전 ' + esc(Number(item.leadDays == null ? 7 : item.leadDays)) + '일</small></td>' +
        '<td><span class="pa-state ' + esc(status.key) + '">' + esc(status.label) + '</span></td>' +
        '<td><div class="pa-row-actions">' + (item.active && item.dueDate ? '<button type="button" class="pa-btn outline" data-action="complete" data-id="' + esc(item.id) + '">완료</button>' : '') + '<button type="button" class="pa-btn outline" data-action="edit" data-id="' + esc(item.id) + '">수정</button></div></td></tr>';
    }).join('') : '<tr><td colspan="7"><div class="pa-empty">조건에 맞는 관리 항목이 없습니다.</div></td></tr>';
  }
  function renderEmailSettings() {
    state.email = loadEmailSettings();
    if (!state.email.recipients) state.email.recipients = [];
    if (!state.emailDirty) {
      $('paEmailRecipients').value = state.email.recipients.join(', ');
      $('paEmailDispatchTime').value = state.email.dispatchTime || '08:30';
      $('paEmailEnabled').checked = state.email.enabled !== false;
      $('paEmailOverdue').checked = state.email.levels.overdue !== false;
      $('paEmailToday').checked = state.email.levels.today !== false;
      $('paEmailSoon').checked = state.email.levels.soon !== false;
    }

    var listEl = $('paRecipientsList');
    if (listEl) {
      if (!state.email.recipients.length) {
        listEl.innerHTML = '<span class="pa-recipient-empty">등록된 수신 이메일이 없습니다. 아래에서 이메일을 추가해 주세요.</span>';
      } else {
        listEl.innerHTML = state.email.recipients.map(function (em) {
          return '<span class="pa-recipient-tag">' + esc(em) + ' <button type="button" class="pa-tag-del" data-email="' + esc(em) + '" title="수신자 삭제">×</button></span>';
        }).join('');
      }
    }
    if ($('paRecipientCount')) $('paRecipientCount').textContent = state.email.recipients.length;

    var quickEl = $('paQuickStaff');
    if (quickEl) {
      quickEl.innerHTML = '<span>💡 빠른 추가:</span> ' +
        '<button type="button" data-add-email="gohwansok@gmail.com">+ 고환석 (gohwansok@gmail.com)</button> ' +
        '<button type="button" data-add-email="quality@donggimje.nonghyup.com">+ 품질관리팀</button> ' +
        '<button type="button" data-add-email="haccp@donggimje.nonghyup.com">+ HACCP팀</button>';
    }

    var status = $('paEmailStatus'), recipientCount = state.email.recipients.length;
    if (!state.email.enabled) { status.className = 'pa-email-status warn'; status.textContent = '서버 이메일 자동 발송이 꺼져 있습니다.'; }
    else if (!recipientCount) { status.className = 'pa-email-status warn'; status.textContent = '수신 이메일을 등록하면 매일 ' + (state.email.dispatchTime || '08:30') + '에 서버가 자동 발송합니다.'; }
    else { status.className = 'pa-email-status ok'; status.textContent = recipientCount + '명에게 매일 ' + (state.email.dispatchTime || '08:30') + '에 자동 발송하도록 저장되었습니다. (브라우저를 닫아도 서버에서 자동 발송)'; }
  }

  function addRecipient(emailStr) {
    var raw = String(emailStr || '').trim();
    if (!raw) { toast('추가할 이메일 주소를 입력하세요.', true); return; }
    if (!validEmail(raw)) { toast('올바른 이메일 형식이 아닙니다: ' + raw, true); return; }
    if (!state.email) state.email = loadEmailSettings();
    if (!state.email.recipients) state.email.recipients = [];
    var lower = raw.toLowerCase();
    if (state.email.recipients.indexOf(lower) !== -1) {
      toast('이미 등록된 수신 이메일입니다: ' + lower, true);
      return;
    }
    state.email.recipients.push(lower);
    saveEmailSettings({ recipients: state.email.recipients });
    state.emailDirty = false;
    if ($('paNewRecipientInput')) $('paNewRecipientInput').value = '';
    renderEmailSettings();
    toast('수신자 추가 완료: ' + lower);
  }

  function removeRecipient(emailStr) {
    var lower = String(emailStr || '').trim().toLowerCase();
    if (!state.email || !state.email.recipients) return;
    state.email.recipients = state.email.recipients.filter(function (e) { return e.toLowerCase() !== lower; });
    saveEmailSettings({ recipients: state.email.recipients });
    state.emailDirty = false;
    renderEmailSettings();
    toast('수신자 제거 완료: ' + lower);
  }

  function previewEmailDispatch() {
    state.email = loadEmailSettings();
    var recipients = state.email.recipients || [];
    var activeAlerts = state.alerts || [];
    var time = state.email.dispatchTime || '08:30';
    var enabled = state.email.enabled !== false;

    var msg = '【 정기 알림 이메일 자동 발송 현황 】\n\n' +
      '• 발송 상태: ' + (enabled ? '🟢 사용 중 (자동 발송 대기)' : '🔴 꺼짐') + '\n' +
      '• 매일 발송 시각: ' + time + ' (KST 한국 표준시)\n' +
      '• 등록된 수신자 (' + recipients.length + '명):\n  ' + (recipients.length ? recipients.join('\n  ') : '(수신자가 없습니다. 이메일을 추가해 주세요.)') + '\n\n' +
      '• 오늘 기준 발송 대상 알림 (' + activeAlerts.length + '건):\n';

    if (!activeAlerts.length) {
      msg += '  (현재 7일 이내 예정된 알림 항목이 없어 발송이 대기됩니다.)';
    } else {
      activeAlerts.forEach(function (it, idx) {
        var st = statusOf(it);
        msg += '  ' + (idx + 1) + '. [' + st.label + '] ' + it.name + (it.target ? ' (' + it.target + ')' : '') + ' (예정일: ' + (it.dueDate || '-') + ')\n';
      });
    }

    alert(msg);
  }
  function renderLiveInfo() {
    var config = settings(), permission = browserPermission();
    $('paBrowserEnabled').checked = config.browserEnabled;
    var permissionText = permission === 'granted' ? '브라우저 알림 허용됨' : (permission === 'denied' ? '브라우저 알림 차단됨' : (permission === 'unsupported' ? '브라우저 알림 미지원' : '브라우저 알림 권한 필요'));
    $('paRequestPermission').textContent = permissionText;
    $('paRequestPermission').disabled = permission === 'unsupported' || permission === 'denied';
    var parts = ['<span>' + esc(permissionText) + '</span>', '<span>' + (config.browserEnabled ? '새 경보 알림 켜짐' : '새 경보 알림 꺼짐') + '</span>'];
    if (state.alerts.some(function (item) { return statusOf(item).key === 'overdue'; })) parts.push('<span class="danger">기한 경과 즉시 확인</span>');
    else if (state.alerts.length) parts.push('<span class="warn">사전 알림 확인 필요</span>');
    else parts.push('<span>30초 주기 확인 중</span>');
    $('paLiveInfo').innerHTML = parts.join('');
  }
  function notifyNewAlerts() {
    var stored = readJson(SEEN_KEY, {}), next = {}, fresh = [], config = settings();
    state.alerts.forEach(function (item) {
      var status = statusOf(item), fingerprint = status.key + '|' + item.dueDate + '|' + item.name + '|' + item.target;
      next[item.id] = fingerprint;
      if (state.initialized && stored[item.id] !== fingerprint && config.browserEnabled) fresh.push(item);
    });
    writeJson(SEEN_KEY, next);
    if (!fresh.length) return;
    var first = fresh[0], label = fresh.length > 1 ? ' 외 ' + (fresh.length - 1) + '건' : '';
    toast('새 정기 관리 알림: ' + first.name + label, statusOf(first).key === 'overdue');
    if (browserPermission() === 'granted') {
      try { new Notification('동김제농협 정기 관리 알림' + label, { body: first.name + ' · ' + alertDetail(first, statusOf(first)), tag: 'dkj-periodic-' + first.id, renotify: true }); } catch (e) {}
    }
  }
  function maybeOpenAlertWindow() {
    if (!state.alerts.length || sessionStorage.getItem('dkj_periodic_alert_opened')) return;
    sessionStorage.setItem('dkj_periodic_alert_opened', '1');
    setTimeout(function () { openDialog('paAlertDialog'); }, 260);
  }
  function render() {
    state.items = loadItems();
    renderSummary(); renderAlerts(); renderTable(); renderEmailSettings(); renderLiveInfo(); notifyNewAlerts(); maybeOpenAlertWindow();
    state.initialized = true;
  }
  function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim()); }
  function saveEmailFromScreen() {
    var raw = $('paEmailRecipients').value || '';
    var recipients = raw.split(/[;,\n]/).map(function (value) { return value.trim(); }).filter(Boolean);
    var invalid = recipients.filter(function (value) { return !validEmail(value); });
    var time = $('paEmailDispatchTime').value || '';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) { toast('발송 시각을 확인하세요.', true); return; }
    if ($('paEmailEnabled').checked && !recipients.length) { toast('이메일 자동 발송을 사용하려면 수신 이메일을 입력하세요.', true); return; }
    if (invalid.length) { toast('올바른 이메일 형식이 아닙니다: ' + invalid[0], true); return; }
    var unique = recipients.filter(function (value, index, list) { return list.indexOf(value) === index; });
    try {
      saveEmailSettings({ recipients: unique, dispatchTime: time, enabled: $('paEmailEnabled').checked, levels: { overdue: $('paEmailOverdue').checked, today: $('paEmailToday').checked, soon: $('paEmailSoon').checked } });
      state.emailDirty = false; setStatus('이메일 자동 발송 설정을 저장했습니다.'); render();
    } catch (e) { toast('이메일 설정을 저장하지 못했습니다. 다시 시도해 주세요.', true); }
  }
  function excelStatus(text, level) {
    var el = $('paExcelStatus'); if (!el) return;
    el.textContent = text; el.className = 'pa-excel-status' + (level ? ' ' + level : '');
  }
  function clearExcelErrors() {
    state.excelResult = null;
    var box = $('paExcelErrors'), button = $('paDownloadErrorReport');
    if (box) { box.hidden = true; box.innerHTML = ''; }
    if (button) button.hidden = true;
  }
  function excelErrorText(error) {
    if (window.DkjPeriodicAlertExcel && DkjPeriodicAlertExcel.errorText) return DkjPeriodicAlertExcel.errorText(error);
    return (error.row ? error.row + '행 ' : '') + (error.label || error.field || '파일') + ': ' + (error.message || '오류');
  }
  function renderExcelErrors(result) {
    var errors = (result && result.errors) || [], box = $('paExcelErrors'), button = $('paDownloadErrorReport');
    if (!box) return;
    var rowCount = result.invalidRows || new Set(errors.filter(function (error) { return error.row > 1; }).map(function (error) { return error.row; })).size;
    var visible = errors.slice(0, 10);
    box.innerHTML = '<div class="pa-excel-errors__head"><b>업로드 차단: 오류 ' + esc(rowCount || errors.length) + '행 · ' + esc(errors.length) + '건</b><span>모든 오류를 수정한 뒤 다시 업로드하세요.</span></div><ul>' +
      visible.map(function (error) { return '<li>' + esc(excelErrorText(error)) + '</li>'; }).join('') +
      '</ul>' + (errors.length > visible.length ? '<p class="pa-excel-errors__more">외 ' + esc(errors.length - visible.length) + '건은 오류 목록 다운로드에서 확인할 수 있습니다.</p>' : '');
    box.hidden = false;
    if (button) button.hidden = !errors.length;
  }
  function downloadExcelErrorReport() {
    if (!state.excelResult || !state.excelResult.errors || !state.excelResult.errors.length || !window.DkjPeriodicAlertExcel) return;
    excelStatus('오류 목록 엑셀을 만드는 중입니다.');
    DkjPeriodicAlertExcel.downloadErrorReport(state.excelResult).then(function (count) {
      excelStatus(count + '건의 오류 목록을 엑셀로 내려받았습니다.', 'warn');
    }).catch(function () { excelStatus('오류 목록 파일을 만들지 못했습니다. 다시 시도해 주세요.', 'error'); });
  }
  function downloadExcelTemplate() {
    if (!window.DkjPeriodicAlertExcel) { toast('엑셀 모듈을 불러오지 못했습니다.', true); return; }
    excelStatus('엑셀 양식을 만드는 중입니다.');
    DkjPeriodicAlertExcel.downloadTemplate().then(function () { excelStatus('엑셀 양식을 내려받았습니다.', 'ok'); }).catch(function () { excelStatus('엑셀 양식을 만들지 못했습니다. 다시 시도해 주세요.', 'warn'); });
  }
  function downloadExcelItems() {
    if (!window.DkjPeriodicAlertExcel) { toast('엑셀 모듈을 불러오지 못했습니다.', true); return; }
    excelStatus(state.items.length + '개 관리 항목을 엑셀로 만드는 중입니다.');
    DkjPeriodicAlertExcel.downloadItems(state.items).then(function () { excelStatus(state.items.length + '개 관리 항목을 엑셀로 내려받았습니다.', 'ok'); }).catch(function () { excelStatus('엑셀 파일을 만들지 못했습니다. 다시 시도해 주세요.', 'warn'); });
  }
  function uploadExcelItems(file) {
    if (!file || !window.DkjPeriodicAlertExcel) return;
    clearExcelErrors();
    excelStatus('엑셀 파일을 확인하는 중입니다.');
    DkjPeriodicAlertExcel.parseFile(file).then(function (result) {
      if (result.errors.length) {
        state.excelResult = result;
        renderExcelErrors(result);
        excelStatus('업로드를 차단했습니다. 오류 ' + (result.invalidRows || result.errors.length) + '행, 총 ' + result.errors.length + '건을 수정하세요.', 'error');
        toast('엑셀 데이터 오류로 업로드가 차단되었습니다.', true);
        return;
      }
      if (!result.items.length) { excelStatus('등록하거나 수정할 관리 항목이 없습니다. 빈 행은 자동으로 건너뜁니다.', 'warn'); return; }
      var current = {}; state.items.forEach(function (item) { current[item.id] = item; });
      result.items.forEach(function (item) { saveItem(Object.assign({}, current[item.id] || {}, item)); });
      excelStatus(result.items.length + '개 관리 항목을 검증 후 일괄 반영했습니다.' + (result.skipped ? ' 빈 행 ' + result.skipped + '건은 건너뛰었습니다.' : ''), 'ok');
      setStatus('엑셀 업로드를 완료했습니다.'); render();
    }).catch(function (error) {
      var code = error && error.message;
      var message = code === 'XLSX_ONLY' ? 'xlsx 파일만 업로드할 수 있습니다.' : (code === 'FILE_TOO_LARGE' ? '파일 크기는 5MB 이하만 업로드할 수 있습니다.' : '엑셀 파일을 읽지 못했습니다. 제공된 양식을 사용해 주세요.');
      excelStatus(message, 'error');
    });
  }
  function openDialog(id) {
    var dialog = $(id); if (!dialog) return;
    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
    else if (!dialog.open) dialog.setAttribute('open', 'open');
  }
  function closeDialog(id) { var dialog = $(id); if (!dialog) return; if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); }
  function blankItem() { return { id: '', type: 'calibration', name: '', target: '', owner: '', dueDate: '', cycleDays: '', leadDays: 7, link: '', memo: '', active: true }; }
  function populateEditor(item) {
    item = item || blankItem();
    $('paItemId').value = item.id || '';
    $('paItemType').value = item.type || 'calibration';
    $('paItemName').value = item.name || '';
    $('paItemTarget').value = item.target || '';
    $('paItemOwner').value = item.owner || '';
    $('paItemDueDate').value = item.dueDate || '';
    $('paItemCycleDays').value = item.cycleDays || '';
    $('paItemLeadDays').value = item.leadDays == null ? 7 : item.leadDays;
    $('paItemLink').value = item.link || '';
    $('paItemMemo').value = item.memo || '';
    $('paItemActive').checked = item.active !== false;
    $('paEditorTitle').textContent = item.id ? '관리 항목 수정' : '관리 항목 등록';
    $('paDeleteItem').style.display = item.id ? '' : 'none';
    openDialog('paEditorDialog');
  }
  function itemById(id) { return state.items.find(function (item) { return item.id === id; }) || null; }
  function editItem(id) { var item = itemById(id); if (item) populateEditor(item); }
  function submitEditor(event) {
    event.preventDefault();
    var id = $('paItemId').value, prior = id ? itemById(id) : null;
    var dueDate = $('paItemDueDate').value;
    var cycle = Number($('paItemCycleDays').value), lead = Number($('paItemLeadDays').value);
    if (!dueDate || !dateOf(dueDate) || !cycle || cycle < 1 || lead < 0) { toast('다음 예정일, 관리 주기, 사전 알림일을 확인하세요.', true); return; }
    var record = Object.assign({}, prior || {}, {
      id: id || undefined,
      type: $('paItemType').value,
      name: $('paItemName').value.trim(),
      target: $('paItemTarget').value.trim(),
      owner: $('paItemOwner').value.trim(),
      dueDate: dueDate,
      cycleDays: cycle,
      leadDays: lead,
      link: $('paItemLink').value.trim(),
      memo: $('paItemMemo').value.trim(),
      active: $('paItemActive').checked
    });
    if (!record.name) { toast('세부 관리 항목을 입력하세요.', true); return; }
    try { saveItem(record); closeDialog('paEditorDialog'); setStatus('관리 항목을 저장했습니다. 다음 예정일 기준으로 알림을 갱신했습니다.'); render(); } catch (e) { toast('저장하지 못했습니다. 다시 시도해 주세요.', true); }
  }
  function completeItem(id) {
    var item = itemById(id); if (!item) return;
    var cycle = Number(item.cycleDays || 0);
    if (!cycle) { toast('관리 주기를 먼저 등록하세요.', true); return; }
    item.dueDate = dateInputValue(addDays(today(), cycle));
    item.lastCompletedAt = new Date().toISOString();
    item.lastCompletedBy = (window.DkjAuth && DkjAuth.user && DkjAuth.user() && DkjAuth.user().name) || '';
    try { saveItem(item); setStatus(item.name + ' 완료 처리: 다음 예정일은 ' + item.dueDate + '입니다.'); render(); } catch (e) { toast('완료 처리하지 못했습니다. 다시 시도해 주세요.', true); }
  }
  function deleteCurrent() {
    var id = $('paItemId').value; if (!id) return;
    var item = itemById(id); if (!item) return;
    if (!window.confirm('“' + item.name + '” 항목을 삭제하시겠습니까?')) return;
    try { window.DkjRecordStore.remove(FORM_ID, id); closeDialog('paEditorDialog'); setStatus('관리 항목을 삭제했습니다.'); render(); } catch (e) { toast('삭제하지 못했습니다. 다시 시도해 주세요.', true); }
  }
  function requestPermission() {
    if (!('Notification' in window)) { toast('이 브라우저는 알림을 지원하지 않습니다.', true); return; }
    if (Notification.permission === 'denied') { toast('브라우저 설정에서 이 사이트의 알림 차단을 해제해 주세요.', true); render(); return; }
    Notification.requestPermission().then(function (permission) {
      toast(permission === 'granted' ? '브라우저 알림이 허용되었습니다.' : '브라우저 알림이 허용되지 않았습니다.', permission !== 'granted'); render();
    });
  }
  function bindButtons() {
    $('paAdd').addEventListener('click', function () { populateEditor(); });
    $('paRefresh').addEventListener('click', function () { render(); toast('정기 관리 예정일을 새로 확인했습니다.'); });
    $('paOpenModal').addEventListener('click', function () { openDialog('paAlertDialog'); });
    $('paDismissModal').addEventListener('click', function () { closeDialog('paAlertDialog'); });
    $('paCancelEdit').addEventListener('click', function () { closeDialog('paEditorDialog'); });
    $('paDeleteItem').addEventListener('click', deleteCurrent);
    $('paEditorForm').addEventListener('submit', submitEditor);
    $('paBrowserEnabled').addEventListener('change', function () { var next = settings(); next.browserEnabled = this.checked; saveSettings(next); render(); });
    $('paRequestPermission').addEventListener('click', requestPermission);
    $('paSaveEmailSettings').addEventListener('click', saveEmailFromScreen);
    if ($('paTestEmailDispatch')) $('paTestEmailDispatch').addEventListener('click', previewEmailDispatch);
    
    // 수신자 추가 버튼 & 엔터키
    if ($('paAddRecipientBtn')) {
      $('paAddRecipientBtn').addEventListener('click', function () {
        addRecipient($('paNewRecipientInput') && $('paNewRecipientInput').value);
      });
    }
    if ($('paNewRecipientInput')) {
      $('paNewRecipientInput').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          addRecipient(this.value);
        }
      });
    }

    ['paEmailRecipients', 'paEmailDispatchTime', 'paEmailEnabled', 'paEmailOverdue', 'paEmailToday', 'paEmailSoon'].forEach(function (id) {
      var el = $(id);
      if (el) {
        el.addEventListener('input', function () { state.emailDirty = true; });
        el.addEventListener('change', function () { state.emailDirty = true; });
      }
    });

    $('paDownloadTemplate').addEventListener('click', downloadExcelTemplate);
    $('paDownloadItems').addEventListener('click', downloadExcelItems);
    $('paUploadItems').addEventListener('click', function () { $('paExcelFile').click(); });
    $('paDownloadErrorReport').addEventListener('click', downloadExcelErrorReport);
    $('paExcelFile').addEventListener('change', function () { var file = this.files && this.files[0]; this.value = ''; uploadExcelItems(file); });
    $('paTypeFilter').addEventListener('change', renderTable);
    $('paStateFilter').addEventListener('change', renderTable);

    document.addEventListener('click', function (event) {
      // 수신자 삭제
      var delBtn = event.target.closest('.pa-tag-del');
      if (delBtn) {
        removeRecipient(delBtn.getAttribute('data-email'));
        return;
      }
      // 빠른 추가 버튼
      var addBtn = event.target.closest('[data-add-email]');
      if (addBtn) {
        addRecipient(addBtn.getAttribute('data-add-email'));
        return;
      }
      // 테이블 및 알림창 액션
      var button = event.target.closest('[data-action],[data-alert-action]');
      if (!button) return;
      var id = button.getAttribute('data-id');
      if (button.getAttribute('data-action') === 'complete') completeItem(id);
      if (button.getAttribute('data-action') === 'edit' || button.getAttribute('data-alert-action') === 'edit') editItem(id);
    });
  }
  function onStorage(event) {
    var key = String((event && event.key) || '');
    if (key.indexOf('dkj:records:' + FORM_ID + ':') === 0 || key.indexOf('dkj:records:' + EMAIL_SETTINGS_FORM_ID + ':') === 0 || key === SETTINGS_KEY) render();
  }
  function init() {
    ensureDefaults();
    bindButtons();
    window.addEventListener('storage', onStorage);
    window.addEventListener('dkj:records-changed', function () { render(); });
    document.addEventListener('dkj:cloud-ready', render);
    state.timer = setInterval(render, CHECK_MS);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
