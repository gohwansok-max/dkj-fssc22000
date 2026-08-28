(function () {
  'use strict';

  var FORM_INCOMING = 'FR-014';
  var FORM_NC_RAW = 'FR-015';
  var FORM_NC_PRODUCT = 'FR-039';
  var FORM_RECALL = 'FR-016';
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
  var AUDIT_SCENARIOS = {
    raw_forward: { name: '원료 LOT 전방추적', direction: 'forward', drillType: '전방추적 검증', template: 'micro_chemical', instruction: '원료 LOT를 입력해 사용 완제품, 출하처, 정상재고·격리 수량을 확인하세요.' },
    product_backward: { name: '완제품 LOT 후방추적', direction: 'backward', drillType: '후방추적 검증', template: 'customer_complaint', instruction: '완제품 LOT를 입력해 원료 LOT, 공급업체, 포장 LOT와 입고기록을 확인하세요.' },
    mass_balance: { name: '수량대조·회수범위', direction: 'both', drillType: '모의회수', template: 'micro_chemical', instruction: '대상 LOT를 입력하고 출하·재고·격리·폐기·거래처 수량을 대조하세요.' },
    ccp_window: { name: 'CCP 이상 영향범위', direction: 'both', drillType: '모의회수', template: 'ccp_metal', instruction: 'CCP 이상 시점의 생산 LOT 또는 대표 LOT를 입력해 영향을 받은 범위를 확인하세요.' },
    label_pack: { name: '라벨·포장 LOT 추적', direction: 'both', drillType: '모의회수', template: 'label_allergen', instruction: '완제품 또는 포장 LOT를 입력해 라벨 교체 시점, 출하처와 보유재고를 확인하세요.' },
    supplier_evidence: { name: '공급업체 증빙 연결', direction: 'forward', drillType: '전방추적 검증', template: 'supplier_evidence', instruction: '원료 LOT를 입력해 입고검사, 공급업체 증빙, 생산·출하 연결기록을 확인하세요.' }
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
    var keys = [];
    try {
      for (var k = 0; k < localStorage.length; k++) {
        var sk = localStorage.key(k);
        if (sk != null) keys.push(sk);
      }
    } catch (e) {}
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i] || '';
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

  function ncRawRecords() {
    return (window.DkjRecordStore ? DkjRecordStore.list(FORM_NC_RAW) : []).filter(function (record) {
      return record && record.lot;
    }).sort(function (a, b) { return String(b.processDate || b.createdAt || '').localeCompare(String(a.processDate || a.createdAt || '')); });
  }

  function ncProductRecords() {
    return (window.DkjRecordStore ? DkjRecordStore.list(FORM_NC_PRODUCT) : []).filter(function (record) {
      return record && record.lot;
    }).sort(function (a, b) { return String(b.docDate || b.createdAt || '').localeCompare(String(a.docDate || a.createdAt || '')); });
  }

  function recallReports() {
    return (window.DkjRecordStore ? DkjRecordStore.list(FORM_RECALL) : []).filter(function (record) {
      return record && record.lot;
    }).sort(function (a, b) { return String(b.startDate || b.docDate || b.createdAt || '').localeCompare(String(a.startDate || a.docDate || a.createdAt || '')); });
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
      var recordDate = record.receiveDate || record.processDate || record.productionDate || record.docDate || record.startDate || record.createdAt || '';
      if (String(recordDate).slice(0, 10) !== date) return false;
    }
    if (!query) return true;
    var haystack = [record.lot, record.rawLot, record.productionLot, record.packLot, record.itemName, record.rawItemName, record.productName, record.subject, record.supplier, record.vendor, record.destination, record.shipmentNo, record.ncType, record.recallClass].map(lower).join(' ');
    return haystack.indexOf(query) !== -1;
  }

  function runTrace() {
    var query = lower($('traceLot').value);
    var direction = $('traceDirection').value;
    var basisDate = $('traceDate').value;
    var incoming = incomingRecords();
    var ncRecords = ncRawRecords();
    var productNcRecords = ncProductRecords();
    var recallRecordList = recallReports();
    var linkRecords = links();
    if (!query) { setStatus('traceStatus', '추적할 LOT 또는 품목명을 입력하세요.', true); return; }
    traceStartedAt = nowIso();

    var matchedIncoming = incoming.filter(function (record) { return matches(record, query, basisDate); });
    var matchedNc = ncRecords.filter(function (record) { return matches(record, query, basisDate); });
    var matchedProductNc = productNcRecords.filter(function (record) { return matches(record, query, basisDate); });
    var matchedRecalls = recallRecordList.filter(function (record) { return matches(record, query, basisDate); });
    var matchedLinks = linkRecords.filter(function (record) { return matches(record, query, basisDate); });
    var rawLotMap = {};
    matchedIncoming.forEach(function (record) { rawLotMap[record.lot] = true; });
    matchedNc.forEach(function (record) { rawLotMap[record.lot] = true; });
    matchedLinks.forEach(function (record) { rawLotMap[record.rawLot] = true; });

    // 원료 LOT를 찾은 경우, 그 LOT를 사용한 생산·출하 연결기록을 추가한다.
    linkRecords.forEach(function (record) {
      if (rawLotMap[record.rawLot] || matchedIncoming.some(function (source) { return source.id === record.sourceRecordId; })) {
        if (matchedLinks.indexOf(record) === -1) matchedLinks.push(record);
      }
    });
    // 생산 LOT 또는 제품을 찾은 경우, 연결된 원료 입고기록과 FR-015 처리기록을 복원한다.
    matchedLinks.forEach(function (record) {
      incoming.forEach(function (source) {
        if (source.id === record.sourceRecordId || source.lot === record.rawLot) {
          if (matchedIncoming.indexOf(source) === -1) matchedIncoming.push(source);
        }
      });
    });
    var allRawLots = {};
    matchedIncoming.forEach(function (record) { allRawLots[record.lot] = true; });
    matchedLinks.forEach(function (record) { allRawLots[record.rawLot] = true; });
    ncRecords.forEach(function (record) {
      if (allRawLots[record.lot] && matchedNc.indexOf(record) === -1) matchedNc.push(record);
    });
    var allProductLots = {};
    matchedLinks.forEach(function (record) {
      if (record.productionLot) allProductLots[record.productionLot] = true;
      if (record.packLot) allProductLots[record.packLot] = true;
    });
    productNcRecords.forEach(function (record) {
      if (allProductLots[record.lot] && matchedProductNc.indexOf(record) === -1) matchedProductNc.push(record);
    });
    recallRecordList.forEach(function (record) {
      if (allProductLots[record.lot] && matchedRecalls.indexOf(record) === -1) matchedRecalls.push(record);
    });

    if (direction === 'forward') {
      // 조회 기준 원료 외의 보조 원료는 결과에서 제외한다.
      matchedIncoming = matchedIncoming.filter(function (record) { return matches(record, query, basisDate); });
      matchedNc = matchedNc.filter(function (record) { return matches(record, query, basisDate); });
    }
    if (direction === 'backward') {
      // 제품 기준으로 연결된 원료만 유지한다.
      var lots = {};
      matchedLinks.forEach(function (record) { lots[record.rawLot] = true; });
      matchedIncoming = matchedIncoming.filter(function (record) { return lots[record.lot]; });
      matchedNc = matchedNc.filter(function (record) { return lots[record.lot]; });
    }

    var shipQty = matchedLinks.reduce(function (sum, record) { return sum + num(record.shipQty); }, 0);
    var inventoryQty = matchedLinks.reduce(function (sum, record) { return sum + num(record.inventoryQty); }, 0);
    var outputQty = matchedLinks.reduce(function (sum, record) { return sum + num(record.outputQty); }, 0);
    var inputQty = matchedIncoming.reduce(function (sum, record) { return sum + num(record.qty); }, 0);
    var ncQuarantineQty = matchedNc.filter(function (record) { return (record.disposition || '격리') === '격리'; }).reduce(function (sum, record) { return sum + num(record.qty); }, 0);
    var ncClosedQty = matchedNc.filter(function (record) { return record.disposition === '반품' || record.disposition === '폐기'; }).reduce(function (sum, record) { return sum + num(record.qty); }, 0);
    var productNcQuarantineQty = matchedProductNc.filter(function (record) { return (record.disposition || '격리') === '격리'; }).reduce(function (sum, record) { return sum + num(record.qty); }, 0);
    var productNcClosedQty = matchedProductNc.filter(function (record) { return record.disposition === '반품' || record.disposition === '폐기'; }).reduce(function (sum, record) { return sum + num(record.qty); }, 0);
    var productRecallQty = shipQty + inventoryQty + productNcQuarantineQty;
    var targetRecallQty = productRecallQty || ncQuarantineQty;
    currentResult = {
      query: $('traceLot').value.trim(), direction: direction, basisDate: basisDate,
      startedAt: traceStartedAt, incoming: matchedIncoming, ncRecords: matchedNc, productNcRecords: matchedProductNc, recallReports: matchedRecalls, links: matchedLinks,
      inputQty: inputQty, outputQty: outputQty, shipQty: shipQty, inventoryQty: inventoryQty,
      ncQuarantineQty: ncQuarantineQty, ncClosedQty: ncClosedQty, productNcQuarantineQty: productNcQuarantineQty, productNcClosedQty: productNcClosedQty, productRecallQty: productRecallQty, recallUsesRawOnly: !productRecallQty, targetRecallQty: targetRecallQty
    };
    renderTraceResult();
    var found = matchedIncoming.length || matchedLinks.length || matchedNc.length || matchedProductNc.length || matchedRecalls.length;
    setStatus('traceStatus', found ? '일보 기반 추적을 완료했습니다. FR-015 원료격리, FR-039 제품격리, FR-016 회수보고도 함께 확인하세요.' : '일치하는 기록이 없습니다. FR-014 입고 LOT, FR-015·FR-039 부적합 처리 또는 생산·출하 연결기록을 확인하세요.', !found);
  }

  function recordLink(formId, id) {
    if (formId === FORM_INCOMING) return 'records/FR-014.html?id=' + encodeURIComponent(id || '');
    if (formId === FORM_NC_RAW) return 'records/FR-015.html?id=' + encodeURIComponent(id || '');
    if (formId === FORM_NC_PRODUCT) return 'records/FR-039.html?record=' + encodeURIComponent(id || '');
    if (formId === FORM_RECALL) return 'records/FR-016.html?record=' + encodeURIComponent(id || '');
    return '#traceHistory';
  }

  function renderTraceResult() {
    var result = currentResult;
    var summary = $('traceSummary');
    var target = $('traceResult');
    if (!result) return;
    $('traceClock').textContent = '추적 시작 ' + dateTime(result.startedAt) + ' · ' + elapsedMinutes(result.startedAt) + '분 경과';
    summary.innerHTML = metric('원료 입고', result.incoming.length + '건') + metric('생산 LOT', result.links.length + '건') + metric('출하대상', fmt(result.shipQty)) + metric('확보 재고', fmt(result.inventoryQty)) + metric('FR-015 격리', fmt(result.ncQuarantineQty)) + metric('FR-039 제품격리', fmt(result.productNcQuarantineQty)) + metric('FR-016 회수보고', result.recallReports.length + '건');
    if (!result.incoming.length && !result.links.length && !result.ncRecords.length && !result.productNcRecords.length && !result.recallReports.length) { target.className = 'tr-empty'; target.textContent = '일치하는 일보 또는 연결기록이 없습니다.'; return; }
    target.className = '';
    var incomingRows = result.incoming.map(function (record) {
      return '<tr><td><a href="' + recordLink(FORM_INCOMING, record.id) + '">' + esc(record.itemName) + '</a></td><td>' + esc(record.lot) + '</td><td>' + esc(record.supplier || '-') + '</td><td>' + esc(record.receiveDate || '-') + '</td><td>' + fmt(record.qty) + ' ' + esc(record.unit || '') + '</td><td>' + esc(record.judge || '-') + '</td></tr>';
    }).join('') || '<tr><td colspan="6">연결된 원료 입고기록이 없습니다.</td></tr>';
    var linkRows = result.links.map(function (record) {
      var destination = [record.destination, record.shipmentNo].filter(Boolean).join(' · ') || '-';
      return '<tr><td>' + esc(record.productionLot) + '</td><td>' + esc(record.productName) + '</td><td><span class="tr-tag">원료 ' + esc(record.rawLot) + '</span>' + (record.packLot ? '<span class="tr-tag">포장 ' + esc(record.packLot) + '</span>' : '') + '</td><td>' + esc(destination) + '</td><td>' + fmt(record.shipQty) + '</td><td>' + fmt(record.inventoryQty) + '</td></tr>';
    }).join('') || '<tr><td colspan="6">연결된 생산·출하 기록이 없습니다. 위 ‘생산·출하 연결 등록’에서 추가하세요.</td></tr>';
    var ncRows = result.ncRecords.map(function (record) {
      var status = record.disposition || '격리';
      var location = record.isolateLocation || '-';
      return '<tr><td><a href="' + recordLink(FORM_NC_RAW, record.id) + '">' + esc(record.itemName || '-') + '</a></td><td>' + esc(record.lot) + '</td><td>' + fmt(record.qty) + ' ' + esc(record.unit || '') + '</td><td>' + esc(location) + '</td><td><span class="tr-tag">' + esc(status) + '</span></td><td>' + esc(record.reasonText || '-') + '</td></tr>';
    }).join('') || '<tr><td colspan="6">연결된 FR-015 부적합 원부자재 처리기록이 없습니다.</td></tr>';
    var productNcRows = result.productNcRecords.map(function (record) {
      var status = record.disposition || '격리';
      return '<tr><td><a href="' + recordLink(FORM_NC_PRODUCT, record.id) + '">' + esc(record.subject || '-') + '</a></td><td>' + esc(record.lot) + '</td><td>' + fmt(record.qty) + '</td><td>' + esc(record.ncType || '-') + '</td><td><span class="tr-tag">' + esc(status) + '</span></td><td>' + esc(record.dispose || record.detail || '-') + '</td></tr>';
    }).join('') || '<tr><td colspan="6">연결된 FR-039 부적합품 관리기록이 없습니다.</td></tr>';
    var recallRows = result.recallReports.map(function (record) {
      return '<tr><td><a href="' + recordLink(FORM_RECALL, record.id) + '">' + esc(record.subject || '-') + '</a></td><td>' + esc(record.lot) + '</td><td>' + esc(record.recallClass || '-') + '</td><td>' + fmt(record.qty) + '</td><td>' + esc(record.startDate || '-') + '</td><td>' + esc(record.result || '작성 중') + '</td></tr>';
    }).join('') || '<tr><td colspan="6">연결된 FR-016 제품회수 보고서가 없습니다. 실제 회수 전환 시 아래 초안 버튼으로 생성하세요.</td></tr>';
    var balance = result.inputQty ? Math.round((result.outputQty / result.inputQty) * 1000) / 10 : 0;
    target.innerHTML = '<div class="tr-table-wrap"><table class="tr-table"><thead><tr><th colspan="6">원료 입고 일보</th></tr><tr><th>품목</th><th>LOT</th><th>공급업체</th><th>입고일</th><th>입고수량</th><th>판정</th></tr></thead><tbody>' + incomingRows + '</tbody></table></div>' +
      '<div class="tr-table-wrap"><table class="tr-table"><thead><tr><th colspan="6">생산·출하 연결기록</th></tr><tr><th>생산 LOT</th><th>완제품</th><th>연결 LOT</th><th>출하처·전표</th><th>출하수량</th><th>재고</th></tr></thead><tbody>' + linkRows + '</tbody></table></div>' +
      '<div class="tr-table-wrap"><table class="tr-table"><thead><tr><th colspan="6">FR-015 부적합 원부자재 처리기록</th></tr><tr><th>품목</th><th>LOT</th><th>처리수량</th><th>격리 위치</th><th>처리결과</th><th>사유</th></tr></thead><tbody>' + ncRows + '</tbody></table></div>' +
      '<div class="tr-table-wrap"><table class="tr-table"><thead><tr><th colspan="6">FR-039 부적합품 관리기록</th></tr><tr><th>품명</th><th>LOT</th><th>수량</th><th>부적합유형</th><th>처리</th><th>처리결과·확인</th></tr></thead><tbody>' + productNcRows + '</tbody></table></div>' +
      '<div class="tr-table-wrap"><table class="tr-table"><thead><tr><th colspan="6">FR-016 제품회수 보고서 및 기록</th></tr><tr><th>제품명</th><th>LOT</th><th>회수등급</th><th>회수대상량</th><th>개시일</th><th>결과·종료</th></tr></thead><tbody>' + recallRows + '</tbody></table></div>' +
      '<p class="tr-note">수량대조: 입고 ' + fmt(result.inputQty) + ' / 생산 ' + fmt(result.outputQty) + ' / 출하 ' + fmt(result.shipQty) + ' / 정상재고 ' + fmt(result.inventoryQty) + ' / FR-015 원료격리 ' + fmt(result.ncQuarantineQty) + ' / FR-039 제품격리 ' + fmt(result.productNcQuarantineQty) + ' / FR-015 반품·폐기 ' + fmt(result.ncClosedQty) + ' / FR-039 반품·폐기 ' + fmt(result.productNcClosedQty) + ' · 회수 대상 ' + fmt(result.targetRecallQty) + ' · 생산수율(참고) ' + fmt(balance) + '%</p>';
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

  function applyAuditScenario(key) {
    var scenario = AUDIT_SCENARIOS[key];
    if (!scenario) return;
    $('traceDirection').value = scenario.direction;
    $('drillType').value = scenario.drillType;
    $('drillScenarioTemplate').value = scenario.template;
    applyScenarioTemplate();
    var status = $('auditScenarioStatus');
    if (status) status.textContent = scenario.name + ' 준비 완료: ' + scenario.instruction;
    setStatus('traceStatus', scenario.name + '을 선택했습니다. 대상 LOT를 입력한 뒤 추적을 실행하세요.');
    scrollTo('traceLot', 'traceLot');
  }

  function updateLocationBalance() {
    var total = num($('qtyInternal').value) + num($('qtyNonconforming').value) + num($('qtyProductNonconforming').value) + num($('qtyTransit').value) + num($('qtyCustomer').value) + num($('qtySold').value) + num($('qtyDisposed').value);
    var target = currentResult ? currentResult.targetRecallQty : 0;
    var gap = target - total;
    $('drillLocationTotal').value = total || '';
    $('drillQtyGap').value = target ? gap : '';
    if (target && Math.abs(gap) > 0.001 && !$('drillQtyGapReason').value) $('drillQtyGapReason').placeholder = '수량차이 ' + fmt(gap) + '의 사유를 입력하세요';
  }

  function applyTrace() {
    if (!currentResult) { setStatus('drillStatus', '먼저 LOT 추적을 실행하세요.', true); return; }
    $('drillTargetLot').value = currentResult.query;
    var rawOnly = currentResult.recallUsesRawOnly;
    $('drillIsolatedQty').value = (currentResult.inventoryQty + currentResult.productNcQuarantineQty + (rawOnly ? currentResult.ncQuarantineQty : 0)) || '';
    $('drillRecoveredQty').value = currentResult.targetRecallQty || '';
    $('qtyInternal').value = currentResult.inventoryQty || '';
    $('qtyNonconforming').value = rawOnly ? (currentResult.ncQuarantineQty || '') : '';
    $('qtyProductNonconforming').value = currentResult.productNcQuarantineQty || '';
    $('qtyCustomer').value = currentResult.shipQty || '';
    updateLocationBalance();
    if (!drillStartedAt) startDrill();
    $('drillClock').textContent = '대상 적용 · ' + elapsedMinutes(drillStartedAt) + '분 경과';
    setStatus('drillStatus', '현재 추적 결과를 모의회수 대상·수량에 적용했습니다. 위치별 수량·통지·효과검증을 확인하세요.');
  }

  function productNameForRecall() {
    var linked = currentResult && currentResult.links && currentResult.links[0];
    var nonconforming = currentResult && currentResult.productNcRecords && currentResult.productNcRecords[0];
    var incoming = currentResult && currentResult.incoming && currentResult.incoming[0];
    return (linked && linked.productName) || (nonconforming && nonconforming.subject) || (incoming && incoming.itemName) || currentResult.query;
  }

  function createRecallDraft() {
    if (!currentResult) { setStatus('drillStatus', 'FR-016 초안을 만들려면 먼저 LOT 추적을 실행하세요.', true); return; }
    if (!window.DkjRecordStore) { setStatus('drillStatus', '기록 저장소를 불러오지 못했습니다.', true); return; }
    var writer = $('drillWriter').value.trim();
    if (!writer) { setStatus('drillStatus', 'FR-016 회수보고서 초안 생성을 위해 작성자 이름을 입력하세요.', true); return; }
    var lot = $('drillTargetLot').value.trim() || currentResult.query;
    var qty = currentResult.targetRecallQty;
    var destinations = currentResult.links.map(function (record) { return record.destination || record.shipmentNo; }).filter(Boolean);
    var scope = ['대상 LOT: ' + lot, '출하 대상: ' + fmt(currentResult.shipQty), '정상재고: ' + fmt(currentResult.inventoryQty), 'FR-015 원료격리: ' + fmt(currentResult.ncQuarantineQty), 'FR-039 제품격리: ' + fmt(currentResult.productNcQuarantineQty), destinations.length ? '거래처/전표: ' + destinations.join(', ') : '거래처/전표: 추적 결과 확인'].join('\n');
    var action = $('drillAction').value.trim() || '추적성 결과에 따라 출하보류·격리·거래처 재고확인 및 회수 조치를 실시한다.';
    var record = {
      formId: FORM_RECALL,
      title: '제품회수 보고서 및 기록 · ' + productNameForRecall(),
      docDate: today(), subject: productNameForRecall(), lot: lot, recallClass: '2등급', startDate: today(), qty: qty,
      writer: writer, reviewer: $('drillReviewer').value.trim(), approver: '',
      reason: $('drillScenario').value.trim() || 'LOT 추적 결과에 따른 제품회수 검토',
      scope: scope,
      action: action,
      result: '초안 생성: 모의회수 수량대조 결과(대상 ' + fmt(qty) + ', 수량차이 ' + fmt(num($('drillQtyGap').value)) + ')를 확인 후 최종 종료결과를 작성한다.',
      sourceTraceDrill: { lot: lot, traceStartedAt: currentResult.startedAt, targetQty: qty, sourceFormIds: [FORM_INCOMING, FORM_NC_RAW, FORM_NC_PRODUCT, FORM_LINK] },
      locked: false,
      audit: makeAudit('recall_report_draft_created', '추적성·모의회수 화면에서 FR-016 초안 생성')
    };
    var saved = DkjRecordStore.save(FORM_RECALL, record);
    setStatus('drillStatus', 'FR-016 제품회수 보고서 초안을 생성했습니다. 회수등급·조치·종료결과를 확인하세요.');
    location.href = recordLink(FORM_RECALL, saved.id);
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
    var targetQty = currentResult.targetRecallQty || (currentResult.shipQty + currentResult.inventoryQty);
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
      targetNonconformingQty: currentResult.ncQuarantineQty,
      targetProductNonconformingQty: currentResult.productNcQuarantineQty,
      targetReturnedOrDisposedQty: currentResult.ncClosedQty + currentResult.productNcClosedQty,
      targetQty: targetQty,
      isolatedQty: num($('drillIsolatedQty').value),
      recoveredQty: recoveredQty,
      recoveryRate: rate,
      withinTwoHours: minutes <= 120,
      scenarioTemplate: $('drillScenarioTemplate').value || 'custom',
      scenarioTemplateName: scenarioTemplate() ? scenarioTemplate().name : '사용자 정의',
      locationQty: { internal: num($('qtyInternal').value), nonconforming: num($('qtyNonconforming').value), productNonconforming: num($('qtyProductNonconforming').value), transit: num($('qtyTransit').value), customer: num($('qtyCustomer').value), sold: num($('qtySold').value), disposed: num($('qtyDisposed').value), total: num($('drillLocationTotal').value), gap: num($('drillQtyGap').value), gapReason: $('drillQtyGapReason').value.trim() },
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
    $('traceSummary').innerHTML = metric('원료 입고', '0건') + metric('생산 LOT', '0건') + metric('출하대상', '0') + metric('확보 재고', '0') + metric('FR-015 격리', '0') + metric('FR-039 제품격리', '0') + metric('FR-016 회수보고', '0건');
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
    $('createRecallDraft').addEventListener('click', createRecallDraft);
    $('saveDrill').addEventListener('click', saveDrill);
    $('linkSource').addEventListener('change', prefillLink);
    $('drillScenarioTemplate').addEventListener('change', applyScenarioTemplate);
    document.querySelectorAll('[data-trace-scenario]').forEach(function (button) { button.addEventListener('click', function () { applyAuditScenario(button.getAttribute('data-trace-scenario')); }); });
    ['qtyInternal', 'qtyNonconforming', 'qtyProductNonconforming', 'qtyTransit', 'qtyCustomer', 'qtySold', 'qtyDisposed'].forEach(function (id) {
      $(id).addEventListener('input', updateLocationBalance);
      $(id).addEventListener('change', updateLocationBalance);
    });
    updateLocationBalance();
    setupQuickLot(new URLSearchParams(location.search));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
