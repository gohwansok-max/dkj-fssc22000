(function () {
  'use strict';

  var FORM_ID = 'PERIODIC-ALERTS';
  var SETTINGS_KEY = 'dkj:periodic-alerts:settings:v1';
  var SEEN_KEY = 'dkj:periodic-alerts:seen:v1';
  var CHECK_MS = 30000;
  var state = { initialized: false, items: [], alerts: [], timer: null };
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
    renderSummary(); renderAlerts(); renderTable(); renderLiveInfo(); notifyNewAlerts(); maybeOpenAlertWindow();
    state.initialized = true;
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
    $('paTypeFilter').addEventListener('change', renderTable);
    $('paStateFilter').addEventListener('change', renderTable);
    document.addEventListener('click', function (event) {
      var button = event.target.closest('[data-action],[data-alert-action]'); if (!button) return;
      var id = button.getAttribute('data-id');
      if (button.getAttribute('data-action') === 'complete') completeItem(id);
      if (button.getAttribute('data-action') === 'edit' || button.getAttribute('data-alert-action') === 'edit') editItem(id);
    });
  }
  function onStorage(event) {
    var key = String((event && event.key) || '');
    if (key.indexOf('dkj:records:' + FORM_ID + ':') === 0 || key === SETTINGS_KEY) render();
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
