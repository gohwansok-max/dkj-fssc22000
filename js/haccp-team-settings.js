(function () {
  'use strict';

  var FORM_ID = 'HACCP-TEAM-SETTINGS';
  var current = null;
  var approvalUi = null;
  var RISKS = [
    { key: 'fraud', label: '식품사기', description: '원료 진위·원산지·공급망·가격·성적서 관련 취약성' },
    { key: 'defense', label: '식품방어', description: '의도적 오염·훼손, 출입·방문객·유틸리티·기록보안 위협' },
    { key: 'env', label: '환경모니터링', description: '공정·위생구역·채취지점·검사결과·반복 이탈 위험' },
    { key: 'allergen', label: '알레르기 관리', description: '원료·제품·교차접촉·세척전환·라벨 표시 위험' }
  ];

  function $(id) { return document.getElementById(id); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function me() { try { return window.DkjAuth && window.DkjAuth.user ? window.DkjAuth.user() : null; } catch (e) { return null; } }

  function defaultRiskSettings() {
    var out = {};
    RISKS.forEach(function (r) { out[r.key] = { level: '중간', basis: '', controls: '', reviewTrigger: '' }; });
    return out;
  }

  function blankState() {
    var user = me();
    return {
      title: 'HACCP팀 위험·환경 설정',
      docDate: today(),
      revision: 'R1',
      effectiveDate: today(),
      nextReviewDate: '',
      writer: (user && user.name) || '',
      reviewer: '',
      approver: '',
      changeReason: '신규 제정',
      riskSettings: defaultRiskSettings(),
      samplingSites: [],
      approvals: { writer: '', reviewer: '', approver: '' },
      signoff: {},
      audit: [],
      locked: false,
      status: 'draft'
    };
  }

  function allRecords() {
    return (window.DkjRecordStore ? window.DkjRecordStore.list(FORM_ID) : []).sort(function (a, b) {
      return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
    });
  }

  function riskHtml(r, value) {
    var v = value || { level: '중간', basis: '', controls: '', reviewTrigger: '' };
    return '<article class="risk-box" data-risk="' + r.key + '">' +
      '<h3>' + esc(r.label) + '</h3><p class="desc">' + esc(r.description) + '</p>' +
      '<div class="field"><label>위험등급 *</label><select name="level"><option' + (v.level === '낮음' ? ' selected' : '') + '>낮음</option><option' + (v.level === '중간' ? ' selected' : '') + '>중간</option><option' + (v.level === '높음' ? ' selected' : '') + '>높음</option></select></div>' +
      '<div class="field"><label>평가 근거 *</label><textarea name="basis" placeholder="원료·공정·이력·고객/법규 요구사항 등">' + esc(v.basis) + '</textarea></div>' +
      '<div class="field"><label>통제·완화조치 *</label><textarea name="controls" placeholder="승인공급업체, 출입통제, 채취계획, 세척·표시확인 등">' + esc(v.controls) + '</textarea></div>' +
      '<div class="field"><label>재검토 조건</label><input name="reviewTrigger" value="' + esc(v.reviewTrigger) + '" placeholder="공급처·공정·이탈·고객요구 변경 시"></div>' +
    '</article>';
  }

  function addSite(site) {
    site = site || {};
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td><input data-key="site" value="' + esc(site.site) + '" placeholder="예: 포장실 작업대 A"></td>' +
      '<td><select data-key="zone"><option' + (site.zone === 'Zone 1 제품접촉면' ? ' selected' : '') + '>Zone 1 제품접촉면</option><option' + (site.zone === 'Zone 2 제품인접면' ? ' selected' : '') + '>Zone 2 제품인접면</option><option' + (site.zone === 'Zone 3 비제품접촉면' ? ' selected' : '') + '>Zone 3 비제품접촉면</option><option' + (site.zone === 'Zone 4 외곽·일반구역' ? ' selected' : '') + '>Zone 4 외곽·일반구역</option></select></td>' +
      '<td><input data-key="test" value="' + esc(site.test) + '" placeholder="예: 일반세균"></td>' +
      '<td><select data-key="frequency"><option' + (site.frequency === '매일' ? ' selected' : '') + '>매일</option><option' + (site.frequency === '매주' ? ' selected' : '') + '>매주</option><option' + (site.frequency === '매월' ? ' selected' : '') + '>매월</option><option' + (site.frequency === '분기' ? ' selected' : '') + '>분기</option><option' + (site.frequency === '연간' ? ' selected' : '') + '>연간</option><option' + (site.frequency === '이슈 발생 시' ? ' selected' : '') + '>이슈 발생 시</option></select></td>' +
      '<td><input data-key="criterion" value="' + esc(site.criterion) + '" placeholder="예: 사내 승인기준/불검출"></td>' +
      '<td><input data-key="action" value="' + esc(site.action) + '" placeholder="예: 격리·청소소독·재채취"></td>' +
      '<td><button type="button" class="btn danger delete-site">×</button></td>';
    tr.querySelector('.delete-site').addEventListener('click', function () { tr.remove(); });
    $('siteRows').appendChild(tr);
  }

  function renderForm() {
    var s = current || blankState();
    $('revision').value = s.revision || '';
    $('effectiveDate').value = s.effectiveDate || '';
    $('nextReviewDate').value = s.nextReviewDate || '';
    $('writer').value = s.writer || '';
    $('reviewer').value = s.reviewer || '';
    $('approver').value = s.approver || '';
    $('changeReason').value = s.changeReason || '';
    $('riskGrid').innerHTML = RISKS.map(function (r) { return riskHtml(r, s.riskSettings && s.riskSettings[r.key]); }).join('');
    $('siteRows').innerHTML = '';
    (s.samplingSites || []).forEach(addSite);
    if (!(s.samplingSites || []).length) addSite();
    updateUiState();
  }

  function formState() {
    var s = clone(current || blankState());
    s.title = 'HACCP팀 위험·환경 설정';
    s.docDate = today();
    s.revision = $('revision').value.trim();
    s.effectiveDate = $('effectiveDate').value;
    s.nextReviewDate = $('nextReviewDate').value;
    s.writer = $('writer').value.trim();
    s.reviewer = $('reviewer').value.trim();
    s.approver = $('approver').value.trim();
    s.changeReason = $('changeReason').value.trim();
    s.approvals = { writer: s.writer, reviewer: s.reviewer, approver: s.approver };
    s.riskSettings = {};
    document.querySelectorAll('.risk-box').forEach(function (box) {
      var key = box.getAttribute('data-risk');
      s.riskSettings[key] = {
        level: box.querySelector('[name="level"]').value,
        basis: box.querySelector('[name="basis"]').value.trim(),
        controls: box.querySelector('[name="controls"]').value.trim(),
        reviewTrigger: box.querySelector('[name="reviewTrigger"]').value.trim()
      };
    });
    s.samplingSites = Array.prototype.slice.call(document.querySelectorAll('#siteRows tr')).map(function (tr) {
      var obj = {};
      tr.querySelectorAll('[data-key]').forEach(function (input) { obj[input.getAttribute('data-key')] = input.value.trim(); });
      return obj;
    }).filter(function (site) { return site.site || site.test || site.criterion || site.action; });
    return s;
  }

  function validate(s, finalizing) {
    var missing = [];
    [['revision','개정번호'], ['effectiveDate','적용일'], ['nextReviewDate','다음 정기검토일'], ['writer','작성자'], ['reviewer','검토자'], ['approver','승인자'], ['changeReason','개정·검토 사유']].forEach(function (item) { if (!s[item[0]]) missing.push(item[1]); });
    RISKS.forEach(function (r) {
      var v = s.riskSettings[r.key];
      if (!v.basis) missing.push(r.label + ' 평가 근거');
      if (!v.controls) missing.push(r.label + ' 통제·완화조치');
    });
    if (!s.samplingSites.length) missing.push('환경 채취지점');
    s.samplingSites.forEach(function (site, idx) {
      ['site','zone','test','frequency','criterion','action'].forEach(function (key) { if (!site[key]) missing.push('채취지점 ' + (idx + 1) + ' ' + key); });
    });
    if (missing.length) { alert('다음 항목을 입력하세요.\n- ' + missing.slice(0, 8).join('\n- ') + (missing.length > 8 ? '\n외 ' + (missing.length - 8) + '건' : '')); return false; }
    if (finalizing) {
      var signed = s.signoff || {};
      if (!signed.writer || !signed.reviewer || !signed.approver) { alert('작성·검토·승인 결재를 모두 확정한 뒤 작성완료·잠금을 진행하세요.'); return false; }
    }
    return true;
  }

  function save(s, message) {
    current = s;
    window.DkjRecordStore.save(FORM_ID, current);
    current = window.DkjRecordStore.get(FORM_ID, current.id) || current;
    renderHistory();
    updateUiState();
    syncApprovalPanel();
    if (message) alert(message);
  }

  function syncApprovalPanel() {
    var panel = $('approvalPanel');
    if (!panel) return;
    if (!current || !current.id) {
      panel.innerHTML = '<div class="locked-note">설정 기준을 모두 입력한 뒤 <strong>초안 저장</strong>을 하면 작성·검토·승인 결재를 진행할 수 있습니다.</div>';
      return;
    }
    if (approvalUi) approvalUi.render();
  }

  function updateUiState() {
    var isLocked = !!(current && current.locked);
    var state = isLocked ? '승인 완료 · 잠금됨' : (current && current.id ? '검토·승인 진행 중' : '신규 초안');
    $('settingsStatus').className = 'statusbar ' + (isLocked ? 'ok' : (current && current.id ? 'draft' : ''));
    $('settingsStatus').innerHTML = '<strong>' + esc(state) + '</strong> · ' + (isLocked ? '이 설정은 심사준비 화면의 승인 기준으로 사용할 수 있습니다. 변경은 새 개정본으로 관리하세요.' : '초안 저장 후 작성·검토·승인 결재를 진행하세요.');
    $('revisionTag').textContent = (current && current.revision ? current.revision : '신규 초안') + (isLocked ? ' · 승인' : ' · 초안');
    document.querySelectorAll('input,select,textarea,#addSite').forEach(function (el) { el.disabled = isLocked; });
    $('saveDraft').disabled = isLocked;
    $('finalize').disabled = isLocked || !(current && current.id);
    $('lockHint').textContent = isLocked ? '승인된 설정은 잠겼습니다. 수정이 필요하면 “새 개정본 만들기”를 사용하세요.' : '초안을 저장한 뒤 작성·검토·승인 결재를 순서대로 확정하세요.';
  }

  function renderHistory() {
    var list = allRecords();
    $('settingsHistory').innerHTML = list.length ? list.map(function (r) {
      var label = r.locked ? '<span class="tag">승인·잠금</span>' : '<span class="tag draft">초안</span>';
      return '<div class="history-row"><span>' + esc(r.revision || '개정번호 없음') + '</span><span>' + label + '</span><span><strong>' + esc(r.changeReason || '사유 미입력') + '</strong><br><span class="note">적용일 ' + esc(r.effectiveDate || '-') + ' · 작성 ' + esc(r.writer || '-') + '</span></span><span><button class="btn load-setting" type="button" data-id="' + esc(r.id) + '">열기</button></span></div>';
    }).join('') : '<div class="note">저장된 설정이 없습니다.</div>';
    $('settingsHistory').querySelectorAll('.load-setting').forEach(function (button) {
      button.addEventListener('click', function () { load(button.getAttribute('data-id')); });
    });
  }

  function load(id) {
    current = window.DkjRecordStore.get(FORM_ID, id) || blankState();
    renderForm();
    if (approvalUi) approvalUi.render();
  }

  function nextRevision(value) {
    var m = /^R(\d+)$/i.exec(String(value || ''));
    return m ? 'R' + (Number(m[1]) + 1) : 'R1';
  }

  function makeNewRevision() {
    var base = formState();
    current = {
      title: 'HACCP팀 위험·환경 설정', docDate: today(), revision: nextRevision(base.revision), effectiveDate: today(), nextReviewDate: '',
      writer: (me() && me().name) || base.writer || '', reviewer: '', approver: '',
      changeReason: '개정본 작성', riskSettings: clone(base.riskSettings), samplingSites: clone(base.samplingSites),
      approvals: { writer: '', reviewer: '', approver: '' }, signoff: {}, audit: [], locked: false, status: 'draft'
    };
    renderForm();
    if (approvalUi) approvalUi.render();
  }

  function mountApproval() {
    if (!window.DkjApproval) return;
    approvalUi = window.DkjApproval.mount({
      getState: function () { return current || blankState(); },
      onChange: function (state) {
        current = state;
        save(current, '결재가 저장됐습니다. 다음 결재 단계 또는 작성완료·잠금을 진행하세요.');
      }
    });
    syncApprovalPanel();
  }

  function bindEvents() {
    $('addSite').addEventListener('click', function () { addSite(); });
    $('saveDraft').addEventListener('click', function () {
      var s = formState();
      if (!validate(s, false)) return;
      s.status = 'draft';
      save(s, 'HACCP팀 설정 초안이 저장됐습니다. 검토·승인 결재를 진행하세요.');
    });
    $('finalize').addEventListener('click', function () {
      var s = formState();
      if (!validate(s, true)) return;
      if (!confirm('이 설정을 작성완료·잠금 처리합니다. 이후 내용 수정은 새 개정본으로만 가능합니다. 계속하시겠습니까?')) return;
      s.status = 'approved'; s.locked = true;
      save(s, 'HACCP팀 승인 설정이 작성완료·잠금됐습니다.');
    });
    $('newRevision').addEventListener('click', function () {
      if (current && !current.locked && current.id && !confirm('현재 초안은 저장된 상태로 남고 새 개정본을 만듭니다. 계속하시겠습니까?')) return;
      makeNewRevision();
    });
  }

  function init() {
    current = allRecords()[0] || blankState();
    renderForm();
    bindEvents();
    mountApproval();
    renderHistory();
    syncApprovalPanel();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
