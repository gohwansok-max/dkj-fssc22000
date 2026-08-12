/**
 * DkjLedgerForm — 유형 E(대장/검사일지) 입력 엔진
 * 1 레코드 = 1장(대장 시트). 행은 건별로 추가·삭제한다.
 */
(function (global) {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function today() { return new Date().toISOString().slice(0, 10); }

  function emptyRow(spec) {
    var r = {};
    (spec.columns || []).forEach(function (c) { r[c.key] = c.default || ''; });
    return r;
  }

  function emptyState(spec) {
    var rows = [];
    if (spec.defaultRows && spec.defaultRows.length) {
      // 측정위치·설비명·일자처럼 서식에 인쇄되어 있는 행을 그대로 채운다
      spec.defaultRows.forEach(function (d) {
        rows.push(Object.assign(emptyRow(spec), d));
      });
    } else {
      for (var i = 0; i < (spec.rows || 12); i++) rows.push(emptyRow(spec));
    }
    var info = {};
    (spec.infoFields || []).forEach(function (f) {
      info[f.id] = f.type === 'date' ? today() : (f.default || '');
    });
    return {
      info: info,
      rows: rows,
      approvals: { writer: '', reviewer: '', approver: '' },
      remark: '',
      locked: false
    };
  }

  function mount(spec) {
    if (!spec || !spec.code) throw new Error('DkjLedgerForm: spec.code required');
    var FORM_ID = spec.code;
    var COLS = spec.columns || [];
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

    function renderInfo() {
      var host = $('infoFields');
      if (!host) return;
      host.innerHTML = (spec.infoFields || []).map(function (f) {
        var v = state.info[f.id] || '';
        var input = f.type === 'date'
          ? '<input type="date" data-info="' + f.id + '" value="' + esc(v) + '">'
          : '<input type="text" data-info="' + f.id + '" value="' + esc(v) + '" placeholder="' +
            esc(f.placeholder || '') + '">';
        return '<div class="dkj-field"><label>' + esc(f.label) + '</label>' + input + '</div>';
      }).join('');
      host.querySelectorAll('[data-info]').forEach(function (el) {
        el.addEventListener('input', function () {
          state.info[el.getAttribute('data-info')] = el.value;
          scheduleDraft();
        });
      });
    }

    function cellInput(c, ri, v) {
      if (c.readonly) {
        return '<span class="lgf-fixed">' + esc(v) + '</span>';
      }
      if (c.type === 'choice') {
        return '<select data-r="' + ri + '" data-c="' + c.key + '">' +
          '<option value=""></option>' +
          (c.choices || []).map(function (o) {
            return '<option value="' + esc(o) + '"' + (v === o ? ' selected' : '') + '>' + esc(o) + '</option>';
          }).join('') + '</select>';
      }
      var t = c.type === 'num' ? 'number' : (c.type === 'date' ? 'date' : 'text');
      return '<input type="' + t + '" data-r="' + ri + '" data-c="' + c.key + '" value="' +
        esc(v) + '" placeholder="' + esc(c.unit || '') + '">';
    }

    function renderGrid() {
      var host = $('ledgerGrid');
      if (!host) return;
      var thead = global.DkjLedgerPrint
        ? global.DkjLedgerPrint.theadHtml(
            spec.defaultRows ? COLS : COLS.concat([{ key: '__act', label: '' }]))
        : '';
      var body = state.rows.map(function (r, ri) {
        return '<tr>' + COLS.map(function (c) {
          return '<td>' + cellInput(c, ri, r[c.key] || '') + '</td>';
        }).join('') +
          (spec.defaultRows ? '' :
            '<td class="lgf-act"><button type="button" class="lgf-del" data-del="' + ri +
            '">삭제</button></td>') + '</tr>';
      }).join('');
      host.innerHTML = '<table class="lgf-table"><thead>' + thead + '</thead><tbody>' + body + '</tbody></table>';

      host.querySelectorAll('[data-r]').forEach(function (el) {
        var ev = el.tagName === 'SELECT' ? 'change' : 'input';
        el.addEventListener(ev, function () {
          state.rows[Number(el.getAttribute('data-r'))][el.getAttribute('data-c')] = el.value;
          scheduleDraft();
        });
      });
      host.querySelectorAll('[data-del]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (state.locked) return;
          state.rows.splice(Number(b.getAttribute('data-del')), 1);
          if (!state.rows.length) state.rows.push(emptyRow(spec));
          renderGrid();
          scheduleDraft();
        });
      });
      applyLock();
    }

    function applyLock() {
      var host = document.querySelector('.dkj-form-body');
      if (!host) return;
      host.classList.toggle('is-locked', !!state.locked);
      host.querySelectorAll('#ledgerGrid input, #ledgerGrid select, #ledgerGrid button, #infoFields input')
        .forEach(function (el) { el.disabled = !!state.locked; });
    }

    function filledRows() {
      return state.rows.filter(function (r) {
        return COLS.some(function (c) { return String(r[c.key] || '').trim(); });
      });
    }

    function validate() {
      if (!state.approvals.writer) return '작성자를 입력하세요.';
      var req = (spec.infoFields || []).filter(function (f) { return f.required; });
      for (var i = 0; i < req.length; i++) {
        if (!state.info[req[i].id]) return req[i].label + '을(를) 입력하세요.';
      }
      if (!filledRows().length) return '최소 1건 이상 기록하세요.';
      var reqCols = COLS.filter(function (c) { return c.required; });
      var bad = filledRows().find(function (r) {
        return reqCols.some(function (c) { return !String(r[c.key] || '').trim(); });
      });
      if (bad) return '기재한 행의 필수 항목(' +
        reqCols.map(function (c) { return c.label; }).join(', ') + ')을 채우세요.';
      return '';
    }

    function save(lock) {
      var err = validate();
      if (err) { alert(err); return; }
      state.locked = !!lock;
      var first = (spec.infoFields || [])[0];
      var rec = DkjRecordStore.save(FORM_ID, Object.assign({}, state, {
        id: editingId || undefined,
        title: (first ? (state.info[first.id] || '') : '') + ' · ' + filledRows().length + '건',
        judge: '기록'
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
        return '<div class="dkj-history-item"><div><strong>' + esc(r.title || '') + '</strong>' +
          (r.locked ? ' <span class="badge done">잠금</span>' : '') + '</div>' +
          '<div style="display:flex;gap:6px;">' +
          '<button type="button" class="pill-btn ghost" data-load="' + r.id + '">불러오기</button>' +
          '<button type="button" class="pill-btn ghost" data-del2="' + r.id + '">삭제</button></div></div>';
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
      el.querySelectorAll('[data-del2]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (!confirm('삭제할까요?')) return;
          DkjRecordStore.remove(FORM_ID, b.getAttribute('data-del2'));
          renderHistory();
        });
      });
    }

    function writeForm() {
      ['writer', 'reviewer', 'approver'].forEach(function (k) {
        if ($(k)) $(k).value = state.approvals[k] || '';
      });
      if ($('remark')) $('remark').value = state.remark || '';
      renderInfo();
      renderGrid();
    }

    function doPrint() {
      var sheet = $('printSheet');
      sheet.innerHTML = global.DkjLedgerPrint.render(spec, state);
      setTimeout(function () { window.print(); }, 120);
    }

    function bind() {
      ['writer', 'reviewer', 'approver'].forEach(function (k) {
        if ($(k)) $(k).addEventListener('input', function () {
          state.approvals[k] = this.value; scheduleDraft();
        });
      });
      if ($('remark')) $('remark').addEventListener('input', function () {
        state.remark = this.value; scheduleDraft();
      });
      if ($('btnAddRow')) $('btnAddRow').addEventListener('click', function () {
        if (state.locked) return;
        state.rows.push(emptyRow(spec));
        renderGrid();
        scheduleDraft();
      });
      if ($('btnSave')) $('btnSave').addEventListener('click', function () { save(false); });
      if ($('btnLock')) $('btnLock').addEventListener('click', function () { save(true); });
      if ($('btnNew')) $('btnNew').addEventListener('click', function () {
        editingId = null; state = emptyState(spec); writeForm(); setStatus('새 시트', false);
      });
      if ($('btnPrint')) $('btnPrint').addEventListener('click', doPrint);
    }

    function init() {
      var draft = DkjRecordStore.loadDraft(FORM_ID);
      if (draft) state = Object.assign(emptyState(spec), draft);
      writeForm();
      bind();
      renderHistory();
      setStatus('준비', false);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    return { getState: function () { return state; } };
  }

  global.DkjLedgerForm = { mount: mount, emptyState: emptyState };
})(window);
