/**
 * 일자별 기록 자동 불러오기 — 업무 콘솔·달력에서 `서식.html?date=YYYY-MM-DD` 로 들어오거나
 * 일보의 날짜 칸을 바꾸면, 그 날짜에 마지막으로 저장된 기록을 자동으로 불러온다.
 * (불러오기 버튼을 따로 눌러야 보이던 것을 없앰 — 2026-10-19 현장 요청)
 *
 * 규칙
 *  - 삭제 표식이 붙은 기록은 제외하고, 같은 날짜가 여럿이면 updatedAt 이 가장 늦은 것을 쓴다.
 *  - 같은 날짜의 임시본(draft)이 그 기록보다 나중에 저장됐으면 임시본이 더 최신 작업이므로 임시본을 쓴다.
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

  /** @returns {Promise<{kind:'record'|'draft'|'none', data:object|null}>} */
  async function resolve(formId, date, dateField) {
    var field = dateField || 'workDate';
    if (!date || !global.DkjRecordStore) return { kind: 'none', data: null };
    var list = (await global.DkjRecordStore.list(formId)) || [];
    var hit = null;
    list.forEach(function (r) {
      if (!r || r.deleted || r[field] !== date) return;
      if (!hit || stamp(r) > stamp(hit)) hit = r;
    });
    var draft = null;
    try { draft = (await global.DkjRecordStore.loadDraft(formId)) || null; } catch (e) { draft = null; }
    if (draft && draft[field] === date && (!hit || String(draft._savedAt || '') > stamp(hit))) {
      return { kind: 'draft', data: draft };
    }
    return hit ? { kind: 'record', data: hit } : { kind: 'none', data: null };
  }

  global.DkjDateLoad = { queryDate: queryDate, resolve: resolve };
})(window);
