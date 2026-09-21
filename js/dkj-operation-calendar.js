/**
 * DkjOperationCalendar — 기록양식 페이지에서 쓰는 생산일·비생산일 판정 (읽기 전용)
 *
 * 업무 콘솔(js/dkj-console.js)이 관리하는 공유 캘린더를 그대로 읽는다 — 같은
 * 로컬 캐시 키(dkj:operation-calendar:v1)와 RTDB 경로를 보되, 콘솔 UI 렌더링·
 * 서식 카탈로그 로딩까지 딸려오는 dkj-console.js 전체를 기록양식 페이지에
 * 끌어오지 않기 위해 판정 로직만 떼어냈다. 달력에서 날짜를 비생산일로
 * 지정하면(예: 추석 연휴) 여기를 통해 대장(dkj-ledger-form.js)의 휴무행
 * 판정에도 그대로 반영된다.
 */
(function (global) {
  'use strict';

  var CACHE_KEY = 'dkj:operation-calendar:v1';
  var REMOTE_NODE = 'ZGtqOm9wZXJhdGlvbi1jYWxlbmRhcjpzaGFyZWQ6djE';
  var DEFAULT_CALENDAR = { workdays: [1, 2, 3, 4, 5], nonProductionDates: [], productionDates: [] };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hasDate(list, value) { return (list || []).indexOf(value) !== -1; }

  function normalizeCalendar(value) {
    var source = value || {};
    var workdays = Array.isArray(source.workdays) ? source.workdays.map(Number) : DEFAULT_CALENDAR.workdays.slice();
    var productionDates = Array.isArray(source.productionDates) ? source.productionDates.slice() : [];
    var nonProductionDates = (Array.isArray(source.nonProductionDates) ? source.nonProductionDates : [])
      .filter(function (d) { return productionDates.indexOf(d) === -1; });
    return { workdays: workdays, productionDates: productionDates, nonProductionDates: nonProductionDates };
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && parsed.calendar ? normalizeCalendar(parsed.calendar) : null;
    } catch (e) { return null; }
  }

  var calendar = readCache() || DEFAULT_CALENDAR;

  function isProductionDay(date) {
    var day = iso(date);
    if (hasDate(calendar.productionDates, day)) return true;
    if (hasDate(calendar.nonProductionDates, day)) return false;
    return (calendar.workdays || DEFAULT_CALENDAR.workdays).indexOf(date.getDay()) !== -1;
  }

  /** RTDB 에서 최신 공유 캘린더를 받아와 캐시에 반영한다. 로그인 전이거나 오프라인이면
   *  마지막으로 받아둔 캐시(또는 기본 평일 규칙)를 그대로 쓴다 — dkj-console.js 의
   *  loadOperationCalendar() 와 같은 경로·같은 캐시 키를 본다. */
  function refresh() {
    var auth = global.DkjAuth;
    if (!auth || !auth.request || !auth.token || !auth.token()) return Promise.resolve(calendar);
    return auth.request('records/' + REMOTE_NODE, 'GET').then(function (remote) {
      var stored = remote && remote.value && remote.value.calendar;
      if (stored) {
        calendar = normalizeCalendar(stored);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ calendar: calendar, pending: false })); } catch (e) {}
        try { global.dispatchEvent(new CustomEvent('dkj:operation-calendar-changed', { detail: calendar })); } catch (e) {}
      }
      return calendar;
    }).catch(function () { return calendar; });
  }

  document.addEventListener('dkj:auth-ready', refresh);
  refresh();

  global.DkjOperationCalendar = {
    isProductionDay: isProductionDay,
    calendar: function () { return normalizeCalendar(calendar); },
    refresh: refresh
  };
})(window);
