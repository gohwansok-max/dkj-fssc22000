/**
 * DkjLedgerForm — 유형 E(대장/검사일지) 입력 엔진
 * 1 레코드 = 1장(대장 시트). 행은 건별로 추가·삭제한다.
 */
(function (global) {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function thisMonth() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

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
      info[f.id] = f.type === 'date' ? today() : f.type === 'month' ? thisMonth() : (f.default || '');
    });
    var incidents = [];
    if (spec.incident) {
      for (var k = 0; k < (spec.incident.rows || 4); k++) {
        var ir = {};
        (spec.incident.columns || []).forEach(function (c) { ir[c.key] = ''; });
        incidents.push(ir);
      }
    }
    return {
      info: info,
      rows: rows,
      incidents: incidents,
      approvals: { writer: '이다은', reviewer: '권화선', approver: '최민재' },
      signoff: {},
      // audit 를 여기서 만들어 둬야 저장 훅이 같은 배열에 이어 붙인다.
      // 없으면 저장할 때마다 새 배열이 생겨 감사이력이 1건으로 초기화된다.
      audit: [],
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


    /* 전자결재 패널 — 모듈이 없으면 그냥 건너뛴다 */
    var apvUi = null;

    function mountApproval() {
      if (!global.DkjApproval || apvUi) return;
      apvUi = global.DkjApproval.mount({
        getState: function () { return state; },
        onChange: function () { scheduleDraft(); }
      });
    }

    function refreshApproval() {
      if (apvUi) apvUi.render();
    }

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

    /** 점검 월(YYYY-MM 또는 '2026 . 08')이 바뀌면 요일 열을 다시 계산한다 */
    function applyAutoWeekday() {
      var cfg = spec.autoWeekday;
      if (!cfg) return;
      var raw = String(state.info[cfg.monthField] || '');
      var m = raw.match(/(\d{4})\D+(\d{1,2})/);
      if (!m) return;
      var y = Number(m[1]), mo = Number(m[2]);
      var names = ['일', '월', '화', '수', '목', '금', '토'];
      state.rows.forEach(function (r, i) {
        var dnum = Number(String(r[cfg.dayKey] || '').replace(/\D/g, '')) || (i + 1);
        var d = new Date(y, mo - 1, dnum);
        r[cfg.weekdayKey] = (d.getMonth() === mo - 1) ? names[d.getDay()] : '';
      });
    }

    function renderInfo() {
      var host = $('infoFields');
      if (!host) return;
      host.innerHTML = (spec.infoFields || []).map(function (f) {
        var v = state.info[f.id] || '';
        var input = f.type === 'date'
          ? '<input type="date" data-info="' + f.id + '" value="' + esc(v) + '">'
          : f.type === 'month'
            ? '<input type="month" data-info="' + f.id + '" value="' + esc(v) + '">'
            : '<input type="text" data-info="' + f.id + '" value="' + esc(v) + '" placeholder="' +
              esc(f.placeholder || '') + '">';
        return '<div class="dkj-field"><label>' + esc(f.label) + '</label>' + input + '</div>';
      }).join('');
      // dkj-approval.js 의 직원 자동선택 기능(attachStaffPickers)이 '점검자' 같은 인원 칸을
      // <select>로 통째로 바꿔치기한다. 개별 요소에 리스너를 걸면 그 바꿔치기 때마다
      // 리스너가 원래 요소와 함께 사라져서, 드롭다운에서 이름을 골라도 state.info 에는
      // 절대 반영되지 않는(=검증에서 계속 "입력하세요"로 막히는) 버그가 있었다. 부모
      // 컨테이너(host)에 위임 리스너를 하나만 걸어 두면, 자식이 어떤 요소로 바뀌든
      // 이벤트 버블링만으로 계속 잡힌다.
      if (!host._dkjInfoDelegated) {
        host._dkjInfoDelegated = true;
        ['input', 'change'].forEach(function (evt) {
          host.addEventListener(evt, function (e) {
            var el = e.target.closest ? e.target.closest('[data-info]') : null;
            if (!el || !host.contains(el)) return;
            state.info[el.getAttribute('data-info')] = el.value;
            if (spec.autoWeekday && el.getAttribute('data-info') === spec.autoWeekday.monthField) {
              applyAutoWeekday();
              renderGrid();
            }
            scheduleDraft();
          });
        });
      }
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

    function renderIncidents() {
      var host = $('incidentGrid');
      if (!host || !spec.incident) return;
      var cols = spec.incident.columns || [];
      var head = '<tr>' + cols.map(function (c) {
        return '<th' + (c.width ? ' style="width:' + c.width + '"' : '') + '>' + esc(c.label) + '</th>';
      }).join('') + '</tr>';
      var body = state.incidents.map(function (r, i) {
        return '<tr>' + cols.map(function (c) {
          var isStaff = c.key === 'actor' || c.key === 'confirmer' || c.key === 'writer';
          return '<td><input type="text"' + (isStaff ? ' list="dkjStaffList" placeholder="선택/입력"' : '') +
            ' data-inc="' + i + '" data-ck="' + c.key +
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

    function applyLock() {
      var host = document.querySelector('.dkj-form-body');
      if (!host) return;
      host.classList.toggle('is-locked', !!state.locked);
      host.querySelectorAll('#ledgerGrid input, #ledgerGrid select, #ledgerGrid button, '
        + '#infoFields input, #incidentGrid input')
        .forEach(function (el) { el.disabled = !!state.locked; });
      ['btnBulkOk', 'btnBulkNg'].forEach(function (id) {
        if ($(id)) $(id).disabled = !!state.locked;
      });
    }

    function filledRows() {
      return state.rows.filter(function (r) {
        return COLS.some(function (c) { return String(r[c.key] || '').trim(); });
      });
    }

    function applyBulkChoice(value) {
      var keys = spec.bulkChoiceKeys || [];
      if (state.locked || !keys.length) return;
      state.rows.forEach(function (row) {
        keys.forEach(function (key) { row[key] = value; });
      });
      renderGrid();
      scheduleDraft();
      setStatus('냉장창고 적/부 전체 ' + value + ' 입력됨', false);
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
      refreshApproval();
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
      applyAutoWeekday();
      renderGrid();
      renderIncidents();
      refreshApproval();
    }

    function doPrint() {
      var sheet = $('printSheet');
      sheet.innerHTML = global.DkjLedgerPrint.render(spec, state);
      setTimeout(function () { window.print(); }, 120);
    }

    function bind() {
      // writer/reviewer/approver 도 dkj-approval.js 의 직원 자동선택이 <select>로
      // 바꿔치기한다 — renderInfo() 와 같은 이유로 개별 요소 리스너 대신 document 위임
      // 리스너를 쓴다(요소가 나중에 통째로 바뀌어도 계속 잡힌다).
      ['writer', 'reviewer', 'approver'].forEach(function (k) {
        document.addEventListener('input', function (e) {
          if (e.target && e.target.id === k) {
            state.approvals[k] = e.target.value;
            scheduleDraft();
            global.dispatchEvent(new CustomEvent('dkj:approval-changed'));
          }
        });
        document.addEventListener('change', function (e) {
          if (e.target && e.target.id === k) {
            state.approvals[k] = e.target.value;
            scheduleDraft();
            global.dispatchEvent(new CustomEvent('dkj:approval-changed'));
          }
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
      if ($('btnBulkOk')) $('btnBulkOk').addEventListener('click', function () { applyBulkChoice('적'); });
      if ($('btnBulkNg')) $('btnBulkNg').addEventListener('click', function () { applyBulkChoice('부'); });
      if ($('btnSave')) $('btnSave').addEventListener('click', function () { save(false); });
      if ($('btnLock')) $('btnLock').addEventListener('click', function () { save(true); });
      if ($('btnNew')) $('btnNew').addEventListener('click', function () {
        editingId = null; state = emptyState(spec); writeForm(); setStatus('새 시트', false);
      });
      if ($('btnPrint')) $('btnPrint').addEventListener('click', doPrint);
      if (global.DkjUtil) {
        global.DkjUtil.attachQuickToolbar($('btnSave') ? $('btnSave').parentNode : null, {
          formId: FORM_ID,
          hasChecks: false,
          onClonePrev: function (cloned) {
            if (state.locked) return;
            state = Object.assign(emptyState(spec), cloned);
            editingId = null;
            writeForm();
            scheduleDraft();
          }
        });
        global.DkjUtil.attachChips(document);
      }
    }

    function init() {
      var draft = DkjRecordStore.loadDraft(FORM_ID);
      if (draft) state = Object.assign(emptyState(spec), draft);
      writeForm();
      mountApproval();
      bind();
      renderHistory();
      if (global.DkjUtil) {
        global.DkjUtil.autoFillUser(state.approvals, ['writer', 'reviewer', 'approver'], function () {
          writeForm();
        });
      }
      setStatus('준비', false);
      // 기록보관함에서 ?record=<id> 로 들어온 경우 그 기록을 띄운다(임시저장분보다 우선)
      if (global.DkjDeepLink) {
        var opened = DkjDeepLink.apply(FORM_ID, function (rec) {
          editingId = rec.id;
          state = Object.assign(emptyState(spec), rec);
          writeForm();
        });
        if (opened) setStatus('기록 불러옴', true);
      }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    return { getState: function () { return state; } };
  }

  global.DkjLedgerForm = { mount: mount, emptyState: emptyState };
})(window);
