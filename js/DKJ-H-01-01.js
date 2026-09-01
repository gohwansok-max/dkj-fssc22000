/**
 * DKJ-H-01-01 CCP-1BC 소독·헹굼공정 점검표
 * 코엔에프 CONF-H-01-03 구조 벤치마크 → 동김제 신선편의 CCP
 */
(function () {
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

  var PPM_PRESETS = ['50', '60', '70', '80', '90', '100', '110', '120', '130', '140', '150', '160', '170', '180', '190', '200'];
  var SOAK_PRESETS = ['60', '65', '70', '75', '80', '90', '100', '120', '150', '180'];

  var TIME_SLOTS = [
    '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
    '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
    '18:00', '18:30', '19:00', '19:30', '20:00'
  ];

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
    return { time: '', ppm: '', soak: '', rinse: '', judge: '', isCustomPpm: false, isCustomSoak: false };
  }

  function emptyState() {
    var td = today();
    return {
      workDate: td,
      disinfectant: 'NaOCl',
      productName: '',
      lot: dateToLot(td),
      waterChangeTimes: '08:00, 11:00, 14:00',
      clMin: 50,
      clMax: 200,
      timeMin: 60,
      monitorName: '이다은',
      rows: [emptyRow(), emptyRow(), emptyRow()],
      deviation: '',
      corrective: '',
      confirmer: '권화선',
      approver: '최민재',
      remark: '',
      approvals: { writer: '이다은', reviewer: '권화선', approver: '최민재' },
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
      stages: ['writer', 'reviewer', 'approver'],
      getState: function () { readForm(); return state; },
      onChange: function () { scheduleDraft(); }
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
    return n >= Number(state.timeMin);
  }

  function evaluateRow(row) {
    var cl = withinCl(row.ppm);
    var sk = soakOk(row.soak);
    var rinseOk = row.rinse === 'O';
    if (cl === null && sk === null && !row.rinse) {
      row.judge = '';
      return;
    }
    if (cl === false || sk === false || row.rinse === 'X') row.judge = 'X';
    else if (cl === true && sk === true && rinseOk) row.judge = 'O';
    else if (row.rinse === '-') row.judge = row.judge || '';
  }

  function refreshDeviation() {
    state.hasDeviation = state.rows.some(function (r) { return r.judge === 'X'; });
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
      opts += '<option value="' + v + '"' + sel + '>' + v + ' ppm</option>';
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
      var label = v + '초' + (v === '60' ? ' (기준)' : '');
      opts += '<option value="' + v + '"' + sel + '>' + label + '</option>';
    });
    opts += '<option value="__custom__">✏️ 직접입력</option>';

    return '<div class="mon-select-group">' +
      '<select class="mon-in' + (skBad ? ' bad' : '') + '" data-f="soak-sel">' + opts + '</select>' +
      '<button type="button" class="mon-mode-btn" data-toggle-soak="' + i + '" title="직접 입력으로 전환">✏️</button>' +
      '</div>';
  }

  function renderRows() {
    var body = $('monBody');
    if (!body) return;

    body.innerHTML = state.rows.map(function (row, i) {
      evaluateRow(row);
      return '<tr data-i="' + i + '">' +
        '<td><input type="time" class="mon-in" data-f="time" value="' + (row.time || '') + '"></td>' +
        '<td>' + buildPpmCell(row, i) + '</td>' +
        '<td>' + buildSoakCell(row, i) + '</td>' +
        '<td><select class="mon-in" data-f="rinse">' +
          '<option value=""' + (!row.rinse ? ' selected' : '') + '>-</option>' +
          '<option value="O"' + (row.rinse === 'O' ? ' selected' : '') + '>O</option>' +
          '<option value="X"' + (row.rinse === 'X' ? ' selected' : '') + '>X</option>' +
        '</select></td>' +
        '<td class="mon-judge ' + (row.judge === 'X' ? 'ng' : row.judge === 'O' ? 'ok' : '') + '">' + (row.judge || '·') + '</td>' +
        '<td><button type="button" class="pill-btn ghost mon-del" data-del="' + i + '">삭제</button></td>' +
        '</tr>';
    }).join('');

    body.querySelectorAll('.mon-in').forEach(function (inp) {
      inp.addEventListener('change', onRowInput);
      inp.addEventListener('input', onRowInput);
    });

    body.querySelectorAll('[data-toggle-ppm]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var i = Number(btn.getAttribute('data-toggle-ppm'));
        state.rows[i].isCustomPpm = !state.rows[i].isCustomPpm;
        renderRows();
        scheduleDraft();
      });
    });

    body.querySelectorAll('[data-toggle-soak]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var i = Number(btn.getAttribute('data-toggle-soak'));
        state.rows[i].isCustomSoak = !state.rows[i].isCustomSoak;
        renderRows();
        scheduleDraft();
      });
    });

    body.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var i = Number(btn.getAttribute('data-del'));
        state.rows.splice(i, 1);
        if (!state.rows.length) state.rows.push(emptyRow());
        renderRows();
        scheduleDraft();
      });
    });

    refreshDeviation();
  }

  function onRowInput(e) {
    if (state.locked) return;
    var tr = e.target.closest('tr');
    if (!tr) return;
    var i = Number(tr.getAttribute('data-i'));
    var f = e.target.getAttribute('data-f');

    if (f === 'ppm-sel') {
      if (e.target.value === '__custom__') {
        state.rows[i].isCustomPpm = true;
      } else {
        state.rows[i].isCustomPpm = false;
        state.rows[i].ppm = e.target.value;
      }
    } else if (f === 'soak-sel') {
      if (e.target.value === '__custom__') {
        state.rows[i].isCustomSoak = true;
      } else {
        state.rows[i].isCustomSoak = false;
        state.rows[i].soak = e.target.value;
      }
    } else if (f) {
      state.rows[i][f] = e.target.value;
    }

    renderRows();
    scheduleDraft();
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

  function syncWaterPresetUi() {
    var wSel = $('waterPresetSelect');
    var wInp = $('waterChangeTimes');
    if (!wSel || !wInp) return;

    var val = (state.waterChangeTimes || '').trim();
    wInp.value = val;

    var found = false;
    for (var i = 0; i < wSel.options.length; i++) {
      if (wSel.options[i].value === val) {
        wSel.selectedIndex = i;
        found = true;
        break;
      }
    }
    if (!found) {
      wSel.value = val ? '__custom__' : '';
    }
  }

  function readForm() {
    state.workDate = $('workDate').value;
    state.disinfectant = $('disinfectant').value;

    var pSel = $('productSelect');
    var pInp = $('productName');
    if (pSel && pSel.value === '__custom__') {
      state.productName = pInp ? pInp.value.trim() : '';
    } else if (pSel && pSel.value) {
      state.productName = pSel.value;
    } else {
      state.productName = pInp ? pInp.value.trim() : '';
    }

    state.lot = $('lot').value.trim();
    state.waterChangeTimes = $('waterChangeTimes').value.trim();
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
    syncWaterPresetUi();

    if (!state.rows || !state.rows.length) state.rows = [emptyRow()];
    renderRows();
    syncApprovals();
    refreshApproval();
  }

  function scheduleDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(function () {
      readForm();
      DkjRecordStore.saveDraft(FORM_ID, state);
      setStatus('임시저장 ' + new Date().toLocaleTimeString(), false);
    }, 400);
  }

  function validate() {
    readForm();
    state.rows.forEach(evaluateRow);
    refreshDeviation();
    if (!state.workDate) return '작업일자를 입력하세요.';
    if (!state.productName) return '품목을 선택하거나 입력하세요.';
    if (!state.lot) return 'LOT를 입력하세요.';
    if (!state.monitorName) return '모니터링 담당자를 입력하세요.';
    var filled = state.rows.filter(function (r) { return r.ppm || r.soak || r.rinse; });
    if (!filled.length) return '모니터링 측정값을 1건 이상 입력하세요.';
    if (state.hasDeviation) {
      if (!(state.deviation || '').trim() || state.deviation === '해당없음') {
        return '한계기준 이탈 시 이탈 내용을 기록하세요.';
      }
      if (!(state.corrective || '').trim()) {
        return '이탈 시 시정조치를 기록하세요.';
      }
    }
    return '';
  }

  function save(lock) {
    var err = validate();
    if (err) { alert(err); return; }
    state.locked = !!lock;
    var rec = DkjRecordStore.save(FORM_ID, Object.assign({}, state, {
      id: editingId || undefined,
      title: 'CCP-1BC ' + state.productName,
      judge: state.hasDeviation ? '이탈' : '적합'
    }));
    editingId = rec.id;
    setStatus(lock ? '작성완료 저장됨' : '저장됨 ' + new Date().toLocaleTimeString(), true);
    refreshApproval();
    renderHistory();
  }

  function renderHistory() {
    var list = DkjRecordStore.list(FORM_ID).slice(0, 12);
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
      b.addEventListener('click', function () {
        var r = DkjRecordStore.get(FORM_ID, b.getAttribute('data-load'));
        if (!r) return;
        editingId = r.id;
        state = Object.assign(emptyState(), r);
        writeForm();
        setStatus('기록 불러옴', true);
      });
    });
    el.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!confirm('삭제할까요?')) return;
        DkjRecordStore.remove(FORM_ID, b.getAttribute('data-del'));
        if (editingId === b.getAttribute('data-del')) {
          editingId = null;
          state = emptyState();
          writeForm();
        }
        renderHistory();
      });
    });
  }

  /* 시간 선택 모달 다이얼로그 제어 */
  var selectedModalTimes = [];

  function updateModalPreview() {
    var prevEl = $('modalSelectedPreview');
    if (!prevEl) return;
    prevEl.textContent = selectedModalTimes.length ? selectedModalTimes.join(', ') : '-';
  }

  function renderModalTimeGrid() {
    var grid = $('modalTimeGrid');
    if (!grid) return;

    grid.innerHTML = TIME_SLOTS.map(function (t) {
      var active = selectedModalTimes.indexOf(t) !== -1 ? ' active' : '';
      return '<button type="button" class="dkj-time-chip-btn' + active + '" data-time="' + t + '">' + t + '</button>';
    }).join('');

    grid.querySelectorAll('[data-time]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var t = btn.getAttribute('data-time');
        var idx = selectedModalTimes.indexOf(t);
        if (idx === -1) {
          selectedModalTimes.push(t);
        } else {
          selectedModalTimes.splice(idx, 1);
        }
        selectedModalTimes.sort();
        renderModalTimeGrid();
        updateModalPreview();
      });
    });
    updateModalPreview();
  }

  function openTimeModal() {
    var dlg = $('waterTimeModal');
    if (!dlg) return;

    var cur = ($('waterChangeTimes').value || '').trim();
    selectedModalTimes = cur ? cur.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
    renderModalTimeGrid();

    if (typeof dlg.showModal === 'function') {
      dlg.showModal();
    } else {
      dlg.setAttribute('open', '');
    }
  }

  function closeTimeModal() {
    var dlg = $('waterTimeModal');
    if (!dlg) return;
    if (typeof dlg.close === 'function') {
      dlg.close();
    } else {
      dlg.removeAttribute('open');
    }
  }

  function applyTimeModal() {
    var res = selectedModalTimes.join(', ');
    $('waterChangeTimes').value = res;
    state.waterChangeTimes = res;
    syncWaterPresetUi();
    scheduleDraft();
    closeTimeModal();
  }

  function autoCalc3HourTimes() {
    var start = $('modalStartHour') ? $('modalStartHour').value : '08:00';
    var parts = start.split(':');
    var h = parseInt(parts[0], 10);
    var m = parts[1] || '00';

    selectedModalTimes = [];
    for (var i = 0; i < 3; i++) {
      var curH = h + (i * 3);
      if (curH <= 23) {
        selectedModalTimes.push(String(curH).padStart(2, '0') + ':' + m);
      }
    }
    renderModalTimeGrid();
  }

  function bind() {
    // 기본 필드 이벤트 바인딩
    ['workDate', 'disinfectant', 'productName', 'lot', 'waterChangeTimes', 'clMin', 'clMax', 'timeMin',
      'monitorName', 'deviation', 'corrective', 'confirmer', 'approver', 'remark'].forEach(function (id) {
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

    // 소독액 교체 시각 드롭다운 바인딩
    var wSel = $('waterPresetSelect');
    if (wSel) {
      wSel.addEventListener('change', function () {
        if (wSel.value === '__custom__') {
          $('waterChangeTimes').focus();
        } else if (wSel.value) {
          $('waterChangeTimes').value = wSel.value;
          state.waterChangeTimes = wSel.value;
          scheduleDraft();
        }
      });
    }

    // 소독액 교체 시각 칩 바인딩
    var waterChips = $('waterChips');
    if (waterChips) {
      waterChips.querySelectorAll('[data-water]').forEach(function (chip) {
        chip.addEventListener('click', function () {
          if (state.locked) return;
          var val = chip.getAttribute('data-water');
          $('waterChangeTimes').value = val;
          state.waterChangeTimes = val;
          syncWaterPresetUi();
          scheduleDraft();
        });
      });
    }

    // 시간 모달 팝업 바인딩
    var btnOpenTimePicker = $('btnOpenTimePicker');
    if (btnOpenTimePicker) btnOpenTimePicker.addEventListener('click', openTimeModal);
    var btnCloseTimeModal = $('btnCloseTimeModal');
    if (btnCloseTimeModal) btnCloseTimeModal.addEventListener('click', closeTimeModal);
    var btnCancelTimeModal = $('btnCancelTimeModal');
    if (btnCancelTimeModal) btnCancelTimeModal.addEventListener('click', closeTimeModal);
    var btnApplyTimeModal = $('btnApplyTimeModal');
    if (btnApplyTimeModal) btnApplyTimeModal.addEventListener('click', applyTimeModal);
    var btnAutoCalcTimes = $('btnAutoCalcTimes');
    if (btnAutoCalcTimes) btnAutoCalcTimes.addEventListener('click', autoCalc3HourTimes);

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

    $('btnSave').addEventListener('click', function () { save(false); });
    $('btnLock').addEventListener('click', function () { save(true); });
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
      window.DkjUtil.attachQuickToolbar($('btnSave') ? $('btnSave').parentNode : null, {
        formId: FORM_ID,
        hasChecks: false,
        onClonePrev: function (cloned) {
          if (state.locked) return;
          state = Object.assign(emptyState(), cloned);
          editingId = null;
          writeForm();
          scheduleDraft();
        }
      });
      window.DkjUtil.attachChips(document);
    }
  }

  function init() {
    var draft = DkjRecordStore.loadDraft(FORM_ID);
    if (draft) state = Object.assign(emptyState(), draft);
    writeForm();
    bind();
    renderHistory();
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
  else init();
})();

