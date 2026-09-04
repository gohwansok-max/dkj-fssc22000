/**
 * DkjReportForm — 유형 F(보고서/일지) 입력 엔진
 * 1 레코드 = 보고서 1장. 블록(pairs/check/text/table/signs)을 조합해 렌더한다.
 */
(function (global) {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function emptyTableRow(b) {
    var r = {};
    (b.columns || []).forEach(function (c) { r[c.key] = ''; });
    return r;
  }

  function emptyState(spec) {
    var values = {};
    var tables = {};
    (spec.blocks || []).forEach(function (b) {
      if (b.type === 'pairs' || b.type === 'signs') {
        (b.fields || []).forEach(function (f) {
          values[f.id] = f.type === 'date' ? today() : (f.default || '');
        });
      } else if (b.type === 'check') {
        values[b.id] = b.default || '';
      } else if (b.type === 'text') {
        values[b.id] = b.default || '';
      } else if (b.type === 'table') {
        var rows = [];
        for (var i = 0; i < (b.rows || 6); i++) rows.push(emptyTableRow(b));
        tables[b.id] = rows;
      }
    });
    return {
      values: values,
      tables: tables,
      approvals: { writer: '', reviewer: '', approver: '' },
      signoff: {},
      // audit 를 여기서 만들어 둬야 저장 훅이 같은 배열에 이어 붙인다.
      // 없으면 저장할 때마다 새 배열이 생겨 감사이력이 1건으로 초기화된다.
      audit: [],
      locked: false
    };
  }

  function mount(spec) {
    if (!spec || !spec.code) throw new Error('DkjReportForm: spec.code required');
    var FORM_ID = spec.code;
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

    /* ---------- 블록 렌더 ---------- */

    function fieldInput(f) {
      var v = state.values[f.id] || '';
      var t = f.type === 'date' ? 'date' : 'text';
      return '<input type="' + t + '" data-v="' + f.id + '" value="' + esc(v) +
        '" placeholder="' + esc(f.placeholder || '') + '">';
    }

    function blockHtml(b, bi) {
      if (b.type === 'pairs' || b.type === 'signs') {
        return '<div class="rpf-block"><h3>' + esc(b.label || (b.type === 'signs' ? '서명' : '기본정보')) + '</h3>' +
          '<div class="dkj-field-grid">' +
          (b.fields || []).map(function (f) {
            return '<div class="dkj-field"><label>' + esc(f.label) +
              (f.required ? ' *' : '') + '</label>' + fieldInput(f) + '</div>';
          }).join('') + '</div></div>';
      }
      if (b.type === 'check') {
        var cur = state.values[b.id] || '';
        return '<div class="rpf-block"><h3>' + esc(b.label) + '</h3><div class="rpf-checks">' +
          (b.options || []).map(function (o) {
            return '<button type="button" class="rpf-chk' + (cur === o ? ' on' : '') +
              '" data-chk="' + b.id + '" data-o="' + esc(o) + '">' + esc(o) + '</button>';
          }).join('') + '</div></div>';
      }
      if (b.type === 'text') {
        return '<div class="rpf-block"><h3>' + esc(b.label) + '</h3>' +
          '<textarea data-v="' + b.id + '" rows="' + (b.uiRows || 5) + '" placeholder="' +
          esc(b.placeholder || '') + '">' + esc(state.values[b.id] || '') + '</textarea></div>';
      }
      if (b.type === 'table') {
        var cols = b.columns || [];
        var rows = state.tables[b.id] || [];
        var head = '<tr>' + cols.map(function (c) {
          return '<th' + (c.width ? ' style="width:' + c.width + '"' : '') + '>' + esc(c.label) + '</th>';
        }).join('') + '<th class="lgf-act"></th></tr>';
        var body = rows.map(function (r, ri) {
          return '<tr>' + cols.map(function (c) {
            return '<td><input type="text" data-t="' + b.id + '" data-r="' + ri +
              '" data-c="' + c.key + '" value="' + esc(r[c.key] || '') + '"></td>';
          }).join('') +
            '<td class="lgf-act"><button type="button" class="lgf-del" data-trm="' + b.id +
            '" data-ri="' + ri + '">삭제</button></td></tr>';
        }).join('');
        return '<div class="rpf-block"><h3>' + esc(b.label || '기록') +
          ' <button type="button" class="pill-btn ghost rpf-add" data-add="' + b.id + '">+ 행 추가</button></h3>' +
          '<div class="mxf-scroll"><table class="lgf-table"><thead>' + head + '</thead><tbody>' +
          body + '</tbody></table></div></div>';
      }
      return '';
    }

    function renderBlocks() {
      var host = $('reportBlocks');
      if (!host) return;
      host.innerHTML = (spec.blocks || []).map(blockHtml).join('');

      host.querySelectorAll('[data-v]').forEach(function (el) {
        el.addEventListener('input', function () {
          state.values[el.getAttribute('data-v')] = el.value;
          scheduleDraft();
        });
      });
      host.querySelectorAll('[data-chk]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (state.locked) return;
          var id = b.getAttribute('data-chk');
          var o = b.getAttribute('data-o');
          state.values[id] = state.values[id] === o ? '' : o;
          renderBlocks();
          scheduleDraft();
        });
      });
      host.querySelectorAll('[data-t]').forEach(function (el) {
        el.addEventListener('input', function () {
          state.tables[el.getAttribute('data-t')][Number(el.getAttribute('data-r'))]
            [el.getAttribute('data-c')] = el.value;
          scheduleDraft();
        });
      });
      host.querySelectorAll('[data-add]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (state.locked) return;
          var id = b.getAttribute('data-add');
          var blk = (spec.blocks || []).find(function (x) { return x.id === id; });
          state.tables[id].push(emptyTableRow(blk));
          renderBlocks();
          scheduleDraft();
        });
      });
      host.querySelectorAll('[data-trm]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (state.locked) return;
          var id = b.getAttribute('data-trm');
          state.tables[id].splice(Number(b.getAttribute('data-ri')), 1);
          if (!state.tables[id].length) {
            var blk = (spec.blocks || []).find(function (x) { return x.id === id; });
            state.tables[id].push(emptyTableRow(blk));
          }
          renderBlocks();
          scheduleDraft();
        });
      });
      applyLock();
    }

    function applyLock() {
      var host = document.querySelector('.dkj-form-body');
      if (!host) return;
      host.classList.toggle('is-locked', !!state.locked);
      host.querySelectorAll('#reportBlocks input, #reportBlocks textarea, #reportBlocks button')
        .forEach(function (el) { el.disabled = !!state.locked; });
    }

    /* ---------- 검증 / 저장 ---------- */

    function requiredFields() {
      var out = [];
      (spec.blocks || []).forEach(function (b) {
        if (b.type === 'pairs' || b.type === 'signs') {
          (b.fields || []).forEach(function (f) { if (f.required) out.push(f); });
        } else if ((b.type === 'text' || b.type === 'check') && b.required) {
          out.push({ id: b.id, label: b.label });
        }
      });
      return out;
    }

    function validate() {
      if (!state.approvals.writer) return '작성자를 입력하세요.';
      var req = requiredFields();
      for (var i = 0; i < req.length; i++) {
        if (!String(state.values[req[i].id] || '').trim()) {
          return req[i].label + '을(를) 입력하세요.';
        }
      }
      return '';
    }

    function buildTitle() {
      if (spec.titleField && state.values[spec.titleField]) {
        return String(state.values[spec.titleField]);
      }
      var first = requiredFields()[0];
      return first ? String(state.values[first.id] || spec.title) : spec.title;
    }

    function save(lock) {
      var err = validate();
      if (err) { alert(err); return; }
      // 대기 중인 임시저장 타이머를 지운다 — 안 지우면 저장 직후 "저장됨"이 잠깐
      // 떴다가 그 타이머가 뒤늦게 "임시저장"으로 덮어써 버린다.
      clearTimeout(draftTimer);
      state.locked = !!lock;
      var rec = DkjRecordStore.save(FORM_ID, Object.assign({}, state, {
        id: editingId || undefined,
        title: buildTitle(),
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
      renderBlocks();
      refreshApproval();
    }

    function doPrint() {
      $('printSheet').innerHTML = global.DkjReportPrint.render(spec, state);
      setTimeout(function () { window.print(); }, 120);
    }

    function bind() {
      // dkj-approval.js 의 직원 자동선택이 writer/reviewer/approver 칸을 <select>로
      // 통째로 바꿔치기한다 — 개별 요소 리스너 대신 document 위임 리스너를 써야
      // 그 뒤로도 계속 값이 잡힌다.
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
      if ($('btnSave')) $('btnSave').addEventListener('click', function () { save(false); });
      if ($('btnLock')) $('btnLock').addEventListener('click', function () { save(true); });
      if ($('btnNew')) $('btnNew').addEventListener('click', function () {
        editingId = null; state = emptyState(spec); writeForm(); setStatus('새 보고서', false);
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
      bind();
      renderHistory();
      mountApproval();
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

  global.DkjReportForm = { mount: mount, emptyState: emptyState };
})(window);
