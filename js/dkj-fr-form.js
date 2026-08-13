/**
 * DkjFrForm — FR 시스템 양식 공용 엔진
 * pattern: fields + optional items(O/X) + sections(textarea) + judge
 */
(function (global) {
  'use strict';

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function $(id) {
    return document.getElementById(id);
  }

  function fieldIds(spec) {
    return (spec.fields || []).map(function (f) { return f.id; });
  }

  function sectionIds(spec) {
    return (spec.sections || []).map(function (s) { return s.id; });
  }

  function emptyState(spec) {
    var checks = {};
    (spec.items || []).forEach(function (c) { checks[c.key] = ''; });
    var st = {
      checks: checks,
      judge: '',
      corrective: '',
      writer: '',
      reviewer: '',
      approver: '',
      remark: '',
      locked: false
    };
    (spec.fields || []).forEach(function (f) {
      if (f.type === 'date') st[f.id] = today();
      else if (f.default !== undefined) st[f.id] = f.default;
      else if (f.type === 'number') st[f.id] = f.default != null ? f.default : '';
      else st[f.id] = f.default || '';
    });
    (spec.sections || []).forEach(function (s) {
      st[s.id] = '';
    });
    return st;
  }

  function mount(spec) {
    if (!spec || !spec.code) throw new Error('DkjFrForm: spec.code required');
    var FORM_ID = spec.code;
    var ITEMS = spec.items || [];
    var SECTIONS = spec.sections || [];
    var titleKey = spec.titleKey || null;
    var historyKeys = spec.historyKeys || ['docDate'];
    var state = emptyState(spec);
    var editingId = null;
    var draftTimer = null;
    var ids = fieldIds(spec)
      .concat(sectionIds(spec))
      .concat(['corrective', 'writer', 'reviewer', 'approver', 'remark', 'inspector', 'confirmer'])
      .filter(function (v, i, a) { return a.indexOf(v) === i; });

    function setStatus(msg, saved) {
      var el = $('saveStatus');
      if (!el) return;
      el.innerHTML = '<span class="dot"></span> ' + msg;
      el.className = 'dkj-status' + (saved ? ' saved' : '');
    }

    function renderOxGrid() {
      var grid = $('oxGrid');
      if (!grid || !ITEMS.length) return;
      grid.innerHTML = ITEMS.map(function (item) {
        var v = state.checks[item.key] || '';
        function btn(val) {
          return '<button type="button" class="ox-btn' + (v === val ? ' on' : '') +
            '" data-key="' + item.key + '" data-v="' + val + '">' + val + '</button>';
        }
        return '<div class="ox-row"><div><label>[' + (item.group || '항목') + '] ' + item.label +
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
      if (!ITEMS.length) return;
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
        if (!el) return;
        state[id] = el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value;
      });
      if ($('inspector') && !state.writer) state.writer = state.inspector || '';
    }

    function writeForm() {
      ids.forEach(function (id) {
        var el = $(id);
        if (!el) return;
        var v = state[id];
        if (v === undefined || v === null) v = '';
        el.value = v;
      });
      var dateEl = $('docDate') || $('checkDate');
      if (dateEl && !dateEl.value) dateEl.value = today();
      renderOxGrid();
      renderJudge();
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
      var req = (spec.fields || []).filter(function (f) { return f.required; });
      for (var i = 0; i < req.length; i++) {
        if (!state[req[i].id]) return req[i].label + '을(를) 입력하세요.';
      }
      if (!(state.writer || state.inspector)) return '작성자를 입력하세요.';
      if (ITEMS.length) {
        var filled = Object.values(state.checks).filter(Boolean);
        if (filled.length < (spec.minChecks || 1)) {
          return '점검항목을 ' + (spec.minChecks || 1) + '개 이상 입력하세요.';
        }
      }
      return '';
    }

    function save(lock) {
      var err = validate();
      if (err) { alert(err); return; }
      state.locked = !!lock;
      var titlePart = titleKey && state[titleKey] ? state[titleKey] : (state.docTitle || state.subject || '');
      var rec = DkjRecordStore.save(FORM_ID, Object.assign({}, state, {
        id: editingId || undefined,
        title: (spec.title || FORM_ID) + (titlePart ? ' · ' + titlePart : ''),
        judge: state.judge || (lock ? '작성완료' : '')
      }));
      editingId = rec.id;
      setStatus(lock ? '작성완료 저장됨' : '저장됨', true);
      renderHistory();
    }

    function renderHistory() {
      var list = DkjRecordStore.list(FORM_ID).slice(0, 12);
      var el = $('historyList');
      if (!el) return;
      if (!list.length) {
        el.innerHTML = '<p style="color:#888;font-size:13px;">저장된 기록이 없습니다.</p>';
        return;
      }
      el.innerHTML = list.map(function (r) {
        var bits = historyKeys.map(function (k) { return r[k] || ''; }).filter(Boolean).join(' · ');
        return '<div class="dkj-history-item">' +
          '<div><strong>' + bits + '</strong> ' +
          '<span class="badge ' + (r.locked ? 'done' : 'wip') + '">' + (r.judge || '-') + '</span></div>' +
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
        el.addEventListener('input', scheduleDraft);
        el.addEventListener('change', scheduleDraft);
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
          setStatus('새 기록', false);
        });
      }
      if ($('btnPrint')) {
        $('btnPrint').addEventListener('click', function () {
          readForm();
          if (window.DkjPrint) {
            var tmpl = spec.print || { layout: 'official-fr-generic', docNo: FORM_ID, title: spec.title };
            DkjPrint.print(tmpl, state);
          } else {
            window.print();
          }
        });
      }
    }

    function init() {
      var draft = DkjRecordStore.loadDraft(FORM_ID);
      if (draft) state = Object.assign(emptyState(spec), draft);
      writeForm();
      bind();
      renderHistory();
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
  }

  global.DkjFrForm = { mount: mount, today: today, emptyState: emptyState };
})(window);
