/**
 * DkjApproval — 전자결재 + 감사이력(변조 탐지)
 *
 * 스마트HACCP 등록 요건 중 '기록 위변조 방지'의 최소 형태를 구현한다.
 *
 *  1) 감사이력  : 저장·작성완료·결재 행위를 append-only 로 쌓는다. 수정/삭제 API 없음.
 *  2) 해시 체인 : 각 항목이 직전 항목의 해시를 품는다. 중간을 고치면 이후가 전부 깨진다.
 *  3) 3단 결재  : 작성/검토/승인 각 단계에 이름과 시각을 확정 기록한다.
 *
 * 주의 — 이것은 브라우저 로컬 저장 기준의 '변조 탐지'다.
 * 저장소 자체를 통째로 교체하는 공격은 막지 못한다. 서버 도입 시
 * 이 체인을 서버에서 재검증하는 것이 다음 단계다.
 */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function nowIso() { return new Date().toISOString(); }

  function fmt(iso) {
    if (!iso) return '';
    return String(iso).slice(0, 16).replace('T', ' ');
  }

  /* ---------- 해시 ----------
     crypto.subtle 은 비동기이고 file:// 에서는 동작하지 않는다.
     기록 저장을 막지 않도록 동기 해시(FNV-1a 64bit 유사)를 쓴다.
     암호학적 서명이 아니라 '변조 탐지용 체크값'이다. */
  function hash(str) {
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      h1 ^= c; h1 = (h1 * 0x01000193) >>> 0;
      h2 ^= (c + i); h2 = (h2 * 0x85ebca6b) >>> 0;
    }
    return ('00000000' + h1.toString(16)).slice(-8) +
           ('00000000' + h2.toString(16)).slice(-8);
  }

  function entryHash(prev, e) {
    return hash([prev, e.at, e.action, e.by, e.detail].join('|'));
  }

  var STAGES = [
    { key: 'writer', label: '작성', role: '작성자' },
    { key: 'reviewer', label: '검토', role: '검토자' },
    { key: 'approver', label: '승인', role: '승인자' }
  ];

  /* ---------- 서명 주체 ----------
     결재 서명은 '지금 로그인한 사람'으로 남긴다. 폼의 결재자 이름 칸은 누구나 아무 이름이나
     타이핑할 수 있어서, 그 값으로 서명하면 남의 이름을 빌린 결재를 막을 수 없다.
     로그인 세션(DkjAuth)이 있으면 그 이름·사번이 서명 주체이고, 폼에 적힌 이름은
     claimed 로 함께 남겨 둔다(둘이 다르면 심사에서 확인할 수 있게).

     클라우드 미설정 상태(파일럿 준비 중)에서는 로그인 자체가 없으므로 종전처럼
     폼에 적힌 이름으로 서명한다 — 그때는 signer.source 가 'form' 으로 남는다. */
  function me() {
    try {
      return (global.DkjAuth && global.DkjAuth.user()) || null;
    } catch (e) { return null; }
  }

  /** 감사이력·서명에 쓸 표기 — '홍길동(1234)' */
  function whoLabel(u) {
    if (!u) return '';
    return u.empId ? u.name + '(' + u.empId + ')' : u.name;
  }

  /* ---------- 감사이력 ---------- */

  /** 기록에 항목을 덧붙인다. 기존 항목은 절대 수정하지 않는다. */
  function append(state, action, by, detail) {
    if (!state.audit || !Array.isArray(state.audit)) state.audit = [];
    var prev = state.audit.length ? state.audit[state.audit.length - 1].hash : 'GENESIS';
    var actor = me();
    var e = {
      at: nowIso(),
      action: action,
      by: by || '',
      actorUid: (actor && actor.uid) || '',
      detail: detail || ''
    };
    e.prev = prev;
    e.hash = entryHash(prev, e);
    state.audit.push(e);
    return e;
  }

  /** 체인 검증 — {ok, brokenAt, total} */
  function verify(state) {
    var list = (state && state.audit) || [];
    var prev = 'GENESIS';
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.prev !== prev || e.hash !== entryHash(e.prev, e)) {
        return { ok: false, brokenAt: i + 1, total: list.length };
      }
      prev = e.hash;
    }
    return { ok: true, brokenAt: 0, total: list.length };
  }

  /* ---------- 평면 필드 어댑터 ----------
     결재 패널은 state.approvals.{writer,reviewer,approver} 를 읽지만,
     서식마다 이름 칸이 다르다(점검자/확인자, 모니터링 담당자/확인자, 처리자/승인자 …).
     각 서식이 자기 필드명을 map 으로 넘기면 여기서 approvals 로 맞춘다.

       DkjApproval.bindFlat(state, { writer: ['writer', 'inspector'], approver: 'confirmer' })

     값은 앞에 적은 필드부터 찾아 처음 채워진 것을 쓴다. */
  function bindFlat(state, map) {
    if (!state) return state;
    if (!state.approvals) state.approvals = {};
    Object.keys(map).forEach(function (stageKey) {
      var names = map[stageKey];
      if (!Array.isArray(names)) names = [names];
      var v = '';
      for (var i = 0; i < names.length && !v; i++) v = state[names[i]] || '';
      state.approvals[stageKey] = v;
    });
    return state;
  }

  /* ---------- 잠금 후 내용 변경 차단 ----------
     작성완료(잠금)된 기록을 '불러오기' 로 다시 열면 텍스트 입력칸에는 잠금 가드가 없어서
     내용을 고친 뒤 저장/작성완료 버튼을 다시 누르면 같은 id 로 조용히 덮어써졌다.
     다만 검토·승인 결재는 잠긴 기록을 다시 저장해야 신호(signoff)가 남는 구조라
     재저장 자체를 막을 수는 없다 — 결재·이력 관련 필드만 예외로 두고
     나머지 필드가 하나라도 달라지면 막는다. */
  var UNLOCKED_SAVE_FIELDS = { signoff: 1, audit: 1, updatedAt: 1, updatedBy: 1, updatedByEmpId: 1, locked: 1 };

  function sameLockedContent(prev, next) {
    var keys = {}, k;
    for (k in prev) keys[k] = 1;
    for (k in next) keys[k] = 1;
    for (k in keys) {
      if (UNLOCKED_SAVE_FIELDS[k]) continue;
      if (JSON.stringify(prev[k]) !== JSON.stringify(next[k])) return false;
    }
    return true;
  }

  /* ---------- 저장 훅 ----------
     모든 엔진·서식별 스크립트가 DkjRecordStore.save 를 쓴다.
     엔진을 각각 고치는 대신 저장 지점 한 곳에서 이력을 남긴다. */
  function installHook() {
    if (!global.DkjRecordStore || global.DkjRecordStore.__auditHooked) return;
    var orig = global.DkjRecordStore.save;
    global.DkjRecordStore.save = function (formId, record) {
      var prev = record.id ? this.get(formId, record.id) : null;
      if (prev && prev.locked && (!record.locked || !sameLockedContent(prev, record))) {
        try { global.alert('작성완료(잠금)된 기록의 내용은 수정할 수 없습니다. 결재(서명)는 계속 진행할 수 있습니다.'); } catch (e) { /* alert 불가 환경 무시 */ }
        return prev;
      }
      try {
        // 저장한 사람도 로그인 세션을 우선한다 — 폼에 적힌 이름은 누구나 바꿀 수 있다.
        var u = me();
        var by = u ? whoLabel(u)
                   : ((record.approvals && record.approvals.writer) || record.inspector ||
                      (record.info && record.info.inspector) || '');
        append(record, record.locked ? 'LOCK' : 'SAVE',
               by, record.locked ? '작성완료(잠금)' : '저장');
      } catch (e) { /* 이력 실패가 저장을 막지 않는다 */ }
      return orig.call(this, formId, record);
    };
    global.DkjRecordStore.__auditHooked = true;
  }

  /* ---------- 삭제 차단 ----------
     작성완료(잠금)된 기록은 지울 수 없어야 한다 — 지금까지는 각 서식의 '최근 기록'
     삭제 버튼이 잠금 여부를 보지 않고 DkjRecordStore.remove 를 그대로 불렀다.
     모든 서식이 이 store 하나를 거치므로, 저장 훅과 같은 방식으로 여기 한 곳만 막는다. */
  function installRemoveGuard() {
    if (!global.DkjRecordStore || global.DkjRecordStore.__removeGuarded) return;
    var orig = global.DkjRecordStore.remove;
    global.DkjRecordStore.remove = function (formId, id) {
      var rec = this.get(formId, id);
      if (rec && rec.locked) {
        try { global.alert('작성완료(잠금)된 기록은 삭제할 수 없습니다.'); } catch (e) { /* alert 불가 환경 무시 */ }
        return false;
      }
      return orig.call(this, formId, id);
    };
    global.DkjRecordStore.__removeGuarded = true;
  }

  function staffOptions() {
    var rows = [];
    var seen = {};
    function add(empId, name) {
      var label = String(name || '').trim();
      var id = String(empId || '').trim();
      if (!label && id) label = '사번 ' + id;
      if (!label || seen[label]) return;
      seen[label] = true;
      rows.push({ value: label, label: label + (id ? ' (' + id + ')' : '') });
    }
    try {
      var fixed = global.DkjAuth && global.DkjAuth.staff && global.DkjAuth.staff();
      Object.keys(fixed || {}).forEach(function (id) { add(id, fixed[id].name); });
    } catch (e) {}
    try {
      var current = me();
      if (current) add(current.empId, current.name);
    } catch (e) {}
    return rows;
  }

  function attachStaffPickers() {
    var fields = ['writer', 'reviewer', 'approver', 'inspector', 'confirmer', 'monitorName'];
    var options = staffOptions();
    fields.forEach(function (id) {
      var input = document.getElementById(id);
      if (!input) return;
      var currentValue = input.value || '';
      var select = input;
      if (input.tagName === 'INPUT') {
        select = document.createElement('select');
        select.id = input.id;
        select.className = input.className;
        select.required = input.required;
        input.parentNode.replaceChild(select, input);
      }
      if (select.tagName !== 'SELECT') return;
      select.setAttribute('data-dkj-staff-picker', 'true');
      select.innerHTML = '<option value="">등록 인원 선택</option>' + options.map(function (o) {
        return '<option value="' + esc(o.value) + '">' + esc(o.label) + '</option>';
      }).join('');
      if (currentValue) {
        if (!options.some(function (o) { return o.value === currentValue; })) {
          select.insertAdjacentHTML('beforeend', '<option value="' + esc(currentValue) + '">' + esc(currentValue) + '</option>');
        }
        select.value = currentValue;
      }
      if (!select.getAttribute('data-dkj-bound')) {
        select.setAttribute('data-dkj-bound', 'true');
        var handler = function () {
          global.dispatchEvent(new CustomEvent('dkj:approval-changed'));
        };
        select.addEventListener('input', handler);
        select.addEventListener('change', handler);
      }
    });
  }

  /* ---------- 결재 패널 ---------- */

  function mount(opts) {
    var host = document.getElementById('approvalPanel');
    if (!host) return null;

    var getState = opts.getState;
    var onChange = opts.onChange || function () {};

    /* 서식에 따라 결재 단계가 다르다.
       O/X 점검일보처럼 점검자·확인자 2단인 서식은 stages: ['writer','approver'] 로 줄이고,
       종이 원본의 호칭이 다르면 labels 로 바꾼다. 기본은 3단(작성·검토·승인). */
    var stages = STAGES;
    if (opts.stages && opts.stages.length) {
      stages = STAGES.filter(function (s) { return opts.stages.indexOf(s.key) !== -1; });
    }
    if (opts.labels) {
      stages = stages.map(function (s) {
        var lab = opts.labels[s.key];
        return lab ? { key: s.key, label: lab, role: lab + '자' } : s;
      });
    }

    function stageOf(key) {
      return stages.filter(function (x) { return x.key === key; })[0] || { label: key, role: key };
    }

    function stageHtml(st, s) {
      var sign = (s.signoff && s.signoff[st.key]) || null;
      var name = (s.approvals && s.approvals[st.key]) || '';
      var done = !!(sign && sign.at);
      // 로그인 서명이면 사번을 함께 보여 준다. 폼에 적힌 이름과 다르면 그 사실도 드러낸다.
      var shown = done ? (sign.empId ? sign.name + ' (' + sign.empId + ')' : sign.name) : (name || '—');
      var mismatch = done && sign.claimed
        ? '<div class="apv-claimed">기재명 ' + esc(sign.claimed) + '</div>' : '';
      // 권한표에 걸리면 버튼을 눌러도 되지 않으니 아예 잠그고 이유를 적는다
      var allowed = !global.DkjAuth || !global.DkjAuth.can || global.DkjAuth.can(st.key);
      var why = allowed || !global.DkjAuth.denyReason ? '' : global.DkjAuth.denyReason(st.key);

      return '<div class="apv-stage' + (done ? ' done' : '') + '">' +
        '<div class="apv-lab">' + esc(st.label) + '</div>' +
        '<div class="apv-name">' + esc(shown) + '</div>' + mismatch +
        '<div class="apv-at">' + (done ? esc(fmt(sign.at)) : '미결재') + '</div>' +
        (done
          ? '<span class="apv-mark">서명됨</span>'
          : allowed
            ? '<button type="button" class="pill-btn ghost apv-btn" data-stage="' +
              st.key + '">' + esc(st.label) + ' 확정</button>'
            : '<button type="button" class="pill-btn ghost apv-btn" disabled ' +
              'title="' + esc(why) + '">' + esc(st.label) + ' 확정</button>' +
              '<div class="apv-deny">' + esc(why) + '</div>') +
        '</div>';
    }

    function render() {
      var s = getState();
      var v = verify(s);
      var audit = (s.audit || []).slice().reverse();

      host.innerHTML =
        '<div class="apv-stages">' +
        stages.map(function (st) { return stageHtml(st, s); }).join('') +
        '</div>' +
        '<div class="apv-verify ' + (v.ok ? 'ok' : 'ng') + '">' +
        (v.ok
          ? '기록 무결성 정상 · 이력 ' + v.total + '건'
          : '⚠ 이력 ' + v.brokenAt + '번째에서 불일치 — 기록이 변경되었을 수 있습니다') +
        '</div>' +
        '<details class="apv-log"' + (audit.length ? '' : ' hidden') + '>' +
        '<summary>감사이력 ' + audit.length + '건 보기</summary>' +
        '<div class="apv-log-list">' +
        audit.map(function (e) {
          return '<div class="apv-log-row">' +
            '<span class="apv-log-at">' + esc(fmt(e.at)) + '</span>' +
            '<span class="apv-log-act">' + esc(e.action) + '</span>' +
            '<span class="apv-log-by">' + esc(e.by || '-') + '</span>' +
            '<span class="apv-log-dt">' + esc(e.detail || '') + '</span>' +
            '<code class="apv-log-h">' + esc(String(e.hash).slice(0, 8)) + '</code>' +
            '</div>';
        }).join('') +
        '</div></details>';

      host.querySelectorAll('.apv-btn').forEach(function (b) {
        b.addEventListener('click', function () {
          var key = b.getAttribute('data-stage');
          // 버튼은 잠가 뒀지만 화면을 만져 되살릴 수 있으니 누를 때 한 번 더 본다
          if (global.DkjAuth && global.DkjAuth.can && !global.DkjAuth.can(key)) {
            alert(global.DkjAuth.denyReason(key));
            return;
          }
          var st = getState();
          var claimed = (st.approvals && st.approvals[key]) || '';
          var u = me();

          if (!u && !claimed) {
            alert(stageOf(key).role + ' 이름을 먼저 입력하세요.');
            return;
          }

          // 서명자 = 로그인한 사람. 로그인이 없으면(미설정 파일럿) 폼에 적힌 이름.
          var signer = u
            ? { name: u.name, empId: u.empId, source: 'login' }
            : { name: claimed, empId: '', source: 'form' };

          var msg = signer.name + ' 님으로 ' + stageOf(key).label +
                    ' 결재를 확정합니다.\n확정 후에는 취소할 수 없습니다.';
          if (u && claimed && claimed !== u.name) {
            msg = '결재란에 적힌 이름은 「' + claimed + '」 이지만, 지금 로그인한 사람은 「' +
                  u.name + '」 입니다.\n\n서명은 로그인한 ' + u.name + ' 님으로 남습니다.\n' + msg;
          }
          if (!confirm(msg)) return;

          if (!st.signoff) st.signoff = {};
          st.signoff[key] = {
            name: signer.name,
            empId: signer.empId,
            uid: (u && u.uid) || '',
            source: signer.source,
            claimed: claimed && claimed !== signer.name ? claimed : undefined,
            at: nowIso()
          };
          append(st, 'SIGN', u ? whoLabel(u) : signer.name, stageOf(key).label + ' 결재');
          onChange(st);
          render();
        });
      });
    }

    render();
    try {
      if (global.DkjAuth && global.DkjAuth.loadStaff) global.DkjAuth.loadStaff()['catch'](function () {});
      if (global.DkjAuth && global.DkjAuth.loadUsers) global.DkjAuth.loadUsers()['catch'](function () {});
    } catch (e) {}
    attachStaffPickers();
    document.addEventListener('dkj:auth-ready', function () {
      try {
        if (global.DkjAuth && global.DkjAuth.loadUsers) global.DkjAuth.loadUsers()['catch'](function () {});
      } catch (e) {}
    });
    document.addEventListener('dkj:staff-loaded', function () {
      attachStaffPickers();
      render();
    });
    document.addEventListener('dkj:auth-ready', attachStaffPickers);

    var onFieldChange = function (e) {
      if (e && e.target && /^(writer|reviewer|approver|inspector|confirmer|monitorName)$/.test(e.target.id)) {
        if (typeof getState === 'function') getState();
        render();
      }
    };
    document.addEventListener('input', onFieldChange);
    document.addEventListener('change', onFieldChange);
    global.addEventListener('dkj:approval-changed', function () {
      if (typeof getState === 'function') getState();
      render();
    });

    return { render: render };
  }

  installHook();
  installRemoveGuard();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      installHook();
      installRemoveGuard();
    });
  }

  global.DkjApproval = {
    mount: mount,
    bindFlat: bindFlat,
    append: append,
    verify: verify,
    hash: hash,
    STAGES: STAGES
  };
})(window);
