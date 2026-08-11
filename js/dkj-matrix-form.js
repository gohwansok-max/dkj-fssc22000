/**
 * DkjMatrixForm — 유형 A(항목 × 날짜 매트릭스) 입력 엔진
 *
 * 종이 원본과 동일하게 "시트 1장 = 1주(6일)" 를 하나의 기록으로 저장한다.
 * 셀을 누르면 O → X → — → 공란 으로 순환한다.
 */
(function (global) {
  'use strict';

  var CYCLE = ['', 'O', 'X', '-'];

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function toISO(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /** 해당 날짜가 속한 주의 월요일 */
  function mondayOf(iso) {
    var d = iso ? new Date(iso + 'T00:00:00') : new Date();
    var dow = d.getDay();               // 0=일
    var diff = dow === 0 ? -6 : 1 - dow; // 월요일로 이동
    d.setDate(d.getDate() + diff);
    return toISO(d);
  }

  function addDays(iso, n) {
    var d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return toISO(d);
  }

  /** period 'week' → 하루씩, 'month' → 한 주씩 증가 */
  function buildDays(weekStart, n, step) {
    var out = [];
    var s = step || 1;
    for (var i = 0; i < n; i++) out.push(addDays(weekStart, i * s));
    return out;
  }

  function flatten(spec) {
    return global.DkjMatrixPrint
      ? global.DkjMatrixPrint.flatten(spec)
      : [];
  }

  function emptyIncident() {
    return { occurredAt: '', place: '', detail: '', action: '', doneAt: '', actor: '', confirmer: '' };
  }

  function emptyState(spec) {
    var n = spec.days || 6;
    var ws = mondayOf(null);
    var step = spec.period === 'month' ? 7 : 1;
    var checks = {};
    var notes = {};
    flatten(spec).forEach(function (r) {
      checks[r.key] = new Array(n).fill('');
      notes[r.key] = '';
    });
    var incidents = [];
    for (var i = 0; i < ((spec.incident && spec.incident.rows) || 5); i++) {
      incidents.push(emptyIncident());
    }
    return {
      weekStart: ws,
      days: buildDays(ws, n, step),
      checks: checks,
      notes: notes,
      signs: new Array(n).fill(''),
      incidents: incidents,
      approvals: { writer: '', reviewer: '', approver: '' },
      remark: '',
      locked: false
    };
  }

  function mount(spec) {
    if (!spec || !spec.code) throw new Error('DkjMatrixForm: spec.code required');
    var FORM_ID = spec.code;
    var N = spec.days || 6;
    var ROWS = flatten(spec);
    var state = emptyState(spec);
    var editingId = null;
    var draftTimer = null;

    function setStatus(msg, saved) {
      var el = $('saveStatus');
      if (!el) return;
      el.innerHTML = '<span class="dot"></span> ' + msg;
      el.className = 'dkj-status' + (saved ? ' saved' : '');
    }

    function scheduleDraft() {
      clearTimeout(draftTimer);
      draftTimer = setTimeout(function () {
        DkjRecordStore.saveDraft(FORM_ID, state);
        setStatus('임시저장 ' + new Date().toLocaleTimeString(), false);
      }, 400);
    }

    /* ---------- 매트릭스 ---------- */

    var LV = spec.divLevels === 1 ? 1 : 2;
    var HAS_FREQ = spec.showFreq !== false;
    var HAS_NOTE = spec.showNote !== false;
    var WEEK_MODE = spec.dayMode === 'week';

    function dayHeadCells() {
      var out = '';
      for (var i = 0; i < N; i++) {
        var d = state.days[i] || '';
        var md = d ? (Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10))) : '-';
        var lab = (spec.dayLabels && spec.dayLabels[i]) || '';
        var main = WEEK_MODE ? (lab || (i + 1) + '주') : md;
        var sub = WEEK_MODE ? md : lab;
        out += '<th class="mxf-day"><span>' + esc(main) + '</span><small>' + esc(sub) + '</small></th>';
      }
      return out;
    }

    function spanOf(rows, field, i) {
      if (i > 0 && rows[i - 1][field] === rows[i][field] &&
          (field !== 'minor' || rows[i - 1].major === rows[i].major)) return 0;
      var c = 1;
      while (i + c < rows.length && rows[i + c][field] === rows[i][field] &&
             (field !== 'minor' || rows[i + c].major === rows[i].major)) c++;
      return c;
    }

    function renderMatrix() {
      var host = $('matrixGrid');
      if (!host) return;
      var head =
        '<tr>' +
        '<th class="mxf-div" colspan="' + LV + '">구 분</th>' +
        '<th class="mxf-item">' + esc(spec.itemHeader || '점 검 사 항') + '</th>' +
        (HAS_FREQ ? '<th class="mxf-freq">주기</th>' : '') +
        dayHeadCells() +
        (HAS_NOTE ? '<th class="mxf-note">비 고</th>' : '') +
        '</tr>';

      var body = ROWS.map(function (r, i) {
        var tr = '';
        var ms = spanOf(ROWS, 'major', i);
        if (ms) tr += '<td class="mxf-major" rowspan="' + ms + '">' + esc(r.major) + '</td>';
        if (LV === 2) {
          var ns = spanOf(ROWS, 'minor', i);
          if (ns) tr += '<td class="mxf-minor" rowspan="' + ns + '">' + esc(r.minor) + '</td>';
        }
        tr += '<td class="mxf-label">' + esc(r.label) + '</td>';
        if (HAS_FREQ) tr += '<td class="mxf-freq">' + esc(r.freq) + '</td>';
        var vals = state.checks[r.key] || [];
        for (var d = 0; d < N; d++) {
          var v = vals[d] || '';
          tr += '<td class="mxf-cellwrap"><button type="button" class="mxf-cell v' +
            (v === 'O' ? 'o' : v === 'X' ? 'x' : v === '-' ? 'n' : 'e') +
            '" data-k="' + r.key + '" data-d="' + d + '">' +
            (v === 'O' ? '○' : v === 'X' ? '×' : v === '-' ? '—' : '') +
            '</button></td>';
        }
        if (HAS_NOTE) {
          tr += '<td class="mxf-notewrap"><input type="text" class="mxf-note-in" data-note="' +
            r.key + '" value="' + esc(state.notes[r.key] || '') + '"></td>';
        }
        return '<tr>' + tr + '</tr>';
      }).join('');

      var signCells = '';
      for (var s = 0; s < N; s++) {
        signCells += '<td class="mxf-cellwrap"><input type="text" class="mxf-sign" data-sign="' +
          s + '" value="' + esc(state.signs[s] || '') + '"></td>';
      }
      var foot =
        '<tr class="mxf-signrow"><th colspan="' + (LV + 1 + (HAS_FREQ ? 1 : 0)) + '">' +
        esc(spec.signRowLabel || '작 성') + '</th>' +
        signCells + (HAS_NOTE ? '<td></td>' : '') + '</tr>';

      host.innerHTML = '<table class="mxf-table"><thead>' + head + '</thead><tbody>' +
        body + foot + '</tbody></table>';

      host.querySelectorAll('.mxf-cell').forEach(function (b) {
        b.addEventListener('click', function () {
          if (state.locked) return;
          var k = b.getAttribute('data-k');
          var d = Number(b.getAttribute('data-d'));
          var cur = (state.checks[k] || [])[d] || '';
          var next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
          if (!state.checks[k]) state.checks[k] = new Array(N).fill('');
          state.checks[k][d] = next;
          renderMatrix();
          renderSummary();
          scheduleDraft();
        });
      });
      host.querySelectorAll('[data-note]').forEach(function (el) {
        el.addEventListener('input', function () {
          state.notes[el.getAttribute('data-note')] = el.value;
          scheduleDraft();
        });
      });
      host.querySelectorAll('[data-sign]').forEach(function (el) {
        el.addEventListener('input', function () {
          state.signs[Number(el.getAttribute('data-sign'))] = el.value;
          scheduleDraft();
        });
      });
    }

    /* ---------- 이상 발생 내역 ---------- */

    function renderIncidents() {
      var host = $('incidentGrid');
      if (!host || !spec.incident) return;
      var cols = spec.incident.columns || [];
      var head = '<tr>' + cols.map(function (c) {
        return '<th' + (c.width ? ' style="width:' + c.width + '"' : '') + '>' + esc(c.label) + '</th>';
      }).join('') + '</tr>';
      var body = state.incidents.map(function (r, i) {
        return '<tr>' + cols.map(function (c) {
          return '<td><input type="text" data-inc="' + i + '" data-ck="' + c.key +
            '" value="' + esc(r[c.key] || '') + '"></td>';
        }).join('') + '</tr>';
      }).join('');
      host.innerHTML = '<table class="mxf-inc"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
      host.querySelectorAll('[data-inc]').forEach(function (el) {
        el.addEventListener('input', function () {
          state.incidents[Number(el.getAttribute('data-inc'))][el.getAttribute('data-ck')] = el.value;
          scheduleDraft();
        });
      });
    }

    /* ---------- 요약 ---------- */

    function stats() {
      var o = 0, x = 0, n = 0, blank = 0;
      ROWS.forEach(function (r) {
        var v = state.checks[r.key] || [];
        for (var d = 0; d < N; d++) {
          if (v[d] === 'O') o++;
          else if (v[d] === 'X') x++;
          else if (v[d] === '-') n++;
          else blank++;
        }
      });
      return { o: o, x: x, n: n, blank: blank, total: ROWS.length * N };
    }

    /** 열(하루)이 전부 채워졌는지 */
    function filledDays() {
      var out = [];
      for (var d = 0; d < N; d++) {
        var ok = ROWS.every(function (r) { return (state.checks[r.key] || [])[d]; });
        if (ok) out.push(d);
      }
      return out;
    }

    function renderSummary() {
      var el = $('mxSummary');
      if (!el) return;
      var s = stats();
      var fd = filledDays();
      el.innerHTML =
        '<span class="chip ok">○ ' + s.o + '</span>' +
        '<span class="chip ng">× ' + s.x + '</span>' +
        '<span class="chip na">— ' + s.n + '</span>' +
        '<span class="chip">미입력 ' + s.blank + ' / ' + s.total + '</span>' +
        '<span class="chip">완료 ' + fd.length + (spec.period === 'month' ? '주' : '일') + '</span>';
    }

    /* ---------- 폼 <-> 상태 ---------- */

    function writeForm() {
      if ($('weekStart')) $('weekStart').value = state.weekStart;
      if ($('weekRange')) {
        $('weekRange').textContent = state.days.length
          ? state.days[0] + ' ~ ' + state.days[state.days.length - 1]
          : '';
      }
      ['writer', 'reviewer', 'approver'].forEach(function (k) {
        if ($(k)) $(k).value = state.approvals[k] || '';
      });
      if ($('remark')) $('remark').value = state.remark || '';
      renderMatrix();
      renderIncidents();
      renderSummary();
      applyLock();
    }

    function applyLock() {
      var host = document.querySelector('.dkj-form-body');
      if (!host) return;
      host.classList.toggle('is-locked', !!state.locked);
      host.querySelectorAll('input, textarea, .mxf-cell').forEach(function (el) {
        if (el.id === 'weekStart' || el.closest('.dkj-form-toolbar')) return;
        el.disabled = !!state.locked;
      });
    }

    /* ---------- 검증 / 저장 ---------- */

    function validate() {
      if (!state.weekStart) return '점검 주차(시작일)를 선택하세요.';
      if (!state.approvals.writer) return '작성자를 입력하세요.';
      var fd = filledDays();
      if (!fd.length) {
        return spec.period === 'month'
          ? '최소 1개 주차는 모든 점검항목을 입력해야 합니다.'
          : '최소 하루치는 모든 점검항목을 입력해야 합니다.';
      }
      var hasX = ROWS.some(function (r) {
        return (state.checks[r.key] || []).indexOf('X') !== -1;
      });
      var hasInc = state.incidents.some(function (r) {
        return (r.detail || '').trim() || (r.action || '').trim();
      });
      if (hasX && !hasInc) return '부적합(×)이 있으므로 이상 발생 내역을 1건 이상 기록하세요.';
      return '';
    }

    function buildTitle() {
      return state.weekStart + ' 주 (' + state.days[0] + '~' + state.days[state.days.length - 1] + ')';
    }

    function save(lock) {
      var err = validate();
      if (err) { alert(err); return; }
      state.locked = !!lock;
      var rec = DkjRecordStore.save(FORM_ID, Object.assign({}, state, {
        id: editingId || undefined,
        title: buildTitle(),
        judge: ROWS.some(function (r) {
          return (state.checks[r.key] || []).indexOf('X') !== -1;
        }) ? '부적합' : '적합'
      }));
      editingId = rec.id;
      setStatus(lock ? '작성완료 저장됨' : '저장됨', true);
      applyLock();
      renderHistory();
    }

    function renderHistory() {
      var el = $('historyList');
      if (!el) return;
      var list = DkjRecordStore.list(FORM_ID).slice(0, 12);
      if (!list.length) {
        el.innerHTML = '<p style="color:#888;font-size:13px;">저장 기록 없음</p>';
        return;
      }
      el.innerHTML = list.map(function (r) {
        return '<div class="dkj-history-item"><div><strong>' + esc(r.title || r.weekStart) + '</strong> ' +
          '<span class="badge ' + (r.judge === '적합' ? 'done' : 'wip') + '">' + esc(r.judge || '-') + '</span>' +
          (r.locked ? ' <span class="badge done">잠금</span>' : '') + '</div>' +
          '<div style="display:flex;gap:6px;">' +
          '<button type="button" class="pill-btn ghost" data-load="' + r.id + '">불러오기</button>' +
          '<button type="button" class="pill-btn ghost" data-del="' + r.id + '">삭제</button></div></div>';
      }).join('');
      el.querySelectorAll('[data-load]').forEach(function (b) {
        b.addEventListener('click', function () {
          var r = DkjRecordStore.get(FORM_ID, b.getAttribute('data-load'));
          if (!r) return;
          editingId = r.id;
          state = Object.assign(emptyState(spec), r);
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
            state = emptyState(spec);
            writeForm();
          }
          renderHistory();
        });
      });
    }

    /* ---------- 인쇄 ---------- */

    function doPrint() {
      var sheet = $('printSheet') || (function () {
        var el = document.createElement('div');
        el.id = 'printSheet';
        el.className = 'print-sheet';
        document.body.appendChild(el);
        return el;
      })();
      sheet.innerHTML = global.DkjMatrixPrint.render(spec, state);
      setTimeout(function () { window.print(); }, 120);
    }

    /* ---------- 바인딩 ---------- */

    function bind() {
      if ($('weekStart')) {
        $('weekStart').addEventListener('change', function () {
          var ws = mondayOf(this.value);
          state.weekStart = ws;
          state.days = buildDays(ws, N, spec.period === 'month' ? 7 : 1);
          writeForm();
          scheduleDraft();
        });
      }
      ['writer', 'reviewer', 'approver'].forEach(function (k) {
        if ($(k)) {
          $(k).addEventListener('input', function () {
            state.approvals[k] = this.value;
            scheduleDraft();
          });
        }
      });
      if ($('remark')) {
        $('remark').addEventListener('input', function () {
          state.remark = this.value;
          scheduleDraft();
        });
      }
      if ($('btnSave')) $('btnSave').addEventListener('click', function () { save(false); });
      if ($('btnLock')) $('btnLock').addEventListener('click', function () { save(true); });
      if ($('btnNew')) {
        $('btnNew').addEventListener('click', function () {
          editingId = null;
          state = emptyState(spec);
          writeForm();
          setStatus('새 일보', false);
        });
      }
      if ($('btnPrint')) $('btnPrint').addEventListener('click', doPrint);
      if ($('btnFillO')) {
        $('btnFillO').addEventListener('click', function () {
          if (state.locked) return;
          var d = Number($('fillDay') && $('fillDay').value || 0);
          ROWS.forEach(function (r) {
            if (!state.checks[r.key]) state.checks[r.key] = new Array(N).fill('');
            if (!state.checks[r.key][d]) state.checks[r.key][d] = 'O';
          });
          renderMatrix();
          renderSummary();
          scheduleDraft();
        });
      }
    }

    function fillDayOptions() {
      var sel = $('fillDay');
      if (!sel) return;
      sel.innerHTML = state.days.map(function (d, i) {
        var dow = (spec.dayLabels && spec.dayLabels[i]) || '';
        return '<option value="' + i + '">' + d.slice(5) + ' (' + dow + ')</option>';
      }).join('');
    }

    function init() {
      var draft = DkjRecordStore.loadDraft(FORM_ID);
      if (draft) state = Object.assign(emptyState(spec), draft);
      writeForm();
      fillDayOptions();
      bind();
      renderHistory();
      setStatus('준비', false);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    return {
      getState: function () { return state; },
      setState: function (patch) { Object.assign(state, patch); writeForm(); }
    };
  }

  global.DkjMatrixForm = {
    mount: mount,
    mondayOf: mondayOf,
    buildDays: buildDays,
    emptyState: emptyState
  };
})(window);
