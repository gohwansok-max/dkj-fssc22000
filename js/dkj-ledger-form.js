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
      approvals: { writer: '', reviewer: '', approver: '' },
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
      clearDisabledRows();
    }

    /** 휴무일로 바뀐 행에 남아 있던 값을 지운다 — 안 지우면 정본에 그대로 인쇄된다 */
    function clearDisabledRows() {
      if (!spec.disableRowIf) return;
      state.rows.forEach(function (r) {
        if (!isRowDisabled(r)) return;
        (spec.columns || []).forEach(function (c) {
          if (!c.readonly && r[c.key]) r[c.key] = '';
        });
      });
    }

    /* dkj-approval.js 의 attachStaffPickers() 는 라벨에 '점검'·'작성' 같은 말이 들어가면
       그 입력칸을 직원 이름 <select> 로 바꿔 버린다. '점검 일시'·'점검 월' 처럼 사람이
       아닌 칸까지 잡혀 필수 항목을 아예 못 쓰는 서식이 있었다. 사양에서 staff:false 로
       지정하면 이 표시를 달아 치환에서 제외한다(선택자가
       input:not([data-dkj-staff-picker]) 이라 표시만 있으면 건너뛴다). */
    function noStaff(f) {
      return f.staff === false ? ' data-dkj-staff-picker="skip"' : '';
    }

    function renderInfo() {
      var host = $('infoFields');
      if (!host) return;
      host.innerHTML = (spec.infoFields || []).map(function (f) {
        var v = state.info[f.id] || '';
        // readonly 는 서식에서 값이 고정된 칸(예: 자체 처리하는 폐기물 수거업체)이다.
        // disabled 대신 readonly 를 쓰면 값이 그대로 state 에 남아 정본에도 인쇄된다.
        var input = f.readonly
          ? '<input type="text" data-info="' + f.id + '" data-fixed="1" value="' + esc(v) +
            '" readonly disabled>'
          : f.type === 'date'
            ? '<input type="date" data-info="' + f.id + '" value="' + esc(v) + '">'
            : f.type === 'month'
              ? '<input type="month" data-info="' + f.id + '" value="' + esc(v) + '">'
              : '<input type="text" data-info="' + f.id + '"' + noStaff(f) + ' value="' + esc(v) +
                '" placeholder="' + esc(f.placeholder || '') + '">';
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

    /** 휴무일처럼 아예 기재하지 않는 행인지 — spec.disableRowIf 로 지정한다 */
    function isRowDisabled(row) {
      var cfg = spec.disableRowIf;
      if (!cfg || !row) return false;
      return (cfg.values || []).indexOf(String(row[cfg.key] || '').trim()) !== -1;
    }

    /** 터치 O/X 버튼 묶음 — 태블릿에서 드롭다운을 여닫지 않고 한 번에 찍는다 */
    function toggleInput(c, ri, v) {
      var choices = (c.choices || []).slice();
      // 예전 기록(적/부 등 지금 선택지에 없는 값)이 조용히 사라지지 않도록 그대로 보여준다
      if (v && choices.indexOf(v) === -1) choices.push(v);
      return '<div class="lgf-tg" role="group">' + choices.map(function (o) {
        return '<button type="button" class="lgf-tg-btn' + (v === o ? ' on' : '') +
          '" data-r="' + ri + '" data-tg="' + c.key + '" data-v="' + esc(o) + '">' + esc(o) + '</button>';
      }).join('') + '</div>';
    }

    function cellInput(c, ri, v, row) {
      if (c.readonly) {
        return '<span class="lgf-fixed">' + esc(v) + '</span>';
      }
      // 설비 종류에 따라 해당 없는 항목 칸을 회색 처리하고 입력을 막는다
      // (예: 포충등 행에서는 보행해충·설치류 칸이 해당 없음).
      if (c.enableIf && row && String(row[c.enableIf.field] || '').indexOf(c.enableIf.includes) === -1) {
        return '<input type="text" class="lgf-disabled" data-r="' + ri + '" data-c="' + c.key +
          '" value="" disabled aria-hidden="true">';
      }
      if (c.ui === 'toggle' && c.type === 'choice') {
        return toggleInput(c, ri, v);
      }
      if (c.type === 'choice') {
        return '<select data-r="' + ri + '" data-c="' + c.key + '">' +
          '<option value=""></option>' +
          (c.choices || []).map(function (o) {
            return '<option value="' + esc(o) + '"' + (v === o ? ' selected' : '') + '>' + esc(o) + '</option>';
          }).join('') + '</select>';
      }
      // combo — 자주 쓰는 품목을 목록에서 고르되 목록에 없는 것도 직접 칠 수 있다
      if (c.type === 'combo') {
        return '<input type="text" list="lgfList_' + c.key + '" data-r="' + ri + '" data-c="' + c.key +
          '" value="' + esc(v) + '" placeholder="' + esc(c.placeholder || '선택/입력') + '">';
      }
      var t = c.type === 'num' ? 'number' : (c.type === 'date' ? 'date' : 'text');
      return '<input type="' + t + '" data-r="' + ri + '" data-c="' + c.key + '" value="' +
        esc(v) + '" placeholder="' + esc(c.unit || '') + '">';
    }

    /** 휴무일 행 — 일자·요일만 남기고 기재란은 하나로 합쳐 '휴무'만 표시한다.
        칸마다 '휴무'를 반복해 찍으면 가로로 긴 온도표에서 읽기가 더 나빠진다. */
    function offRowCells(row) {
      var label = esc(spec.disableRowIf.label || '휴무');
      var out = '';
      var i = 0;
      while (i < COLS.length) {
        if (COLS[i].readonly) {
          out += '<td>' + cellInput(COLS[i], -1, row[COLS[i].key] || '', row) + '</td>';
          i++;
        } else {
          var j = i;
          while (j + 1 < COLS.length && !COLS[j + 1].readonly) j++;
          out += '<td class="lgf-off-cell" colspan="' + (j - i + 1) + '">' +
            '<span class="lgf-off">' + label + '</span></td>';
          i = j + 1;
        }
      }
      return out;
    }

    /** combo 열이 참조하는 <datalist> 를 표 앞에 한 번만 깐다 */
    function datalistHtml() {
      return COLS.filter(function (c) { return c.type === 'combo' && (c.choices || []).length; })
        .map(function (c) {
          return '<datalist id="lgfList_' + c.key + '">' + c.choices.map(function (o) {
            return '<option value="' + esc(o) + '"></option>';
          }).join('') + '</datalist>';
        }).join('');
    }

    function renderGrid() {
      var host = $('ledgerGrid');
      if (!host) return;
      var thead = global.DkjLedgerPrint
        ? global.DkjLedgerPrint.theadHtml(
            spec.defaultRows ? COLS : COLS.concat([{ key: '__act', label: '' }]))
        : '';
      var body = state.rows.map(function (r, ri) {
        var cells = isRowDisabled(r)
          ? offRowCells(r)
          : COLS.map(function (c) {
              return '<td>' + cellInput(c, ri, r[c.key] || '', r) + '</td>';
            }).join('');
        return '<tr' + (isRowDisabled(r) ? ' class="lgf-row-off"' : '') + '>' + cells +
          (spec.defaultRows ? '' :
            '<td class="lgf-act"><button type="button" class="lgf-del" data-del="' + ri +
            '">삭제</button></td>') + '</tr>';
      }).join('');
      host.innerHTML = datalistHtml() +
        '<table class="lgf-table"><thead>' + thead + '</thead><tbody>' + body + '</tbody></table>';

      host.querySelectorAll('[data-r]').forEach(function (el) {
        var ev = el.tagName === 'SELECT' ? 'change' : 'input';
        el.addEventListener(ev, function () {
          state.rows[Number(el.getAttribute('data-r'))][el.getAttribute('data-c')] = el.value;
          scheduleDraft();
        });
      });
      host.querySelectorAll('[data-tg]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (state.locked) return;
          var row = state.rows[Number(b.getAttribute('data-r'))];
          var key = b.getAttribute('data-tg');
          var val = b.getAttribute('data-v');
          // 같은 버튼을 다시 누르면 해제 — 잘못 찍었을 때 지우는 유일한 방법이다
          row[key] = row[key] === val ? '' : val;
          renderGrid();
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
        + '#infoFields input, #infoFields select, #incidentGrid input')
        .forEach(function (el) { el.disabled = !!state.locked; });
      // 잠금 해제 시에도 서식상 읽기전용인 칸은 계속 막아 둔다
      host.querySelectorAll('#infoFields [data-fixed]').forEach(function (el) { el.disabled = true; });
      ['btnBulkOk', 'btnBulkNg'].forEach(function (id) {
        if ($(id)) $(id).disabled = !!state.locked;
      });
    }

    function filledRows() {
      // 서식에 미리 인쇄된 칸(구역·점검항목·고정 수거업체 등)과 휴무일 행은 '기재됨'으로
      // 세지 않는다. 세면 아무것도 안 쓴 시트가 검증을 통과하고 건수도 부풀려진다.
      var inputCols = COLS.filter(function (c) { return !c.readonly; });
      var cols = inputCols.length ? inputCols : COLS;
      return state.rows.filter(function (r) {
        if (isRowDisabled(r)) return false;
        return cols.some(function (c) { return String(r[c.key] || '').trim(); });
      });
    }

    function applyBulkChoice(value) {
      var keys = spec.bulkChoiceKeys || [];
      if (state.locked || !keys.length) return;
      state.rows.forEach(function (row) {
        if (isRowDisabled(row)) return;
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
      // 대기 중인 임시저장 타이머를 지운다 — 안 지우면 저장 직후 "저장됨"이 잠깐
      // 떴다가 그 타이머가 뒤늦게 "임시저장"으로 덮어써 버린다.
      clearTimeout(draftTimer);
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
