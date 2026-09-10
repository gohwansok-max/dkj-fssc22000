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

  /** select 필드의 options 안에 {value:'__register__'} 가 있으면 그 필드는
   *  "새 항목 등록" 을 지원한다 — 예: DKJ-S-02-18 의 차량번호. 값이 사양에
   *  없으니(운행 차량은 계속 늘어난다) localStorage 레지스트리에 사용자가
   *  직접 추가한다. */
  function registrableFields(spec) {
    return (spec.fields || []).filter(function (f) {
      return f.type === 'select' && (f.options || []).some(function (o) {
        return o && o.value === '__register__';
      });
    });
  }
  function registryKeyFor(spec, field) {
    return field.registryKey || ('dkj:registry:' + spec.code + ':' + field.id + ':v1');
  }
  function loadRegistry(key) {
    try {
      var list = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function saveRegistry(key, list) {
    try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) {}
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
      // 여기서 이름을 미리 채우지 않는다 — 점검자는 autoFillUser()가 로그인한
      // 사람으로 채우고, 확인자는 화면에서 드롭다운으로 직접 고른다.
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
    // 'writer' 는 이 서식에 없는 필드다(화면은 점검자·확인자 2단) — 넣으면 로그인한
    // 사람 이름이 최초 1회 박제돼 dkj-export.js 의 pick() 이 실제 점검자(inspector)보다
    // 그 값을 먼저 찾아 기록보관함 작성자 칸이 틀어진다.
    if (global.DkjUtil) global.DkjUtil.autoFillUser(st, ['inspector', 'confirmer']);
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
    var REGISTRABLE = registrableFields(spec);
    var REGISTRABLE_BY_ID = {};
    REGISTRABLE.forEach(function (f) { REGISTRABLE_BY_ID[f.id] = f; });

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

    /** 레지스트리(등록된 값) + 사양에 박힌 고정 옵션을 합쳐 select 를 다시 그린다.
     *  '__register__' 항목 바로 앞에 끼워 넣어, "+ 새 OO 등록" 은 항상 맨 끝에 남는다.
     *  현재 state 값이 레지스트리에도 고정 옵션에도 없으면(다른 기기에서 등록했거나
     *  이 기능이 생기기 전에 저장된 옛 기록) 그 값도 레지스트리에 편입해, 불러온
     *  기록이 빈 선택으로 보이는 일이 없게 한다. */
    function renderRegistryOptions(field) {
      var el = $(field.id);
      if (!el) return;
      var key = registryKeyFor(spec, field);
      var registry = loadRegistry(key);
      var current = state[field.id];
      var fixedValues = (field.options || []).map(function (o) { return (o && o.value !== undefined) ? o.value : o; });
      if (current && fixedValues.indexOf(current) === -1 && registry.indexOf(current) === -1) {
        registry.push(current);
        registry.sort(function (a, b) { return String(a).localeCompare(String(b), 'ko'); });
        saveRegistry(key, registry);
      }
      var parts = [];
      (field.options || []).forEach(function (o) {
        var v = (o && o.value !== undefined) ? o.value : o;
        if (v === '__register__') {
          registry.forEach(function (rv) {
            parts.push('<option value="' + esc(rv) + '">' + esc(rv) + '</option>');
          });
        }
        var label = (o && o.label !== undefined) ? o.label : o;
        parts.push('<option value="' + esc(v) + '">' + esc(label) + '</option>');
      });
      el.innerHTML = parts.join('');
    }

    /** '+ 새 OO 등록' 을 고르면 프롬프트로 값을 받아 레지스트리에 더하고 곧바로
     *  선택 상태로 만든다. 취소하거나 빈 값이면 이전 선택으로 되돌린다 — '__register__'
     *  가 실제 값으로 저장되는 일은 없어야 한다. */
    function promptRegister(field, el) {
      var label = String(field.label || '항목').replace(/\s*\*\s*$/, '');
      var raw = window.prompt(label + '을(를) 입력하세요.', '');
      var value = (raw || '').trim();
      if (!value) { el.value = state[field.id] || ''; return; }
      var key = registryKeyFor(spec, field);
      var registry = loadRegistry(key);
      if (registry.indexOf(value) === -1) {
        registry.push(value);
        registry.sort(function (a, b) { return String(a).localeCompare(String(b), 'ko'); });
        saveRegistry(key, registry);
      }
      state[field.id] = value;
      renderRegistryOptions(field);
      el.value = value;
      readForm();
      refreshApproval();
      scheduleDraft();
    }

    /** 등록된 값을 한 줄에 하나씩 담은 텍스트를 프롬프트로 보여주고, 사용자가 고친
     *  내용을 그대로 레지스트리에 반영한다 — 줄을 지우면 삭제, 글자를 고치면 수정,
     *  줄을 추가하면 등록이다. 별도 삭제·수정 화면을 새로 만들지 않고 기존 prompt()
     *  패턴 하나로 세 가지를 다 처리한다. 이미 저장된 기록은 건드리지 않는다 —
     *  여기서 바뀌는 건 다음에 고를 수 있는 목록뿐이다. */
    function manageRegistry(field, el) {
      var key = registryKeyFor(spec, field);
      var registry = loadRegistry(key);
      if (!registry.length) { alert('등록된 항목이 없습니다.'); return; }
      var label = String(field.label || '항목').replace(/\s*\*\s*$/, '');
      var text = window.prompt(
        label + ' 목록입니다. 줄을 지우면 삭제, 고치면 수정됩니다(취소하면 그대로 둡니다).',
        registry.join('\n')
      );
      if (text === null) return;
      var next = text.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      var seen = {};
      next = next.filter(function (v) { return seen[v] ? false : (seen[v] = true); });
      next.sort(function (a, b) { return String(a).localeCompare(String(b), 'ko'); });
      saveRegistry(key, next);
      renderRegistryOptions(field);
      // 지금 골라져 있던 값이 방금 지워졌거나 이름이 바뀌었으면 선택을 비운다 —
      // 없는 값을 그대로 들고 있으면 화면엔 빈칸으로 보이면서 state 에는 옛 값이 남는다.
      var fixedValues = (field.options || []).map(function (o) { return (o && o.value !== undefined) ? o.value : o; });
      if (state[field.id] && fixedValues.indexOf(state[field.id]) === -1 && next.indexOf(state[field.id]) === -1) {
        state[field.id] = '';
      }
      if (el) el.value = state[field.id] || '';
      readForm();
      refreshApproval();
      scheduleDraft();
    }

    /** 등록형 select 옆에 목록 관리 링크를 한 번만 붙인다. writeForm() 이 기록을
     *  불러올 때마다 다시 불릴 수 있어, 이미 붙어 있으면 다시 만들지 않는다. */
    function ensureManageLink(field) {
      var el = $(field.id);
      if (!el || !el.parentNode) return;
      if (el.parentNode.querySelector('.dkj-registry-manage')) return;
      var link = document.createElement('button');
      link.type = 'button';
      link.className = 'dkj-registry-manage';
      link.style.cssText = 'display:block;margin-top:4px;background:none;border:none;padding:0;' +
        'font-size:12px;color:#2563eb;text-decoration:underline;cursor:pointer;';
      link.textContent = '목록 관리(수정·삭제)';
      link.addEventListener('click', function () { manageRegistry(field, el); });
      el.parentNode.appendChild(link);
    }

    function writeForm() {
      REGISTRABLE.forEach(renderRegistryOptions);
      REGISTRABLE.forEach(ensureManageLink);
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
      // 대기 중인 임시저장 타이머를 지운다 — 안 지우면 저장 직후 "저장됨"이 잠깐
      // 떴다가 그 타이머가 뒤늦게 "임시저장"으로 덮어써 버린다.
      clearTimeout(draftTimer);
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
      // dkj-approval.js 의 직원 자동선택이 inspector 같은 인원 칸을 <select>로 통째로
      // 바꿔치기하면서, 개별 요소에 건 리스너는 그 요소와 함께 사라진다. document 위임
      // 리스너를 쓰면 요소가 나중에 바뀌어도 계속 잡힌다 — readForm()은 매번 id로 다시
      // 조회해서 읽으므로 어떤 요소가 지금 거기 있든 상관없다.
      var onFieldInput = function (e) {
        if (!e.target || ids.indexOf(e.target.id) === -1) return;
        var registrable = REGISTRABLE_BY_ID[e.target.id];
        if (registrable && e.target.value === '__register__') {
          promptRegister(registrable, e.target);
          return;
        }
        readForm();
        refreshApproval();
        scheduleDraft();
      };
      document.addEventListener('input', onFieldInput);
      document.addEventListener('change', onFieldInput);
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
        global.DkjUtil.autoFillUser(state, ['inspector', 'confirmer'], function () {
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
