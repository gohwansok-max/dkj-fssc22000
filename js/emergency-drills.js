(function () {
  'use strict';

  var FORM_ID = 'EMERGENCY-DRILL';
  var selectedId = '';
  var reportHtml = '';
  var current = null;
  var approvalUi = null;
  var CHECKS = [
    '인명안전과 현장 접근통제를 우선 확인했다.',
    '제품·원료·포장재·용수·설비에 대한 영향범위를 판단했다.',
    '비상연락망과 의사결정권자 통지 흐름을 확인했다.',
    '격리·출하보류·생산중단 등 통제조치와 기록을 확인했다.',
    '훈련 결과, 개선조치, 증빙 참조를 기록했다.'
  ];
  var SCENARIOS = [
    {
      id: 'flood', number: '01', category: '풍수재해', title: '집중호우·침수 위험 대응',
      short: '배수 불량과 외부수 유입 징후가 확인된 상황에서 인명안전, 제품보호, 위생복구 역량을 점검합니다.',
      goal: '집중호우로 인한 배수 지연과 외부수 유입 가능성에 대비하여 작업자 안전, 원료·제품 보호, 시설 위생복구 및 운영 재개 판단 절차를 검증한다.',
      situation: '기상특보가 발효된 오후, 우천이 지속되면서 원료 하역장 배수구의 배수 속도가 저하되고 외부수 유입 가능성이 관찰되었다. 훈련은 실제 침수가 아닌 통제된 가상상황으로 진행하며, 저장구역과 제조구역의 제품·원료 보호 및 비상연락체계를 확인한다.',
      initial: '총괄자는 비상연락망을 가동하고 현장 접근을 통제한다. 생산·입고·출하 책임자는 각 구역의 인명안전, 바닥 상태, 원료·제품 보관상태를 확인한다. 품질팀은 외부수 접촉 가능 구역과 제품·포장재 영향범위를 기록하고, 필요 시 출하보류·격리 후보를 지정한다.',
      timeline: [['T+0분', '기상특보 및 배수지연 가상상황을 훈련 참여자에게 통보하고 총괄자를 지정한다.'], ['T+10분', '작업자 안전 확인, 위험구역 접근통제, 원료·제품 보관위치 점검을 실시한다.'], ['T+25분', '배수·전기·냉장설비 상태를 확인하고 필요 시 가동중지 또는 이동 판단을 기록한다.'], ['T+40분', '영향범위, 격리·출하보류 대상, 세척·소독 및 환경점검 계획을 결정한다.'], ['T+60분', '복구 전 확인항목, 기록·사진·연락 증빙, 개선과제를 정리하고 훈련을 종료한다.']],
      roles: '총괄(비상대응 지휘), 생산(현장안전·설비 상태), 품질(영향평가·격리·복구검증), 물류(입출고 통제), 시설(배수·전기·설비 점검)',
      improvements: '배수로·우수 유입 차단 상태, 원료·제품 적치 높이, 비상전원·연락망 최신성, 복구 후 세척·소독 및 환경확인 기준을 점검한다.',
      evidence: '기상특보 화면, 현장점검표, 사진, 연락기록, 제품·원료 위치 목록, 격리·출하보류 기록, 세척·소독 및 환경점검 결과'
    },
    {
      id: 'fire_power', number: '02', category: '비상사태', title: '화재경보·정전 및 냉장설비 중단 대응',
      short: '경보 발생과 전력중단으로 냉장·제조설비가 정지한 상황을 가정해 대피, 설비보호, 제품온도 관리 역량을 점검합니다.',
      goal: '화재경보 또는 정전으로 설비가 중단되는 상황에서 대피·인원확인, 비상연락, 냉장·냉동 제품 보호, 운영 재개 승인 절차를 검증한다.',
      situation: '제조구역 인근에서 화재경보가 발생하고 동시에 일부 전력공급이 중단되어 냉장설비와 제조설비의 상태 확인이 필요한 가상상황이다. 실제 화재 진압이나 전기 작업은 수행하지 않으며, 지정된 안전절차에 따라 대피·통제·보고·제품 상태 확인 역량만 점검한다.',
      initial: '총괄자는 비상방송 또는 연락체계로 훈련 개시를 알리고, 각 부서는 지정 대피·집결지 인원확인을 수행한다. 시설 담당자는 승인된 안전절차에 따라 설비상태와 비상전원 가능 여부를 확인한다. 품질팀은 시간대별 냉장·냉동 제품의 관리상태와 출하보류 필요성을 기록한다.',
      timeline: [['T+0분', '경보·전력중단 가상상황을 통보하고 대피·집결 및 인원확인을 개시한다.'], ['T+10분', '총괄자는 비상연락망과 부서별 현황을 취합하고 현장 접근통제를 확인한다.'], ['T+20분', '시설·품질 담당자는 설비상태, 온도기록, 제품보호·출하보류 판단 기준을 확인한다.'], ['T+35분', '대체보관·출하중단·비상전원 사용 여부를 모의 의사결정하고 기록한다.'], ['T+55분', '안전 확인 후 운영 재개 전 승인조건과 미비점 개선계획을 정리한다.']],
      roles: '총괄(대피·비상연락 지휘), 안전관리(집결·인원확인), 시설(설비·전원 상태), 품질(온도·제품 영향평가), 물류(출하통제)',
      improvements: '대피로·집결지 표지, 비상연락망, 냉장온도 기록 접근성, 비상전원 점검, 제품 품질평가 및 재개승인 권한을 확인한다.',
      evidence: '대피·집결 인원확인표, 경보 통보 기록, 설비·온도 점검표, 비상연락 기록, 출하보류 기록, 훈련사진'
    },
    {
      id: 'environment_safety', number: '03', category: '환경·안전', title: '세척·소독제 누출 의심 및 환경안전 대응',
      short: '세척·소독 구역의 이상 냄새·누출 징후를 가정하여 작업자 보호, 구역 통제, 제품 영향평가를 점검합니다.',
      goal: '환경·안전 이상 징후가 발생한 경우 인명안전 우선, 구역 통제, 관련 제품·원료 보호, 승인된 세척·복구 절차와 의사소통 체계를 검증한다.',
      situation: '세척·소독 작업 후 보관구역 인근에서 평소와 다른 냄새 또는 누출 의심 징후가 보고된 가상상황이다. 훈련은 실제 화학물질 취급이나 노출을 유발하지 않으며, SDS·비상연락·구역통제 절차가 신속히 작동하는지 확인한다.',
      initial: '발견자는 즉시 작업을 중지하고 주변 작업자에게 알린다. 총괄자는 현장 접근을 통제하고, 안전 담당자는 승인된 비상절차와 SDS를 확인한다. 품질팀은 인접 제품·원료·포장재의 영향 가능성을 평가하여 보류·격리 필요성을 기록한다.',
      timeline: [['T+0분', '이상 징후 발견 보고와 작업중지·현장 접근통제를 실시한다.'], ['T+10분', '총괄·안전·품질 담당자를 소집하고 비상연락 및 정보확인을 수행한다.'], ['T+20분', '제품·원료·포장재 영향범위와 설비·배수·환기 상태 확인 계획을 수립한다.'], ['T+35분', '안전한 복구·세척·환경확인 조건과 출하보류 필요성을 모의 판단한다.'], ['T+50분', '훈련 결과와 미비점, 교육·표지·보관관리 개선조치를 정리한다.']],
      roles: '총괄(상황판단), 안전관리(SDS·현장통제), 생산(작업중지·설비확인), 품질(제품영향평가), 시설(환기·배수·복구 지원)',
      improvements: 'SDS 접근성, 보관장소 표지·분리, 비상연락망, 보호구 위치, 구역통제 표시, 환경확인 및 제품평가 기준을 확인한다.',
      evidence: '훈련 통보 기록, SDS 확인기록, 접근통제 사진, 제품·원료 영향평가표, 복구·세척 확인기록, 교육기록'
    },
    {
      id: 'infectious', number: '04', category: '감염병', title: '감염병 의심 집단발생 및 운영연속성 대응',
      short: '작업자 다수의 유사 증상 보고를 가정해 개인보호, 작업배치, 위생강화, 생산연속성 판단을 점검합니다.',
      goal: '감염병 의심 상황에서 근무자 보호, 작업구역 위생관리, 대체인력·생산연속성, 내부 의사소통 및 기록관리 절차를 검증한다.',
      situation: '같은 조 근무자 중 여러 명이 유사 증상 또는 감염 의심 사실을 보고한 가상상황이다. 개인의 건강정보를 수집·공개하지 않고, 회사의 보건·인사 절차와 관계기관 지침에 따라 근무배치·위생강화·생산연속성 판단 체계가 작동하는지를 훈련한다.',
      initial: '총괄자는 보건·인사 담당과 품질팀에 상황을 공유하고, 해당 작업자에 대한 근무배치 기준을 확인한다. 현장 책임자는 접촉 가능 구역의 청소·소독 강화와 개인위생·보호구 준수 여부를 점검한다. 생산책임자는 대체인력 및 운영중단 기준을 모의 검토한다.',
      timeline: [['T+0분', '감염 의심 보고를 접수하고 보건·인사·품질·생산 총괄에게 훈련상황을 통보한다.'], ['T+15분', '개인정보 보호 원칙 아래 근무배치·접촉구역·위생강화 필요성을 판단한다.'], ['T+30분', '청소·소독 강화, 손위생·보호구 점검, 대체인력 및 교육계획을 수립한다.'], ['T+45분', '생산연속성·출하계획·고객 커뮤니케이션 필요성을 모의 검토한다.'], ['T+60분', '운영 재개·강화조치 종료 기준과 추적 가능한 증빙을 정리한다.']],
      roles: '총괄(의사결정), 보건·인사(근무배치·개인정보 보호), 생산(대체인력·공정통제), 품질(위생강화·기록), 교육담당(재교육)',
      improvements: '대체인력 명단, 개인위생 교육자료, 청소·소독 강화기록, 비상연락망, 개인정보 취급 원칙, 운영연속성 기준을 확인한다.',
      evidence: '훈련통보 기록, 위생·소독 강화점검표, 교육참석 기록, 근무배치 모의계획, 대체인력 검토기록, 회의록'
    },
    {
      id: 'food_defense', number: '05', category: '식품방어', title: '식품방어 침해 의심 및 출입통제 대응',
      short: '제한구역 출입기록 불일치 또는 제품보호 구역의 이상 징후를 가정해 제품보호·보고·조사 역량을 점검합니다.',
      goal: '식품방어 침해 의심 상황에서 사람·제품·공정의 보호, 출입통제, 증거 보전, 내부 보고, 영향평가와 정상화 판단 절차를 검증한다.',
      situation: '제한구역의 출입기록과 현장확인 내용이 일치하지 않거나, 제품보호 구역에서 확인이 필요한 이상 징후가 보고된 가상상황이다. 훈련은 의도적 위해 행위를 재현하지 않으며, 접근통제·제품보호·보고·조사·회복 절차가 작동하는지에만 초점을 둔다.',
      initial: '발견자는 즉시 현장 책임자에게 보고하고, 총괄자는 해당 구역의 출입을 통제한다. 품질팀은 해당 시간대의 제품·원료·포장재·공정기록을 보존하고 영향평가를 시작한다. 보안·시설 담당자는 출입기록과 CCTV 등 승인된 증빙의 보존 여부를 확인한다.',
      timeline: [['T+0분', '이상 징후를 보고하고 해당 구역·제품의 접근과 이동을 통제한다.'], ['T+10분', '식품방어 대응팀과 경영책임자에게 상황을 통보하고 역할을 배정한다.'], ['T+20분', '출입기록·공정기록·제품 LOT·보관 위치를 확인하고 증빙 보존을 시작한다.'], ['T+35분', '영향 제품의 격리·출하보류, 필요시 외부 통지 검토, 현장 재개 조건을 모의 판단한다.'], ['T+55분', '식품방어 취약점, 출입통제·방문객 관리·교육 개선과제를 정리한다.']],
      roles: '총괄(대응지휘), 보안·시설(출입통제·증빙보전), 품질(제품영향평가·격리), 생산(공정통제), 경영책임자(중요 의사결정)',
      improvements: '출입권한 부여·회수, 방문객·협력업체 관리, 제한구역 표지, CCTV·출입기록 보존, 제품보호 구역 점검, 보고·의사결정 체계를 확인한다.',
      evidence: '출입기록 확인표, 제한구역 통제 사진, LOT·재고 영향평가표, 격리·출하보류 기록, 비상연락기록, 식품방어 점검표'
    },
    {
      id: 'water_supply', number: '06', category: '비상사태', title: '용수 이상·공급중단 및 위생관리 대응',
      short: '용수 품질 이상 또는 공급중단 가능성을 가정하여 사용중지, 제품 영향평가, 대체용수·재개승인 절차를 점검합니다.',
      goal: '용수 이상 또는 공급중단 상황에서 용수 사용통제, 영향을 받은 제품·공정 판단, 대체용수·세척·검증 및 운영 재개 승인 절차를 검증한다.',
      situation: '용수 공급압 저하 또는 품질 이상 의심 통보가 접수된 가상상황이다. 훈련은 실제 용수 차단이나 분석을 수행하지 않고, 사용중지·영향범위·대체운영·재개승인 관련 부서의 판단과 기록체계를 확인한다.',
      initial: '총괄자는 관련 공정의 용수 사용 상태를 확인하고 필요 시 사용중지·생산보류 판단을 내린다. 품질팀은 해당 시간대의 제품·세척·위생 활동에 대한 영향평가를 기록한다. 시설 담당자는 공급상태와 대체운영 가능성을 확인한다.',
      timeline: [['T+0분', '용수 이상 또는 공급중단 가능성 통보와 관련 공정 상태 확인을 실시한다.'], ['T+10분', '사용중지·생산보류·출하보류 필요성과 비상연락을 모의 판단한다.'], ['T+25분', '영향 공정·제품·세척활동 범위와 대체운영 가능성을 확인한다.'], ['T+40분', '용수 확인·세척·환경점검·재개승인 조건을 정리한다.'], ['T+55분', '기록·검사·설비점검·연락망의 개선과제를 확정한다.']],
      roles: '총괄(상황판단), 시설(공급상태·대체운영), 품질(영향평가·검증), 생산(공정통제), 물류(출하보류)',
      improvements: '용수 모니터링, 비상용수·대체운영 계획, 사용중지 권한, 재개승인 기준, 세척·환경점검 기록, 공급업체 연락망을 확인한다.',
      evidence: '용수 점검기록, 공정·제품 영향평가표, 비상연락기록, 설비점검표, 세척·환경점검 결과, 재개승인 기록'
    }
  ];

  function $(id) { return document.getElementById(id); }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>'"]/g, function (c) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[c]; }); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function nowTime() { var d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function value(id) { return ($(id).value || '').trim(); }
  function selected() { return SCENARIOS.find(function (item) { return item.id === selectedId; }) || null; }
  function setStatus(id, message, bad) { var el = $(id); if (!el) return; el.textContent = message || ''; el.className = 'status' + (bad ? ' bad' : ''); }
  function clone(value) { return JSON.parse(JSON.stringify(value || {})); }
  function scenarioById(id) { return SCENARIOS.filter(function (item) { return item.id === id; })[0] || null; }

  function renderCards() {
    $('scenarioGrid').innerHTML = SCENARIOS.map(function (item) { return '<button class="scenario-btn' + (item.id === selectedId ? ' active' : '') + '" type="button" data-scenario="' + esc(item.id) + '"><span class="scenario-num">' + esc(item.number) + '</span><b>' + esc(item.title) + '</b><span>' + esc(item.short) + '</span><small>' + esc(item.category) + ' · 결과보고서 자동작성</small></button>'; }).join('');
    document.querySelectorAll('[data-scenario]').forEach(function (button) { button.addEventListener('click', function () { choose(button.getAttribute('data-scenario')); }); });
  }

  function renderChecks() {
    $('checkGrid').innerHTML = CHECKS.map(function (check, index) { return '<label class="check"><input type="checkbox" id="check_' + index + '"> <span>' + esc(check) + '</span></label>'; }).join('');
  }

  function choose(id) {
    selectedId = id;
    var item = selected();
    if (!item) return;
    renderCards();
    $('scenarioDetail').innerHTML = '<b>' + esc(item.title) + '</b><br><strong>훈련 목표:</strong> ' + esc(item.goal) + '<br><strong>가상상황:</strong> ' + esc(item.situation) + '<br><strong>권장 초기조치:</strong> ' + esc(item.initial);
    if (!value('incidentInput')) $('incidentInput').value = item.situation;
    if (!value('actualAction')) $('actualAction').value = item.initial;
    if (!value('findingInput')) $('findingInput').value = item.improvements;
    if (!value('evidence')) $('evidence').value = item.evidence;
    setStatus('scenarioStatus', item.title + ' 시나리오가 준비되었습니다. 실제 훈련 정보를 입력하고 보고서 초안을 생성하세요.');
    $('scenarioDetail').scrollIntoView({ behavior:'smooth', block:'nearest' });
  }

  function reportData() {
    var item = selected();
    if (!item) return null;
    return {
      item:item, date:value('drillDate') || today(), time:value('drillTime') || nowTime(), site:value('site') || '훈련 대상 구역', leader:value('leader') || '훈련 총괄자', participants:value('participants') || item.roles,
      incident:value('incidentInput') || item.situation, action:value('actualAction') || item.initial, finding:value('findingInput') || item.improvements, evidence:value('evidence') || item.evidence,
      checks:CHECKS.map(function (check, index) { return { text:check, checked:$('check_' + index).checked }; })
    };
  }

  function buildReport(data) {
    var item = data.item;
    var statusLabel = data.statusLabel || '모의훈련 결과 초안';
    var number = 'ED-' + data.date.replace(/-/g, '') + '-' + item.number;
    var timeline = item.timeline.map(function (row) { return '<li><b>' + esc(row[0]) + '</b>' + esc(row[1]) + '</li>'; }).join('');
    var checks = data.checks.map(function (row) { return '<tr><td>' + esc(row.text) + '</td><td>' + (row.checked ? '확인' : '확인 필요') + '</td></tr>'; }).join('');
    return '<div class="report-head"><div class="report-kicker">FSSC 22000 · EMERGENCY PREPAREDNESS / FOOD DEFENSE EXERCISE</div><h2>비상·식품방어 모의훈련 결과보고서</h2><div class="report-meta"><span><b>보고서 번호:</b> ' + esc(number) + '</span><span><b>훈련 구분:</b> ' + esc(item.category) + '</span><span><b>훈련일시:</b> ' + esc(data.date + ' ' + data.time) + '</span><span><b>훈련 장소:</b> ' + esc(data.site) + '</span><span><b>훈련 총괄:</b> ' + esc(data.leader) + '</span><span><b>상태:</b> ' + esc(statusLabel) + '</span></div></div>' +
      '<section class="report-section"><h3>1. 훈련 목적 및 범위</h3><p>' + esc(item.goal) + '\n\n본 훈련은 실제 비상사태가 아닌 통제된 모의상황으로 실시하였다. 훈련 범위는 ' + esc(data.site) + '이며, 참여·연계 역할은 ' + esc(data.participants) + '이다.</p></section>' +
      '<section class="report-section"><h3>2. 부여 상황 및 초기 판단</h3><p>' + esc(data.incident) + '\n\n훈련 총괄은 인명안전과 현장 접근통제를 우선으로 하고, 제품·원료·포장재·설비의 영향 여부를 확인하는 방향으로 초기 대응을 지휘하였다.</p></section>' +
      '<section class="report-section"><h3>3. 훈련 전개 및 역할 수행</h3><ul class="timeline">' + timeline + '</ul></section>' +
      '<section class="report-section"><h3>4. 통제·보호 조치 및 의사소통</h3><p>' + esc(data.action) + '\n\n훈련 중 부서별 상황 공유, 의사결정권자 보고, 관련 기록 보존과 후속 확인 절차를 점검하였다. 실제 비상사태 발생 시에는 승인된 비상대응 절차, 관계기관 지침 및 법정 통지 의무를 우선 적용한다.</p></section>' +
      '<section class="report-section"><h3>5. 확인 결과 및 개선계획</h3><p>' + esc(data.finding) + '\n\n개선조치는 담당자·완료기한을 정하여 CAPA 관리 화면에 등록하고, 완료 후 효과성을 재확인한다.</p></section>' +
      '<section class="report-section"><h3>6. 훈련 확인 체크</h3><table class="report-table"><thead><tr><th>확인항목</th><th>결과</th></tr></thead><tbody>' + checks + '</tbody></table></section>' +
      '<section class="report-section"><h3>7. 증빙 및 결론</h3><p><b>증빙 참조:</b> ' + esc(data.evidence) + '\n\n본 보고서는 모의훈련의 시나리오와 실제 확인 내용을 바탕으로 자동 작성된 초안이다. 훈련 총괄과 관련 부서는 사실관계·증빙·개선조치를 검토한 뒤 저장·잠금하며, 미비점은 시정조치 절차에 따라 추적한다.</p></section>';
  }

  function approvalStatus(record) {
    var sign = (record && record.signoff) || {};
    if (record && record.locked) return '최종 승인·잠금';
    if (sign.approver) return '승인 완료';
    if (sign.reviewer) return '검토 완료 · 승인 대기';
    if (sign.writer) return '작성 확정 · 검토 대기';
    if (record && record.approvalRequested) return '결재 요청 · 작성 대기';
    return '모의훈련 결과 초안';
  }

  function approvalTable(record) {
    var names = (record && record.approvals) || {};
    var signs = (record && record.signoff) || {};
    var stages = [{key:'writer',label:'작성'},{key:'reviewer',label:'검토'},{key:'approver',label:'승인'}];
    var rows = stages.map(function (stage) {
      var sign = signs[stage.key];
      var name = sign ? (sign.empId ? sign.name + ' (' + sign.empId + ')' : sign.name) : (names[stage.key] || '미지정');
      var at = sign && sign.at ? formatDate(sign.at) : '결재 대기';
      return '<tr><th>' + stage.label + '</th><td>' + esc(name) + '</td><td class="' + (sign ? 'signed' : 'pending') + '">' + (sign ? '서명 완료' : '결재 대기') + '</td><td>' + esc(at) + '</td></tr>';
    }).join('');
    return '<section class="report-section report-approval"><h3>8. 결재 및 승인</h3><table class="approval-table"><thead><tr><th>단계</th><th>결재권자</th><th>상태</th><th>일시</th></tr></thead><tbody>' + rows + '</tbody></table></section>';
  }

  function buildApprovedReport(record) {
    var item = scenarioById(record.scenarioId);
    if (!item) return record.reportHtml || '';
    var data = { item:item, date:record.drillDate, time:record.drillTime, site:record.site, leader:record.leader, participants:record.participants, incident:record.incident, action:record.action, finding:record.finding, evidence:record.evidence, checks:record.checks || [], statusLabel:approvalStatus(record) };
    return buildReport(data) + approvalTable(record);
  }

  function currentApprovals() { return { writer:value('writer') || '이다은', reviewer:value('reviewer') || '권화선', approver:value('approver') || '최민재' }; }
  function setApprovals(approvals) { approvals = approvals || {}; ['writer','reviewer','approver'].forEach(function (key) { if ($(key)) $(key).value = approvals[key] || (key === 'writer' ? '이다은' : key === 'reviewer' ? '권화선' : '최민재'); }); }
  function allSigned(record) { var sign = (record && record.signoff) || {}; return !!(sign.writer && sign.reviewer && sign.approver); }
  function approvalNamesValid() { var approvals = currentApprovals(); return !!(approvals.writer && approvals.reviewer && approvals.approver); }
  function lockedState() { return !!(current && (current.approvalRequested || current.locked)); }

  function updateApprovalUi() {
    var locked = lockedState();
    ['drillDate','drillTime','site','leader','participants','incidentInput','actualAction','findingInput','evidence','writer','reviewer','approver'].forEach(function (id) { if ($(id)) $(id).disabled = locked; });
    for (var i = 0; i < CHECKS.length; i++) if ($('check_' + i)) $('check_' + i).disabled = locked;
    $('generateReport').disabled = locked; $('saveReport').disabled = locked; $('requestApproval').disabled = !current || !!(current && current.approvalRequested) || !!(current && current.locked); $('lockReport').disabled = !current || !allSigned(current) || !!(current && current.locked);
    var notice = $('approvalNotice');
    if (!current) notice.textContent = '결재 요청 전 결과보고서 초안을 저장하세요.';
    else if (current.locked) notice.textContent = '최종 승인·잠금된 기록입니다. 본문 수정과 삭제가 차단됩니다.';
    else if (current.approvalRequested) notice.textContent = '결재 진행 중입니다. 작성·검토·승인 단계가 모두 확정되면 최종 잠금할 수 있습니다.';
    else notice.textContent = '결재권자 확인 후 “결재 요청”을 누르세요. 요청 후 보고서 본문은 수정할 수 없습니다.';
    if (!current) { $('approvalPanel').innerHTML = '<div class="hint">결과보고서 초안을 저장하면 작성·검토·승인 결재를 진행할 수 있습니다.</div>'; return; }
    if (!current.approvalRequested) { $('approvalPanel').innerHTML = '<div class="hint">초안이 저장됐습니다. 결재권자를 확인한 뒤 “결재 요청”을 누르면 전자서명 단계를 시작할 수 있습니다.</div>'; return; }
    if (approvalUi) approvalUi.render();
  }

  function mountApproval() {
    if (!window.DkjApproval) return;
    approvalUi = window.DkjApproval.mount({ getState:function () { return current || { approvals:currentApprovals(), signoff:{}, audit:[] }; }, onChange:function (state) { current = state; current.reportHtml = buildApprovedReport(current); DkjRecordStore.save(FORM_ID, current); $('reportPreview').innerHTML = current.reportHtml; renderHistory(); updateApprovalUi(); setStatus('formStatus', '결재 서명이 저장되었습니다. 다음 결재 단계 또는 최종 잠금을 진행하세요.'); } });
  }

  function generate() {
    if (current && current.approvalRequested) { reportHtml = buildApprovedReport(current); $('reportPreview').innerHTML = reportHtml; return; }
    var data = reportData();
    if (!data) { setStatus('formStatus', '먼저 훈련 시나리오를 선택하세요.', true); return; }
    reportHtml = buildReport(data) + approvalTable({ approvals:currentApprovals(), signoff:{}, approvalRequested:false });
    $('reportPreview').innerHTML = reportHtml;
    setStatus('formStatus', '결과보고서 초안을 작성했습니다. 실제 훈련 사실과 증빙을 검토한 뒤 초안으로 저장하세요.');
  }

  function validForSave(data) {
    if (!data || !selectedId) return '훈련 시나리오를 선택하세요.';
    if (!value('drillDate') || !value('drillTime') || !value('site') || !value('leader')) return '훈련일, 시작시각, 장소/범위, 훈련 총괄을 입력하세요.';
    if (!data.checks.every(function (row) { return row.checked; })) return '훈련 종료 후 5개 확인항목을 모두 점검·체크하세요.';
    return '';
  }

  function formRecord() {
    var data = reportData();
    var error = validForSave(data);
    if (error) { setStatus('formStatus', error, true); return null; }
    var prior = current ? clone(current) : {};
    var item = data.item;
    prior.formId = FORM_ID; prior.title = '모의훈련 · ' + item.title + ' · ' + data.date; prior.scenarioId = item.id; prior.scenarioTitle = item.title; prior.category = item.category;
    prior.drillDate = data.date; prior.drillTime = data.time; prior.site = data.site; prior.leader = data.leader; prior.participants = data.participants; prior.incident = data.incident; prior.action = data.action; prior.finding = data.finding; prior.evidence = data.evidence;
    prior.checks = data.checks; prior.approvals = currentApprovals(); prior.signoff = prior.signoff || {}; prior.audit = prior.audit || []; prior.locked = !!prior.locked; prior.approvalRequested = !!prior.approvalRequested; prior.createdAt = prior.createdAt || new Date().toISOString(); prior.updatedAt = new Date().toISOString();
    prior.reportHtml = buildApprovedReport(prior);
    return prior;
  }

  function persist(message) {
    if (!window.DkjRecordStore) { setStatus('formStatus', '기록 저장소를 불러오지 못했습니다.', true); return null; }
    DkjRecordStore.save(FORM_ID, current);
    current = DkjRecordStore.get(FORM_ID, current.id) || current;
    reportHtml = current.reportHtml || buildApprovedReport(current); $('reportPreview').innerHTML = reportHtml;
    renderHistory(); updateApprovalUi(); if (message) setStatus('formStatus', message);
    return current;
  }

  function saveDraft() {
    if (current && current.approvalRequested) { setStatus('formStatus', '결재 요청 후에는 본문을 수정할 수 없습니다. 결재를 완료하거나 새 훈련을 시작하세요.', true); return null; }
    var record = formRecord(); if (!record) return null;
    current = record; return persist('결재 전 결과보고서 초안을 저장했습니다. 결재권자를 확인한 뒤 결재 요청하세요.');
  }

  function requestApproval() {
    if (!current) { if (!saveDraft()) return; }
    if (!approvalNamesValid()) { setStatus('formStatus', '작성자·검토자·승인자를 모두 입력하세요.', true); return; }
    current.approvals = currentApprovals(); current.approvalRequested = true; current.updatedAt = new Date().toISOString();
    if (window.DkjApproval && DkjApproval.append) DkjApproval.append(current, 'APPROVAL_REQUEST', current.approvals.writer, '모의훈련 결과보고서 결재 요청');
    current.reportHtml = buildApprovedReport(current); persist('결재를 요청했습니다. 작성 → 검토 → 승인 순으로 결재를 확정하세요.');
  }

  function lockReport() {
    if (!current || !current.approvalRequested) { setStatus('formStatus', '먼저 초안을 저장하고 결재를 요청하세요.', true); return; }
    if (!allSigned(current)) { setStatus('formStatus', '작성·검토·승인 결재를 모두 확정한 뒤 최종 잠금할 수 있습니다.', true); return; }
    if (!confirm('승인된 모의훈련 결과보고서를 최종 잠금합니다. 이후 본문 수정과 삭제가 차단됩니다. 계속하시겠습니까?')) return;
    current.locked = true; current.completedAt = new Date().toISOString(); current.updatedAt = current.completedAt; current.reportHtml = buildApprovedReport(current);
    persist('모의훈련 결과보고서가 최종 승인·잠금됐습니다. PDF 또는 인쇄본을 심사 증빙으로 활용하세요.');
  }

  function records() { return window.DkjRecordStore ? DkjRecordStore.list(FORM_ID).sort(function(a,b){ return String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')); }) : []; }
  function formatDate(value) { try { return new Date(value).toLocaleString('ko-KR',{hour12:false}); } catch(e) { return value || '-'; } }
  function renderHistory() {
    var list = records().slice(0, 10);
    $('reportHistory').innerHTML = list.length ? list.map(function (record) { return '<div class="history-row"><div><strong>' + esc(record.title) + '</strong><small>' + esc([record.site, record.leader, record.updatedAt ? formatDate(record.updatedAt) : ''].filter(Boolean).join(' · ')) + '</small></div><span class="badge">' + esc(approvalStatus(record)) + '</span><button class="btn secondary load-report" type="button" data-id="' + esc(record.id) + '">열기</button></div>'; }).join('') : '<div class="report-empty">저장된 모의훈련 결과가 없습니다.</div>';
    document.querySelectorAll('.load-report').forEach(function (button) { button.addEventListener('click', function () { loadReport(button.getAttribute('data-id')); }); });
  }

  function loadReport(id) {
    if (!window.DkjRecordStore) return;
    current = DkjRecordStore.get(FORM_ID, id); if (!current) return;
    selectedId = current.scenarioId || ''; renderCards();
    ['drillDate','drillTime','site','leader','participants','incidentInput','actualAction','findingInput','evidence'].forEach(function (key) { if ($(key)) $(key).value = current[key === 'incidentInput' ? 'incident' : key === 'actualAction' ? 'action' : key === 'findingInput' ? 'finding' : key] || ''; });
    setApprovals(current.approvals); renderChecks(); (current.checks || []).forEach(function (row, index) { if ($('check_' + index)) $('check_' + index).checked = !!row.checked; });
    var item = selected(); $('scenarioDetail').innerHTML = item ? '<b>' + esc(item.title) + '</b><br><strong>훈련 목표:</strong> ' + esc(item.goal) : '저장된 모의훈련 결과';
    reportHtml = buildApprovedReport(current); $('reportPreview').innerHTML = reportHtml; updateApprovalUi(); setStatus('formStatus', '저장된 모의훈련 결과보고서를 열었습니다.');
  }

  function reset() {
    current = null; selectedId = ''; ['site','leader','participants','incidentInput','actualAction','findingInput','evidence'].forEach(function (id) { $(id).value = ''; }); setApprovals({});
    $('drillDate').value = today(); $('drillTime').value = nowTime(); renderCards(); renderChecks(); $('scenarioDetail').textContent = '왼쪽의 시나리오를 선택하면 훈련 목표와 권장 전개가 표시됩니다.'; $('reportPreview').innerHTML = '<div class="report-empty">시나리오를 선택하고 <strong>결과보고서 자동 작성</strong>을 누르세요.</div>'; reportHtml = ''; setStatus('scenarioStatus', '시나리오를 선택하세요.'); setStatus('formStatus', '새 모의훈련을 준비했습니다.'); updateApprovalUi();
  }

  function ensureReport() { if (!reportHtml) generate(); return !!reportHtml; }
  function pdfFileName() { var data = reportData(); var title = data && data.item ? data.item.title : '모의훈련'; var date = data ? data.date.replace(/-/g, '') : today().replace(/-/g, ''); return ('DKJ_모의훈련_결과보고서_' + date + '_' + title).replace(/[\\/:*?\"<>|]/g, '_') + '.pdf'; }
  function printDocument(report) {
    return '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><title>모의훈련 결과보고서</title><style>@page{size:A4;margin:14mm}body{margin:0;color:#23464e;background:#fff;font-family:"Noto Sans KR","Malgun Gothic",sans-serif}.report{color:#23464e}.report-head{padding-bottom:16px;border-bottom:3px solid #0b5c72}.report-kicker{color:#0a7b6c;font-size:10px;font-weight:800;letter-spacing:.1em}.report h2{margin:5px 0;color:#163f4a;font-size:23px}.report-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:12px;color:#527078;font-size:11px}.report-section{margin-top:18px;break-inside:avoid;page-break-inside:avoid}.report-section h3{margin:0 0 8px;color:#155463;font-size:14px}.report-section p{margin:0;color:#385a62;font-size:12px;line-height:1.8;white-space:pre-line}.timeline{margin:0;padding:0;list-style:none}.timeline li{padding:7px 0;border-bottom:1px solid #e1edef;color:#385a62;font-size:12px;line-height:1.55}.timeline b{display:inline-block;min-width:66px;color:#0b7184}.report-table{width:100%;border-collapse:collapse;font-size:11px;break-inside:avoid;page-break-inside:avoid}.report-table th,.report-table td{padding:7px;border:1px solid #dce9eb;text-align:left;vertical-align:top}.report-table th{width:30%;color:#2f5760;background:#eef8f9}.approval-table{width:100%;border-collapse:collapse;font-size:11px;break-inside:avoid;page-break-inside:avoid}.approval-table th,.approval-table td{padding:7px;border:1px solid #dce9eb;text-align:left;vertical-align:top}.approval-table th{color:#2f5760;background:#eef8f9}.signed{color:#11714c;font-weight:800}.pending{color:#a95b08;font-weight:800}@media(max-width:600px){.report-meta{grid-template-columns:1fr}}</style></head><body><main class="report">' + report + '</main></body></html>';
  }
  function printReport() {
    if (!ensureReport()) return;
    var popup = window.open('', '_blank', 'noopener,noreferrer,width=900,height=900');
    if (!popup) { setStatus('formStatus', '인쇄 창을 열 수 없습니다. 브라우저 팝업 차단을 해제한 뒤 다시 시도하세요.', true); return; }
    popup.document.open(); popup.document.write(printDocument(reportHtml)); popup.document.close();
    setTimeout(function () { popup.focus(); popup.print(); }, 350);
    setStatus('formStatus', 'A4 인쇄 창을 열었습니다. 프린터를 선택하거나 인쇄 대화상자에서 PDF로 저장하세요.');
  }
  function downloadPdf() {
    if (!ensureReport()) return;
    if (typeof window.html2pdf !== 'function') { setStatus('formStatus', 'PDF 생성 모듈을 불러오지 못했습니다. 새로고침 후 다시 시도하세요.', true); return; }
    var button = $('downloadPdf'); button.disabled = true; button.textContent = 'PDF 생성 중…';
    var source = $('reportPreview');
    var options = { margin:[10,10,10,10], filename:pdfFileName(), image:{type:'jpeg',quality:0.98}, html2canvas:{scale:3,useCORS:true,backgroundColor:'#ffffff'}, jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}, pagebreak:{mode:['css','legacy']} };
    window.html2pdf().set(options).from(source).save().then(function () { setStatus('formStatus', 'A4 PDF 파일을 다운로드했습니다. 파일명: ' + pdfFileName()); }).catch(function () { setStatus('formStatus', 'PDF 생성에 실패했습니다. 인쇄 기능에서 “PDF로 저장”을 사용해 주세요.', true); }).finally(function () { button.disabled = false; button.textContent = 'PDF 다운로드'; });
  }

  function init() {
    $('drillDate').value = today(); $('drillTime').value = nowTime(); renderCards(); renderChecks(); mountApproval(); renderHistory(); updateApprovalUi();
    $('generateReport').addEventListener('click', generate); $('saveReport').addEventListener('click', saveDraft); $('requestApproval').addEventListener('click', requestApproval); $('lockReport').addEventListener('click', lockReport); $('downloadPdf').addEventListener('click', downloadPdf); $('newReport').addEventListener('click', reset); $('printReport').addEventListener('click', printReport);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
