/**
 * DKJ-H-01-01 CCP-1BC 소독·헹굼공정 점검표
 * 코엔에프 CONF-H-01-03 구조 벤치마크 → 동김제 신선편의 CCP
 */
(async function () {
  'use strict';

  var FORM_ID = 'DKJ-H-01-01';
  var state = emptyState();
  var editingId = null;
  var draftTimer = null;

  var PRODUCT_PRESETS = [
    '농협 샐러드 채소믹스, 샐러디아 샐러드 채소믹스',
    '농협 샐러드 채소믹스',
    '샐러디아 샐러드 채소믹스',
    '양상추 샐러드',
    '슬로우캘리 샐러드믹스',
    '급식(바로먹는 유러피언 샐러드 채소믹스)'
  ];

  var PPM_PRESETS = ['200', '210', '220', '230', '240', '250', '260', '270', '280', '290', '300'];
  var SOAK_PRESETS = ['20', '22', '24', '25', '26', '28', '30'];
  var RINSE_SEC_PRESETS = ['50', '52', '54', '55', '56', '58', '60'];
  var RESIDUAL_CL_PRESETS = ['0', '0.05', '0.1', '0.5', '1', '1.5', '2'];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function dateToLot(d) {
    if (!d) return '';
    return String(d).replace(/[^0-9]/g, '');
  }

  function emptyRow() {
    return {
      time: '', productName: '', rawMaterialKg: '', ppm: '', soak: '', rinseSec: '', residualCl: '', judge: '',
      isCustomPpm: false, isCustomSoak: false, isCustomRinseSec: false, isCustomResidualCl: false, isCustomProduct: false,
      // paper(시험지)로 실측한 유효염소·잔류염소 결과를 사진으로 남긴다(측정행당 1장).
      // 인쇄 시 맨 뒤에 별첨으로 붙는다 — ccp1bc() 의 photoAttachmentHtml 참고.
      photo: null,
      // 최근기록 복사로 따라온 사진이면 true — 전일 증빙이라 화면에 '전일 사진' 배지를 띄운다(화면 전용).
      photoCarried: false
    };
  }

  function emptyState() {
    var td = today();
    return {
      workDate: td,
      disinfectant: 'NaOCl',
      productName: '',
      rawMaterialKg: '',
      preWorkPpm: '',
      lot: dateToLot(td),
      preWorkTime: '',
      waterChangeTimes: '08:00, 11:00, 14:00',
      changeTimes: ['08:00', '11:00', '14:00'],
      clMin: 200,
      clMax: 300,
      timeMin: 20,
      monitorName: '',
      rows: [emptyRow(), emptyRow(), emptyRow()],
      // 해당 없음은 '-' 로 미리 채워 둔다(이탈이 있을 때만 작업자가 고쳐 쓴다).
      deviation: '-',
      corrective: '-',
      confirmer: '',
      approver: '',
      remark: '',
      approvals: { writer: '', reviewer: '', approver: '' },
      signoff: {},
      audit: [],
      locked: false,
      hasDeviation: false
    };
  }

  /* 전자결재 패널 — 모듈이 없으면 그냥 건너뛴다 */
  var apvUi = null;

  function syncApprovals() {
    if (!window.DkjApproval) return;
    DkjApproval.bindFlat(state, { writer: 'monitorName', reviewer: 'confirmer', approver: 'approver' });
  }

  function mountApproval() {
    if (!window.DkjApproval || apvUi) return;
    apvUi = DkjApproval.mount({
      // 한 번도 저장 안 한 새 시트에서 결재를 누르면 먼저 저장한다(검증 포함) — 안 그러면 서명이
      // 이 기기 임시본에만 남아 다른 기기의 검토·승인자에게 보이지 않았다(2026-10-23 점검).
      ensureSaved: async function () { if (!editingId) (await save(false)); return !!editingId; },
      stages: ['writer', 'reviewer', 'approver'],
      getState: function () { readForm(); return state; },
      // 결재 서명은 임시저장(이 기기에만 남고 클라우드 동기화 안 됨)이 아니라
      // 실제 저장 레코드에 바로 반영해야 다른 기기·다른 사람에게도 보인다.
      onChange: async function () {
        // 결재 저장은 DkjApproval.persistSign 한 곳에서 한다 — 잠긴 기록은 서명·이력만 덧붙이고,
        // 잠기지 않은 기록은 이 서식의 저장(검증·제목·판정 계산 포함)을 그대로 거친다.
        if (await window.DkjApproval.persistSign(FORM_ID, editingId, state, function () { return save(false); })) {
          setStatus('결재 저장됨 · ' + new Date().toLocaleTimeString('ko-KR'), true);
          (await renderHistory());
        } else {
          scheduleDraft();
        }
      }
    });
  }

  function refreshApproval() {
    if (apvUi) apvUi.render();
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function nowTime() {
    var d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function $(id) { return document.getElementById(id); }

  function setStatus(msg, saved) {
    var el = $('saveStatus');
    if (!el) return;
    el.innerHTML = '<span class="dot"></span> ' + msg;
    el.className = 'dkj-status' + (saved ? ' saved' : '');
  }

  function withinCl(ppm) {
    var n = parseFloat(ppm);
    if (isNaN(n)) return null;
    return n >= Number(state.clMin) && n <= Number(state.clMax);
  }

  function soakOk(sec) {
    var n = parseFloat(sec);
    if (isNaN(n)) return null;
    return n >= Number(state.timeMin) && n <= 30;
  }

  function rinseSecOk(sec) {
    var n = parseFloat(sec);
    if (isNaN(n)) return null;
    return n >= 50 && n <= 60;
  }

  function residualClOk(ppm) {
    var n = parseFloat(ppm);
    if (isNaN(n)) return null;
    return n < 4;
  }

  function evaluateRow(row) {
    var cl = withinCl(row.ppm);
    var sk = soakOk(row.soak);
    var rt = rinseSecOk(row.rinseSec);
    var rc = residualClOk(row.residualCl);
    if (cl === null && sk === null && rt === null && rc === null) {
      row.judge = '';
      return;
    }
    if (cl === false || sk === false || rt === false || rc === false) row.judge = 'X';
    else if (cl === true && sk === true && rt === true && rc === true) row.judge = 'O';
    else row.judge = row.judge || '';
  }

  function refreshDeviation() {
    state.hasDeviation = state.rows.some(function (r) { return r.judge === 'X'; }) || withinCl(state.preWorkPpm) === false;
    var ban = $('deviationBanner');
    if (ban) ban.hidden = !state.hasDeviation;
  }

  function buildPpmCell(row, i) {
    var clBad = withinCl(row.ppm) === false;
    var isCustom = row.isCustomPpm || (row.ppm && PPM_PRESETS.indexOf(String(row.ppm)) === -1);
    
    if (isCustom) {
      return '<div class="mon-select-group">' +
        '<input type="number" class="mon-in' + (clBad ? ' bad' : '') + '" data-f="ppm" step="1" min="0" value="' + (row.ppm || '') + '" placeholder="ppm">' +
        '<button type="button" class="mon-mode-btn" data-toggle-ppm="' + i + '" title="드롭다운 목록으로 선택">📋</button>' +
        '</div>';
    }

    var opts = '<option value="">선택</option>';
    PPM_PRESETS.forEach(function (v) {
      var sel = String(row.ppm) === v ? ' selected' : '';
      var label = v + ' ppm';
      opts += '<option value="' + v + '"' + sel + '>' + label + '</option>';
    });
    opts += '<option value="__custom__">✏️ 직접입력</option>';

    return '<div class="mon-select-group">' +
      '<select class="mon-in' + (clBad ? ' bad' : '') + '" data-f="ppm-sel">' + opts + '</select>' +
      '<button type="button" class="mon-mode-btn" data-toggle-ppm="' + i + '" title="직접 입력으로 전환">✏️</button>' +
      '</div>';
  }

  function buildSoakCell(row, i) {
    var skBad = soakOk(row.soak) === false;
    var isCustom = row.isCustomSoak || (row.soak && SOAK_PRESETS.indexOf(String(row.soak)) === -1);

    if (isCustom) {
      return '<div class="mon-select-group">' +
        '<input type="number" class="mon-in' + (skBad ? ' bad' : '') + '" data-f="soak" step="1" min="0" value="' + (row.soak || '') + '" placeholder="초">' +
        '<button type="button" class="mon-mode-btn" data-toggle-soak="' + i + '" title="드롭다운 목록으로 선택">📋</button>' +
        '</div>';
    }

    var opts = '<option value="">선택</option>';
    SOAK_PRESETS.forEach(function (v) {
      var sel = String(row.soak) === v ? ' selected' : '';
      var label = v + '초' + (v === '20' ? ' (하한)' : (v === '25' ? ' (표준)' : (v === '30' ? ' (상한)' : '')));
      opts += '<option value="' + v + '"' + sel + '>' + label + '</option>';
    });
    opts += '<option value="__custom__">✏️ 직접입력</option>';

    return '<div class="mon-select-group">' +
      '<select class="mon-in' + (skBad ? ' bad' : '') + '" data-f="soak-sel">' + opts + '</select>' +
      '<button type="button" class="mon-mode-btn" data-toggle-soak="' + i + '" title="직접 입력으로 전환">✏️</button>' +
      '</div>';
  }

  function buildRinseSecCell(row, i) {
    var rtBad = rinseSecOk(row.rinseSec) === false;
    var isCustom = row.isCustomRinseSec || (row.rinseSec && RINSE_SEC_PRESETS.indexOf(String(row.rinseSec)) === -1);

    if (isCustom) {
      return '<div class="mon-select-group">' +
        '<input type="number" class="mon-in' + (rtBad ? ' bad' : '') + '" data-f="rinseSec" step="1" min="0" value="' + (row.rinseSec || '') + '" placeholder="초">' +
        '<button type="button" class="mon-mode-btn" data-toggle-rinseSec="' + i + '" title="드롭다운 목록으로 선택">📋</button>' +
        '</div>';
    }

    var opts = '<option value="">선택</option>';
    RINSE_SEC_PRESETS.forEach(function (v) {
      var sel = String(row.rinseSec) === v ? ' selected' : '';
      var label = v + '초';
      opts += '<option value="' + v + '"' + sel + '>' + label + '</option>';
    });
    opts += '<option value="__custom__">✏️ 직접입력</option>';

    return '<div class="mon-select-group">' +
      '<select class="mon-in' + (rtBad ? ' bad' : '') + '" data-f="rinseSec-sel">' + opts + '</select>' +
      '<button type="button" class="mon-mode-btn" data-toggle-rinseSec="' + i + '" title="직접 입력으로 전환">✏️</button>' +
      '</div>';
  }

  function buildResidualClCell(row, i) {
    var rcBad = residualClOk(row.residualCl) === false;
    var isCustom = row.isCustomResidualCl || (row.residualCl && RESIDUAL_CL_PRESETS.indexOf(String(row.residualCl)) === -1);

    if (isCustom) {
      return '<div class="mon-select-group">' +
        '<input type="text" inputmode="decimal" class="mon-in' + (rcBad ? ' bad' : '') + '" data-f="residualCl" value="' + (row.residualCl || '') + '" placeholder="ppm">' +
        '<button type="button" class="mon-mode-btn" data-toggle-residualCl="' + i + '" title="드롭다운 목록으로 선택">📋</button>' +
        '</div>';
    }

    var opts = '<option value="">선택</option>';
    RESIDUAL_CL_PRESETS.forEach(function (v) {
      var sel = String(row.residualCl) === v ? ' selected' : '';
      var label = v + ' ppm' + (v === '0' ? ' (양호)' : '');
      opts += '<option value="' + v + '"' + sel + '>' + label + '</option>';
    });
    opts += '<option value="__custom__">✏️ 직접입력</option>';

    return '<div class="mon-select-group">' +
      '<select class="mon-in' + (rcBad ? ' bad' : '') + '" data-f="residualCl-sel">' + opts + '</select>' +
      '<button type="button" class="mon-mode-btn" data-toggle-residualCl="' + i + '" title="직접 입력으로 전환">✏️</button>' +
      '</div>';
  }

  /** 유효염소·잔류염소를 시험지로 실측한 결과를 사진으로 남기는 칸(측정행당 1장).
   *  촬영본은 dkj-util.js 의 compressImageToDataUrl 로 압축해 그대로 상태에 저장한다
   *  (별도 서버가 없는 구조라 여기 dataURL 이 정본). 인쇄 시 맨 뒤 별첨으로도 나간다
   *  — dkj-print-official.js 의 ccp1bc() 참고. */
  function buildPhotoCell(row, i) {
    if (row.photo) {
      return '<div class="dkj-photo-thumb-wrap">' +
        '<img src="' + row.photo + '" class="dkj-photo-thumb" data-view-photo="' + i + '" title="클릭하여 원본보기">' +
        (row.photoCarried ? '<span class="dkj-photo-carried" title="최근기록 복사로 가져온 이전 사진입니다. 오늘 촬영본으로 바꾸세요.">전일</span>' : '') +
        '<button type="button" class="dkj-photo-del" data-del-photo="' + i + '" title="사진 삭제">✕</button>' +
        '</div>';
    }
    return '<label class="dkj-photo-cam-btn" title="시험지 촬영">📷' +
      '<input type="file" accept="image/*" capture="environment" data-photo-inp="' + i + '">' +
      '</label>';
  }

  function buildProductCell(row, i) {
    if (row.productName && PRODUCT_PRESETS.indexOf(row.productName) === -1) row.isCustomProduct = true;
    if (row.isCustomProduct) {
      return '<div class="mon-select-group"><input type="text" class="mon-in" data-f="productName" value="' + esc(row.productName || '') + '" placeholder="품목명 입력"><button type="button" class="mon-mode-btn" data-toggle-product="' + i + '" title="목록 선택">📋</button></div>';
    }
    var opts = '<option value="">품목 선택</option>';
    PRODUCT_PRESETS.forEach(function (name) { opts += '<option value="' + esc(name) + '"' + (row.productName === name ? ' selected' : '') + '>' + esc(name) + '</option>'; });
    opts += '<option value="__custom__">직접 입력</option>';
    return '<select class="mon-in" data-f="productName-sel">' + opts + '</select>';
  }

  function buildPreWorkPpmCell() {
    var opts = '<option value="">선택</option>';
    PPM_PRESETS.forEach(function (v) { opts += '<option value="' + v + '"' + (String(state.preWorkPpm) === v ? ' selected' : '') + '>' + v + ' ppm</option>'; });
    return '<select class="mon-in" data-f="preWorkPpm-sel">' + opts + '</select>';
  }

  function renderRows() {
    var body = $('monBody');
    if (!body) return;
    var preWorkRow = '<tr class="prework-row" data-i="-1">' +
      '<td><input type="time" class="mon-in" data-f="time" data-prework="1" value="' + esc(state.preWorkTime || '') + '"></td>' +
      '<td class="c strong">작업 시작 전 확인</td><td class="c">-</td>' +
      '<td>' + buildPreWorkPpmCell() + '</td>' +
      '<td class="c">-</td><td class="c">-</td><td class="c">-</td><td class="c">-</td><td class="c">-</td><td class="c">-</td></tr>';
    body.innerHTML = preWorkRow + state.rows.map(function (row, i) {
      evaluateRow(row);
      return '<tr data-i="' + i + '">' +
        '<td><input type="time" class="mon-in" data-f="time" value="' + (row.time || '') + '"></td>' +
        '<td>' + buildProductCell(row, i) + '</td>' +
        '<td><input type="number" class="mon-in" data-f="rawMaterialKg" min="0" max="7.99" step="0.01" inputmode="decimal" aria-label="원물 투입량(kg)" placeholder="kg" value="' + esc(row.rawMaterialKg == null ? '' : row.rawMaterialKg) + '"></td>' +
        '<td>' + buildPpmCell(row, i) + '</td>' +
        '<td>' + buildSoakCell(row, i) + '</td>' +
        '<td>' + buildRinseSecCell(row, i) + '</td>' +
        '<td>' + buildResidualClCell(row, i) + '</td>' +
        '<td class="mon-judge ' + (row.judge === 'X' ? 'ng' : row.judge === 'O' ? 'ok' : '') + '">' + (row.judge || '·') + '</td>' +
        '<td class="dkj-photo-cell">' + buildPhotoCell(row, i) + '</td>' +
        '<td><button type="button" class="pill-btn ghost mon-del" data-del="' + i + '">삭제</button></td></tr>';
    }).join('');
    body.querySelectorAll('.mon-in').forEach(function (inp) {
      inp.addEventListener('change', onRowInput);
      inp.addEventListener('input', onRowInput);
    });
    body.querySelectorAll('[data-toggle-product]').forEach(function (btn) {
      btn.addEventListener('click', function () { if (state.locked) return; var i = Number(btn.getAttribute('data-toggle-product')); state.rows[i].isCustomProduct = false; state.rows[i].productName = ''; renderRows(); });
    });
    body.querySelectorAll('[data-toggle-ppm]').forEach(function (btn) { btn.addEventListener('click', function () { if (state.locked) return; var i = Number(btn.getAttribute('data-toggle-ppm')); state.rows[i].isCustomPpm = !state.rows[i].isCustomPpm; renderRows(); scheduleDraft(); }); });
    body.querySelectorAll('[data-toggle-soak]').forEach(function (btn) { btn.addEventListener('click', function () { if (state.locked) return; var i = Number(btn.getAttribute('data-toggle-soak')); state.rows[i].isCustomSoak = !state.rows[i].isCustomSoak; renderRows(); scheduleDraft(); }); });
    body.querySelectorAll('[data-toggle-rinseSec]').forEach(function (btn) { btn.addEventListener('click', function () { if (state.locked) return; var i = Number(btn.getAttribute('data-toggle-rinseSec')); state.rows[i].isCustomRinseSec = !state.rows[i].isCustomRinseSec; renderRows(); scheduleDraft(); }); });
    body.querySelectorAll('[data-toggle-residualCl]').forEach(function (btn) { btn.addEventListener('click', function () { if (state.locked) return; var i = Number(btn.getAttribute('data-toggle-residualCl')); state.rows[i].isCustomResidualCl = !state.rows[i].isCustomResidualCl; renderRows(); scheduleDraft(); }); });
    body.querySelectorAll('[data-del]').forEach(function (btn) { btn.addEventListener('click', function () { if (state.locked) return; state.rows.splice(Number(btn.getAttribute('data-del')), 1); if (!state.rows.length) state.rows.push(emptyRow()); renderRows(); scheduleDraft(); }); });
    body.querySelectorAll('[data-photo-inp]').forEach(function (inp) { inp.addEventListener('change', function () { if (state.locked) return; var i = Number(inp.getAttribute('data-photo-inp')); var file = inp.files && inp.files[0]; if (!file) return; var apply = function (dataUrl) { state.rows[i].photo = dataUrl; state.rows[i].photoCarried = false; renderRows(); scheduleDraft(); }; if (window.DkjUtil && window.DkjUtil.compressImageToDataUrl) window.DkjUtil.compressImageToDataUrl(file, apply, { maxDim: 600, quality: 0.5 }); else { var reader = new FileReader(); reader.onload = function (e) { apply(e.target.result); }; reader.readAsDataURL(file); } }); });
    body.querySelectorAll('[data-view-photo]').forEach(function (img) { img.addEventListener('click', function () { var i = Number(img.getAttribute('data-view-photo')); var photo = state.rows[i] && state.rows[i].photo; if (photo) window.open(photo); }); });
    body.querySelectorAll('[data-del-photo]').forEach(function (btn) { btn.addEventListener('click', function () { if (state.locked) return; var i = Number(btn.getAttribute('data-del-photo')); state.rows[i].photo = null; state.rows[i].photoCarried = false; renderRows(); scheduleDraft(); }); });
    refreshDeviation(); renderPhotoAppendix();
  }

  /** 화면 하단 "④ 별첨 — 소독수 시험지 사진" 갤러리. 인쇄본의 별첨 표(ccp1bc())와
   *  같은 사진·같은 순서를 보여준다 — 화면에서 본 것과 인쇄물이 달라 보이면 안 된다. */
  function renderPhotoAppendix() {
    var host = $('photoAppendix');
    if (!host) return;
    var withPhoto = state.rows.filter(function (r) { return r.photo; });
    if (!withPhoto.length) {
      host.innerHTML = '<p class="dkj-photo-empty">촬영된 시험지 사진이 없습니다. 위 ② 모니터링 표의 📷 버튼으로 측정행마다 촬영하세요.</p>';
      return;
    }
    host.innerHTML = '<div class="dkj-photo-gallery">' + withPhoto.map(function (r) {
      var cap = '시각 ' + (r.time || '-') + ' · 유효염소 ' + (r.ppm || '-') + 'ppm · 잔류염소 ' + (r.residualCl || '-') + 'ppm · 판정 ' + (r.judge || '-');
      return '<div class="dkj-photo-card">' +
        '<img src="' + r.photo + '" onclick="window.open(this.src)" title="클릭하여 원본보기">' +
        '<div class="dkj-photo-card-cap">' + esc(cap) + '</div>' +
        '</div>';
    }).join('') + '</div>';
  }

  function onRowInput(e) {
    if (state.locked) return;
    var tr = e.target.closest('tr');
    if (!tr) return;
    var i = Number(tr.getAttribute('data-i'));
    var f = e.target.getAttribute('data-f');
    if (i < 0) {
      if (f === 'time') state.preWorkTime = e.target.value;
      else if (f === 'preWorkPpm-sel') state.preWorkPpm = e.target.value;
      refreshDeviation(); scheduleDraft();
      if (e.type === 'change') renderRows();
      return;
    }
    var row = state.rows[i];
    if (!row) return;
    if (f === 'productName-sel') {
      if (e.target.value === '__custom__') { row.isCustomProduct = true; }
      else { row.isCustomProduct = false; row.productName = e.target.value; }
    } else if (f === 'ppm-sel') {
      if (e.target.value === '__custom__') row.isCustomPpm = true;
      else { row.isCustomPpm = false; row.ppm = e.target.value; }
    } else if (f === 'soak-sel') {
      if (e.target.value === '__custom__') row.isCustomSoak = true;
      else { row.isCustomSoak = false; row.soak = e.target.value; }
    } else if (f === 'rinseSec-sel') {
      if (e.target.value === '__custom__') row.isCustomRinseSec = true;
      else { row.isCustomRinseSec = false; row.rinseSec = e.target.value; }
    } else if (f === 'residualCl-sel') {
      if (e.target.value === '__custom__') row.isCustomResidualCl = true;
      else { row.isCustomResidualCl = false; row.residualCl = e.target.value; }
    } else if (f) { row[f] = e.target.value; }
    if (e.type === 'input' && (f === 'residualCl' || f === 'productName' || f === 'rawMaterialKg')) {
      evaluateRow(row); refreshDeviation(); scheduleDraft(); return;
    }
    renderRows(); scheduleDraft();
  }

  function syncProductUi() {
    var pSel = $('productSelect');
    var pInp = $('productName');
    var val = (state.productName || '').trim();

    if (pSel) {
      var matched = false;
      for (var i = 0; i < pSel.options.length; i++) {
        if (pSel.options[i].value === val) {
          pSel.selectedIndex = i;
          matched = true;
          break;
        }
      }
      if (!matched) {
        pSel.value = val ? '__custom__' : '';
      }
    }

    if (pInp) {
      if (pSel && pSel.value === '__custom__') {
        pInp.style.display = 'block';
      } else {
        pInp.style.display = 'none';
      }
      pInp.value = val;
    }

    // Chip active states
    var host = $('productChips');
    if (host) {
      host.querySelectorAll('[data-prod]').forEach(function (chip) {
        var pVal = chip.getAttribute('data-prod');
        if (pVal === val) {
          chip.classList.add('active');
        } else if (pVal.indexOf(',') === -1 && val.indexOf(',') !== -1 && val.indexOf(pVal) !== -1) {
          chip.classList.add('active');
        } else {
          chip.classList.remove('active');
        }
      });
    }
  }

  /** state.changeTimes(배열)가 정본이고, state.waterChangeTimes(콤마 문자열)는
   *  저장·인쇄(ccp1bc())가 읽는 파생값이다 — 구조를 바꾸지 않고 계속 쓰려고
   *  둘을 함께 맞춘다. 옛 기록은 changeTimes 가 없으므로 문자열에서 되살린다. */
  function ensureChangeTimes() {
    if (!Array.isArray(state.changeTimes) || !state.changeTimes.length) {
      var fromStr = (state.waterChangeTimes || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      state.changeTimes = fromStr.length ? fromStr : [''];
    }
  }

  function syncWaterChangeTimesString() {
    state.waterChangeTimes = state.changeTimes.filter(Boolean).join(', ');
  }

  /** 소독액·헹굼수 교체 시각 — 하루 1~2회로 들쭉날쭉해서 칸을 자유롭게
   *  늘리고 줄일 수 있게 한다. 각 칸은 type=time 이라 탭하면 시계 picker 가 뜬다. */
  function renderChangeTimeList() {
    var host = $('changeTimeList');
    if (!host) return;
    ensureChangeTimes();

    host.innerHTML = state.changeTimes.map(function (t, i) {
      return '<div style="display:flex;gap:8px;align-items:center;">' +
        '<input type="time" class="mon-in" data-ct="' + i + '" value="' + esc(t) + '" style="flex:1;min-width:140px;max-width:220px;">' +
        (state.changeTimes.length > 1
          ? '<button type="button" class="pill-btn ghost" data-ct-del="' + i + '">삭제</button>'
          : '') +
        '</div>';
    }).join('');

    host.querySelectorAll('[data-ct]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        if (state.locked) return;
        var i = Number(inp.getAttribute('data-ct'));
        state.changeTimes[i] = inp.value;
        syncWaterChangeTimesString();
        scheduleDraft();
      });
    });
    host.querySelectorAll('[data-ct-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var i = Number(btn.getAttribute('data-ct-del'));
        state.changeTimes.splice(i, 1);
        if (!state.changeTimes.length) state.changeTimes = [''];
        syncWaterChangeTimesString();
        renderChangeTimeList();
        scheduleDraft();
      });
    });
  }

  function readForm() {
    state.workDate = $('workDate').value;
    state.disinfectant = $('disinfectant').value;
    state.productName = Array.from(new Set((state.rows || []).map(function (r) { return (r.productName || '').trim(); }).filter(Boolean))).join(', ');
    // 원물 투입량은 측정행별로만 입력한다. 총량은 행 합계로 계산해 다른 화면이 읽는 값을 유지한다.
    var kgSum = 0, kgAny = false;
    (state.rows || []).forEach(function (r) {
      var n = parseFloat(r.rawMaterialKg);
      if (!isNaN(n)) { kgSum += n; kgAny = true; }
    });
    state.rawMaterialKg = kgAny ? String(Math.round(kgSum * 100) / 100) : '';
    state.lot = $('lot').value.trim();
    state.clMin = Number($('clMin').value) || 0;
    state.clMax = Number($('clMax').value) || 0;
    state.timeMin = Number($('timeMin').value) || 0;
    state.monitorName = $('monitorName').value;
    state.deviation = $('deviation').value;
    state.corrective = $('corrective').value;
    state.confirmer = $('confirmer').value;
    state.approver = $('approver').value;
    state.remark = $('remark').value;
    syncApprovals();
  }

  function writeForm() {
    $('workDate').value = state.workDate || today();
    $('disinfectant').value = state.disinfectant || 'NaOCl';
    $('lot').value = state.lot || dateToLot(state.workDate || today());
    $('clMin').value = state.clMin;
    $('clMax').value = state.clMax;
    $('timeMin').value = state.timeMin;
    $('monitorName').value = state.monitorName || '';
    $('deviation').value = state.deviation || '';
    $('corrective').value = state.corrective || '';
    $('confirmer').value = state.confirmer || '';
    $('approver').value = state.approver || '';
    $('remark').value = state.remark || '';

    syncProductUi();
    renderChangeTimeList();

    if (!state.rows || !state.rows.length) state.rows = [emptyRow()];
    if (state.productName && !state.rows.some(function (r) { return (r.productName || '').trim(); })) {
      state.rows[0].productName = state.productName;
      state.rows[0].isCustomProduct = PRODUCT_PRESETS.indexOf(state.productName) === -1;
    }
    renderRows();
    syncApprovals();
    refreshApproval();
  }

  function scheduleDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(async function () {
      readForm();
      (await DkjRecordStore.saveDraft(FORM_ID, state));
      setStatus('임시저장 ' + new Date().toLocaleTimeString(), false);
    }, 400);
  }

  function validate() {
    readForm();
    state.rows.forEach(evaluateRow);
    refreshDeviation();
    if (!state.workDate) return '작업일자를 입력하세요.';
    if (!(state.rows || []).some(function (r) { return (r.productName || '').trim(); })) return '모니터링 행에서 품목을 선택하세요.';
    if (!state.lot) return 'LOT를 입력하세요.';
    if (!state.monitorName) return '모니터링 담당자를 입력하세요.';
    var invalidRowQuantity = (state.rows || []).some(function (r) {
      var value = r.rawMaterialKg;
      return value !== '' && value != null && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) >= 8);
    });
    if (invalidRowQuantity) return '행별 원물 투입량은 0 이상 8kg 미만으로 입력하세요.';
    var filled = state.rows.filter(function (r) { return r.ppm || r.soak || r.rinseSec || r.residualCl; });
    if (!filled.length && !state.preWorkPpm) return '모니터링 측정값을 1건 이상 입력하세요.';
    if (state.hasDeviation) {
      if (!(state.deviation || '').trim() || /^(-|해당\s*없음)$/.test(state.deviation.trim())) {
        return '한계기준 이탈 시 이탈 내용을 기록하세요.';
      }
      if (!(state.corrective || '').trim() || /^(-|해당\s*없음)$/.test(state.corrective.trim())) {
        return '이탈 시 시정조치를 기록하세요.';
      }
    }
    return '';
  }

  var saveInFlight = false;
  async function save(lock) {
    if (saveInFlight) return;
    saveInFlight = true;
    try {
      var err;
      try {
        err = validate();
      } catch (e) {
        // 검증 단계에서 예외가 나면(옛 임시저장 데이터 형식 등) 예전에는 아무 반응 없이
        // 임시저장만 되는 것처럼 보였다 — 원인을 화면에 알린다.
        alert('저장 전 검사 중 오류가 발생했습니다: ' + (e && e.message || e) + '\n화면을 새로고침(Ctrl+Shift+R)한 뒤 다시 시도하세요.');
        setStatus('저장 실패', false);
        try { console.error('[DKJ-H-01-01] validate 오류', e); } catch (x) {}
        return;
      }
      if (err) { alert(err); return; }
      // 값(품목·측정값)은 있는데 시간이 비어 있는 행이 있으면 저장 전에 알린다.
      var missingTime = [];
      (state.rows || []).forEach(function (r, i) {
        if (!r || r.time) return;
        if (!((r.productName || '').trim() || r.ppm || r.soak || r.rinseSec || r.residualCl || r.rawMaterialKg)) return;
        missingTime.push({ idx: i, label: (i + 1) + '행' + (r.productName ? ' ' + r.productName : '') });
      });
      if (!state.preWorkTime && state.preWorkPpm) missingTime.unshift({ idx: -1, label: '작업 시작 전 확인' });
      if (missingTime.length && window.DkjUtil && (lock ? DkjUtil.blockMissingTime(missingTime.map(function (m) { return m.label; })) : !DkjUtil.confirmMissingTime(missingTime.map(function (m) { return m.label; }), false))) {
        var firstEl = null;
        missingTime.forEach(function (m) {
          var el = document.querySelector('tr[data-i="' + m.idx + '"] [data-f="time"]');
          if (el) { el.classList.add('bad'); if (!firstEl) firstEl = el; }
        });
        if (firstEl) { try { firstEl.scrollIntoView({ block: 'center' }); firstEl.focus(); } catch (e) {} }
        setStatus('시간 입력 필요', false);
        return;
      }
      // 대기 중인 임시저장 타이머를 지운다 — 안 지우면 저장 직후 화면에 "저장됨"이
      // 잠깐 떴다가 곧이어 그 타이머가 뒤늦게 "임시저장"으로 덮어써서, 실제로는
      // 정상 저장됐는데도 작업자가 "임시저장만 된 건가?" 하고 헷갈리게 된다.
      clearTimeout(draftTimer);
      state.locked = !!lock;
      var rec;
      try {
        rec = (await DkjRecordStore.save(FORM_ID, Object.assign({}, state, {
          id: editingId || undefined,
          title: 'CCP-1BC ' + state.productName,
          judge: state.hasDeviation ? '이탈' : '적합'
        })));
      } catch (e) {
        // 저장소가 가득 차면(시험지 사진이 쌓인 PC) setItem 이 예외를 던진다. 예전에는
        // 이게 그대로 삼켜져 '눌러도 아무 반응 없음'으로 보였다.
        state.locked = false;
        var quota = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
        alert(quota
          ? '저장 공간이 가득 차서 저장하지 못했습니다.\n기록보관함에서 백업한 뒤 불필요한 기록(삭제하면 용량이 확보됩니다)을 정리하고 다시 저장하세요.'
          : '저장에 실패했습니다: ' + (e && e.message || e));
        setStatus('저장 실패', false);
        return;
      }
      editingId = rec.id;
      setStatus(lock ? '작성완료 저장됨' : '저장됨 ' + new Date().toLocaleTimeString(), true);
      refreshApproval();
      (await renderHistory());
    } finally { saveInFlight = false; }
  }

  async function renderHistory() {
    var list = (await DkjRecordStore.list(FORM_ID)).slice(0, 12);
    var el = $('historyList');
    if (!list.length) {
      el.innerHTML = '<p style="color:#888;font-size:13px;">저장된 기록이 없습니다.</p>';
      return;
    }
    el.innerHTML = list.map(function (r) {
      return '<div class="dkj-history-item">' +
        '<div><strong>' + esc(r.workDate || '') + '</strong> · ' + esc(r.productName || '') + ' / ' + esc(r.lot || '') +
        ' <span class="badge ' + (r.hasDeviation ? 'wip' : 'done') + '">' + esc(r.judge || '-') + '</span></div>' +
        '<div style="display:flex;gap:6px;">' +
        '<button type="button" class="pill-btn ghost" data-load="' + r.id + '">불러오기</button>' +
        '<button type="button" class="pill-btn ghost" data-del="' + r.id + '">삭제</button></div></div>';
    }).join('');

    el.querySelectorAll('[data-load]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var r = (await DkjRecordStore.get(FORM_ID, b.getAttribute('data-load')));
        if (!r) return;
        editingId = r.id;
        state = Object.assign(emptyState(), r);
        writeForm();
        setStatus('기록 불러옴', true);
      });
    });
    el.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('삭제할까요?')) return;
        (await DkjRecordStore.remove(FORM_ID, b.getAttribute('data-del')));
        if (editingId === b.getAttribute('data-del')) {
          editingId = null;
          state = emptyState();
          writeForm();
        }
        (await renderHistory());
      });
    });
  }

  async function bind() {
    // 기본 필드 이벤트 바인딩
    ['workDate', 'disinfectant', 'lot', 'clMin', 'clMax', 'timeMin', 'monitorName', 'deviation', 'corrective', 'confirmer', 'approver', 'remark'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      var onFieldInput = function () {
        if (id === 'workDate') {
          // 작업일자 변경 시 LOT가 빈값이거나 이전 날짜 형태일 때 자동 동기화
          var newLot = dateToLot(el.value);
          var curLot = $('lot').value;
          if (!curLot || /^\d{8}$/.test(curLot)) {
            $('lot').value = newLot;
            state.lot = newLot;
          }
          loadForDate(el.value, true);
        }
        if (id === 'clMin' || id === 'clMax' || id === 'timeMin') {
          readForm();
          renderRows();
        }
        readForm();
        refreshApproval();
        scheduleDraft();
      };
      el.addEventListener('input', onFieldInput);
      el.addEventListener('change', onFieldInput);
    });

    // 품목 드롭다운 바인딩
    var pSel = $('productSelect');
    if (pSel) {
      pSel.addEventListener('change', function () {
        var pInp = $('productName');
        if (pSel.value === '__custom__') {
          if (pInp) {
            pInp.style.display = 'block';
            pInp.value = '';
            pInp.focus();
          }
          state.productName = '';
        } else {
          if (pInp) {
            pInp.style.display = 'none';
            pInp.value = pSel.value;
          }
          state.productName = pSel.value;
        }
        readForm();
        refreshApproval();
        scheduleDraft();
      });
    }

    // 품목 칩 바인딩 (농협+샐러디아 동시체크 및 다중선택 지원)
    var prodChips = $('productChips');
    if (prodChips) {
      prodChips.querySelectorAll('[data-prod]').forEach(function (chip) {
        chip.addEventListener('click', function () {
          if (state.locked) return;
          var val = chip.getAttribute('data-prod');

          if (val.indexOf(',') !== -1) {
            // "농협+샐러디아" 원터치 콤보
            if (state.productName === val) {
              state.productName = '';
            } else {
              state.productName = val;
            }
          } else {
            // 단일 칩 다중 토글
            var curList = state.productName ? state.productName.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
            var idx = curList.indexOf(val);
            if (idx !== -1) {
              curList.splice(idx, 1);
            } else {
              curList.push(val);
            }
            state.productName = curList.join(', ');
          }

          syncProductUi();
          readForm();
          refreshApproval();
          scheduleDraft();
        });
      });
    }

    // 생산 LOT 작업일자 동기화 버튼
    var btnSyncLot = $('btnSyncLot');
    if (btnSyncLot) {
      btnSyncLot.addEventListener('click', function () {
        if (state.locked) return;
        var d = $('workDate').value || today();
        var l = dateToLot(d);
        $('lot').value = l;
        state.lot = l;
        scheduleDraft();
        if (window.DkjUtil && window.DkjUtil.toast) {
          window.DkjUtil.toast('생산 LOT를 ' + l + ' (으)로 생성했습니다.');
        }
      });
    }

    // 소독액·헹굼수 교체 시각 — ＋ 누르면 칸이 하나 더 생긴다(하루 1~2회로 들쭉날쭉)
    var btnAddChangeTime = $('btnAddChangeTime');
    if (btnAddChangeTime) {
      btnAddChangeTime.addEventListener('click', function () {
        if (state.locked) return;
        ensureChangeTimes();
        state.changeTimes.push('');
        renderChangeTimeList();
        scheduleDraft();
      });
    }

    // 툴바 버튼 바인딩
    $('btnAddRow').addEventListener('click', function () {
      if (state.locked) return;
      state.rows.push(emptyRow());
      renderRows();
      scheduleDraft();
    });

    $('btnNow').addEventListener('click', function () {
      if (state.locked) return;
      var empty = state.rows.find(function (r) { return !r.time; });
      if (empty) empty.time = nowTime();
      else state.rows.push(Object.assign(emptyRow(), { time: nowTime() }));
      renderRows();
      scheduleDraft();
    });

    $('btnSave').addEventListener('click', async function () { (await save(false)); });
    $('btnLock').addEventListener('click', async function () { (await save(true)); });
    $('btnNew').addEventListener('click', function () {
      editingId = null;
      state = emptyState();
      writeForm();
      setStatus('새 일보', false);
    });

    $('btnPrint').addEventListener('click', function () {
      if (typeof readForm === 'function') readForm();
      if (window.DkjPrint) {
        DkjPrint.print({ layout: 'official-ccp1bc' }, state);
      } else {
        window.print();
      }
    });

    if (window.DkjUtil) {
      (await window.DkjUtil.attachQuickToolbar($('btnSave') ? $('btnSave').parentNode : null, {
        formId: FORM_ID,
        hasChecks: false,
        keepPhotos: true,
        onClonePrev: function (cloned) {
          if (state.locked) return;
          (cloned.rows || []).forEach(function (r) { r.photoCarried = !!r.photo; });
          state = Object.assign(emptyState(), cloned);
          editingId = null;
          writeForm();
          scheduleDraft();
        }
      }));
      window.DkjUtil.attachChips(document);
    }
  }

  /** 날짜에 저장된 기록(없으면 같은 날짜 임시본)을 화면에 올린다. 불러왔으면 true. */
  async function loadForDate(date, userDriven) {
    if (!window.DkjDateLoad || !date) return false;
    var hit = (await DkjDateLoad.resolve(FORM_ID, date, 'workDate'));
    if (hit.kind === 'none') return false;
    if (hit.kind === 'record' && hit.data.id && hit.data.id === editingId) return false;
    // 아직 저장하지 않은 새 입력이 있으면 덮어쓰기 전에 확인한다.
    if (userDriven && !editingId) {
      readForm();
      if (JSON.stringify(state.rows) !== JSON.stringify(emptyState().rows) &&
          !confirm(date + ' 저장 기록을 불러오면 지금 입력 중인 내용은 사라집니다. 불러올까요?')) return false;
    }
    editingId = hit.kind === 'record' ? hit.data.id : (hit.data.id || null);
    state = Object.assign(emptyState(), hit.data);
    writeForm();
    refreshApproval();
    setStatus(hit.kind === 'record' ? date + ' 저장 기록 불러옴' : date + ' 임시저장 불러옴', true);
    return true;
  }

  async function init() {
    var draft = (await DkjRecordStore.loadDraft(FORM_ID));
    if (draft) state = Object.assign(emptyState(), draft);
    // 업무 콘솔·달력에서 ?date= 로 들어오면 그 날짜의 기록을 바로 연다(없으면 그 날짜의 새 일지).
    var qd = window.DkjDateLoad ? DkjDateLoad.queryDate() : '';
    if (qd) {
      var hit = (await DkjDateLoad.resolve(FORM_ID, qd, 'workDate'));
      if (hit.kind === 'none') {
        state = emptyState();
        state.workDate = qd;
        state.lot = dateToLot(qd);
        editingId = null;
      } else {
        editingId = hit.data.id || null;
        state = Object.assign(emptyState(), hit.data);
      }
    }
    writeForm();
    (await bind());
    (await renderHistory());
    mountApproval();
    refreshApproval();
    if (window.DkjUtil) {
      window.DkjUtil.autoFillUser(state, ['monitorName', 'confirmer', 'approver'], function () {
        writeForm();
      });
    }
    setStatus('준비', false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else (await init());
})();
