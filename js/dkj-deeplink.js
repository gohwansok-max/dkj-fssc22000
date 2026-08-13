/**
 * 기록 딥링크 — 기록보관함에서 `서식.html?record=<id>` 로 특정 기록을 바로 연다.
 *
 * 서식마다 폼 렌더러(fr/ox/mon/matrix)가 다르고 state 모양도 달라서, 불러오는 방법은
 * 각 렌더러가 콜백으로 알려주게 하고 여기서는 "URL 읽기 → 기록 찾기 → 콜백 → 인쇄" 순서만
 * 맡는다.
 *
 * `&print=1` 이 붙어 있으면 정본 인쇄까지 자동으로 띄운다(기록보관함 → PDF 저장 동선).
 */
(function (global) {
  'use strict';

  function params() {
    try { return new URLSearchParams(global.location.search); } catch (e) { return null; }
  }

  function wanted() {
    var p = params();
    if (!p) return null;
    var id = p.get('record');
    return id ? { id: id, print: p.get('print') === '1' } : null;
  }

  /**
   * @param {string} formId
   * @param {function(object)} onLoad 기록을 폼에 반영하는 콜백
   * @returns {object|null} 불러온 기록
   */
  function apply(formId, onLoad) {
    var want = wanted();
    if (!want || !global.DkjRecordStore) return null;
    var rec = global.DkjRecordStore.get(formId, want.id);
    if (!rec) {
      console.warn('[DkjDeepLink] 기록을 찾지 못했습니다:', formId, want.id);
      return null;
    }
    try { onLoad(rec); } catch (e) {
      console.warn('[DkjDeepLink] 기록 반영 실패', e);
      return null;
    }
    if (want.print) {
      // 폼마다 인쇄 준비 과정이 달라 버튼을 그대로 누른다(가장 확실한 경로)
      setTimeout(function () {
        var btn = document.getElementById('btnPrint');
        if (btn) btn.click();
        else global.print();
      }, 400);
    }
    return rec;
  }

  global.DkjDeepLink = { wanted: wanted, apply: apply };
})(window);
