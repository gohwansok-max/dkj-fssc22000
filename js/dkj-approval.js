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

  /* ---------- 감사이력 ---------- */

  /** 기록에 항목을 덧붙인다. 기존 항목은 절대 수정하지 않는다. */
  function append(state, action, by, detail) {
    if (!state.audit || !Array.isArray(state.audit)) state.audit = [];
    var prev = state.audit.length ? state.audit[state.audit.length - 1].hash : 'GENESIS';
    var e = {
      at: nowIso(),
      action: action,
      by: by || '',
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

  /* ---------- 저장 훅 ----------
     세 엔진(matrix/ledger/report)이 모두 DkjRecordStore.save 를 쓴다.
     엔진을 각각 고치는 대신 저장 지점 한 곳에서 이력을 남긴다. */
  function installHook() {
    if (!global.DkjRecordStore || global.DkjRecordStore.__auditHooked) return;
    var orig = global.DkjRecordStore.save;
    global.DkjRecordStore.save = function (formId, record) {
      try {
        var by = (record.approvals && record.approvals.writer) || record.inspector ||
                 (record.info && record.info.inspector) || '';
        append(record, record.locked ? 'LOCK' : 'SAVE',
               by, record.locked ? '작성완료(잠금)' : '저장');
      } catch (e) { /* 이력 실패가 저장을 막지 않는다 */ }
      return orig.call(this, formId, record);
    };
    global.DkjRecordStore.__auditHooked = true;
  }

  /* ---------- 결재 패널 ---------- */

  function mount(opts) {
    var host = document.getElementById('approvalPanel');
    if (!host) return null;

    var getState = opts.getState;
    var onChange = opts.onChange || function () {};

    function stageHtml(st, s) {
      var sign = (s.signoff && s.signoff[st.key]) || null;
      var name = (s.approvals && s.approvals[st.key]) || '';
      var done = !!(sign && sign.at);
      return '<div class="apv-stage' + (done ? ' done' : '') + '">' +
        '<div class="apv-lab">' + esc(st.label) + '</div>' +
        '<div class="apv-name">' + esc(done ? sign.name : (name || '—')) + '</div>' +
        '<div class="apv-at">' + (done ? esc(fmt(sign.at)) : '미결재') + '</div>' +
        (done
          ? '<span class="apv-mark">서명됨</span>'
          : '<button type="button" class="pill-btn ghost apv-btn" data-stage="' +
            st.key + '">' + esc(st.label) + ' 확정</button>') +
        '</div>';
    }

    function render() {
      var s = getState();
      var v = verify(s);
      var audit = (s.audit || []).slice().reverse();

      host.innerHTML =
        '<div class="apv-stages">' +
        STAGES.map(function (st) { return stageHtml(st, s); }).join('') +
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
          var st = getState();
          var name = (st.approvals && st.approvals[key]) || '';
          if (!name) {
            alert(STAGES.filter(function (x) { return x.key === key; })[0].role +
                  ' 이름을 먼저 입력하세요.');
            return;
          }
          if (!confirm(name + ' 님으로 ' +
              STAGES.filter(function (x) { return x.key === key; })[0].label +
              ' 결재를 확정합니다.\n확정 후에는 취소할 수 없습니다.')) return;
          if (!st.signoff) st.signoff = {};
          st.signoff[key] = { name: name, at: nowIso() };
          append(st, 'SIGN', name, STAGES.filter(function (x) {
            return x.key === key;
          })[0].label + ' 결재');
          onChange(st);
          render();
        });
      });
    }

    render();
    return { render: render };
  }

  installHook();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installHook);
  }

  global.DkjApproval = {
    mount: mount,
    append: append,
    verify: verify,
    hash: hash,
    STAGES: STAGES
  };
})(window);
