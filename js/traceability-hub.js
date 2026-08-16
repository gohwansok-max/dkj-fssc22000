(function () {
  'use strict';

  var FORM_INCOMING = 'FR-014';
  var FORM_LINK = 'TRACE-LINK';
  var FORM_DRILL = 'TRACE-DRILL';
  var traceStartedAt = null;
  var drillStartedAt = null;
  var currentResult = null;
  var SCENARIOS = {
    label_allergen: { name: '라벨·알레르겐 표시 오류', scenario: '라벨 또는 알레르겐 표시 오류 가능성에 따른 모의회수', action: '해당 완제품 LOT 출하보류, 사내 재고 격리, 거래처 판매중지·재고확인 요청, 라벨·포장 LOT 범위 확인', hint: '포장 LOT·라벨 교체 시점과 거래처 판매분까지 전방추적합니다.', decision: '거래처 회수 요청' },
    micro_chemical: { name: '원료 미생물·잔류농약 부적합', scenario: '원료 미생물 또는 잔류농약 부적합 가능성에 따른 모의회수', action: '원료 LOT 사용 생산분 확인, 출하보류, 사내 재고 격리, 거래처 재고조사 및 회수 범위 확인', hint: 'FR-014 원료 LOT에서 생산 LOT·출하처까지 전방추적합니다.', decision: '출하보류·격리' },
    ccp_metal: { name: '금속검출기·CCP 이상', scenario: '금속검출기 또는 CCP 모니터링 이상 시점 이후 생산분에 대한 모의회수', action: '이상 확인 시점 이후 생산 LOT를 범위로 설정, 출하보류, 재검사·격리, 거래처 출하분 확인', hint: 'CCP 이상 시점·직전 정상점검·직후 정상점검과 영향을 받은 생산 LOT를 확인합니다.', decision: '출하보류·격리' },
    cold_chain: { name: '냉장 온도이탈', scenario: '냉장보관 또는 운송 중 온도이탈 가능성에 따른 모의회수', action: '온도이탈 기간·보관 LOT·출하차량을 확인, 품질평가 전 출하보류, 재고격리 및 거래처 재고조사', hint: '사내 냉장재고·운송 중·거래처 재고를 각각 위치별로 분류합니다.', decision: '출하보류·격리' },
    customer_complaint: { name: '고객 클레임·이물 발견', scenario: '고객 클레임 또는 이물 발견 신고에 따른 모의회수', action: '고객 제공 제품 LOT 확인, 동일 LOT 재고 격리, 원료·공정·포장재 후방추적, 거래처 회수 가능 수량 확인', hint: '고객의 제품 LOT로 원료·공정·포장 LOT까지 후방추적합니다.', decision: '거래처 회수 요청' },
    supplier_evidence: { name: '공급업체 원산지·증빙 오류', scenario: '공급업체 원산지 또는 시험성적서·납품증빙 오류에 따른 모의회수', action: '해당 원료 LOT의 납품서·시험성적서 확인, 사용 생산분·출하처 파악, 출하보류 및 거래처 증빙 확인', hint: '원료 입고·공급업체 증빙·생산 LOT·출하처의 연결성을 검증합니다.', decision: '모의회수 개시' }
  };

  function $(id) { return document.getElementById(id); }
  function text(value) { return String(value == null ? '' : value); }
  function lower(value) { return text(value).trim().toLowerCase(); }
  function num(value) { var n = Number(value); return Number.isFinite(n) ? n : 0; }
  function fmt(value) { return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 3 }).format(num(value)); }
  function nowIso() { return new Date().toISOString(); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function esc(value) { return text(value).replace(/[&<>'"]/g, function (c) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[c]; }); }
  function elapsedMinutes(start, end) { return start ? Math.max(0, Math.round((Date.parse(end || nowIso()) - Date.parse(start)) / 60000)) : 0; }
  function dateTime(value) { if (!value) return '-'; try { return new Date(value).toLocaleString('ko-KR', { hour12:false }); } catch (e) { return value; } }
  function localDateTimeNow() { var d = new Date(); var z = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T' + z(d.getHours()) + ':' + z(d.getMinutes()); }

  function setStatus(id, message, bad) {
    var el = $(id);
    if (!el) return;
    el.textContent = message || '';
    el.className = 'tr-status' + (bad ? ' bad' : '');
  }

  function localRecords() {
    var out = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i) || '';
      var match = key.match(/^dkj:records:([^:]+):list:v1$/);
      if (!match) continue;
      try {
        var list = JSON.parse(localStorage.getItem(key) || '[]');
        (Array.isArray(list) ? list : []).forEach(function (record) {
          if (!record || typeof record !== 'object') return;
          record = Object.assign({}, record);
          record.formId = record.formId || match[1];
          out.push(record);
        });
      } catch (e) {}
    }
    return out;
  }

  function incomingRecords() {
    return localRecords().filter(function (record) {
      return record.formId === FORM_INCOMING && record.lot && record.itemName;
    }).sort(function (a, b) {
      return String(b.receiveDate || b.createdAt || '').localeCompare(String(a.receiveDate || a.createdAt || ''));
    });
  }

  function incomingById(id) {
    return incomingRecords().find(function (record) { return record.id === id; }) || null;
  }

  function links() {
    return (window.DkjRecordStore ? DkjRecordStore.list(FORM_LINK) : []).filter(function (record) {
      return record && record.rawLot && record.productionLot;
    }).sort(function (a, b) { return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); });
  }

  function drills() {
    return (window.DkjRecordStore ? DkjRecordStore.list(FORM_DRILL) : []).sort(function (a, b) {
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
  }

  function selectIncoming() {
    var select = $('linkSource');
    if (!select) return;
    var keep = select.value;
    var list = incomingRecords();
    select.innerHTML = '<option value="">원료 입고기록을 선택하세요</option>' + list.map(function (record) {
      return '<option value="' + esc(record.id) + '">' + esc((record.receiveDate || '-') + ' · ' + record.itemName + ' · LOT ' + record.lot + ' · ' + record.supplier) + '</option>';
    }).join('');
    if (keep && list.some(function (record) { return record.id === keep; })) select.value = keep;
  }

  function selectedIncoming() {
    var id = $('linkSource').value;
    return incomingRecords().find(function (record) { return record.id === id; }) || null;
  }

  function prefillLink() {
    var source = selectedIncoming();
    if (!source) { setStatus('linkStatus', '원료 입고기록을 먼저 선택하세요.', true); return; }
    if (!$('linkProductionDate').value) $('linkProductionDate').value = source.receiveDate || today();
    if (!$('linkProductName').value) $('linkProductName').value = source.linkedProduct || source.itemName || '';
    if (!$('linkUsedQty').value) $('linkUsedQty').value = source.qty || '';
    setStatus('linkStatus', '선택한 입고 LOT와 수량을 불러왔습니다. 생산 LOT·완제품명·출하 정보를 입력하세요.');
  }

  function makeAudit(action, detail) {
    var user = window.DkjAuth && DkjAuth.user ? DkjAuth.user() : null;
    return [{
      id: 'a_' + Date.now(), at: nowIso(), action: action,
      actor: (user && user.name) || '', actorEmpId: (user && user.empId) || '', actorUid: (user && user.uid) || '', detail: detail || ''
    }];
  }

  function saveLink() {
    var source = selectedIncoming();
    var productionLot = $('linkProductionLot').value.trim();
    var productName = $('linkProductName').value.trim();
    var productionDate = $('linkProductionDate').value;
    var writer = $('linkWriter').value.trim();
    if (!source) { setStatus('linkStatus', '원료 입고기록을 선택하세요.', true); return; }
    if (!productionLot || !productName || !productionDate || !writer) { setStatus('linkStatus', '생산 LOT, 완제품명, 생산일, 등록자를 모두 입력하세요.', true); return; }
    if (!window.DkjRecordStore) { setStatus('linkStatus', '기록 저장소를 불러오지 못했습니다.', true); return; }

    var record = {
      formId: FORM_LINK,
      title: '추적성 연결 · ' + source.lot + ' → ' + productionLot,
      sourceRecordId: source.id,
      sourceFormId: FORM_INCOMING,
      rawLot: source.lot,
      rawItemName: source.itemName,
      supplier: source.supplier || '',
      receiveDate: source.receiveDate || '',
      productionLot: productionLot,
      productName: productName,
      productionDate: productionDate,
      usedQty: num($('linkUsedQty').value),
      outputQty: num($('linkOutputQty').value),
      packLot: $('linkPackLot').value.trim(),
      destination: $('linkDestination').value.trim(),
      shipQty: num($('linkShipQty').value),
      inventoryQty: num($('linkInventoryQty').value),
      shipmentNo: $('linkShipmentNo').value.trim(),
      writer: writer,
      linkType: '일보 연계 생산·출하',
      locked: true,
      audit: makeAudit('trace_link_created', 'FR-014 ' + source.id + '에서 생성')
    };
    DkjRecordStore.save(FORM_LINK, record);
    setStatus('linkStatus', '생산·출하 연결기록을 저장했습니다. 추적 실행 시 즉시 반영됩니다.');
    $('linkProductionLot').value = '';
    $('linkProductName').value = '';
    $('linkUsedQty').value = '';
    $('linkOutputQty').value = '';
    $('linkPackLot').value = '';
    $('linkDestination').value = '';
    $('linkShipQty').value = '';
    $('linkInventoryQty').value = '';
    $('linkShipmentNo').value = '';
    selectIncoming();
    renderHistory();
  }

  function matches(record, query, date) {
    if (date) {
      var recordDate = record.receiveDate || record.productionDate || record.createdAt || '';
      if (String(recordDate).slice(0, 10) !== date) return false;
    }
    if (!query) return true;
    var haystack = [record.lot, record.rawLot, record.productionLot, record.itemName, record.rawItemName, record.productName, record.supplier, record.destination, record.shipmentNo].map(lower).join(' ');
    return haystack.indexOf(query) !== -1;
  }

  function runTrace() {
    var query = lower($('traceLot').value);
    var direction = $('traceDirection').value;
    var basisDate = $('traceDate').value;
    var incoming = incomingRecords();
    var linkRecords = links();
    if (!query) { setStatus('traceStatus', '추적할 LOT 또는 품목명을 입력하세요.', true); return; }
    traceStartedAt = nowIso();

    var matchedIncoming = incoming.filter(function (record) { return matches(record, query, basisDate); });
    var matchedLinks = linkRecords.filter(function (record) { return matches(record, query, basisDate); });
    var rawLotMap = {};
    matchedIncoming.forEach(function (record) { rawLotMap[record.lot] = true; });
    matchedLinks.forEach(function (record) { rawLotMap[record.rawLot] = true; });

    // 원료 LOT를 찾은 경우, 그 LOT를 사용한 생산·출하 연결기록을 추가한다.
    linkRecords.forEach(function (record) {
      if (rawLotMap[record.rawLot] || matchedIncoming.some(function (source) { return source.id === record.sourceRecordId; })) {
        if (matchedLinks.indexOf(record) === -1) matchedLinks.push(record);
      }
    });
    // 생산 LOT 또는 제품을 찾은 경우, 연결된 원료 입고기록을 복원한다.
    matchedLinks.forEach(function (record) {
      incoming.forEach(function (source) {
        if (source.id === record.sourceRecordId || source.lot === record.rawLot) {
          if (matchedIncoming.indexOf(source) === -1) matchedIncoming.push(source);
        }
      });
    });

    if (direction === 'forward') {
      // 조회 기준 원료 외의 보조 원료는 결과에서 제외한다.
      matchedIncoming = matchedIncoming.filter(function (record) { return matches(record, query, basisDate); });
    }
    if (direction === 'backward') {
      // 제품 기준으로 연결된 원료만 유지한다.
      var lots = {};
      matchedLinks.forEach(function (record) { lots[record.rawLot] = true; });
      matchedIncoming = matchedIncoming.filter(function (record) { return lots[record.lot]; });
    }

    var shipQty = matchedLinks.reduce(function (sum, record) { return sum + num(record.shipQty); }, 0);
    var inventoryQty = matchedLinks.reduce(function (sum, record) { return sum + num(record.inventoryQty); }, 0);
    var outputQty = matchedLinks.reduce(function (sum, record) { return sum + num(record.outputQty); }, 0);
    var inputQty = matchedIncoming.reduce(function (sum, record) { return sum + num(record.qty); }, 0);
    currentResult = {
      query: $('traceLot').value.trim(), direction: direction, basisDate: basisDate,
      startedAt: traceStartedAt, incoming: matchedIncoming, links: matchedLinks,
      inputQty: inputQty, outputQty: outputQty, shipQty: shipQty, inventoryQty: inventoryQty
    };
    renderTraceResult();
    setStatus('traceStatus', (matchedIncoming.length || matchedLinks.length) ? '일보 기반 추적을 완료했습니다. 아래 연결기록·수량대조를 확인하세요.' : '일치하는 기록이 없습니다. FR-014 입고 LOT 또는 생산·출하 연결기록을 확인하세요.', !(matchedIncoming.length || matchedLinks.length));
  }

  function recordLink(formId, id) {
    if (formId === FORM_INCOMING) return 'records/FR-014.html?id=' + encodeURIComponent(id || '');
    return '#traceHistory';
  }

  function renderTraceResult() {
    var result = currentResult;
    var summary = $('traceSummary');
    var target = $('traceResult');
    if (!result) return;
    $('traceClock').textContent = '추적 시작 ' + dateTime(result.startedAt) + ' · ' + elapsedMinutes(result.startedAt) + '분 경과';
    summary.innerHTML = metric('원료 입고', result.incoming.length + '건') + metric('생산 LOT', result.links.length + '건') + metric('출하대상', fmt(result.shipQty)) + metric('확보 재고', fmt(result.inventoryQty));
    if (!result.incoming.length && !result.links.length) { target.className = 'tr-empty'; target.textContent = '일치하는 일보 또는 연결기록이 없습니다.'; return; }
    target.className = '';
    var incomingRows = result.incoming.map(function (record) {
      return '<tr><td><a href="' + recordLink(FORM_INCOMING, record.id) + '">' + esc(record.itemName) + '</a></td><td>' + esc(record.lot) + '</td><td>' + esc(record.supplier || '-') + '</td><td>' + esc(record.receiveDate || '-') + '</td><td>' + fmt(record.qty) + ' ' + esc(record.unit || '') + '</td><td>' + esc(record.judge || '-') + '</td></tr>';
    }).join('') || '<tr><td colspan="6">연결된 원료 입고기록이 없습니다.</td></tr>';
    var linkRows = result.links.map(function (record) {
      var destination = [record.destination, record.shipmentNo].filter(Boolean).join(' · ') || '-';
      return '<tr><td>' + esc(record.productionLot) + '</td><td>' + esc(record.productName) + '</td><td><span class="tr-tag">원료 ' + esc(record.rawLot) + '</span>' + (record.packLot ? '<span class="tr-tag">포장 ' + esc(record.packLot) + '</span>' : '') + '</td><td>' + esc(destination) + '</td><td>' + fmt(record.shipQty) + '</td><td>' + fmt(record.inventoryQty) + '</td></tr>';
    }).join('') || '<tr><td colspan="6">연결된 생산·출하 기록이 없습니다. 위 ‘생산·출하 연결 등록’에서 추가하세요.</td></tr>';
    var balance = result.inputQty ? Math.round((result.outputQty / result.inputQty) * 1000) / 10 : 0;
    target.innerHTML = '<div class="tr-table-wrap"><table class="tr-table"><thead><tr><th colspan="6">원료 입고 일보</th></tr><tr><th>품목</th><th>LOT</th><th>공급업체</th><th>입고일</th><th>입고수량</th><th>판정</th></tr></thead><tbody>' + incomingRows + '</tbody></table></div>' +
      '<div class="tr-table-wrap"><table class="tr-table"><thead><tr><th colspan="6">생산·출하 연결기록</th></tr><tr><th>생산 LOT</th><th>완제품</th><th>연결 LOT</th><th>출하처·전표</th><th>출하수량</th><th>재고</th></tr></thead><tbody>' + linkRows + '</tbody></table></div>' +
      '<p class="tr-note">수량대조: 입고 ' + fmt(result.inputQty) + ' / 생산 ' + fmt(result.outputQty) + ' / 출하 ' + fmt(result.shipQty) + ' / 재고 ' + fmt(result.inventoryQty) + ' · 생산수율(참고) ' + fmt(balance) + '%</p>';
  }

  function metric(label, value) { return '<div class="tr-metric"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div>'; }

  function startDrill() {
    drillStartedAt = nowIso();
    if (!$('drillNotifyAt').value) $('drillNotifyAt').value = localDateTimeNow();
    $('drillClock').textContent = '훈련 시작 ' + dateTime(drillStartedAt);
    setStatus('drillStatus', '모의회수 시작 시각을 기록했습니다. 추적 결과와 조치 내용을 입력한 뒤 완료 저장하세요.');
  }

  function scenarioTemplate() {
    return SCENARIOS[$('drillScenarioTemplate').value] || null;
  }

  function applyScenarioTemplate() {
    var template = scenarioTemplate();
    if (!template) { $('scenarioHint').textContent = '선택하면 회수 사유·초기 조치가 자동 입력됩니다.'; return; }
    $('drillScenario').value = template.scenario;
    $('drillAction').value = template.action;
    $('drillDecision').value = template.decision;
    $('scenarioHint').textContent = template.hint;
    if (!$('drillAuthorityContact').value) $('drillAuthorityContact').value = '모의회수: 실제 통지 대신 연락체계 검증';
  }

  function updateLocationBalance() {
    var total = num($('qtyInternal').value) + num($('qtyTransit').value) + num($('qtyCustomer').value) + num($('qtySold').value) + num($('qtyDisposed').value);
    var target = currentResult ? currentResult.shipQty + currentResult.inventoryQty : 0;
    var gap = target - total;
    $('drillLocationTotal').value = total || '';
    $('drillQtyGap').value = target ? gap : '';
    if (target && Math.abs(gap) > 0.001 && !$('drillQtyGapReason').value) $('drillQtyGapReason').placeholder = '수량차이 ' + fmt(gap) + '의 사유를 입력하세요';
  }

  function applyTrace() {
    if (!currentResult) { setStatus('drillStatus', '먼저 LOT 추적을 실행하세요.', true); return; }
    $('drillTargetLot').value = currentResult.query;
    $('drillIsolatedQty').value = currentResult.inventoryQty || '';
    $('drillRecoveredQty').value = (currentResult.inventoryQty + currentResult.shipQty) || '';
    $('qtyInternal').value = currentResult.inventoryQty || '';
    $('qtyCustomer').value = currentResult.shipQty || '';
    updateLocationBalance();
    if (!drillStartedAt) startDrill();
    $('drillClock').textContent = '대상 적용 · ' + elapsedMinutes(drillStartedAt) + '분 경과';
    setStatus('drillStatus', '현재 추적 결과를 모의회수 대상·수량에 적용했습니다. 위치별 수량·통지·효과검증을 확인하세요.');
  }

  function saveDrill() {
    if (!currentResult) { setStatus('drillStatus', '일보 기반 LOT 추적을 먼저 실행하세요.', true); return; }
    var lot = $('drillTargetLot').value.trim();
    var writer = $('drillWriter').value.trim();
    var scenario = $('drillScenario').value.trim();
    if (!lot || !writer || !scenario) { setStatus('drillStatus', '대상 LOT, 작성자, 시나리오를 입력하세요.', true); return; }
    var requiredChecks = ['checkLot', 'checkContact', 'checkIsolation', 'checkDecision', 'checkBalance', 'checkImprovement', 'checkEffectiveness', 'checkEvidence'];
    if (!requiredChecks.every(function (id) { return $(id).checked; })) { setStatus('drillStatus', '8개 심사 대비 검증확인 항목을 모두 체크하세요.', true); return; }
    if (!window.DkjRecordStore) { setStatus('drillStatus', '기록 저장소를 불러오지 못했습니다.', true); return; }
    if (!drillStartedAt) drillStartedAt = currentResult.startedAt || nowIso();
    var finishedAt = nowIso();
    var minutes = elapsedMinutes(drillStartedAt, finishedAt);
    var targetQty = currentResult.shipQty + currentResult.inventoryQty;
    var recoveredQty = num($('drillRecoveredQty').value);
    var rate = targetQty ? Math.round((recoveredQty / targetQty) * 1000) / 10 : 0;
    var record = {
      formId: FORM_DRILL,
      title: $('drillType').value + ' · ' + lot,
      drillType: $('drillType').value,
      targetLot: lot,
      scenario: scenario,
      writer: writer,
      reviewer: $('drillReviewer').value.trim(),
      startedAt: drillStartedAt,
      finishedAt: finishedAt,
      elapsedMinutes: minutes,
      targetShipQty: currentResult.shipQty,
      targetInventoryQty: currentResult.inventoryQty,
      targetQty: targetQty,
      isolatedQty: num($('drillIsolatedQty').value),
      recoveredQty: recoveredQty,
      recoveryRate: rate,
      withinTwoHours: minutes <= 120,
      scenarioTemplate: $('drillScenarioTemplate').value || 'custom',
      scenarioTemplateName: scenarioTemplate() ? scenarioTemplate().name : '사용자 정의',
      locationQty: { internal: num($('qtyInternal').value), transit: num($('qtyTransit').value), customer: num($('qtyCustomer').value), sold: num($('qtySold').value), disposed: num($('qtyDisposed').value), total: num($('drillLocationTotal').value), gap: num($('drillQtyGap').value), gapReason: $('drillQtyGapReason').value.trim() },
      decision: { maker: $('drillDecisionMaker').value.trim(), type: $('drillDecision').value, notifiedAt: $('drillNotifyAt').value },
      contacts: { recallTeam: $('drillRecallTeam').value.trim(), customer: $('drillCustomerContact').value.trim(), authority: $('drillAuthorityContact').value.trim() },
      effectiveness: { result: $('drillVerification').value, correctiveOwner: $('drillCorrectiveOwner').value.trim(), correctiveDue: $('drillCorrectiveDue').value, evidence: $('drillEvidence').value.trim() },
      action: $('drillAction').value.trim(),
      improvement: $('drillGap').value.trim(),
      checks: { lotQtyDestinationInventory: true, contactSystem: true, isolation: true, decisionAuthority: true, massBalance: true, improvement: true, effectiveness: true, evidence: true },
      traceSnapshot: JSON.parse(JSON.stringify(currentResult)),
      locked: true,
      audit: makeAudit('mock_recall_completed', minutes + '분 · 회수/확보율 ' + rate + '% · 수량차이 ' + fmt(num($('drillQtyGap').value)))
    };
    DkjRecordStore.save(FORM_DRILL, record);
    $('drillClock').textContent = '완료 ' + dateTime(finishedAt) + ' · ' + minutes + '분';
    setStatus('drillStatus', '모의회수 검증을 완료 저장했습니다. ' + (minutes <= 120 ? '2시간 목표를 충족했습니다.' : '2시간 목표를 초과했습니다. 개선조치를 검토하세요.'), minutes > 120);
    renderHistory();
  }

  function renderHistory() {
    var target = $('traceHistory');
    var linkRows = links().slice(0, 8).map(function (record) {
      return '<div class="tr-history"><div><strong>연결 · ' + esc(record.rawLot) + ' → ' + esc(record.productionLot) + '</strong><small>' + esc(record.rawItemName) + ' · ' + esc(record.productName) + ' · 출하 ' + fmt(record.shipQty) + ' · 재고 ' + fmt(record.inventoryQty) + ' · ' + esc(record.createdAt ? dateTime(record.createdAt) : '-') + '</small></div><span class="tr-tag">일보 연계</span></div>';
    });
    var drillRows = drills().slice(0, 8).map(function (record) {
      var template = record.scenarioTemplateName ? ' · ' + record.scenarioTemplateName : '';
      var effect = record.effectiveness && record.effectiveness.result ? ' · 효과검증 ' + record.effectiveness.result : '';
      return '<div class="tr-history"><div><strong>' + esc(record.drillType || '모의회수') + ' · ' + esc(record.targetLot) + '</strong><small>' + esc(record.scenario) + template + ' · ' + fmt(record.elapsedMinutes) + '분 · 확보율 ' + fmt(record.recoveryRate) + '%' + effect + ' · ' + esc(record.createdAt ? dateTime(record.createdAt) : '-') + '</small></div><span class="tr-tag">' + (record.withinTwoHours ? '2시간 이내' : '개선 필요') + '</span></div>';
    });
    target.innerHTML = (drillRows.concat(linkRows)).join('') || '<div class="tr-empty">저장된 추적성 연결기록 또는 모의회수 결과가 없습니다.</div>';
  }

  function clearTrace() {
    currentResult = null;
    traceStartedAt = null;
    $('traceLot').value = '';
    $('traceDate').value = '';
    $('traceStatus').textContent = '';
    $('traceClock').textContent = '추적 대기';
    $('traceSummary').innerHTML = metric('원료 입고', '0건') + metric('생산 LOT', '0건') + metric('출하대상', '0') + metric('확보 재고', '0');
    $('traceResult').className = 'tr-empty';
    $('traceResult').textContent = 'LOT 또는 품목명을 입력하고 ‘일보에서 추적 실행’을 누르세요.';
  }

  function scrollTo(id, focusId) {
    var target = $(id);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (focusId) setTimeout(function () { var field = $(focusId); if (field) field.focus(); }, 420);
  }

  function setupQuickLot(params) {
    var sourceId = params.get('from014') || '';
    var lot = params.get('lot') || '';
    var source = incomingById(sourceId) || incomingRecords().find(function (record) { return lot && record.lot === lot; }) || null;
    var quick = $('quickLotCard');
    var quickMode = params.get('mode') === 'quick' || !!sourceId;
    if (lot) $('traceLot').value = lot;
    if (!quickMode || !quick) return;

    quick.classList.add('on');
    if (source) {
      $('linkSource').value = source.id;
      prefillLink();
      if (!$('linkWriter').value) $('linkWriter').value = source.inspector || source.createdBy || '';
      if (!$('drillWriter').value) $('drillWriter').value = source.inspector || source.createdBy || '';
      if (!$('drillScenario').value) $('drillScenario').value = 'FR-014 입고 LOT ' + source.lot + '에 대한 모의회수';
      $('quickLotTitle').textContent = (source.itemName || '원료') + ' · LOT ' + source.lot;
      $('quickLotMeta').textContent = [source.receiveDate, source.supplier, (source.qty || '-') + ' ' + (source.unit || '')].filter(Boolean).join(' · ');
    } else {
      $('quickLotTitle').textContent = lot ? 'LOT ' + lot : 'FR-014 LOT 정보를 찾지 못했습니다';
      $('quickLotMeta').textContent = '같은 기기에서 저장한 FR-014 기록인지 확인하세요.';
    }

    $('quickTrace').addEventListener('click', function () {
      runTrace();
      scrollTo('traceResult');
    });
    $('quickRecall').addEventListener('click', function () {
      runTrace();
      if (!currentResult) return;
      applyTrace();
      scrollTo('drillTargetLot', 'drillScenario');
    });
  }

  function init() {
    $('linkProductionDate').value = today();
    selectIncoming();
    renderHistory();
    $('runTrace').addEventListener('click', runTrace);
    $('clearTrace').addEventListener('click', clearTrace);
    $('prefillLink').addEventListener('click', prefillLink);
    $('saveLink').addEventListener('click', saveLink);
    $('startDrill').addEventListener('click', startDrill);
    $('applyTrace').addEventListener('click', applyTrace);
    $('saveDrill').addEventListener('click', saveDrill);
    $('linkSource').addEventListener('change', prefillLink);
    $('drillScenarioTemplate').addEventListener('change', applyScenarioTemplate);
    ['qtyInternal', 'qtyTransit', 'qtyCustomer', 'qtySold', 'qtyDisposed'].forEach(function (id) {
      $(id).addEventListener('input', updateLocationBalance);
      $(id).addEventListener('change', updateLocationBalance);
    });
    updateLocationBalance();
    setupQuickLot(new URLSearchParams(location.search));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
