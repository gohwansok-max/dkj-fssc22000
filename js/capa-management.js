(function () {
  'use strict';
  var FORM_ID = 'CAPA-MANAGEMENT';
  var SOURCES = ['FR-015', 'FR-016', 'FR-039', 'FR-042', 'DKJ-S-02-19'];
  var current = null;
  var approvalUi = null;

  function $(id) { return document.getElementById(id); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function nowIso() { return new Date().toISOString(); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function me() { try { return window.DkjAuth && window.DkjAuth.user ? window.DkjAuth.user() : null; } catch (e) { return null; } }

  function readPath(obj, path) {
    return path.split('.').reduce(function (value, key) { return value && value[key] != null ? value[key] : ''; }, obj);
  }
  function pick(obj, names) {
    for (var i = 0; i < names.length; i++) {
      var value = readPath(obj, names[i]);
      if (value != null && String(value).trim() !== '') return value;
    }
    return '';
  }
  function toText(v) {
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'object' && v) return Object.keys(v).filter(function (key) { return v[key]; }).join(', ');
    return String(v || '');
  }
  function formatDate(v) { return v ? String(v).slice(0, 10) : '-'; }

  function records() {
    if (!window.DkjRecordStore) return [];
    return window.DkjRecordStore.list(FORM_ID).filter(function (r) { return r && r.recordType === 'capa'; }).sort(function (a, b) {
      return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
    });
  }
  function sourceRecords(formId) {
    if (!window.DkjRecordStore) return [];
    var ids = formId ? [formId] : SOURCES;
    var list = [];
    ids.forEach(function (id) { list = list.concat(window.DkjRecordStore.list(id).map(function (r) { r.__sourceForm = id; return r; })); });
    return list.sort(function (a, b) { return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')); });
  }

  function newCapaNo() {
    var prefix = 'CAPA-' + today().replace(/-/g, '');
    var n = records().filter(function (r) { return String(r.capaNo || '').indexOf(prefix) === 0; }).length + 1;
    return prefix + '-' + String(n).padStart(3, '0');
  }
  function blankState() {
    var user = me();
    return { recordType: 'capa', title: '이탈·시정조치(CAPA)', capaNo: newCapaNo(), foundDate: today(), severity: '중대', discovery: '공정·CCP 모니터링', item: '', lot: '', qty: '', unit: 'kg', isolation: '', description: '', containment: '', containmentOwner: (user && user.name) || '', rootMethod: '5 Why', actionOwner: '', dueDate: '', verificationDueDate: '', rootCause: '', actionPlan: '', status: 'containment', verifyDate: '', verifier: '', verificationResult: '', verificationDetail: '', evidence: '', closureDate: '', managementReview: '', writer: (user && user.name) || '', reviewer: '', approver: '', approvals: { writer: (user && user.name) || '', reviewer: '', approver: '' }, signoff: {}, audit: [], sourceForm: '', sourceId: '', sourceTitle: '', sourceSnapshot: {}, locked: false, createdAt: nowIso() };
  }

  function deadlineFor(r) {
    return (r.status === 'verification' || r.status === 'closed') && r.verificationDueDate ? r.verificationDueDate : r.dueDate;
  }
  function daysTo(date) {
    if (!date) return null;
    var start = new Date(today() + 'T00:00:00');
    var end = new Date(String(date).slice(0, 10) + 'T00:00:00');
    return Math.round((end - start) / 86400000);
  }
  function isDueSoon(r) {
    var days = daysTo(deadlineFor(r));
    return !r.locked && days != null && days >= 0 && days <= 7;
  }
  function statusMeta(r) {
    var deadline = deadlineFor(r), days = daysTo(deadline);
    if (r.locked) return { label: '종결 완료', cls: 'done' };
    if (deadline && days < 0) return { label: '기한 초과', cls: 'overdue' };
    if (isDueSoon(r)) return { label: '7일 이내', cls: 'soon' };
    var map = { containment: '즉시조치 완료', root: '원인분석 완료', action: '조치 실행 중', verification: '효과검증 대기', closed: '종결 요청' };
    return { label: map[r.status] || '초안', cls: 'progress' };
  }

  function setValue(id, value) { var el = $(id); if (el) el.value = value == null ? '' : value; }
  function textValue(id) { return ($(id).value || '').trim(); }

  function renderSourceOptions() {
    var selectedForm = $('sourceForm').value;
    var options = sourceRecords(selectedForm);
    var prior = $('sourceRecord').value;
    $('sourceRecord').innerHTML = '<option value="">직접 입력</option>' + options.map(function (r) {
      var item = toText(pick(r, ['itemName','품명','관련제품','원·부자재명','제품명','info.itemName'])) || '품목 미입력';
      var lot = toText(pick(r, ['lot','LOT','로트번호','info.lot'])) || 'LOT 미입력';
      var date = formatDate(pick(r, ['processDate','작성일자','접수일','개시일','docDate','createdAt']));
      return '<option value="' + esc(r.__sourceForm + '|' + r.id) + '">' + esc(r.__sourceForm + ' · ' + date + ' · ' + item + ' · ' + lot) + '</option>';
    }).join('');
    if (prior) $('sourceRecord').value = prior;
  }

  function selectedSource() {
    var value = $('sourceRecord').value;
    if (!value) return null;
    var parts = value.split('|');
    return sourceRecords(parts[0]).filter(function (r) { return r.id === parts.slice(1).join('|'); })[0] || null;
  }

  function sourceToCapa(r) {
    if (!r) return;
    var form = r.__sourceForm;
    var item = toText(pick(r, ['itemName','품명','관련제품','원·부자재명','제품명','info.itemName']));
    var lot = toText(pick(r, ['lot','LOT','로트번호','info.lot']));
    var qty = pick(r, ['qty','수량','회수대상량','info.qty']);
    var unit = toText(pick(r, ['unit','단위','info.unit'])) || 'kg';
    var description = toText(pick(r, ['reasonText','reasons','부적합유형','발생내용','불만내용','불만요지','회수사유','부적합 발생내용','info.description']));
    var immediate = toText(pick(r, ['disposition','처리','처리결과','회신·보상·시정','대책실시','조치사항','조치','info.action']));
    var root = toText(pick(r, ['조사결과','원인분석 및 대책 수립','rootCause']));
    var date = pick(r, ['processDate','작성일자','접수일','개시일','docDate','createdAt']);
    setValue('foundDate', formatDate(date) === '-' ? today() : formatDate(date));
    setValue('item', item); setValue('lot', lot); setValue('qty', qty); setValue('unit', unit);
    setValue('description', description); setValue('containment', immediate); setValue('rootCause', root);
    var discoveryMap = { 'FR-015': '입고검사', 'FR-016': '제품회수·모의회수', 'FR-039': '제품검사', 'FR-042': '고객불만', 'DKJ-S-02-19': '공정·CCP 모니터링' };
    setValue('discovery', discoveryMap[form] || '기타');
    setValue('sourceInfo', '');
    $('sourceInfo').className = 'source-info';
    $('sourceInfo').innerHTML = '<strong>' + esc(form) + ' 원천 이탈기록 연결됨</strong> · ' + esc(item || '품목 미입력') + ' / LOT ' + esc(lot || '미입력') + ' / 기존 조치: ' + esc(immediate || '미입력') + '<br><span class="tag">원천기록은 CAPA 저장 시 스냅샷으로 보존됩니다.</span>';
  }

  function formState() {
    var s = clone(current || blankState());
    ['capaNo','foundDate','severity','discovery','item','lot','qty','unit','isolation','description','containment','containmentOwner','rootMethod','actionOwner','dueDate','verificationDueDate','rootCause','actionPlan','status','verifyDate','verifier','verificationResult','verificationDetail','evidence','closureDate','managementReview','writer','reviewer','approver'].forEach(function (key) { s[key] = textValue(key); });
    s.title = 'CAPA ' + s.capaNo + ' · ' + (s.item || '품목 미입력');
    s.recordType = 'capa'; s.updatedAt = nowIso();
    s.approvals = { writer: s.writer, reviewer: s.reviewer, approver: s.approver };
    var source = selectedSource();
    if (source) { s.sourceForm = source.__sourceForm; s.sourceId = source.id; s.sourceTitle = source.title || ''; s.sourceSnapshot = clone(source); }
    return s;
  }

  function draftValid(s) {
    var items = [['capaNo','CAPA 번호'],['foundDate','발견일'],['item','품목/공정'],['description','이탈 내용'],['containment','즉시조치·확산방지'],['containmentOwner','즉시조치 담당자'],['writer','작성자'],['reviewer','검토자'],['approver','승인자']];
    var miss = items.filter(function (p) { return !s[p[0]]; }).map(function (p) { return p[1]; });
    if (miss.length) { alert('다음 항목을 입력하세요.\n- ' + miss.join('\n- ')); return false; }
    return true;
  }
  function readyValid(s) {
    if (!draftValid(s)) return false;
    var items = [['rootCause','근본원인 분석'],['actionPlan','시정·예방조치'],['actionOwner','조치 책임자'],['dueDate','조치 완료기한'],['verificationDueDate','효과검증 예정일'],['verifyDate','효과검증일'],['verifier','효과검증자'],['verificationDetail','효과검증 방법·결과'],['evidence','증빙 참조'],['closureDate','종결 제안일']];
    var miss = items.filter(function (p) { return !s[p[0]]; }).map(function (p) { return p[1]; });
    if (!s.verificationResult || s.verificationResult === '검증 대기') miss.push('효과검증 결과');
    if (s.verificationResult && s.verificationResult !== '적합·재발 없음') miss.push('종결 가능한 효과검증 결과(적합·재발 없음)');
    if (s.foundDate && s.dueDate && s.dueDate < s.foundDate) miss.push('발견일 이후의 조치 완료기한');
    if (s.verifyDate && s.closureDate && s.closureDate < s.verifyDate) miss.push('효과검증일 이후의 종결 제안일');
    if (miss.length) { alert('종결 요청 전 다음 항목을 입력하세요.\n- ' + miss.join('\n- ')); return false; }
    return true;
  }

  function updateUi() {
    var locked = !!(current && current.locked);
    var meta = statusMeta(current || blankState());
    $('recordStatus').className = 'badge ' + meta.cls; $('recordStatus').textContent = meta.label;
    document.querySelectorAll('.card input,.card select,.card textarea,#loadSource').forEach(function (el) { el.disabled = locked; });
    $('saveDraft').disabled = locked; $('markReady').disabled = locked || !(current && current.id); $('lockClose').disabled = locked || !(current && current.id);
    $('approvalHint').textContent = locked ? '승인된 CAPA는 잠겼습니다. 후속 조치가 필요하면 새 CAPA를 등록하세요.' : (current && current.id ? '작성·검토·승인 결재를 완료한 뒤 “승인 후 종결·잠금”을 진행하세요.' : '초안을 저장하면 HACCP팀 결재를 진행할 수 있습니다.');
    syncApproval();
  }
  function syncApproval() {
    if (!$('approvalPanel')) return;
    if (!current || !current.id) { $('approvalPanel').innerHTML = '<div class="hint">CAPA 초안을 저장한 뒤 작성·검토·승인 결재를 진행할 수 있습니다.</div>'; return; }
    if (approvalUi) approvalUi.render();
  }

  function save(s, message) {
    current = s; window.DkjRecordStore.save(FORM_ID, current); current = window.DkjRecordStore.get(FORM_ID, current.id) || current;
    renderHistory(); updateUi(); if (message) alert(message);
  }

  function renderForm() {
    var s = current || blankState();
    ['capaNo','foundDate','severity','discovery','item','lot','qty','unit','isolation','description','containment','containmentOwner','rootMethod','actionOwner','dueDate','verificationDueDate','rootCause','actionPlan','status','verifyDate','verifier','verificationResult','verificationDetail','evidence','closureDate','managementReview','writer','reviewer','approver'].forEach(function (key) { setValue(key, s[key]); });
    $('sourceForm').value = s.sourceForm || ''; renderSourceOptions();
    if (s.sourceForm && s.sourceId) $('sourceRecord').value = s.sourceForm + '|' + s.sourceId;
    if (s.sourceForm) { $('sourceInfo').className = 'source-info'; $('sourceInfo').innerHTML = '<strong>' + esc(s.sourceForm) + ' 원천기록 연동</strong> · ' + esc(s.sourceTitle || '저장된 원천기록') + ' · 원천 스냅샷이 CAPA에 보존돼 있습니다.'; }
    else { $('sourceInfo').className = 'source-info empty'; $('sourceInfo').textContent = '원천 이탈기록을 선택하면 LOT·품목·발생내용·기존 조치가 자동 입력됩니다.'; }
    updateUi();
  }

  function renderMetrics() {
    var list = records(), open = list.filter(function (r) { return !r.locked; });
    var overdue = open.filter(function (r) { var days = daysTo(deadlineFor(r)); return days != null && days < 0; });
    var dueSoon = open.filter(isDueSoon);
    $('mOpen').textContent = open.length;
    $('mOverdue').textContent = overdue.length;
    $('mRoot').textContent = open.filter(function (r) { return !r.rootCause || r.status === 'containment'; }).length;
    $('mVerify').textContent = open.filter(function (r) { return r.status === 'verification' || (!r.verificationDetail && r.status !== 'containment'); }).length;
    $('mDueSoon').textContent = dueSoon.length;
    $('mClosed').textContent = list.filter(function (r) { return r.locked; }).length;
    var notice = $('dueSoonNotice');
    if (notice) {
      if (overdue.length || dueSoon.length) {
        notice.classList.remove('hide');
        notice.innerHTML = '<strong>CAPA 기한 경보:</strong> 기한 초과 ' + overdue.length + '건 · 7일 이내 ' + dueSoon.length + '건입니다. 원인분석·조치 또는 효과검증 일정을 확인하세요.';
      } else { notice.classList.add('hide'); notice.textContent = ''; }
    }
  }
  function renderHistory() {
    renderMetrics();
    var filter = $('historyFilter').value, rows = records();
    rows = rows.filter(function (r) { var days = daysTo(deadlineFor(r)), overdue = !r.locked && days != null && days < 0; if (filter === 'open') return !r.locked; if (filter === 'overdue') return overdue; if (filter === 'dueSoon') return isDueSoon(r); if (filter === 'verification') return !r.locked && (r.status === 'verification' || r.status === 'closed'); if (filter === 'closed') return r.locked; return true; });
    $('capaHistory').innerHTML = rows.length ? rows.map(function (r) { var meta = statusMeta(r); return '<div class="history-row"><span><strong>' + esc(r.capaNo || '-') + '</strong><br><span class="tag">' + esc(formatDate(r.foundDate)) + '</span></span><span class="badge ' + meta.cls + '">' + meta.label + '</span><span><strong>' + esc(r.item || '품목 미입력') + '</strong> · LOT ' + esc(r.lot || '-') + '<br><span class="tag">' + esc((r.sourceForm || '직접 등록') + ' / ' + (r.discovery || '-')) + '</span><br>' + esc(r.description || '이탈내용 미입력') + '</span><span>책임: ' + esc(r.actionOwner || r.containmentOwner || '-') + '<br>기한: ' + esc(formatDate(deadlineFor(r))) + '</span><span><button class="btn load-capa" data-id="' + esc(r.id) + '">열기</button></span></div>'; }).join('') : '<p class="desc">저장된 CAPA가 없습니다.</p>';
    $('capaHistory').querySelectorAll('.load-capa').forEach(function (b) { b.addEventListener('click', function () { load(b.getAttribute('data-id')); }); });
  }

  function load(id) { current = window.DkjRecordStore.get(FORM_ID, id) || blankState(); renderForm(); if (approvalUi) approvalUi.render(); }
  function newRecord() { current = blankState(); renderForm(); if (approvalUi) approvalUi.render(); }

  function mountApproval() {
    if (!window.DkjApproval) return;
    approvalUi = window.DkjApproval.mount({ getState: function () { return current || blankState(); }, onChange: function (state) { current = state; save(current, '결재가 저장됐습니다. 다음 결재 단계 또는 종결·잠금을 진행하세요.'); } });
    syncApproval();
  }

  function bind() {
    $('sourceForm').addEventListener('change', renderSourceOptions);
    $('loadSource').addEventListener('click', function () { var source = selectedSource(); if (!source) { alert('원천 이탈기록을 선택하세요.'); return; } sourceToCapa(source); });
    $('saveDraft').addEventListener('click', function () { var s = formState(); if (!draftValid(s)) return; save(s, 'CAPA 초안이 저장됐습니다. 원인분석·조치·효과검증을 보완하고 HACCP팀 결재를 진행하세요.'); });
    $('markReady').addEventListener('click', function () { var s = formState(); if (!readyValid(s)) return; s.status = 'closed'; s.closureDate = s.closureDate || today(); setValue('status', 'closed'); setValue('closureDate', s.closureDate); save(s, '효과검증 완료·종결 요청 상태로 저장했습니다. HACCP팀 결재를 완료하세요.'); });
    $('lockClose').addEventListener('click', function () { var s = formState(); if (!readyValid(s)) return; if (s.status !== 'closed') { alert('먼저 “효과검증 완료·종결 요청”을 진행하세요.'); return; } if (!s.signoff || !s.signoff.writer || !s.signoff.reviewer || !s.signoff.approver) { alert('작성·검토·승인 결재를 모두 완료한 뒤 종결·잠금하세요.'); return; } if (!confirm('이 CAPA를 종결·잠금합니다. 이후 내용은 수정할 수 없습니다. 계속하시겠습니까?')) return; s.locked = true; s.status = 'closed'; save(s, 'CAPA가 승인·종결·잠금됐습니다.'); });
    $('newCapa').addEventListener('click', function () { if (current && current.id && !current.locked && !confirm('현재 초안은 저장된 상태로 남고 새 CAPA를 시작합니다. 계속하시겠습니까?')) return; newRecord(); });
    $('historyFilter').addEventListener('change', renderHistory);
  }

  function init() { current = records()[0] || blankState(); renderForm(); bind(); mountApproval(); renderHistory(); syncApproval(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
