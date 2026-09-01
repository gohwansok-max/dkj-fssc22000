/**
 * DKJ-QC-001 — 일일 공정검사일지 (QC 순회)
 * 입출고/폐기량 무제한 자유 입력 · 실시간 포커스 유지 수율 계산 · 다품종 생산 지원
 */
(function (global) {
  'use strict';

  var FORM_ID = 'DKJ-QC-001';
  var draftTimer = null;
  var editingId = null;

  // Master Products & BOM Presets (DKJ-H-01-01과 일원화된 5개 완제품)
  var PRODUCTS = [
    {
      code: 'DKJ-FG-01', name: '양상추 샐러드', spec: '500g',
      bom: [
        { name: '양상추(선별/절단)', ratio: '100.0%', supplier: '수입/국내산' },
        { name: '포장용기(트레이/필름)', ratio: '1 set', supplier: '포장재공급사' },
        { name: '소독제(NaOCl)', ratio: '적량', supplier: '식품첨가물' },
        { name: '외포장 박스', ratio: '적량', supplier: '포장재공급사' }
      ]
    },
    {
      code: 'DKJ-FG-02', name: '농협 샐러드 채소믹스', spec: '500g',
      bom: [
        { name: '상추(카이피라)', ratio: '28.33%', supplier: '동김제 계약농가' },
        { name: '상추(프릴아이스)', ratio: '28.33%', supplier: '동김제 계약농가' },
        { name: '상추(로메인)', ratio: '28.34%', supplier: '동김제 계약농가' },
        { name: '라디치오잎', ratio: '15.0%', supplier: '국내산 협력사' }
      ]
    },
    {
      code: 'DKJ-FG-03', name: '샐러디아 샐러드 채소믹스', spec: '500g',
      bom: [
        { name: '상추(카이피라)', ratio: '28.33%', supplier: '동김제 계약농가' },
        { name: '상추(프릴아이스)', ratio: '28.33%', supplier: '동김제 계약농가' },
        { name: '상추(로메인)', ratio: '28.34%', supplier: '동김제 계약농가' },
        { name: '라디치오잎', ratio: '15.0%', supplier: '국내산 협력사' }
      ]
    },
    {
      code: 'DKJ-FG-04', name: '슬로우캘리 샐러드믹스', spec: '500g',
      bom: [
        { name: '양상추', ratio: '40.0%', supplier: '수입/국내산' },
        { name: '상추(프릴아이스)', ratio: '25.0%', supplier: '동김제 계약농가' },
        { name: '상추(로메인)', ratio: '20.0%', supplier: '동김제 계약농가' },
        { name: '케일잎', ratio: '15.0%', supplier: '동김제 계약농가' }
      ]
    },
    {
      code: 'DKJ-FG-05', name: '급식(바로먹는 유러피언 샐러드 채소믹스)', spec: '1kg',
      bom: [
        { name: '상추(카이피라)', ratio: '30.0%', supplier: '동김제 계약농가' },
        { name: '상추(버터헤드)', ratio: '25.0%', supplier: '동김제 계약농가' },
        { name: '상추(이자벨)', ratio: '25.0%', supplier: '동김제 계약농가' },
        { name: '상추(로메인)', ratio: '20.0%', supplier: '동김제 계약농가' }
      ]
    }
  ];

  // 28 Inspection Check Items (Exact Match to Excel)
  var CHECK_ITEMS = [
    // 선행 (4)
    { key: 'c01', group: '선행', proc: '위생관리', label: '개인위생 점검', std: '위생복·모·마스크·손소독 준수, 장신구 제거 (양호:○, 불량:×)', type: 'ox', defaultVal: '○', act: '재소독 및 환복' },
    { key: 'c02', group: '선행', proc: '환경관리', label: '작업장 청결·밀폐', std: '바닥 고임물 없음, 에어커튼·출입문 밀폐 (양호:○, 불량:×)', type: 'ox', defaultVal: '○', act: '즉시 바닥 청소/문 닫힘' },
    { key: 'c03', group: '선행', proc: '온도관리', label: '작업장 온도 (전처리/가공실)', std: '10 ~ 20 ℃ (측정 온도 기록)', type: 'num', unit: '℃', min: 10, max: 20, defaultVal: '15.0', act: '공조 냉방기 가동 점검' },
    { key: 'c04', group: '선행', proc: '온도관리', label: '냉장창고 온도 (원료/완제품)', std: '0 ~ 5 ℃ (측정 온도 기록)', type: 'num', unit: '℃', min: 0, max: 5, defaultVal: '3.0', act: '유니트쿨러 온도 재조정' },
    
    // 원료 (2)
    { key: 'c05', group: '원료', proc: '보관·선별', label: '원료 보관 & 선입선출', std: '바닥·벽 이격 적재, 선입선출(FIFO) 위치 준수 (○/×)', type: 'ox', defaultVal: '○', act: '정위치 재적재 및 표시' },
    { key: 'c06', group: '원료', proc: '보관·선별', label: '원료 외관 및 신선도', std: '부패, 갈변, 짓무름, 병충해, 이물 혼입 없음 (○/×)', type: 'ox', defaultVal: '○', act: '불량 원료 즉시 선별 격리' },
    
    // 전처리 (2)
    { key: 'c07', group: '전처리', proc: '절단·선별', label: '품목별 절단 규격', std: '밑동·외엽 제거, 규격 크기 절단 준수 (○/×)', type: 'ox', defaultVal: '○', act: '절단기 칼날 조정/재선별' },
    { key: 'c08', group: '전처리', proc: '절단·선별', label: '이물 1차 선별 상태', std: '달팽이, 벌레, 비닐 등 협잡물 100% 제거 (○/×)', type: 'ox', defaultVal: '○', act: '선별 속도 감속 및 재선별' },
    
    // CCP-1BC (4)
    { key: 'c09', group: 'CCP-1BC', proc: '소독공정', label: '소독수 유효염소농도 (ppm)', std: '한계기준: 50 ~ 200 ppm (관리목표: 100~150 ppm)', type: 'num', unit: 'ppm', min: 50, max: 200, defaultVal: '120', isCcp: true, act: '소독원액 보충 및 재조제', photoKey: 'chlorinePaper', photoTitle: '소독수 시험지' },
    { key: 'c10', group: 'CCP-1BC', proc: '소독공정', label: '소독 침지 시간 (초)', std: '한계기준: 60초 이상 침지 (측정 초 기록)', type: 'num', unit: '초', min: 60, max: 300, defaultVal: '75', isCcp: true, act: '컨베이어 이송속도 감속' },
    { key: 'c11', group: 'CCP-1BC', proc: '헹굼공정', label: '세척 헹굼 및 잔류염소', std: '음용수 헹굼 실시, 잔류염소 냄새 없음 (○/×)', type: 'ox', defaultVal: '○', isCcp: true, act: '헹굼 수량/수압 증대' },
    { key: 'c12', group: 'CCP-1BC', proc: '세척수관리', label: '소독액·헹굼수 교체', std: '3시간 주기 전량 교체 확인 (교체 시각 기록)', type: 'ox', defaultVal: '○', isCcp: true, act: '세척수 즉시 전량 교체' },
    
    // 가공 (2)
    { key: 'c13', group: '가공', proc: '탈수공정', label: '탈수 상태 (수분제거)', std: '품목별 RPM/시간 준수, 과탈수/물기 없음 (○/×)', type: 'ox', defaultVal: '○', act: '탈수 시간/회전수 재조정' },
    { key: 'c14', group: '가공', proc: '배합공정', label: '채소 배합 비율 & 혼합', std: '표준 BOM 배합비(%) 준수 및 균일 혼합 상태 (○/×)', type: 'ox', defaultVal: '○', act: '부족 원료 보충 계량' },
    
    // 포장 (3)
    { key: 'c15', group: '포장', proc: '계량충진', label: '포장 충진 중량 (g)', std: '품목별 표시중량 이상 (±허용공차 준수)', type: 'num', unit: 'g', min: 100, max: 2000, defaultVal: '505', act: '저울 영점 및 충진량 조정' },
    { key: 'c16', group: '포장', proc: '용기실링', label: '트레이/필름 실링 밀봉', std: '열접착 실링 양호, 틈새/누기/씹힘 없음 (○/×)', type: 'ox', defaultVal: '○', act: '실러 온도/압력 재설정' },
    { key: 'c17', group: '포장', proc: '표시사항', label: '소비기한 / LOT 날인', std: '날인 위치 적정, 번짐 없이 선명, 일자 일치 (○/×)', type: 'ox', defaultVal: '○', act: '날인기 활자/리본 교체', photoKey: 'lotPrint', photoTitle: '소비기한/LOT 날인' },
    
    // CCP-2P (4) - Fe (2.0/2.5/3.0), SUS (3.0/3.5)
    { key: 'c18', group: 'CCP-2P', proc: '금속검출', label: 'Test Piece (Fe 시편)', std: 'Fe 2.0 / 2.5 / 3.0㎜ 통과 시 100% 검출 및 리젝트', type: 'spec', options: ['2.0', '2.5', '3.0'], unit: '㎜', defaultVal: '2.0', isCcp: true, act: '검출기 감도 조정/라인정지' },
    { key: 'c19', group: 'CCP-2P', proc: '금속검출', label: 'Test Piece (SUS 시편)', std: 'SUS 3.0 / 3.5㎜ 통과 시 100% 검출 및 리젝트', type: 'spec', options: ['3.0', '3.5'], unit: '㎜', defaultVal: '3.0', isCcp: true, act: '검출기 감도 조정/라인정지' },
    { key: 'c20', group: 'CCP-2P', proc: '금속검출', label: '제품 + 시편 (복합 검출)', std: '제품+Fe, 제품+SUS 통과 시 정상 검출·배출 (○/×)', type: 'ox', defaultVal: '○', isCcp: true, act: '설비 점검 및 제품 격리' },
    { key: 'c21', group: 'CCP-2P', proc: '금속검출', label: '제품 단독 통과 (정상)', std: '제품만 통과 시 오작동 없이 통과 (○/×)', type: 'ox', defaultVal: '○', isCcp: true, act: '감도 재보정' },
    
    // 완제품 (5)
    { key: 'c22', group: '완제품', proc: '품질관능', label: '외관 및 색택', std: '신선한 고유 색택 유지, 갈변/탈색 없음 (○/×)', type: 'ox', defaultVal: '○', act: '원인 분석 및 선별 재작업' },
    { key: 'c23', group: '완제품', proc: '품질관능', label: '조직감 및 식감', std: '아삭한 식감 유지, 짓무름/무름 없음 (○/×)', type: 'ox', defaultVal: '○', act: '원료/탈수 상태 점검' },
    { key: 'c24', group: '완제품', proc: '품질관능', label: '풍미 및 이취', std: '채소 고유의 풍미, 이상 냄새/부패취 없음 (○/×)', type: 'ox', defaultVal: '○', act: '해당 LOT 전량 폐기/격리' },
    { key: 'c25', group: '완제품', proc: '품질관능', label: '포장 내부 이물 검사', std: '포장지 내부 모발, 비닐, 곤충 등 이물 전무 (○/×)', type: 'ox', defaultVal: '○', act: '해당 배치 전량 전수 재검' },
    { key: 'c26', group: '완제품', proc: '보관출하', label: '완제품 보관온도', std: '완제품 냉장창고 0 ~ 5 ℃ 유지 (측정 ℃)', type: 'num', unit: '℃', min: 0, max: 5, defaultVal: '3.0', act: '창고 냉각기 점검 및 출하' },
    
    // 확인 (2)
    { key: 'c27', group: '확인', proc: '순회확인', label: 'QC 순회 검사자 서명', std: '품질관리 담당자 (정·부) 서명', type: 'ox', defaultVal: '○', act: '—' },
    { key: 'c28', group: '확인', proc: '순회확인', label: '관리책임자 확인 서명', std: 'HACCP 팀장 / 공장장 확인 서명', type: 'ox', defaultVal: '○', act: '—' }
  ];

  var state = emptyState();
  var apvUi = null;

  function todayStr() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function nowTimeStr() {
    var d = new Date();
    var h = String(d.getHours()).padStart(2, '0');
    var m = String(d.getMinutes()).padStart(2, '0');
    return h + ':' + m;
  }

  function makeLot(dateVal) {
    var raw = (dateVal || todayStr()).replace(/-/g, '');
    return raw + '-01';
  }

  function emptyState() {
    var defProd = PRODUCTS[0];
    var curDate = todayStr();
    var curLot = makeLot(curDate);

    var checks = { r1: {}, r2: {}, r3: {} };
    CHECK_ITEMS.forEach(function (it) {
      checks.r1[it.key] = it.defaultVal;
      checks.r2[it.key] = it.defaultVal;
      checks.r3[it.key] = it.defaultVal;
    });

    var materials = defProd.bom.map(function (b) {
      return { name: b.name, ratio: b.ratio, supplier: b.supplier, inKg: '', usedKg: '', wasteKg: '', yieldRate: '' };
    });

    var finishedItems = [
      { code: defProd.code, name: defProd.name, spec: defProd.spec, madeKg: '', madeBag: '', shippedKg: '', stockKg: '', first20: 'O' }
    ];

    return {
      workDate: curDate,
      lot: curLot,
      inspector: '최민재',
      roundTimes: { r1: '09:00', r2: '13:30', r3: '16:30' },
      selectedCodes: [defProd.code],
      checks: checks,
      materials: materials,
      finishedItems: finishedItems,
      photos: {
        chlorinePaper: null,
        lotPrint: null
      },
      remarkPreset: '특이사항 없음 / 정상 가동',
      deviationNotes: '',
      confirmer: '권화선',
      approver: '최재원',
      approvals: { writer: '최민재', reviewer: '권화선', approver: '최재원' },
      signoff: {},
      audit: [],
      locked: false,
      hasDeviation: false
    };
  }

  function $(id) { return document.getElementById(id); }

  function setStatus(msg, saved) {
    var el = $('saveStatus');
    if (!el) return;
    el.innerHTML = '<span class="dot"></span> ' + msg;
    el.className = 'dkj-status' + (saved ? ' saved' : '');
  }

  // Handle and compress camera/uploaded image for localStorage & high quality print
  function handleImageUpload(file, callback) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        var MAX_DIM = 1000;
        var width = img.width;
        var height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        callback(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // Re-sync raw materials BOM whenever products list changes
  function syncMaterialsFromProducts() {
    var matMap = {};
    (state.materials || []).forEach(function (m) {
      if (m.name) matMap[m.name] = m;
    });

    var newMats = [];
    (state.finishedItems || []).forEach(function (fItem) {
      var prod = PRODUCTS.find(function (p) { return p.code === fItem.code || p.name === fItem.name; });
      if (prod && prod.bom) {
        prod.bom.forEach(function (b) {
          if (!newMats.find(function (x) { return x.name === b.name; })) {
            var existing = matMap[b.name];
            newMats.push({
              name: b.name,
              ratio: b.ratio,
              supplier: b.supplier,
              inKg: existing ? existing.inKg : '',
              usedKg: existing ? existing.usedKg : '',
              wasteKg: existing ? existing.wasteKg : '',
              yieldRate: existing ? existing.yieldRate : ''
            });
          }
        });
      }
    });

    if (newMats.length) {
      state.materials = newMats;
    }
  }

  function renderProductChips() {
    var host = $('productChips');
    if (!host) return;

    var curCodes = (state.finishedItems || []).map(function (f) { return f.code; });

    host.innerHTML = PRODUCTS.map(function (p) {
      var active = curCodes.includes(p.code) ? ' active' : '';
      return '<button type="button" class="qc-chip' + active + '" data-code="' + p.code + '">' + (active ? '✓ ' : '＋ ') + p.name + '</button>';
    }).join('');

    host.querySelectorAll('.qc-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var code = btn.getAttribute('data-code');
        var sel = PRODUCTS.find(function (x) { return x.code === code; });
        if (!sel) return;

        var existsIdx = state.finishedItems.findIndex(function (x) { return x.code === code; });
        if (existsIdx >= 0) {
          if (state.finishedItems.length > 1) {
            state.finishedItems.splice(existsIdx, 1);
          } else {
            alert('최소 1개 이상의 생산 제품이 필요합니다.');
            return;
          }
        } else {
          state.finishedItems.push({
            code: sel.code,
            name: sel.name,
            spec: sel.spec,
            madeKg: '',
            madeBag: '',
            shippedKg: '',
            stockKg: '',
            first20: 'O'
          });
        }

        syncMaterialsFromProducts();
        renderProductChips();
        renderFinishedGoodsTable();
        renderMaterialsTable();
        scheduleDraft();
      });
    });
  }

  function updateRoundTimeLabels() {
    var t1 = (state.roundTimes && state.roundTimes.r1) || '09:00';
    var t2 = (state.roundTimes && state.roundTimes.r2) || '13:30';
    var t3 = (state.roundTimes && state.roundTimes.r3) || '16:30';

    if ($('roundTime1')) $('roundTime1').value = t1;
    if ($('roundTime2')) $('roundTime2').value = t2;
    if ($('roundTime3')) $('roundTime3').value = t3;

    if ($('lblTime1')) $('lblTime1').innerText = t1;
    if ($('lblTime2')) $('lblTime2').innerText = t2;
    if ($('lblTime3')) $('lblTime3').innerText = t3;
  }

  function isBad(item, val) {
    if (!val) return false;
    if (item.type === 'ox') return val === '×' || val === 'X';
    if (item.type === 'num') {
      var n = parseFloat(val);
      if (isNaN(n)) return false;
      return n < item.min || n > item.max;
    }
    return false;
  }

  function checkDeviations() {
    var dev = false;
    ['r1', 'r2', 'r3'].forEach(function (rk) {
      CHECK_ITEMS.forEach(function (it) {
        if (isBad(it, state.checks[rk][it.key])) dev = true;
      });
    });
    state.hasDeviation = dev;
    var ban = $('deviationBanner');
    if (ban) ban.hidden = !dev;
  }

  function renderMainCheckTable() {
    var tbody = $('mainCheckBody');
    if (!tbody) return;

    var groupCounts = {};
    CHECK_ITEMS.forEach(function (it) {
      groupCounts[it.group] = (groupCounts[it.group] || 0) + 1;
    });

    var renderedGroups = {};
    var rowsHtml = '';

    CHECK_ITEMS.forEach(function (it) {
      var isFirstOfGroup = !renderedGroups[it.group];
      renderedGroups[it.group] = true;

      var ccpRowCls = it.isCcp ? ' class="ccp-row"' : '';
      var grpCellCls = it.isCcp ? 'ccp-grp-cell' : 'grp-cell';

      var r1Val = state.checks.r1[it.key] || '';
      var r2Val = state.checks.r2[it.key] || '';
      var r3Val = state.checks.r3[it.key] || '';

      var r1Bad = isBad(it, r1Val);
      var r2Bad = isBad(it, r2Val);
      var r3Bad = isBad(it, r3Val);

      function renderCell(rk, val, bad) {
        if (it.type === 'ox') {
          var isOk = (val === '○' || val === 'O') ? ' active' : '';
          var isNg = (val === '×' || val === 'X') ? ' active' : '';
          return '<div class="qc-seg-control" data-k="' + it.key + '" data-r="' + rk + '">' +
            '<button type="button" class="qc-seg-btn ok' + isOk + '" data-val="○">○</button>' +
            '<button type="button" class="qc-seg-btn ng' + isNg + '" data-val="×">×</button>' +
            '</div>';
        } else if (it.type === 'spec') {
          var btns = (it.options || []).map(function (opt) {
            var isSel = (val === opt || val === (opt + '㎜') || val === (opt + 'mm')) ? ' active' : '';
            return '<button type="button" class="qc-spec-btn' + isSel + '" data-val="' + opt + '">' + opt + '</button>';
          }).join('');
          return '<div class="qc-spec-control" data-k="' + it.key + '" data-r="' + rk + '">' + btns + '</div>';
        } else {
          return '<input type="number" step="any" class="qc-val-box' + (bad ? ' bad' : '') + '" data-k="' + it.key + '" data-r="' + rk + '" value="' + val + '" placeholder="' + it.defaultVal + '">';
        }
      }

      var photoColHtml = '';
      if (it.photoKey) {
        var curPhoto = (state.photos && state.photos[it.photoKey]) || null;
        photoColHtml = '<div class="qc-photo-box">' +
          '<button type="button" class="qc-camera-btn" data-trigger-photo="' + it.photoKey + '">📷 ' + it.photoTitle + '</button>' +
          '<input type="file" accept="image/*" capture="environment" class="qc-photo-file-inp" data-photo-inp="' + it.photoKey + '" style="display:none;">' +
          (curPhoto ? '<div class="qc-photo-preview-wrap"><img src="' + curPhoto + '" class="qc-photo-thumb" alt="미리보기"><button type="button" class="qc-photo-del" data-del-photo="' + it.photoKey + '">✕</button></div>' : '') +
          '</div>';
      }

      rowsHtml += '<tr' + ccpRowCls + '>';
      if (isFirstOfGroup) {
        rowsHtml += '<td rowspan="' + groupCounts[it.group] + '" class="' + grpCellCls + '">' + it.group + '</td>';
      }
      rowsHtml += '<td style="font-weight:600;">' + it.proc + '</td>';
      rowsHtml += '<td class="left-txt" style="font-weight:700;">' + (it.isCcp ? '<span style="color:#b71c1c;">[CCP] </span>' : '') + it.label + '</td>';
      rowsHtml += '<td class="left-txt" style="font-size:12px;color:#475467;">' + it.std + '</td>';
      rowsHtml += '<td>' + renderCell('r1', r1Val, r1Bad) + '</td>';
      rowsHtml += '<td>' + renderCell('r2', r2Val, r2Bad) + '</td>';
      rowsHtml += '<td>' + renderCell('r3', r3Val, r3Bad) + '</td>';
      rowsHtml += '<td class="left-txt" style="font-size:11.5px;color:#555;">' +
        '<div>' + it.act + '</div>' + photoColHtml +
        '</td>';
      rowsHtml += '</tr>';
    });

    tbody.innerHTML = rowsHtml;

    // OX Buttons
    tbody.querySelectorAll('.qc-seg-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var par = btn.closest('.qc-seg-control');
        var k = par.getAttribute('data-k');
        var rk = par.getAttribute('data-r');
        var v = btn.getAttribute('data-val');
        state.checks[rk][k] = v;
        
        par.querySelectorAll('.qc-seg-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');

        checkDeviations();
        scheduleDraft();
      });
    });

    // Spec Buttons (Fe / SUS)
    tbody.querySelectorAll('.qc-spec-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var par = btn.closest('.qc-spec-control');
        var k = par.getAttribute('data-k');
        var rk = par.getAttribute('data-r');
        var v = btn.getAttribute('data-val');
        state.checks[rk][k] = v;
        
        par.querySelectorAll('.qc-spec-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');

        checkDeviations();
        scheduleDraft();
      });
    });

    // Numeric Inputs
    tbody.querySelectorAll('.qc-val-box').forEach(function (inp) {
      inp.addEventListener('input', function () {
        if (state.locked) return;
        var k = inp.getAttribute('data-k');
        var rk = inp.getAttribute('data-r');
        state.checks[rk][k] = inp.value;

        var it = CHECK_ITEMS.find(function (x) { return x.key === k; });
        if (it) {
          var bad = isBad(it, inp.value);
          if (bad) inp.classList.add('bad');
          else inp.classList.remove('bad');
        }

        checkDeviations();
        scheduleDraft();
      });
    });

    // Camera Trigger Buttons
    tbody.querySelectorAll('[data-trigger-photo]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var pKey = btn.getAttribute('data-trigger-photo');
        var fileInp = tbody.querySelector('[data-photo-inp="' + pKey + '"]');
        if (fileInp) fileInp.click();
      });
    });

    // Camera File Inputs
    tbody.querySelectorAll('[data-photo-inp]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        if (state.locked) return;
        var pKey = inp.getAttribute('data-photo-inp');
        var file = inp.files && inp.files[0];
        if (file) {
          handleImageUpload(file, function (dataUrl) {
            state.photos = state.photos || {};
            state.photos[pKey] = dataUrl;
            renderMainCheckTable();
            scheduleDraft();
            if (window.DkjUtil && window.DkjUtil.toast) {
              window.DkjUtil.toast('사진이 성공적으로 첨부되었습니다.');
            }
          });
        }
      });
    });

    // Photo Delete Buttons
    tbody.querySelectorAll('[data-del-photo]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var pKey = btn.getAttribute('data-del-photo');
        if (state.photos && state.photos[pKey]) {
          state.photos[pKey] = null;
          renderMainCheckTable();
          scheduleDraft();
        }
      });
    });
  }

  // Calculate Yield Helper
  function calcMaterialYield(m) {
    var inN = parseFloat(m.inKg) || 0;
    var usedN = parseFloat(m.usedKg) || 0;
    var wasteN = parseFloat(m.wasteKg) || 0;

    if (inN > 0) {
      if (usedN > 0) {
        return String(Math.round((usedN / inN) * 1000) / 10);
      } else if (wasteN > 0 && inN >= wasteN) {
        return String(Math.round(((inN - wasteN) / inN) * 1000) / 10);
      }
    }
    return '';
  }

  function renderMaterialsTable() {
    var tbody = $('matTableBody');
    if (!tbody) return;

    tbody.innerHTML = (state.materials || []).map(function (m, idx) {
      var matType = (idx < 6) ? '주원료 ' + (idx + 1) : '부재료';
      var yRate = m.yieldRate || calcMaterialYield(m);
      return '<tr data-idx="' + idx + '">' +
        '<td style="font-weight:700;color:#1b5e20;">' + matType + '</td>' +
        '<td style="text-align:left;"><input type="text" class="qc-mat-name-box" data-f="name" value="' + (m.name || '') + '"></td>' +
        '<td><input type="text" class="qc-in-box" data-f="ratio" value="' + (m.ratio || '') + '" style="text-align:center;"></td>' +
        '<td><input type="number" step="any" min="0" class="qc-in-box qc-mat-in" data-f="inKg" value="' + (m.inKg || '') + '" placeholder="kg"></td>' +
        '<td><input type="number" step="any" min="0" class="qc-in-box qc-mat-used" data-f="usedKg" value="' + (m.usedKg || '') + '" placeholder="kg"></td>' +
        '<td><input type="number" step="any" min="0" class="qc-in-box qc-mat-waste" data-f="wasteKg" value="' + (m.wasteKg || '') + '" placeholder="kg"></td>' +
        '<td class="qc-yield-val" style="font-weight:800;color:#009a44;font-size:13px;">' + (yRate ? yRate + '%' : '—') + '</td>' +
        '<td style="color:#009a44;font-weight:700;">○ (적합)</td>' +
        '<td><button type="button" class="pill-btn ghost sm qc-del-mat" data-idx="' + idx + '" style="padding:2px 6px;color:#d92d20;">✕</button></td>' +
        '</tr>';
    }).join('');

    // Smooth real-time update WITHOUT destroying input focus
    tbody.querySelectorAll('.qc-in-box, .qc-mat-name-box').forEach(function (inp) {
      inp.addEventListener('input', function () {
        if (state.locked) return;
        var tr = inp.closest('tr');
        var idx = Number(tr.getAttribute('data-idx'));
        var f = inp.getAttribute('data-f');
        state.materials[idx][f] = inp.value;

        var y = calcMaterialYield(state.materials[idx]);
        state.materials[idx].yieldRate = y;

        var yCell = tr.querySelector('.qc-yield-val');
        if (yCell) {
          yCell.innerText = y ? (y + '%') : '—';
        }

        scheduleDraft();
      });
    });

    tbody.querySelectorAll('.qc-del-mat').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var idx = Number(btn.getAttribute('data-idx'));
        state.materials.splice(idx, 1);
        renderMaterialsTable();
        scheduleDraft();
      });
    });
  }

  // Update Finished Goods Totals Row
  function updateFinishedTotals() {
    var tfoot = $('finishedGoodsFoot');
    if (!tfoot) return;

    var sumMadeKg = 0;
    var sumMadeBag = 0;
    var sumShippedKg = 0;
    var sumStockKg = 0;

    (state.finishedItems || []).forEach(function (item) {
      sumMadeKg += parseFloat(item.madeKg) || 0;
      sumMadeBag += parseInt(item.madeBag, 10) || 0;
      sumShippedKg += parseFloat(item.shippedKg) || 0;
      sumStockKg += parseFloat(item.stockKg) || 0;
    });

    tfoot.innerHTML = '<tr>' +
      '<td colspan="2" style="text-align:center;font-weight:800;color:#003311;">당일 완제품 총 생산 합계</td>' +
      '<td style="text-align:right;padding-right:8px;color:#009a44;font-size:13.5px;">' + (Math.round(sumMadeKg * 10) / 10) + ' kg</td>' +
      '<td style="text-align:right;padding-right:8px;color:#009a44;font-size:13.5px;">' + sumMadeBag + ' 봉</td>' +
      '<td style="text-align:right;padding-right:8px;">' + (Math.round(sumShippedKg * 10) / 10) + ' kg</td>' +
      '<td style="text-align:right;padding-right:8px;">' + (Math.round(sumStockKg * 10) / 10) + ' kg</td>' +
      '<td colspan="2" style="text-align:center;color:#009a44;">전수점검 적합(○)</td>' +
      '</tr>';
  }

  // Render Multi-Product Finished Goods Table
  function renderFinishedGoodsTable() {
    var tbody = $('finishedGoodsBody');
    if (!tbody) return;

    tbody.innerHTML = (state.finishedItems || []).map(function (item, idx) {
      var prodOptions = PRODUCTS.map(function (p) {
        var sel = (p.code === item.code || p.name === item.name) ? ' selected' : '';
        return '<option value="' + p.code + '"' + sel + '>' + p.name + '</option>';
      }).join('');

      var isOk = item.first20 === 'O' ? ' active' : '';
      var isNg = item.first20 === 'X' ? ' active' : '';

      return '<tr data-idx="' + idx + '">' +
        '<td><select class="qc-select-box qc-prod-select" data-f="code">' + prodOptions + '</select></td>' +
        '<td><input type="text" class="qc-in-box" data-f="spec" value="' + (item.spec || '500g') + '" style="text-align:center;"></td>' +
        '<td><input type="number" step="any" min="0" class="qc-in-box qc-fn-kg" data-f="madeKg" value="' + (item.madeKg || '') + '" placeholder="kg" style="color:#009a44;font-weight:800;"></td>' +
        '<td><input type="number" step="1" min="0" class="qc-in-box qc-fn-bag" data-f="madeBag" value="' + (item.madeBag || '') + '" placeholder="봉"></td>' +
        '<td><input type="number" step="any" min="0" class="qc-in-box" data-f="shippedKg" value="' + (item.shippedKg || '') + '" placeholder="kg"></td>' +
        '<td><input type="number" step="any" min="0" class="qc-in-box" data-f="stockKg" value="' + (item.stockKg || '') + '" placeholder="kg"></td>' +
        '<td>' +
          '<div class="qc-seg-control" data-idx="' + idx + '">' +
            '<button type="button" class="qc-seg-btn ok' + isOk + '" data-val="O">○</button>' +
            '<button type="button" class="qc-seg-btn ng' + isNg + '" data-val="X">×</button>' +
          '</div>' +
        '</td>' +
        '<td><button type="button" class="pill-btn ghost sm qc-del-prod" data-idx="' + idx + '" style="padding:2px 6px;color:#d92d20;">✕</button></td>' +
        '</tr>';
    }).join('');

    updateFinishedTotals();

    // Product Select Changes
    tbody.querySelectorAll('.qc-prod-select').forEach(function (sel) {
      sel.addEventListener('change', function () {
        if (state.locked) return;
        var tr = sel.closest('tr');
        var idx = Number(tr.getAttribute('data-idx'));
        var code = sel.value;
        var p = PRODUCTS.find(function (x) { return x.code === code; });
        if (p) {
          state.finishedItems[idx].code = p.code;
          state.finishedItems[idx].name = p.name;
          state.finishedItems[idx].spec = p.spec;
          syncMaterialsFromProducts();
          renderProductChips();
          renderFinishedGoodsTable();
          renderMaterialsTable();
          scheduleDraft();
        }
      });
    });

    // Inputs inside finished goods (Focus-safe updates)
    tbody.querySelectorAll('.qc-in-box, .qc-mat-name-box').forEach(function (inp) {
      inp.addEventListener('input', function () {
        if (state.locked) return;
        var tr = inp.closest('tr');
        var idx = Number(tr.getAttribute('data-idx'));
        var f = inp.getAttribute('data-f');
        state.finishedItems[idx][f] = inp.value;

        // Auto bag helper if madeKg entered
        if (f === 'madeKg') {
          var kg = parseFloat(inp.value) || 0;
          var specStr = state.finishedItems[idx].spec || '500g';
          var unitKg = 0.5;
          if (specStr.indexOf('1kg') >= 0 || specStr.indexOf('1000g') >= 0) unitKg = 1.0;
          else if (specStr.indexOf('250g') >= 0) unitKg = 0.25;
          else if (specStr.indexOf('300g') >= 0) unitKg = 0.3;
          else if (specStr.indexOf('350g') >= 0) unitKg = 0.35;
          else if (specStr.indexOf('500g') >= 0) unitKg = 0.5;

          if (kg > 0 && unitKg > 0 && !state.finishedItems[idx].madeBag) {
            state.finishedItems[idx].madeBag = String(Math.round(kg / unitKg));
            var bagInp = tr.querySelector('.qc-fn-bag');
            if (bagInp) bagInp.value = state.finishedItems[idx].madeBag;
          }
        }

        updateFinishedTotals();
        scheduleDraft();
      });
    });

    // First 20 Segmented Button
    tbody.querySelectorAll('.qc-seg-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var par = btn.closest('.qc-seg-control');
        var idx = Number(par.getAttribute('data-idx'));
        state.finishedItems[idx].first20 = btn.getAttribute('data-val');
        par.querySelectorAll('.qc-seg-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        scheduleDraft();
      });
    });

    // Delete Product Row
    tbody.querySelectorAll('.qc-del-prod').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        if (state.finishedItems.length <= 1) {
          alert('최소 1개 이상의 생산 제품이 필요합니다.');
          return;
        }
        var idx = Number(btn.getAttribute('data-idx'));
        state.finishedItems.splice(idx, 1);
        syncMaterialsFromProducts();
        renderProductChips();
        renderFinishedGoodsTable();
        renderMaterialsTable();
        scheduleDraft();
      });
    });
  }

  function readForm() {
    if ($('workDate')) state.workDate = $('workDate').value;
    if ($('lot')) state.lot = $('lot').value;
    if ($('inspector')) state.inspector = $('inspector').value;
    if ($('roundTime1')) state.roundTimes.r1 = $('roundTime1').value || '09:00';
    if ($('roundTime2')) state.roundTimes.r2 = $('roundTime2').value || '13:30';
    if ($('roundTime3')) state.roundTimes.r3 = $('roundTime3').value || '16:30';
    if ($('remarkPreset')) state.remarkPreset = $('remarkPreset').value;
    if ($('deviationNotes')) state.deviationNotes = $('deviationNotes').value;
    if ($('confirmer')) state.confirmer = $('confirmer').value;
    if ($('approver')) state.approver = $('approver').value;
    if (window.DkjApproval) {
      DkjApproval.bindFlat(state, { writer: 'inspector', reviewer: 'confirmer', approver: 'approver' });
    }
  }

  function writeForm() {
    var curDate = state.workDate || todayStr();
    if ($('workDate')) $('workDate').value = curDate;
    if ($('lot')) $('lot').value = state.lot || makeLot(curDate);
    if ($('inspector')) $('inspector').value = state.inspector || '최민재';
    if ($('remarkPreset')) $('remarkPreset').value = state.remarkPreset || '특이사항 없음 / 정상 가동';
    if ($('deviationNotes')) $('deviationNotes').value = state.deviationNotes || '';
    if ($('confirmer')) $('confirmer').value = state.confirmer || '권화선';
    if ($('approver')) $('approver').value = state.approver || '최재원';

    state.photos = state.photos || { chlorinePaper: null, lotPrint: null };

    updateRoundTimeLabels();
    renderProductChips();
    renderMainCheckTable();
    renderFinishedGoodsTable();
    renderMaterialsTable();
    checkDeviations();
    if (apvUi) apvUi.render();
  }

  function scheduleDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(function () {
      readForm();
      DkjRecordStore.saveDraft(FORM_ID, state);
      setStatus('임시저장 ' + new Date().toLocaleTimeString(), false);
    }, 400);
  }

  function save(lock) {
    readForm();
    if (!state.workDate) { alert('작업일자를 입력하세요.'); return; }
    if (!state.lot) { alert('생산 LOT를 입력하세요.'); return; }
    if (!state.inspector) { alert('QC 검사자를 입력하세요.'); return; }

    state.locked = !!lock;
    var prodNames = (state.finishedItems || []).map(function (f) { return f.name; }).join(', ');
    var rec = DkjRecordStore.save(FORM_ID, Object.assign({}, state, {
      id: editingId || undefined,
      title: 'QC 순회 ' + prodNames + ' (' + state.lot + ')',
      judge: state.hasDeviation ? '이탈발생' : '적합',
      workDate: state.workDate
    }));
    editingId = rec.id;
    setStatus(lock ? '✓ 작성완료 확정됨' : '저장됨 ' + new Date().toLocaleTimeString(), true);
    if (apvUi) apvUi.render();
    renderHistory();
  }

  function renderHistory() {
    var list = DkjRecordStore.list(FORM_ID).slice(0, 10);
    var el = $('historyList');
    if (!el) return;
    if (!list.length) {
      el.innerHTML = '<p style="color:#888;font-size:13px;">저장된 기록이 없습니다.</p>';
      return;
    }
    el.innerHTML = list.map(function (r) {
      var badgeCls = r.hasDeviation ? 'wip' : 'done';
      var pName = (r.finishedItems && r.finishedItems.length) ? r.finishedItems.map(function(f){return f.name;}).join(', ') : (r.productName || '가공채소');
      return '<div class="dkj-history-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eaecf0;">' +
        '<div><strong>' + (r.workDate || '') + '</strong> · ' + pName + ' / LOT ' + (r.lot || '') +
        ' <span class="badge ' + badgeCls + '">' + (r.judge || '적합') + '</span></div>' +
        '<div style="display:flex;gap:6px;">' +
        '<button type="button" class="pill-btn ghost sm" data-load="' + r.id + '">불러오기</button>' +
        '<button type="button" class="pill-btn ghost sm" data-del="' + r.id + '">삭제</button>' +
        '</div></div>';
    }).join('');

    el.querySelectorAll('[data-load]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var r = DkjRecordStore.get(FORM_ID, btn.getAttribute('data-load'));
        if (!r) return;
        editingId = r.id;
        state = Object.assign(emptyState(), r);
        writeForm();
        setStatus('기록 불러옴', true);
      });
    });

    el.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('삭제하시겠습니까?')) return;
        DkjRecordStore.remove(FORM_ID, btn.getAttribute('data-del'));
        renderHistory();
      });
    });
  }

  // Exact 1-Page A4 Print Template (100% Matching Excel Layout + Photo Attachments)
  function buildPrintSheet() {
    var p = $('printSheet');
    if (!p) return;
    readForm();

    var t1 = (state.roundTimes && state.roundTimes.r1) || '09:00';
    var t2 = (state.roundTimes && state.roundTimes.r2) || '13:30';
    var t3 = (state.roundTimes && state.roundTimes.r3) || '16:30';

    var groupCounts = {};
    CHECK_ITEMS.forEach(function (it) {
      groupCounts[it.group] = (groupCounts[it.group] || 0) + 1;
    });

    var renderedGroups = {};
    var checkRowsHtml = '';

    CHECK_ITEMS.forEach(function (it) {
      var isFirstOfGroup = !renderedGroups[it.group];
      renderedGroups[it.group] = true;

      var r1Val = state.checks.r1[it.key] || '';
      var r2Val = state.checks.r2[it.key] || '';
      var r3Val = state.checks.r3[it.key] || '';

      if (it.type === 'spec') {
        if (r1Val && r1Val.indexOf('㎜') === -1) r1Val = r1Val + '㎜';
        if (r2Val && r2Val.indexOf('㎜') === -1) r2Val = r2Val + '㎜';
        if (r3Val && r3Val.indexOf('㎜') === -1) r3Val = r3Val + '㎜';
      }

      var isCcp = it.isCcp;
      var fontColor = isCcp ? '#b71c1c' : '#000';
      var fontBold = isCcp ? 'font-weight:bold;' : '';

      checkRowsHtml += '<tr style="height:14pt;">';
      if (isFirstOfGroup) {
        checkRowsHtml += '<td rowspan="' + groupCounts[it.group] + '" style="border:1px solid #000;background:' + (isCcp ? '#ffebee' : '#eef2f6') + ';font-weight:bold;color:' + (isCcp ? '#b71c1c' : '#000') + ';text-align:center;">' + it.group + '</td>';
      }
      checkRowsHtml += '<td style="border:1px solid #000;text-align:center;font-size:7.5pt;color:' + fontColor + ';' + fontBold + '">' + it.proc + '</td>';
      checkRowsHtml += '<td style="border:1px solid #000;text-align:left;padding-left:4px;font-size:7.5pt;font-weight:bold;color:' + fontColor + ';">' + it.label + '</td>';
      checkRowsHtml += '<td style="border:1px solid #000;text-align:left;padding-left:4px;font-size:7.0pt;color:' + fontColor + ';">' + it.std + '</td>';
      checkRowsHtml += '<td style="border:1px solid #000;text-align:center;font-size:8.0pt;font-weight:bold;">' + r1Val + '</td>';
      checkRowsHtml += '<td style="border:1px solid #000;text-align:center;font-size:8.0pt;font-weight:bold;">' + r2Val + '</td>';
      checkRowsHtml += '<td style="border:1px solid #000;text-align:center;font-size:8.0pt;font-weight:bold;">' + r3Val + '</td>';
      checkRowsHtml += '<td style="border:1px solid #000;text-align:left;padding-left:4px;font-size:7.0pt;color:#333;">' + it.act + '</td>';
      checkRowsHtml += '</tr>';
    });

    var matRowsHtml = (state.materials || []).map(function (m, idx) {
      return '<tr style="height:14pt;">' +
        '<td style="border:1px solid #000;text-align:center;font-weight:bold;">주원료 ' + (idx + 1) + '</td>' +
        '<td style="border:1px solid #000;text-align:left;padding-left:4px;">' + (m.name || '') + '</td>' +
        '<td style="border:1px solid #000;text-align:center;">' + (m.ratio || '') + '</td>' +
        '<td style="border:1px solid #000;text-align:right;padding-right:4px;">' + (m.inKg || '') + '</td>' +
        '<td style="border:1px solid #000;text-align:right;padding-right:4px;">' + (m.usedKg || '') + '</td>' +
        '<td style="border:1px solid #000;text-align:right;padding-right:4px;">' + (m.wasteKg || '') + '</td>' +
        '<td style="border:1px solid #000;text-align:center;font-weight:bold;">' + (m.yieldRate ? m.yieldRate + '%' : '') + '</td>' +
        '<td style="border:1px solid #000;text-align:center;">○ (적합)</td>' +
        '</tr>';
    }).join('');

    var prodRowsHtml = (state.finishedItems || []).map(function (f) {
      return '<tr style="height:14pt;">' +
        '<td colspan="2" style="border:1px solid #000;font-weight:bold;text-align:left;padding-left:4px;">' + f.name + '</td>' +
        '<td style="border:1px solid #000;text-align:center;">' + f.spec + '</td>' +
        '<td style="border:1px solid #000;font-weight:bold;text-align:right;padding-right:4px;">' + (f.madeKg || '0') + ' kg</td>' +
        '<td style="border:1px solid #000;font-weight:bold;text-align:right;padding-right:4px;">' + (f.madeBag || '0') + ' 봉</td>' +
        '<td style="border:1px solid #000;text-align:right;padding-right:4px;">' + (f.shippedKg || '0') + ' kg</td>' +
        '<td style="border:1px solid #000;text-align:right;padding-right:4px;">' + (f.stockKg || '0') + ' kg</td>' +
        '<td style="border:1px solid #000;font-weight:bold;color:#009a44;text-align:center;">' + (f.first20 || '○') + ' (적합)</td>' +
        '</tr>';
    }).join('');

    var prodTitle = (state.finishedItems && state.finishedItems.length) ? state.finishedItems.map(function(f){return f.name;}).join(', ') : '신선편의 가공채소';

    var hasPhotos = state.photos && (state.photos.chlorinePaper || state.photos.lotPrint);
    var photoAttachmentHtml = '';
    if (hasPhotos) {
      photoAttachmentHtml = '<div style="margin-top:8px;border-top:1.5px dashed #000;padding-top:6px;page-break-inside:avoid;">' +
        '<div style="font-weight:bold;font-size:8pt;margin-bottom:4px;color:#003311;">■ [현장 실물 증빙 첨부] 소독수 시험지 및 소비기한/LOT 날인 사진</div>' +
        '<div style="display:flex;gap:8px;justify-content:space-between;">' +
          '<div style="flex:1;border:1px solid #000;padding:4px;text-align:center;background:#fff;">' +
            '<div style="font-weight:bold;font-size:7.5pt;margin-bottom:3px;background:#eef2f6;padding:2px;">1. [CCP-1BC] 소독수 유효염소농도 시험지 확인</div>' +
            (state.photos.chlorinePaper ? '<img src="' + state.photos.chlorinePaper + '" style="max-width:100%;max-height:85mm;object-fit:contain;border:1px solid #cbd5e1;">' : '<div style="height:60px;display:flex;align-items:center;justify-content:center;color:#888;font-size:7.5pt;">(미첨부)</div>') +
          '</div>' +
          '<div style="flex:1;border:1px solid #000;padding:4px;text-align:center;background:#fff;">' +
            '<div style="font-weight:bold;font-size:7.5pt;margin-bottom:3px;background:#eef2f6;padding:2px;">2. [포장/표시사항] 소비기한 / LOT 날인 상태</div>' +
            (state.photos.lotPrint ? '<img src="' + state.photos.lotPrint + '" style="max-width:100%;max-height:85mm;object-fit:contain;border:1px solid #cbd5e1;">' : '<div style="height:60px;display:flex;align-items:center;justify-content:center;color:#888;font-size:7.5pt;">(미첨부)</div>') +
          '</div>' +
        '</div>' +
      '</div>';
    }

    p.innerHTML = '<div style="width:200mm;margin:0 auto;padding:4mm 2mm;font-family:sans-serif;font-size:8.0pt;color:#000;line-height:1.2;">' +
      // 1. Header & Approval Box
      '<div style="display:flex;justify-content:space-between;align-items:stretch;margin-bottom:4px;">' +
        '<div style="flex:1;display:flex;align-items:center;justify-content:center;background:#e8f5e9;border:1.5px solid #000;margin-right:6px;">' +
          '<h1 style="font-size:15pt;font-weight:bold;margin:0;color:#003311;">동김제농협 일일 공정검사일지 (QC 순회·수율)</h1>' +
        '</div>' +
        '<table style="border-collapse:collapse;width:170px;text-align:center;font-size:8pt;border:1.5px solid #000;">' +
          '<tr><th style="border:1px solid #000;background:#eef2f6;width:33%;height:14pt;">작 성</th><th style="border:1px solid #000;background:#eef2f6;width:33%;">검 토</th><th style="border:1px solid #000;background:#eef2f6;width:34%;">승 인</th></tr>' +
          '<tr><td style="border:1px solid #000;height:30pt;font-weight:bold;">' + (state.inspector || '') + '</td><td style="border:1px solid #000;font-weight:bold;">' + (state.confirmer || '') + '</td><td style="border:1px solid #000;font-weight:bold;">' + (state.approver || '') + '</td></tr>' +
        '</table>' +
      '</div>' +

      // 2. Meta Info Box
      '<table style="width:100%;border-collapse:collapse;margin-bottom:4px;font-size:8pt;border:1px solid #000;">' +
        '<tr>' +
          '<td style="border:1px solid #000;background:#eef2f6;font-weight:bold;width:12%;text-align:center;height:14pt;">생산 제품</td><td colspan="2" style="border:1px solid #000;text-align:left;padding-left:4px;font-weight:bold;width:38%;">' + prodTitle + '</td>' +
          '<td style="border:1px solid #000;background:#eef2f6;font-weight:bold;width:14%;text-align:center;">문서번호/코드</td><td style="border:1px solid #000;text-align:center;width:14%;">DKJ-QC-001</td>' +
          '<td style="border:1px solid #000;background:#eef2f6;font-weight:bold;width:11%;text-align:center;">생산일자</td><td style="border:1px solid #000;text-align:center;width:11%;">' + state.workDate + '</td>' +
        '</tr>' +
        '<tr>' +
          '<td style="border:1px solid #000;background:#eef2f6;font-weight:bold;text-align:center;height:14pt;">생산 LOT</td><td colspan="2" style="border:1px solid #000;text-align:center;font-weight:bold;color:#009a44;">' + state.lot + '</td>' +
          '<td style="border:1px solid #000;background:#eef2f6;font-weight:bold;text-align:center;">작업 라인</td><td style="border:1px solid #000;text-align:center;">신선편의 가공라인</td>' +
          '<td style="border:1px solid #000;background:#eef2f6;font-weight:bold;text-align:center;">순회 횟수</td><td style="border:1px solid #000;text-align:center;">1일 3회 크로스체크</td>' +
        '</tr>' +
      '</table>' +

      // 3. 28 Check Items Table (With dynamic round times)
      '<table style="width:100%;border-collapse:collapse;border:1.5px solid #000;margin-bottom:4px;">' +
        '<thead style="background:#009a44;color:#fff;font-size:7.5pt;">' +
          '<tr>' +
            '<th rowspan="2" style="border:1px solid #000;width:7%;">구분</th>' +
            '<th rowspan="2" style="border:1px solid #000;width:10%;">세부공정</th>' +
            '<th rowspan="2" style="border:1px solid #000;width:20%;">관리 점검 항목</th>' +
            '<th rowspan="2" style="border:1px solid #000;width:26%;">관리기준 및 판정규격</th>' +
            '<th colspan="3" style="border:1px solid #000;width:21%;">QC 순회 점검 결과 (일일 3회)</th>' +
            '<th rowspan="2" style="border:1px solid #000;width:16%;">이탈 시 조치사항 / 비고</th>' +
          '</tr>' +
          '<tr>' +
            '<th style="border:1px solid #000;width:7%;background:#007a34;">1차(' + t1 + ')</th>' +
            '<th style="border:1px solid #000;width:7%;background:#007a34;">2차(' + t2 + ')</th>' +
            '<th style="border:1px solid #000;width:7%;background:#007a34;">3차(' + t3 + ')</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + checkRowsHtml + '</tbody>' +
      '</table>' +

      // 4. Raw Material In/Out/Waste/Yield Table
      '<div style="background:#eef2f6;border:1px solid #000;border-bottom:none;padding:2px 6px;font-weight:bold;font-size:7.5pt;color:#003311;">■ [생산일지 연계] 원료별 입고량 · 출고(사용)량 · 폐기량 · 실적수율 및 추적성 관리</div>' +
      '<table style="width:100%;border-collapse:collapse;border:1.5px solid #000;margin-bottom:4px;font-size:7.5pt;">' +
        '<thead style="background:#009a44;color:#fff;">' +
          '<tr>' +
            '<th style="border:1px solid #000;width:10%;">원료구분</th><th style="border:1px solid #000;width:20%;">원재료명</th><th style="border:1px solid #000;width:12%;">배합비(BOM)</th>' +
            '<th style="border:1px solid #000;width:13%;">입고량 (kg)</th><th style="border:1px solid #000;width:13%;">출고·사용량(kg)</th><th style="border:1px solid #000;width:13%;">폐기량 (kg)</th>' +
            '<th style="border:1px solid #000;width:11%;">실적수율(%)</th><th style="border:1px solid #000;width:8%;">성상</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + matRowsHtml + '</tbody>' +
      '</table>' +

      // 5. Finished Goods Output Table (Multi-Products)
      '<div style="background:#eef2f6;border:1px solid #000;border-bottom:none;padding:2px 6px;font-weight:bold;font-size:7.5pt;color:#003311;">■ [완제품 생산실적] 당일 제품 생산량 · 완제품 출고량 · 재고 및 관능/첫20팩 점검</div>' +
      '<table style="width:100%;border-collapse:collapse;border:1.5px solid #000;margin-bottom:4px;font-size:7.5pt;text-align:center;">' +
        '<thead style="background:#009a44;color:#fff;">' +
          '<tr><th colspan="2" style="border:1px solid #000;width:24%;">생산 완제품명</th><th style="border:1px solid #000;width:12%;">포장 규격</th><th style="border:1px solid #000;width:14%;">제품 생산량(kg)</th><th style="border:1px solid #000;width:14%;">생산수량(봉/EA)</th><th style="border:1px solid #000;width:14%;">당일 출고량(kg)</th><th style="border:1px solid #000;width:11%;">현재고(kg)</th><th style="border:1px solid #000;width:11%;">첫 20팩 검사</th></tr>' +
        '</thead>' +
        '<tbody>' + prodRowsHtml + '</tbody>' +
      '</table>' +

      // 6. Bottom Notice & Deviations Record
      '<div style="border:1.5px solid #000;padding:4px 6px;font-size:7.5pt;background:#fffee6;line-height:1.3;">' +
        '<div><strong>★ [QC 중점관리]</strong> 가공 시작 시 첫 20팩은 외관·이물·실링·날인 100% 전수 확인 완료 (○)</div>' +
        '<div style="margin-top:2px;"><strong>특이사항 / 이탈 및 조치기록:</strong> ' + (state.deviationNotes || state.remarkPreset || '이상 없음 / 정상 가동') + '</div>' +
      '</div>' +
      photoAttachmentHtml +
      '</div>';
  }

  function bind() {
    if ($('workDate')) {
      $('workDate').addEventListener('change', function () {
        var d = $('workDate').value || todayStr();
        if ($('lot')) $('lot').value = makeLot(d);
        scheduleDraft();
      });
    }

    // Round Time Pickers (1차, 2차, 3차)
    ['1', '2', '3'].forEach(function (num) {
      var inp = $('roundTime' + num);
      if (inp) {
        inp.addEventListener('change', function () {
          state.roundTimes['r' + num] = inp.value || '09:00';
          updateRoundTimeLabels();
          scheduleDraft();
        });
      }
    });

    // Set Now Quick Buttons (🕒 지금시각)
    document.querySelectorAll('[data-set-now]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var num = btn.getAttribute('data-set-now');
        var cur = nowTimeStr();
        state.roundTimes['r' + num] = cur;
        updateRoundTimeLabels();
        scheduleDraft();
      });
    });

    // Add Product Row Button
    if ($('btnAddProductRow')) {
      $('btnAddProductRow').addEventListener('click', function () {
        if (state.locked) return;
        var unselected = PRODUCTS.find(function (p) {
          return !(state.finishedItems || []).some(function (f) { return f.code === p.code || f.name === p.name; });
        }) || PRODUCTS[0];

        state.finishedItems.push({
          code: unselected.code,
          name: unselected.name,
          spec: unselected.spec,
          madeKg: '',
          madeBag: '',
          shippedKg: '',
          stockKg: '',
          first20: 'O'
        });

        syncMaterialsFromProducts();
        renderProductChips();
        renderFinishedGoodsTable();
        renderMaterialsTable();
        scheduleDraft();
      });
    }

    // Add Raw Material Row Button
    if ($('btnAddMatRow')) {
      $('btnAddMatRow').addEventListener('click', function () {
        if (state.locked) return;
        state.materials.push({
          name: '추가 원자재',
          ratio: '—',
          supplier: '협력사',
          inKg: '',
          usedKg: '',
          wasteKg: '',
          yieldRate: ''
        });
        renderMaterialsTable();
        scheduleDraft();
      });
    }

    if ($('btnBulkR1')) {
      $('btnBulkR1').addEventListener('click', function () {
        if (state.locked) return;
        CHECK_ITEMS.forEach(function (it) {
          state.checks.r1[it.key] = it.defaultVal;
        });
        renderMainCheckTable();
        checkDeviations();
        scheduleDraft();
        setStatus('1차 전체 채움 완료', true);
      });
    }

    if ($('btnBulkR2')) {
      $('btnBulkR2').addEventListener('click', function () {
        if (state.locked) return;
        CHECK_ITEMS.forEach(function (it) {
          state.checks.r2[it.key] = it.defaultVal;
        });
        renderMainCheckTable();
        checkDeviations();
        scheduleDraft();
        setStatus('2차 전체 채움 완료', true);
      });
    }

    if ($('btnBulkR3')) {
      $('btnBulkR3').addEventListener('click', function () {
        if (state.locked) return;
        CHECK_ITEMS.forEach(function (it) {
          state.checks.r3[it.key] = it.defaultVal;
        });
        renderMainCheckTable();
        checkDeviations();
        scheduleDraft();
        setStatus('3차 전체 채움 완료', true);
      });
    }

    if ($('btnSave')) $('btnSave').addEventListener('click', function () { save(false); });
    if ($('btnLock')) $('btnLock').addEventListener('click', function () { save(true); });
    if ($('btnNew')) {
      $('btnNew').addEventListener('click', function () {
        editingId = null;
        state = emptyState();
        writeForm();
        setStatus('새 일보', false);
      });
    }

    if ($('btnPrint')) {
      $('btnPrint').addEventListener('click', function () {
        buildPrintSheet();
        window.print();
      });
    }

    ['workDate', 'lot', 'inspector', 'remarkPreset', 'deviationNotes', 'confirmer', 'approver'].forEach(function (id) {
      var el = $(id);
      if (el) {
        el.addEventListener('input', scheduleDraft);
        el.addEventListener('change', scheduleDraft);
      }
    });

    if (window.DkjApproval) {
      apvUi = DkjApproval.mount({
        stages: ['writer', 'reviewer', 'approver'],
        getState: function () { readForm(); return state; },
        onChange: function () { scheduleDraft(); }
      });
    }
  }

  function init() {
    var draft = DkjRecordStore.loadDraft(FORM_ID);
    if (draft) {
      state = Object.assign(emptyState(), draft);
    } else {
      state.workDate = todayStr();
      state.lot = makeLot(state.workDate);
    }
    
    // DKJ-QC-001 전용 결재선 고정: 작성(최민재), 검토(권화선), 승인(최재원)
    state.inspector = state.inspector || '최민재';
    state.confirmer = state.confirmer || '권화선';
    state.approver = state.approver || '최재원';
    if (state.approver === '최민재' && state.inspector === '최민재') {
      state.approver = '최재원';
    }
    state.approvals = {
      writer: state.inspector,
      reviewer: state.confirmer,
      approver: state.approver
    };

    writeForm();
    bind();
    renderHistory();

    // staff picker 변환 후에도 DKJ-QC-001 전용 값 강제 동기화
    setTimeout(function () {
      if ($('inspector')) $('inspector').value = state.inspector;
      if ($('confirmer')) $('confirmer').value = state.confirmer;
      if ($('approver')) $('approver').value = state.approver;
      if (apvUi) apvUi.render();
    }, 50);

    setStatus('준비 완료', false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})(window);

