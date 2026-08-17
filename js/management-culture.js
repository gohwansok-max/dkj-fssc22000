(function () {
  'use strict';
  var FORM_ID = 'MANAGEMENT-CULTURE-HUB';
  var current = null, approvalUi = null;
  var dims = [
    { key: 'leadership', label: '리더십·책임', text: '경영진의 가시적 참여, 자원지원, 책임과 권한' },
    { key: 'communication', label: '소통', text: '현장 보고, 이탈 공유, 목표·기준의 이해' },
    { key: 'training', label: '교육·역량', text: '직무교육, 이해도 확인, 행동 변화' },
    { key: 'feedback', label: '직원 피드백', text: '개선제안, 불안전 행위 보고, 보복 없는 참여' },
    { key: 'measurement', label: '성과측정', text: 'KPI·이탈추세·감사결과·개선 효과의 검토' }
  ];
  var $ = function (id) { return document.getElementById(id); };
  var today = function () { return new Date().toISOString().slice(0, 10); };
  var clone = function (x) { return JSON.parse(JSON.stringify(x)); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); };
  function me() { try { return window.DkjAuth && DkjAuth.user ? DkjAuth.user() : null; } catch (e) { return null; } }
  function list(form) { try { return (window.DkjRecordStore && DkjRecordStore.list(form)) || []; } catch (e) { return []; } }
  function n(v) { var x = Number(v); return isFinite(x) ? x : 0; }
  function defaultScores() { var out = {}; dims.forEach(function (d) { out[d.key] = 3; }); return out; }
  function blank(type) {
    var user = me();
    return {
      title: type === 'culture' ? '식품안전문화 평가·실행계획' : '경영검토 회의·후속조치',
      recordType: type || 'management', docDate: today(), writer: (user && user.name) || '', reviewer: '', approver: '',
      status: 'draft', locked: false, approvals: { writer: '', reviewer: '', approver: '' }, signoff: {}, audit: [],
      reviewPeriod: '', meetingDate: today(), chairperson: '', attendees: '', meetingType: '정기 경영검토', managementInput: '', decisions: '', reviewAction: '', reviewOwner: '', reviewDue: '', resources: '', reviewVerification: '',
      culturePeriod: '', cultureDate: today(), cultureTeam: '', cultureMethod: '현장관찰·면담·기록평가', cultureReviewDate: '', cultureScores: defaultScores(), cultureStrength: '', cultureGap: '', cultureOwner: '', cultureDue: '', culturePlan: '', cultureVerification: '', cultureEvidence: ''
    };
  }
  function allRecords() { return list(FORM_ID).sort(function (a, b) { return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')); }); }
  function isClosed(r) { return !!r.locked; }
  function isOverdue(r) { if (!r || r.locked || !r.dueDate) return false; var d = new Date(r.dueDate); d.setHours(0,0,0,0); var t = new Date(); t.setHours(0,0,0,0); return d < t; }
  function stats() {
    var capa = list('CAPA-MANAGEMENT'), drills = list('TRACE-DRILL'), recalls = list('FR-016'), trace = list('FR-040');
    var closedCapa = capa.filter(isClosed).length, overdue = capa.filter(isOverdue).length;
    var mock = drills.filter(function (r) { return !!r.locked; }).length;
    return { capa: capa.length, closedCapa: closedCapa, openCapa: capa.length - closedCapa, overdue: overdue, drills: drills.length, mock: mock, recalls: recalls.length, trace: trace.length };
  }
  function setVal(id, value) { if ($(id)) $(id).value = value == null ? '' : value; }
  function selectedType() { return current ? current.recordType : 'management'; }
  function scoreLabel(v) { return ({ 1:'매우 미흡', 2:'미흡', 3:'보통', 4:'양호', 5:'우수' })[n(v)] || '미평가'; }
  function renderDimensions(scores) {
    scores = scores || defaultScores();
    $('cultureDimensions').innerHTML = dims.map(function (d) {
      var value = n(scores[d.key]) || 3;
      return '<article class="dimension"><b>' + esc(d.label) + '</b><p>' + esc(d.text) + '</p><select data-score="' + d.key + '">' + [1,2,3,4,5].map(function (x) { return '<option value="' + x + '"' + (x === value ? ' selected' : '') + '>' + x + '점 · ' + scoreLabel(x) + '</option>'; }).join('') + '</select></article>';
    }).join('');
    $('cultureDimensions').querySelectorAll('[data-score]').forEach(function (el) { el.addEventListener('change', renderScore); });
    renderScore();
  }
  function renderScore() {
    var vals = Array.prototype.slice.call(document.querySelectorAll('[data-score]')).map(function (x) { return n(x.value); });
    var avg = vals.length ? Math.round((vals.reduce(function (a,b){return a+b;},0) / vals.length) * 10) / 10 : 0;
    var low = dims.filter(function (d) { var el = document.querySelector('[data-score="' + d.key + '"]'); return el && n(el.value) <= 2; }).map(function (d) { return d.label; });
    $('scoreNote').innerHTML = '<strong>평균 ' + esc(avg) + '점 / 5점</strong> · ' + (low.length ? '개선 우선영역: <strong>' + esc(low.join(', ')) + '</strong>' : '즉시 개선 우선영역이 없습니다. 현장 근거와 직원 피드백으로 점수를 확인하세요.');
  }
  function renderAuto() {
    var s = stats();
    $('managementAuto').innerHTML = [
      ['CAPA', s.closedCapa + ' / ' + s.capa + '건', '종결 / 전체', 'capa-management.html'],
      ['기한초과 CAPA', s.overdue + '건', '경영진 우선 확인', 'quality-dashboard.html'],
      ['모의회수', s.mock + ' / ' + s.drills + '건', '완료 / 전체', 'traceability.html'],
      ['제품회수·추적점검', s.recalls + ' / ' + s.trace + '건', 'FR-016 / FR-040', 'quality-dashboard.html']
    ].map(function (x) { return '<div class="summary"><span>' + esc(x[0]) + '</span><strong>' + esc(x[1]) + '</strong><small>' + esc(x[2]) + '</small><a href="' + esc(x[3]) + '">상세 확인 →</a></div>'; }).join('');
  }
  function renderMetrics() {
    var records = allRecords(), reviews = records.filter(function(r){ return r.recordType === 'management'; }), cultures = records.filter(function(r){ return r.recordType === 'culture'; });
    var lastCulture = cultures.slice().sort(function(a,b){return String(b.cultureDate||b.updatedAt||'').localeCompare(String(a.cultureDate||a.updatedAt||''));})[0];
    var avg = lastCulture ? cultureAverage(lastCulture.cultureScores) : null, s = stats();
    $('mReviewDone').textContent = reviews.filter(isClosed).length; $('mReviewOpen').textContent = reviews.filter(function(r){return !r.locked;}).length;
    $('mCultureDone').textContent = cultures.filter(isClosed).length; $('mCultureScore').textContent = avg == null ? '—' : avg + ' / 5'; $('mOverdue').textContent = s.overdue;
  }
  function cultureAverage(scores) { var vals = dims.map(function(d){return n((scores||{})[d.key]);}).filter(Boolean); return vals.length ? Math.round((vals.reduce(function(a,b){return a+b;},0)/vals.length)*10)/10 : null; }
  function renderForm() {
    var s = current || blank('management');
    document.querySelectorAll('.tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-type') === s.recordType); });
    $('managementPanel').classList.toggle('active', s.recordType === 'management'); $('culturePanel').classList.toggle('active', s.recordType === 'culture');
    setVal('reviewPeriod',s.reviewPeriod); setVal('meetingDate',s.meetingDate); setVal('chairperson',s.chairperson); setVal('attendees',s.attendees); setVal('meetingType',s.meetingType); setVal('managementInput',s.managementInput); setVal('decisions',s.decisions); setVal('reviewAction',s.reviewAction); setVal('reviewOwner',s.reviewOwner); setVal('reviewDue',s.reviewDue); setVal('resources',s.resources); setVal('reviewVerification',s.reviewVerification);
    setVal('culturePeriod',s.culturePeriod); setVal('cultureDate',s.cultureDate); setVal('cultureTeam',s.cultureTeam); setVal('cultureMethod',s.cultureMethod); setVal('cultureReviewDate',s.cultureReviewDate); setVal('cultureStrength',s.cultureStrength); setVal('cultureGap',s.cultureGap); setVal('cultureOwner',s.cultureOwner); setVal('cultureDue',s.cultureDue); setVal('culturePlan',s.culturePlan); setVal('cultureVerification',s.cultureVerification); setVal('cultureEvidence',s.cultureEvidence);
    setVal('writer',s.writer); setVal('reviewer',s.reviewer); setVal('approver',s.approver); renderDimensions(s.cultureScores); renderAuto(); updateUi();
  }
  function formState() {
    var s = clone(current || blank('management')); s.title = s.recordType === 'culture' ? '식품안전문화 평가·실행계획' : '경영검토 회의·후속조치'; s.docDate = today();
    ['reviewPeriod','meetingDate','chairperson','attendees','meetingType','managementInput','decisions','reviewAction','reviewOwner','reviewDue','resources','reviewVerification','culturePeriod','cultureDate','cultureTeam','cultureMethod','cultureReviewDate','cultureStrength','cultureGap','cultureOwner','cultureDue','culturePlan','cultureVerification','cultureEvidence','writer','reviewer','approver'].forEach(function (id) { s[id] = $(id).value.trim(); });
    s.cultureScores = {}; document.querySelectorAll('[data-score]').forEach(function (el) { s.cultureScores[el.getAttribute('data-score')] = n(el.value); });
    s.cultureAverage = cultureAverage(s.cultureScores); s.approvals = {writer:s.writer,reviewer:s.reviewer,approver:s.approver};
    s.dueDate = s.recordType === 'culture' ? s.cultureDue : s.reviewDue; return s;
  }
  function validate(s, finalizing) {
    var required = s.recordType === 'culture' ? [['culturePeriod','평가기간'],['cultureDate','평가일'],['cultureTeam','평가팀'],['cultureReviewDate','재평가 예정일'],['cultureGap','취약점·개선 필요사항'],['cultureOwner','실행 책임자'],['cultureDue','완료기한'],['culturePlan','실행계획']] : [['reviewPeriod','검토기간'],['meetingDate','회의일'],['chairperson','주재자'],['attendees','참석자'],['managementInput','입력 요약'],['decisions','검토 결론·의사결정'],['reviewAction','후속조치·개선계획'],['reviewOwner','후속조치 책임자'],['reviewDue','완료기한']];
    required.push(['writer','작성자'],['reviewer','검토자'],['approver','승인자']); var missing = required.filter(function (x) { return !s[x[0]]; }).map(function(x){return x[1];});
    if (missing.length) { alert('다음 항목을 입력하세요.\n- ' + missing.join('\n- ')); return false; }
    if (finalizing) { var proof = s.recordType === 'culture' ? s.cultureVerification : s.reviewVerification; if (!proof) { alert('효과검증 방법·결과를 입력한 뒤 승인 요청하세요.'); return false; } if (!s.approvalRequested) { alert('효과검증 완료·승인 요청을 먼저 진행하세요.'); return false; } if (!s.signoff || !s.signoff.writer || !s.signoff.reviewer || !s.signoff.approver) { alert('작성·검토·승인 결재를 모두 확정한 뒤 작성완료·잠금을 진행하세요.'); return false; } }
    return true;
  }
  function save(s, msg) { current = s; DkjRecordStore.save(FORM_ID,current); current = DkjRecordStore.get(FORM_ID,current.id) || current; renderHistory(); renderMetrics(); updateUi(); syncApproval(); if (msg) alert(msg); }
  function updateUi() {
    var locked = !!(current && current.locked), hasId = !!(current && current.id), status = locked ? '승인 완료 · 잠금됨' : (hasId ? (current.approvalRequested ? '효과검증 완료 · 승인 진행 중' : '초안 저장됨') : '신규 초안');
    $('recordStatus').className = 'statusbar ' + (locked ? 'ok' : ''); $('recordStatus').innerHTML = '<strong>' + esc(status) + '</strong> · ' + (locked ? '잠긴 기록은 수정하지 않고 새 기록 또는 후속조치로 관리하세요.' : '필수 입력 후 초안을 저장하고 HACCP팀 결재를 진행하세요.');
    var editor = document.querySelectorAll('#managementPanel input,#managementPanel select,#managementPanel textarea,#culturePanel input,#culturePanel select,#culturePanel textarea,#writer,#reviewer,#approver,.tab'); editor.forEach(function(el){el.disabled=locked;}); $('saveDraft').disabled=locked; $('markReady').disabled=locked||!hasId; $('lockClose').disabled=locked||!hasId; $('approvalHint').textContent = locked ? '승인·잠금 이력입니다.' : (hasId ? '작성·검토·승인 결재를 순서대로 확정하세요.' : '초안을 저장하면 결재를 진행할 수 있습니다.');
  }
  function syncApproval() { if (!approvalUi) return; if (!current || !current.id) { $('approvalPanel').innerHTML='<div class="hint">기록을 초안 저장한 뒤 결재를 진행할 수 있습니다.</div>'; return; } approvalUi.render(); }
  function mountApproval() { if (!window.DkjApproval) return; approvalUi = DkjApproval.mount({ getState:function(){return current||blank('management');}, onChange:function(s){current=s; save(current,'결재가 저장됐습니다. 다음 결재 단계 또는 작성완료·잠금을 진행하세요.');} }); syncApproval(); }
  function renderHistory() {
    var f = $('historyFilter').value, records = allRecords().filter(function(r){return f==='all'||(f==='locked'&&r.locked)||r.recordType===f;});
    $('history').innerHTML = records.length ? records.map(function(r){ var t=r.recordType==='culture'?'식품안전문화':'경영검토', period=r.recordType==='culture'?r.culturePeriod:r.reviewPeriod, score=r.recordType==='culture'?(cultureAverage(r.cultureScores)||'—')+' / 5':(r.meetingDate||'-'); return '<div class="history-row"><span class="tag '+(r.recordType==='culture'?'culture':'')+'">'+esc(t)+'</span><span class="tag '+(r.locked?'':'draft')+'">'+(r.locked?'승인·잠금':'초안')+'</span><span><strong>'+esc(period||'기간 미입력')+'</strong><br><span style="color:#60746a">'+esc(score)+' · 작성 '+esc(r.writer||'-')+'</span></span><span><button class="btn load" type="button" data-id="'+esc(r.id)+'">열기</button></span></div>'; }).join('') : '<p class="desc">저장된 경영검토·식품안전문화 이력이 없습니다.</p>';
    $('history').querySelectorAll('.load').forEach(function(b){b.addEventListener('click',function(){current=DkjRecordStore.get(FORM_ID,b.getAttribute('data-id'))||blank('management');renderForm();syncApproval();window.scrollTo({top:0,behavior:'smooth'});});});
  }
  function changeType(type) { if (current && current.id && !current.locked && !confirm('현재 초안은 저장된 상태로 남습니다. 새 ' + (type==='culture'?'식품안전문화':'경영검토') + ' 기록을 작성하시겠습니까?')) return; current=blank(type);renderForm();syncApproval(); }
  function bind() {
    document.querySelectorAll('.tab').forEach(function(b){b.addEventListener('click',function(){changeType(b.getAttribute('data-type'));});});
    $('saveDraft').addEventListener('click',function(){var s=formState();if(!validate(s,false))return;s.status='draft';save(s,'초안이 저장됐습니다. 입력자료와 실행계획을 검토한 뒤 결재를 진행하세요.');});
    $('markReady').addEventListener('click',function(){var s=formState();if(!validate(s,false))return;var proof=s.recordType==='culture'?s.cultureVerification:s.reviewVerification;if(!proof){alert('효과검증 방법·결과를 입력하세요.');return;}s.approvalRequested=true;s.status='approval';save(s,'효과검증 완료·승인 요청 상태로 저장됐습니다. HACCP팀 결재를 진행하세요.');});
    $('lockClose').addEventListener('click',function(){var s=formState();if(!validate(s,true))return;if(!confirm('이 기록을 승인 후 작성완료·잠금 처리합니다. 이후 수정은 새 기록 또는 후속조치로 관리합니다. 계속하시겠습니까?'))return;s.locked=true;s.status='closed';save(s,'경영검토·식품안전문화 기록이 승인·잠금됐습니다.');});
    $('newRecord').addEventListener('click',function(){changeType(selectedType());}); $('historyFilter').addEventListener('change',renderHistory);
  }
  function init(){current=allRecords()[0]||blank('management');renderForm();bind();mountApproval();renderHistory();renderMetrics();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
