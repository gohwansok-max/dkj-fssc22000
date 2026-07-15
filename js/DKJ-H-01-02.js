/**
 * DKJ-H-01-02 CCP-2P 금속검출공정 점검표
 * 코엔에프 CONF-H-01-06 벤치마크 → 동김제 신선편의 CCP-2P
 */
(function () {
  'use strict';

  var FORM_ID = 'DKJ-H-01-02';
  var state = emptyState();
  var editingId = null;
  var draftTimer = null;

  function emptyRow() {
    return { time: '', fe: '', sus: '', prodFe: '', prodSus: '', judge: '' };
  }

  function emptyState() {
    return {
      workDate: today(),
      equipment: 'MD-01',
      productName: '',
      lot: '',
      feSize: '1.5',
      susSize: '2.0',
      monitorName: '',
      timing: '시작전',
      rows: [emptyRow(), emptyRow(), emptyRow()],
      deviation: '',
      corrective: '',
      confirmer: '',
      remark: '',
      locked: false,
      hasDeviation: false
    };
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
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

  function oxSelect(val, field) {
    return '<select class="mon-in" data-f="' + field + '">' +
      '<option value=""' + (!val ? ' selected' : '') + '>-</option>' +
      '<option value="O"' + (val === 'O' ? ' selected' : '') + '>O</option>' +
      '<option value="X"' + (val === 'X' ? ' selected' : '') + '>X</option>' +
      '</select>';
  }

  function evaluateRow(row) {
    var vals = [row.fe, row.sus, row.prodFe, row.prodSus].filter(Boolean);
    if (!vals.length) {
      row.judge = '';
      return;
    }
    if (vals.indexOf('X') !== -1) row.judge = 'X';
    else if (vals.length === 4 && vals.every(function (v) { return v === 'O'; })) row.judge = 'O';
    else if (vals.every(function (v) { return v === 'O'; })) row.judge = 'O';
    else row.judge = '';
  }

  function refreshDeviation() {
    state.hasDeviation = state.rows.some(function (r) { return r.judge === 'X'; });
    var ban = $('deviationBanner');
    if (ban) ban.hidden = !state.hasDeviation;
  }

  function renderRows() {
    var body = $('monBody');
    body.innerHTML = state.rows.map(function (row, i) {
      evaluateRow(row);
      return '<tr data-i="' + i + '">' +
        '<td><input type="time" class="mon-in" data-f="time" value="' + (row.time || '') + '"></td>' +
        '<td>' + oxSelect(row.fe, 'fe') + '</td>' +
        '<td>' + oxSelect(row.sus, 'sus') + '</td>' +
        '<td>' + oxSelect(row.prodFe, 'prodFe') + '</td>' +
        '<td>' + oxSelect(row.prodSus, 'prodSus') + '</td>' +
        '<td class="mon-judge ' + (row.judge === 'X' ? 'ng' : row.judge === 'O' ? 'ok' : '') + '">' + (row.judge || '·') + '</td>' +
        '<td><button type="button" class="pill-btn ghost mon-del" data-del="' + i + '">삭제</button></td>' +
        '</tr>';
    }).join('');

    body.querySelectorAll('.mon-in').forEach(function (inp) {
      inp.addEventListener('change', onRowInput);
      inp.addEventListener('input', onRowInput);
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
    var i = Number(tr.getAttribute('data-i'));
    var f = e.target.getAttribute('data-f');
    state.rows[i][f] = e.target.value;
    renderRows();
    scheduleDraft();
  }

  function readForm() {
    state.workDate = $('workDate').value;
    state.equipment = $('equipment').value;
    state.productName = $('productName').value;
    state.lot = $('lot').value;
    state.feSize = $('feSize').value;
    state.susSize = $('susSize').value;
    state.monitorName = $('monitorName').value;
    state.timing = $('timing').value;
    state.deviation = $('deviation').value;
    state.corrective = $('corrective').value;
    state.confirmer = $('confirmer').value;
    state.remark = $('remark').value;
  }

  function writeForm() {
    $('workDate').value = state.workDate || today();
    $('equipment').value = state.equipment || 'MD-01';
    $('productName').value = state.productName || '';
    $('lot').value = state.lot || '';
    $('feSize').value = state.feSize || '1.5';
    $('susSize').value = state.susSize || '2.0';
    $('monitorName').value = state.monitorName || '';
    $('timing').value = state.timing || '시작전';
    $('deviation').value = state.deviation || '';
    $('corrective').value = state.corrective || '';
    $('confirmer').value = state.confirmer || '';
    $('remark').value = state.remark || '';
    if (!state.rows || !state.rows.length) state.rows = [emptyRow()];
    renderRows();
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
    if (!state.productName) return '품목을 입력하세요.';
    if (!state.lot) return 'LOT를 입력하세요.';
    if (!state.monitorName) return '모니터링 담당자를 입력하세요.';
    var filled = state.rows.filter(function (r) {
      return r.fe || r.sus || r.prodFe || r.prodSus;
    });
    if (!filled.length) return '시편 검출 결과를 1건 이상 입력하세요.';
    if (state.hasDeviation) {
      if (!(state.deviation || '').trim() || state.deviation === '해당없음') {
        return '불검출(이탈) 시 이탈 내용을 기록하세요.';
      }
      if (!(state.corrective || '').trim()) {
        return '이탈 시 시정조치(제품 격리·재검사 등)를 기록하세요.';
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
      title: 'CCP-2P ' + state.productName,
      judge: state.hasDeviation ? '이탈' : '적합'
    }));
    editingId = rec.id;
    setStatus(lock ? '작성완료 저장됨' : '저장됨 ' + new Date().toLocaleTimeString(), true);
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
        '<div><strong>' + (r.workDate || '') + '</strong> · ' + (r.productName || '') + ' / ' + (r.lot || '') +
        ' <span class="badge ' + (r.hasDeviation ? 'wip' : 'done') + '">' + (r.judge || '-') + '</span></div>' +
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

  function bind() {
    ['workDate', 'equipment', 'productName', 'lot', 'feSize', 'susSize',
      'monitorName', 'timing', 'deviation', 'corrective', 'confirmer', 'remark'].forEach(function (id) {
      $(id).addEventListener('input', scheduleDraft);
      $(id).addEventListener('change', scheduleDraft);
    });
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
        DkjPrint.print({ layout: 'official-ccp2p' }, state);
      } else {
        window.print();
      }
    });
  }

  function init() {
    var draft = DkjRecordStore.loadDraft(FORM_ID);
    if (draft) state = Object.assign(emptyState(), draft);
    writeForm();
    bind();
    renderHistory();
    setStatus('준비', false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
