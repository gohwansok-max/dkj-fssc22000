/**
 * DkjFrForm — FR 시스템 양식 공용 엔진
 * pattern: fields + optional items(O/X) + sections(textarea) + judge
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
      // 결재 패널은 approvals(이름) / signoff(확정 서명)를 본다.
      // FR 서식은 writer·reviewer·approver 를 평면 필드로 갖고 있어 readForm 에서 미러링한다.
      // 여기서 이름을 미리 채우지 않는다 — 작성자는 autoFillUser()가 로그인한
      // 사람으로 채우고, 검토·승인자는 화면에서 드롭다운으로 직접 고른다.
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
    (spec.sections || []).forEach(function (s) {
      st[s.id] = '';
    });
    if (global.DkjUtil) global.DkjUtil.autoFillUser(st, ['writer', 'reviewer', 'approver', 'inspector', 'confirmer']);
    return st;
  }

  // 옛 FR-023의 심사 의견은 audit 문자열에 저장됐다. 원본 저장 레코드는 건드리지
  // 않고 화면 상태에서만 새 필드로 읽는다. 이미 정상 배열인 감사이력은 그대로 보존한다.
  function restoreState(spec, saved) {
    var state = Object.assign(emptyState(spec), saved);
    (spec.sections || []).forEach(function (section) {
      var legacy = section.legacyId;
      if (!legacy || !saved || typeof saved[legacy] !== 'string') return;
      if (saved[section.id] === undefined) state[section.id] = saved[legacy];
      if (legacy === 'audit') state.audit = [];
    });
    return state;
  }

  async function mount(spec) {
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

    /* 전자결재 패널 — 모듈이 없으면 그냥 건너뛴다 */
    var apvUi = null;

    /** 평면 필드(writer/reviewer/approver) → 결재 패널이 읽는 approvals 로 맞춘다 */
    function syncApprovals() {
      if (!global.DkjApproval) return;
      global.DkjApproval.bindFlat(state, {
        writer: ['writer', 'inspector'],
        reviewer: 'reviewer',
        approver: ['approver', 'confirmer']
      });
    }

    function mountApproval() {
      if (!global.DkjApproval || apvUi) return;
      apvUi = global.DkjApproval.mount({
        // 한 번도 저장 안 한 새 시트에서 결재를 누르면 먼저 저장한다(검증 포함) — 안 그러면 서명이
        // 이 기기 임시본에만 남아 다른 기기의 검토·승인자에게 보이지 않았다(2026-10-23 점검).
        ensureSaved: async function () { if (!editingId) (await save(false)); return !!editingId; },
        // 이름을 입력한 직후(임시저장 디바운스 400ms 전) 확정을 눌러도
        // 빈 이름으로 반려되지 않도록 화면 값을 먼저 읽는다
        getState: function () { readForm(); return state; },
        // 결재 서명은 임시저장(이 기기에만 남고 클라우드 동기화 안 됨)이 아니라
        // 실제 저장 레코드에 바로 반영해야 다른 기기·다른 사람에게도 보인다.
        // 아직 한 번도 저장 안 한 기록(editingId 없음)에는 서명할 대상이 없으므로
        // 그때만 예전처럼 임시저장으로 남긴다.
        onChange: async function () {
          if (editingId) {
            // title/judge 는 save() 안에서만 계산되고 state 에는 남지 않으므로,
            // 이전에 저장된 기록을 바탕으로 덮어써야 결재만 눌러도 제목이 비지 않는다.
            var prev = (await DkjRecordStore.get(FORM_ID, editingId)) || {};
            // judge 는 save() 가 비어 있으면 '작성완료' 로 채워 저장한다. state.judge('')로 덮으면 내용이
            // 바뀐 것으로 보여 작성완료(잠금) 뒤 검토·승인 서명이 거부됐다(2026-10-23 전 서식 결재 점검).
            (await DkjRecordStore.save(FORM_ID, Object.assign({}, prev, state, {
              id: editingId, title: prev.title || state.title, judge: state.judge || prev.judge || ''
            })));
            setStatus('결재 저장됨 · ' + new Date().toLocaleTimeString('ko-KR'), true);
            (await renderHistory());
          } else {
            scheduleDraft();
          }
        }
      });
    }

    function refreshApproval() {
      if (apvUi) apvUi.render();
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
      syncApprovals();
    }

    function writeForm() {
      // 다른 경로(기록보관함 딥링크 등)로 들어온 기록이 approvals 만 갖고 있으면 평면 필드로 되돌린다
      if (state.approvals) {
        if (!state.writer) state.writer = state.approvals.writer || '';
        if (!state.reviewer) state.reviewer = state.approvals.reviewer || '';
        if (!state.approver) state.approver = state.approvals.approver || '';
      }
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
      syncApprovals();
      refreshApproval();
    }

    function scheduleDraft() {
      clearTimeout(draftTimer);
      draftTimer = setTimeout(async function () {
        readForm();
        (await DkjRecordStore.saveDraft(FORM_ID, state));
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

    var saveInFlight = false;
    async function save(lock) {
      if (saveInFlight) return;
      saveInFlight = true;
      try {
        var err = validate();
        if (err) { alert(err); return; }
        // 대기 중인 임시저장 타이머를 지운다 — 안 지우면 저장 직후 "저장됨"이 잠깐
        // 떴다가 그 타이머가 뒤늦게 "임시저장"으로 덮어써 버린다.
        clearTimeout(draftTimer);
        state.locked = !!lock;
        var titlePart = titleKey && state[titleKey] ? state[titleKey] : (state.docTitle || state.subject || '');
        var rec = (await DkjRecordStore.save(FORM_ID, Object.assign({}, state, {
          id: editingId || undefined,
          title: (spec.title || FORM_ID) + (titlePart ? ' · ' + titlePart : ''),
          judge: state.judge || (lock ? '작성완료' : '')
        })));
        editingId = rec.id;
        setStatus(lock ? '작성완료 저장됨' : '저장됨', true);
        refreshApproval();
        (await renderHistory());
      } finally { saveInFlight = false; }
    }

    async function renderHistory() {
      var list = (await DkjRecordStore.list(FORM_ID)).slice(0, 12);
      var el = $('historyList');
      if (!el) return;
      if (!list.length) {
        el.innerHTML = '<p style="color:#888;font-size:13px;">저장된 기록이 없습니다.</p>';
        return;
      }
      el.innerHTML = list.map(function (r) {
        var bits = historyKeys.map(function (k) { return r[k] || ''; }).filter(Boolean).map(esc).join(' · ');
        return '<div class="dkj-history-item">' +
          '<div><strong>' + bits + '</strong> ' +
          '<span class="badge ' + (r.locked ? 'done' : 'wip') + '">' + esc(r.judge || '-') + '</span></div>' +
          '<div style="display:flex;gap:6px;">' +
          '<button type="button" class="pill-btn ghost" data-load="' + r.id + '">불러오기</button>' +
          '<button type="button" class="pill-btn ghost" data-del="' + r.id + '">삭제</button></div></div>';
      }).join('');
      el.querySelectorAll('[data-load]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var r = (await DkjRecordStore.get(FORM_ID, b.getAttribute('data-load')));
          if (!r) return;
          editingId = r.id;
          state = restoreState(spec, r);
          writeForm();
          setStatus('기록 불러옴', true);
        });
      });
      el.querySelectorAll('[data-del]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('삭제할까요?')) return;
          (await DkjRecordStore.remove(FORM_ID, b.getAttribute('data-del')));
          if (editingId === b.getAttribute('data-del')) {
            editingId = null;
            state = emptyState(spec);
            writeForm();
          }
          (await renderHistory());
        });
      });
    }

    async function bind() {
      // dkj-approval.js 의 직원 자동선택이 writer/inspector 같은 인원 칸을 <select>로
      // 통째로 바꿔치기하면서, 개별 요소에 건 리스너는 그 요소와 함께 사라진다.
      // document 위임 리스너를 쓰면 요소가 나중에 바뀌어도 계속 잡힌다 — readForm()은
      // 어차피 매번 id로 다시 조회해서 읽으므로 어떤 요소가 지금 거기 있든 상관없다.
      var onFieldInput = function (e) {
        if (!e.target || ids.indexOf(e.target.id) === -1) return;
        readForm();
        refreshApproval();
        scheduleDraft();
      };
      document.addEventListener('input', onFieldInput);
      document.addEventListener('change', onFieldInput);
      // 상세내용(sections) 의 "자주 쓰는 문구" 버튼 — textarea 를 그 문구로 채우고
      // 위 onFieldInput 과 같은 경로(readForm→scheduleDraft)를 그대로 태운다.
      document.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('[data-preset-for]');
        if (!btn || state.locked) return;
        var el = $(btn.getAttribute('data-preset-for'));
        if (!el) return;
        el.value = btn.getAttribute('data-preset-text');
        el.dispatchEvent(new Event('input', { bubbles: true }));
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
      if ($('btnSave')) $('btnSave').addEventListener('click', async function () { (await save(false)); });
      if ($('btnLock')) $('btnLock').addEventListener('click', async function () { (await save(true)); });
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
      if (global.DkjUtil) {
        (await global.DkjUtil.attachQuickToolbar($('btnSave') ? $('btnSave').parentNode : null, {
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
            state = restoreState(spec, cloned);
            editingId = null;
            writeForm();
            scheduleDraft();
          }
        }));
        global.DkjUtil.attachChips(document);
      }
    }

    async function init() {
      var draft = (await DkjRecordStore.loadDraft(FORM_ID));
      if (draft) state = restoreState(spec, draft);
      // 달력·콘솔에서 ?date= 로 들어오거나 일자 칸을 바꾸면 그 날짜의 최종 저장 기록을 자동으로 연다
      // (js/dkj-date-autoload.js). 기록이 없으면 그 날짜의 새 서식으로 연다.
      var dateKey = $('docDate') ? 'docDate' : ($('checkDate') ? 'checkDate' : '');
      var loadForDate = null;
      if (dateKey && global.DkjDateLoad) {
        var dateMatch = DkjDateLoad.match.byField(dateKey);
        loadForDate = async function (date, userDriven) {
          var hit = (await DkjDateLoad.resolve(FORM_ID, date, dateMatch));
          if (hit.kind === 'none') return false;
          if (hit.kind === 'record' && hit.data.id && hit.data.id === editingId) return false;
          // 아직 저장하지 않은 새 입력이 있으면 덮어쓰기 전에 확인한다.
          if (userDriven && !editingId) {
            readForm();
            if (JSON.stringify(state.checks) !== JSON.stringify(emptyState(spec).checks) &&
                !confirm(date + ' 저장 기록을 불러오면 지금 입력 중인 내용은 사라집니다. 불러올까요?')) return false;
          }
          editingId = hit.data.id || null;
          state = restoreState(spec, hit.data);
          writeForm();
          setStatus(hit.kind === 'record' ? date + ' 저장 기록 불러옴' : date + ' 임시저장 불러옴', true);
          return true;
        };
        var qd = DkjDateLoad.queryDate();
        if (qd) {
          var first = (await DkjDateLoad.resolve(FORM_ID, qd, dateMatch));
          if (first.kind === 'none') {
            state = emptyState(spec);
            state[dateKey] = qd;
            editingId = null;
          } else {
            editingId = first.data.id || null;
            state = restoreState(spec, first.data);
          }
        }
      }
      writeForm();
      (await bind());
      if (loadForDate) DkjDateLoad.watch(function (el) { return el.id === dateKey; }, function (v) { return loadForDate(v, true); });
      (await renderHistory());
      mountApproval();
      refreshApproval();
      if (global.DkjUtil) {
        global.DkjUtil.autoFillUser(state, ['writer', 'reviewer', 'approver', 'inspector', 'confirmer'], function () {
          writeForm();
        });
      }
      setStatus('준비', false);
      // 기록보관함에서 ?record=<id> 로 들어온 경우 그 기록을 띄운다(임시저장분보다 우선)
      if (global.DkjDeepLink) {
        var opened = (await DkjDeepLink.apply(FORM_ID, function (rec) {
          editingId = rec.id;
          state = restoreState(spec, rec);
          writeForm();
        }));
        if (opened) setStatus('기록 불러옴', true);
      }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else (await init());
  }

  global.DkjFrForm = { mount: mount, today: today, emptyState: emptyState, restoreState: restoreState };
})(window);
