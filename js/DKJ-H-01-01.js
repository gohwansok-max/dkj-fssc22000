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

  function emptyRow() {
    return { time: '', ppm: '', soak: '', rinse: '', judge: '' };
  }

  function emptyState() {
    return {
      workDate: today(),
      disinfectant: 'NaOCl',
      productName: '',
      lot: '',
      clMin: 50,
      clMax: 200,
      timeMin: 60,
      monitorName: '',
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

  function renderRows() {
    var body = $('monBody');
    body.innerHTML = state.rows.map(function (row, i) {
      evaluateRow(row);
      var clBad = withinCl(row.ppm) === false;
      var skBad = soakOk(row.soak) === false;
      return '<tr data-i="' + i + '">' +
        '<td><input type="time" class="mon-in" data-f="time" value="' + (row.time || '') + '"></td>' +
        '<td><input type="number" class="mon-in' + (clBad ? ' bad' : '') + '" data-f="ppm" step="1" min="0" value="' + (row.ppm || '') + '" placeholder="ppm"></td>' +
        '<td><input type="number" class="mon-in' + (skBad ? ' bad' : '') + '" data-f="soak" step="1" min="0" value="' + (row.soak || '') + '" placeholder="초"></td>' +
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
    state.disinfectant = $('disinfectant').value;
    state.productName = $('productName').value;
    state.lot = $('lot').value;
    state.clMin = Number($('clMin').value) || 0;
    state.clMax = Number($('clMax').value) || 0;
    state.timeMin = Number($('timeMin').value) || 0;
    state.monitorName = $('monitorName').value;
    state.deviation = $('deviation').value;
    state.corrective = $('corrective').value;
    state.confirmer = $('confirmer').value;
    state.remark = $('remark').value;
  }

  function writeForm() {
    $('workDate').value = state.workDate || today();
    $('disinfectant').value = state.disinfectant || 'NaOCl';
    $('productName').value = state.productName || '';
    $('lot').value = state.lot || '';
    $('clMin').value = state.clMin;
    $('clMax').value = state.clMax;
    $('timeMin').value = state.timeMin;
    $('monitorName').value = state.monitorName || '';
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
    ['workDate', 'disinfectant', 'productName', 'lot', 'clMin', 'clMax', 'timeMin',
      'monitorName', 'deviation', 'corrective', 'confirmer', 'remark'].forEach(function (id) {
      var el = $(id);
      el.addEventListener('input', function () {
        if (id === 'clMin' || id === 'clMax' || id === 'timeMin') {
          readForm();
          renderRows();
        }
        scheduleDraft();
      });
      el.addEventListener('change', scheduleDraft);
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
        DkjPrint.print({ layout: 'official-ccp1bc' }, state);
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
