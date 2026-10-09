/**
 * DkjOperationCalendarModel — 콘솔과 기록양식의 공통 생산일 규칙.
 * 저장소·인증·DOM에 접근하지 않는다. 저장과 동기화는 각 호출자가 담당한다.
 */
(function (global) {
  'use strict';

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function normalizeDates(list) {
    var seen = {};
    return (Array.isArray(list) ? list : []).map(function (value) {
      return String(value || '').trim();
    }).filter(function (value) {
      return /^\d{4}-\d{2}-\d{2}$/.test(value) && !seen[value] && (seen[value] = true);
    }).sort();
  }
  function normalizeCalendar(value) {
    var source = value || {}, workdays = Array.isArray(source.workdays) ? source.workdays : [1, 2, 3, 4, 5];
    workdays = workdays.map(function (day) { return Number(day); }).filter(function (day, index, list) {
      return day >= 0 && day <= 6 && list.indexOf(day) === index;
    }).sort(function (a, b) { return a - b; });
    var productionDates = normalizeDates(source.productionDates);
    var nonProductionDates = normalizeDates(source.nonProductionDates).filter(function (date) {
      return productionDates.indexOf(date) === -1;
    });
    return {
      label: String(source.label || '기본 생산일: 월요일~금요일'),
      workdays: workdays,
      nonProductionDates: nonProductionDates,
      productionDates: productionDates,
      updatedAt: source.updatedAt || '',
      updatedBy: source.updatedBy || ''
    };
  }
  function hasDate(list, value) { return (list || []).indexOf(value) !== -1; }
  function isProductionDay(calendar, date) {
    var day = iso(date);
    if (hasDate(calendar.productionDates, day)) return true;
    if (hasDate(calendar.nonProductionDates, day)) return false;
    return (calendar.workdays || [1, 2, 3, 4, 5]).indexOf(date.getDay()) !== -1;
  }

  global.DkjOperationCalendarModel = {
    iso: iso,
    normalize: normalizeCalendar,
    isProductionDay: isProductionDay
  };
})(window);
