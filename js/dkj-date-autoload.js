/**
 * 일자별 기록 자동 불러오기 — 업무 콘솔·달력에서 `서식.html?date=YYYY-MM-DD` 로 들어오거나
 * 일보의 날짜 칸을 바꾸면, 그 날짜에 마지막으로 저장된 기록을 자동으로 불러온다.
 * (불러오기 버튼을 따로 눌러야 보이던 것을 없앰 — 2026-10-19 현장 요청)
 *
 * 규칙
 *  - 삭제 표식이 붙은 기록은 제외하고, 같은 날짜가 여럿이면 updatedAt 이 가장 늦은 것을 쓴다.
 *  - 같은 날짜의 임시본(draft)이 그 기록보다 나중에 저장됐으면 임시본이 더 최신 작업이므로 임시본을 쓴다.
 *  - 서식 종류에 따라 '같은 날짜'의 뜻이 다르다: 일 단위(byField), 월 시트(byMonth), 주·월 단위
 *    점검(byPeriod). 엔진이 알맞은 matcher 를 넘기면 같은 규칙으로 기록·임시본을 고른다.
 *  - 저장 기록은 읽기만 한다. 불러온 뒤 고치는 것은 기존 저장 경로(DkjRecordStore.save)를 그대로 탄다.
 */
(function (global) {
  'use strict';

  function queryDate() {
    try {
      var v = new URLSearchParams(global.location.search).get('date');
      return /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '';
    } catch (e) { return ''; }
  }

  function stamp(r) { return String((r && (r.updatedAt || r.createdAt)) || ''); }

  function pick(r, field) {
    if (!r) return '';
    var v = r[field];
    if (!v && r.info) v = r.info[field];
    return v ? String(v) : '';
  }

  /** 'YYYY-MM' — '2026-08' 뿐 아니라 '2026 . 08' 처럼 손으로 적힌 옛 형식도 읽는다. */
  function ymOf(v) {
    var m = String(v || '').match(/(\d{4})\D+(\d{1,2})/);
    return m ? m[1] + '-' + (m[2].length < 2 ? '0' : '') + m[2] : '';
  }
  /** 날짜가 속한 월요일 시작 주의 월요일(YYYY-MM-DD) — DkjRecordEvaluator 의 mondayOf 와 같다. */
  function mondayOf(iso) {
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    var dow = d.getDay();
    d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  var match = {
    /** 일 단위 — 그 필드가 정확히 그 날짜인 기록 */
    byField: function (field) {
      return function (r, date) { return pick(r, field) === date; };
    },
    /** 월 단위 시트 — 그 월 필드가 날짜와 같은 달인 기록 */
    byMonth: function (field) {
      return function (r, date) { var ym = ymOf(pick(r, field)); return !!ym && ym === date.slice(0, 7); };
    },
    /** 주·월 단위 점검 — 그 날짜 필드가 같은 달(또는 같은 월요일 주)에 속한 기록 */
    byPeriod: function (field, period) {
      return function (r, date) {
        var v = pick(r, field);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
        return period === 'month' ? v.slice(0, 7) === date.slice(0, 7) : mondayOf(v) === mondayOf(date);
      };
    }
  };

  /** matcher 는 필드명(문자열 → 일 단위) 또는 function(record, date)
   *  @returns {Promise<{kind:'record'|'draft'|'none', data:object|null}>} */
  async function resolve(formId, date, matcher) {
    var fn = typeof matcher === 'function' ? matcher : match.byField(matcher || 'workDate');
    if (!date || !global.DkjRecordStore) return { kind: 'none', data: null };
    var list = (await global.DkjRecordStore.list(formId)) || [];
    var hit = null;
    list.forEach(function (r) {
      if (!r || r.deleted || !fn(r, date)) return;
      if (!hit || stamp(r) > stamp(hit)) hit = r;
    });
    var draft = null;
    try { draft = (await global.DkjRecordStore.loadDraft(formId)) || null; } catch (e) { draft = null; }
    if (draft && fn(draft, date) && (!hit || String(draft._savedAt || '') > stamp(hit))) {
      return { kind: 'draft', data: draft };
    }
    return hit ? { kind: 'record', data: hit } : { kind: 'none', data: null };
  }

  /** 날짜 입력칸이 바뀌면(change = 입력 확정 시) handler(값)를 부른다. 칸이 화면에서 통째로 다시
   *  그려져도 잡히도록 document 에 위임한다. isDateEl(element) 이 true 인 칸만 본다. */
  function watch(isDateEl, handler) {
    global.document.addEventListener('change', function (e) {
      var el = e.target;
      if (!el || !isDateEl(el) || !/^\d{4}-\d{2}(-\d{2})?$/.test(el.value || '')) return;
      Promise.resolve(handler(el.value)).catch(function (err) {
        if (global.console) global.console.warn('[DkjDateLoad] 날짜 불러오기 실패', err);
      });
    });
  }

  global.DkjDateLoad = { queryDate: queryDate, resolve: resolve, match: match, watch: watch, ymOf: ymOf };
})(window);
