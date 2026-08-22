/**
 * DkjOxForm — O/X 점검일보 공용 엔진
 * mount(spec) where spec = { code, items, fields, minChecks, titleKey, historyKeys, hooks }
 */
(function (global) {
  'use strict';

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function $(id) {
    return document.getElementById(id);
  }

  function fieldIds(spec) {
    return (spec.fields || []).map(function (f) { return f.id; });
  }

  function emptyState(spec) {
    var checks = {};
    (spec.items || []).forEach(function (c) { checks[c.key] = ''; });
    var st = {
      checks: checks,
      judge: '',
      corrective: '',
      inspector: '',
      confirmer: '',
      // O/X 일보는 점검자·확인자 2단이다. 결재 패널이 읽는 approvals 로 readForm 에서 미러링한다.
      approvals: { writer: '', reviewer: '', approver: '' },
      signoff: {},
      // audit 를 여기서 만들어 둬야 저장 훅이 같은 배열에 이어 붙인다.
      // 없으면 저장할 때마다 새 배열이 생겨 감사이력이 1건으로 초기화된다.
      audit: [],
      remark: '',
      locked: false
    };
    (spec.fields || []).forEach(function (f) {
      if (f.type === 'date') st[f.id] = today();
      else if (f.default !== undefined) st[f.id] = f.default;
      else if (f.type === 'number') st[f.id] = f.default != null ? f.default : '';
      else st[f.id] = f.default || '';
    });
    if (spec.defaults) {
      Object.keys(spec.defaults).forEach(function (k) { st[k] = spec.defaults[k]; });
    }
    if (global.DkjUtil) global.DkjUtil.autoFillUser(st, ['inspector', 'writer']);
    return st;
  }

  function mount(spec) {
    if (!spec || !spec.code) throw new Error('DkjOxForm: spec.code required');
    var FORM_ID = spec.code;
    var ITEMS = spec.items || [];
    var minChecks = spec.minChecks != null ? spec.minChecks : 5;
    var titleKey = spec.titleKey || null;
    var historyKeys = spec.historyKeys || ['checkDate'];
    var state = emptyState(spec);
    var editingId = null;
    var draftTimer = null;
    var ids = fieldIds(spec).concat(['corrective', 'inspector', 'confirmer', 'remark']);

    function setStatus(msg, saved) {
      var el = $('saveStatus');
      if (!el) return;
      el.innerHTML = '<span class="dot"></span> ' + msg;
      el.className = 'dkj-status' + (saved ? ' saved' : '');
    }

    /* 전자결재 패널 — 모듈이 없으면 그냥 건너뛴다 */
    var apvUi = null;

    /** 점검자·확인자 → 결재 패널이 읽는 approvals 로 맞춘다 */
    function syncApprovals() {
      if (!global.DkjApproval) return;
      global.DkjApproval.bindFlat(state, { writer: 'inspector', approver: 'confirmer' });
    }

    function mountApproval() {
      if (!global.DkjApproval || apvUi) return;
      apvUi = global.DkjApproval.mount({
        // 종이 원본이 점검자·확인자 2단이므로 검토 단계는 쓰지 않는다
        stages: ['writer', 'approver'],
        labels: { writer: '점검', approver: '확인' },
        // 이름을 입력한 직후(임시저장 디바운스 400ms 전) 확정을 눌러도
        // 빈 이름으로 반려되지 않도록 화면 값을 먼저 읽는다
        getState: function () { readForm(); return state; },
        onChange: function () { scheduleDraft(); }
      });
    }

    function refreshApproval() {
      if (apvUi) apvUi.render();
    }

    function renderOxGrid() {
      var grid = $('oxGrid');
      if (!grid) return;
      grid.innerHTML = ITEMS.map(function (item) {
        var v = state.checks[item.key] || '';
        function btn(val) {
          return '<button type="button" class="ox-btn' + (v === val ? ' on' : '') +
            '" data-key="' + item.key + '" data-v="' + val + '">' + val + '</button>';
        }
        return '<div class="ox-row"><div><label>[' + item.group + '] ' + item.label +
          (item.hint ? '<small>' + item.hint + '</small>' : '') +
          '</label></div><div class="ox-btns">' + btn('O') + btn('X') + btn('-') + '</div></div>';
      }).join('');
      grid.querySelectorAll('.ox-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (state.locked) return;
          state.checks[btn.getAttribute('data-key')] = btn.getAttribute('data-v');
          renderOxGrid();
          autoJudge();
          scheduleDraft();
        });
      });
    }

    function renderJudge() {
      ['judgeOk', 'judgeNg'].forEach(function (id) {
        var el = $(id);
        if (!el) return;
        el.classList.toggle('on', state.judge === el.getAttribute('data-judge'));
      });
    }

    function autoJudge() {
      var vals = Object.values(state.checks).filter(Boolean);
      if (!vals.length) return;
      if (vals.indexOf('X') !== -1) state.judge = '부적합';
      else if (vals.every(function (v) { return v === 'O' || v === '-'; }) && vals.indexOf('O') !== -1) {
        state.judge = '적합';
      }
      renderJudge();
    }

    function readForm() {
      ids.forEach(function (id) {
        var el = $(id);
        if (el) state[id] = el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value;
      });
      syncApprovals();
    }

    function writeForm() {
      ids.forEach(function (id) {
        var el = $(id);
        if (!el) return;
        var v = state[id];
        if (v === undefined || v === null) v = '';
        el.value = v;
      });
      var dateEl = $('checkDate') || $('storeDate');
      if (dateEl && !dateEl.value) dateEl.value = today();
      renderOxGrid();
      renderJudge();
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
      var dateVal = state.checkDate || state.storeDate;
      if (!dateVal) return '점검일자를 입력하세요.';
      if (!state.inspector) return '점검자(담당자)를 입력하세요.';
      if (!state.judge) return '종합판정을 선택하세요.';
      if (state.judge === '부적합' && !(state.corrective || '').trim()) {
        return '부적합 시 즉시조치를 기록하세요.';
      }
      var done = Object.values(state.checks).filter(Boolean).length;
      if (done < minChecks) return '점검항목을 더 입력하세요. (최소 ' + minChecks + '개)';
      if (typeof spec.validateExtra === 'function') {
        var e = spec.validateExtra(state);
        if (e) return e;
      }
      return '';
    }

    function buildTitle() {
      if (typeof spec.titleFn === 'function') return spec.titleFn(state);
      if (titleKey && state[titleKey]) return String(state[titleKey]);
      return spec.title || FORM_ID;
    }

    function save(lock) {
      var err = validate();
      if (err) { alert(err); return; }
      state.locked = !!lock;
      var rec = DkjRecordStore.save(FORM_ID, Object.assign({}, state, {
        id: editingId || undefined,
        title: buildTitle()
      }));
      editingId = rec.id;
      setStatus(lock ? '작성완료 저장됨' : '저장됨', true);
      refreshApproval();
      renderHistory();
    }

    function historyMeta(r) {
      return historyKeys.map(function (k) { return r[k] || ''; }).filter(Boolean).map(esc).join(' · ');
    }

    function renderHistory() {
      var list = DkjRecordStore.list(FORM_ID).slice(0, 12);
      var el = $('historyList');
      if (!el) return;
      if (!list.length) {
        el.innerHTML = '<p style="color:#888;font-size:13px;">저장 기록 없음</p>';
        return;
      }
      el.innerHTML = list.map(function (r) {
        return '<div class="dkj-history-item"><div><strong>' + historyMeta(r) + '</strong>' +
          ' <span class="badge ' + (r.judge === '적합' ? 'done' : 'wip') + '">' + esc(r.judge || '-') + '</span></div>' +
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

    function bind() {
      ids.forEach(function (id) {
        var el = $(id);
        if (!el) return;
        var onFieldInput = function () {
          readForm();
          refreshApproval();
          scheduleDraft();
        };
        el.addEventListener('input', onFieldInput);
        el.addEventListener('change', onFieldInput);
      });
      if ($('judgeOk')) {
        $('judgeOk').addEventListener('click', function () {
          if (state.locked) return;
          state.judge = '적합';
          renderJudge();
          scheduleDraft();
        });
      }
      if ($('judgeNg')) {
        $('judgeNg').addEventListener('click', function () {
          if (state.locked) return;
          state.judge = '부적합';
          renderJudge();
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
          if (typeof spec.onNew === 'function') spec.onNew(state);
          setStatus('새 일보', false);
        });
      }
      if ($('btnPrint')) {
        $('btnPrint').addEventListener('click', function () {
          readForm();
          if (window.DkjPrint) {
            var tmpl = DkjPrint.fromFormSpec(spec);
            DkjPrint.print(tmpl, state);
          } else {
            window.print();
          }
        });
      }
      if (global.DkjUtil) {
        global.DkjUtil.attachQuickToolbar($('btnSave') ? $('btnSave').parentNode : null, {
          formId: FORM_ID,
          hasChecks: ITEMS.length > 0,
          onAllPass: function () {
            if (state.locked) return;
            ITEMS.forEach(function (it) { state.checks[it.key] = 'O'; });
            state.judge = '적합';
            renderOxGrid();
            renderJudge();
            scheduleDraft();
          },
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
      if (typeof spec.afterInit === 'function') {
        spec.afterInit({
          state: state,
          writeForm: writeForm,
          setState: function (patch) {
            Object.assign(state, patch);
            writeForm();
          },
          getState: function () { return state; }
        });
      }
      renderHistory();
      mountApproval();
      refreshApproval();
      if (global.DkjUtil) {
        global.DkjUtil.autoFillUser(state, ['inspector', 'writer'], function () {
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

  global.DkjOxForm = { mount: mount, today: today, emptyState: emptyState };
})(window);
