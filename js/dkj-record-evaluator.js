/**
 * DkjRecordEvaluator — 기록 상태 판정. 기록·임시본·생산일 함수를 입력으로 받는다.
 * DOM, localStorage, Firebase와 독립적이며 DkjConsole.evaluate의 판정 규칙을 유지한다.
 */
(function (global) {
  'use strict';

  var iso = global.DkjOperationCalendarModel.iso;
  var RANK = { off: 0, none: 0, done: 1, part: 2, todo: 3, ng: 4 };
  function best(a, b) { return !a || (b && RANK[b.state] > RANK[a.state]) ? b : a; }

  function mondayOf(d) {
    var x = new Date(d.getTime());
    var dow = x.getDay();
    x.setDate(x.getDate() + (dow === 0 ? -6 : 1 - dow));
    x.setHours(0, 0, 0, 0);
    return x;
  }
  /** 해당 날짜가 속한 "주"의 시작일 — js/dkj-matrix-form.js 의 weekStartOf()와 동일한
   *  계산이다. startDow(0=일~6=토, 기본 월요일)가 다른 서식(예: 매주 금요일 점검인
   *  저수조관리 DKJ-S-02-13)의 주차 컬럼을 오늘 날짜로 찾아내는 데 쓴다. */
  function weekStartOfDow(d, startDow) {
    var sdw = (typeof startDow === 'number' && startDow >= 0 && startDow <= 6) ? startDow : 1;
    var x = new Date(d.getTime());
    var dow = x.getDay();
    var diff = dow - sdw;
    if (diff < 0) diff += 7;
    x.setDate(x.getDate() - diff);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  /** '2026-08' 뿐 아니라 '2026 . 08' 처럼 손으로 적힌 옛 형식도 읽는다(js/dkj-ledger-form.js
   *  의 applyAutoWeekday()와 같은 패턴). 못 읽으면 null — 그 레코드는 어느 달인지 몰라
   *  day 번호만으로 매칭하면 위험하므로 매칭 대상에서 제외한다. */
  function yearMonthOf(record, monthField) {
    var raw = String((record && record.info && record.info[monthField]) || '');
    var m = raw.match(/(\d{4})\D+(\d{1,2})/);
    return m ? (Number(m[1]) * 100 + Number(m[2])) : null;
  }
  /** 반환: {state:'todo'|'done'|'part'|'ng'|'none'|'off', note:string} */
  function evaluate(form, date, records, draft, isProductionDay) {
    if (form._dailyDuty && !isProductionDay(date)) return { state: 'off', note: '비생산일 · 작성 의무 없음' };

    var mode = (form.check || {}).mode || 'event';
    var recs = (records || []).filter(function (record) { return record && !record.deleted; });
    var target = iso(date);

    if (mode === 'event') {
      if (!recs.length) return { state: 'none', note: '발생 기록 없음' };
      return { state: 'none', note: '최근 ' + (String(recs[0].updatedAt || '').slice(0, 10) || '-') };
    }
    if (mode === 'perDay') {
      var dateField = form.check.dateField || 'checkDate';
      var hit = recs.find(function (r) { return (r.info && r.info[dateField]) === target || r[dateField] === target; });
      if (hit) return { state: hit.judge === '부적합' ? 'ng' : 'done', note: hit.judge === '부적합' ? '부적합 발생' : '오늘 작성 완료' };
      var draftHit = draft && (((draft.info && draft.info[dateField]) === target) || draft[dateField] === target);
      return draftHit ? { state: 'part', note: '작성 중' } : { state: 'todo', note: '오늘 미작성' };
    }
    if (mode === 'perPeriod') {
      var periodField = form.check.dateField || 'checkDate';
      var monday = mondayOf(date);
      var exists = recs.some(function (r) {
        var value = (r.info && r.info[periodField]) || r[periodField] || '';
        if (!value) return false;
        var d = new Date(value + 'T00:00:00');
        if (isNaN(d)) return false;
        return form.check.period === 'month'
          ? d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth()
          : d >= monday;
      });
      var unit = form.check.period === 'month' ? '이번 달' : '이번 주';
      return exists ? { state: 'done', note: unit + ' 작성 완료' } : { state: 'todo', note: unit + ' 미작성' };
    }
    if (mode === 'dayColumn') {
      // dayMode:'week' — 시트는 월 단위지만 컬럼이 요일(오늘)이 아니라 주차다(예:
      // 저수조관리 DKJ-S-02-13, 매주 금요일 점검). 컬럼 날짜가 "오늘"과 정확히
      // 같아야만 찾는 기존 방식으로는, 점검 요일이 아닌 날에는 이번 주에 이미
      // 점검을 마쳤어도 컬럼을 못 찾아 매일 '미작성'으로 잘못 뜬다(2026-09-18
      // 현장 문의로 발견). 이번 주가 속한 "주 시작일" 컬럼을 찾도록 바꾼다.
      var weekMode = form.check.dayMode === 'week';
      target = weekMode ? iso(weekStartOfDow(date, form.check.weekStartDay)) : target;
      var unitLabel = weekMode ? '이번 주' : '오늘';
      var bestState = null;
      var matchedRec = null;
      for (var i = 0; i < recs.length; i++) {
        var colRecord = recs[i];
        if (!colRecord || !colRecord.days || !colRecord.checks) continue;
        var idx = colRecord.days.indexOf(target);
        if (idx < 0) continue;
        matchedRec = colRecord;
        var keys = Object.keys(colRecord.checks);
        if (!keys.length) continue;
        var filled = 0;
        var ng = false;
        keys.forEach(function (key) {
          var value = (colRecord.checks[key] || [])[idx];
          if (value) filled++;
          if (value === 'X') ng = true;
        });
        var current = !filled ? { state: 'todo', note: unitLabel + ' 열 미입력' } :
          filled < keys.length ? { state: 'part', note: unitLabel + ' ' + filled + '/' + keys.length + ' 입력' } :
          ng ? { state: 'ng', note: '기준 이탈 있음' } : { state: 'done', note: unitLabel + ' 열 완료' };
        bestState = best(bestState, current);
      }
      // 임시본은 보관함에 아직 없는 기록이므로 완료로 집계하지 않는다.
      // 저장본이 없거나 저장본이 아직 미입력인 경우에만 작성 중으로 표시한다.
      if (draft && draft.days && draft.checks && (!bestState || bestState.state === 'todo')) {
        var draftIdx = draft.days.indexOf(target);
        if (draftIdx >= 0) {
          var draftKeys = Object.keys(draft.checks);
          var draftFilled = draftKeys.some(function (key) {
            return String((draft.checks[key] || [])[draftIdx] || '').trim();
          });
          if (draftFilled) return { state: 'part', note: '작성 중' };
        }
      }
      if (!bestState) return { state: 'todo', note: '이번 시트 없음' };
      // weekMode — 주 1회 점검이지만 결재는 그 달 시트 전체(모든 주)가 끝나야
      // 한 번에 난다. 이번 주 칸만 채워졌다고 바로 '완료'로 숨기면, 아직 결재
      // 전인데도 목록에서 사라져 다음 주까지 못 챙기게 된다. 이번 달 나머지
      // 주차가 다 채워지기 전까지는 '작성 중'으로 남긴다(js/dkj-console.js의
      // monthRows 와 같은 패턴).
      if (weekMode && bestState.state === 'done' && matchedRec) {
        var totalWeeks = matchedRec.days.length;
        var weekKeys = Object.keys(matchedRec.checks);
        var filledWeeks = matchedRec.days.filter(function (_, wi) {
          return weekKeys.length && weekKeys.every(function (key) {
            return String((matchedRec.checks[key] || [])[wi] || '').trim();
          });
        }).length;
        if (filledWeeks < totalWeeks) {
          return { state: 'part', note: '이번 주 완료 · 이번 달 ' + filledWeeks + '/' + totalWeeks + '주 완료' };
        }
        return { state: 'done', note: '이번 달 전체(' + totalWeeks + '주) 입력 완료' };
      }
      return bestState;
    }
    if (mode === 'dayRow' || mode === 'monthRows') {
      var dayKey = form.check.dayKey || 'day';
      var monthField = form.check.monthField || 'month';
      var dayNum = date.getDate();
      var targetYm = date.getFullYear() * 100 + (date.getMonth() + 1);
      var rowState = null;
      var monthRec = null;
      for (var j = 0; j < recs.length; j++) {
        var rowRecord = recs[j];
        if (!rowRecord || !rowRecord.rows) continue;
        // day 번호(1~31)는 매달 반복된다 — 이 레코드가 오늘과 같은 달인지부터
        // 확인해야 한다. 안 그러면 지난달 같은 날짜 행이 채워져 있다는 이유로
        // 이번 달 미작성을 '완료'로 잘못 판정한다(2026-09-10).
        if (yearMonthOf(rowRecord, monthField) !== targetYm) continue;
        monthRec = rowRecord;
        var row = rowRecord.rows.find(function (item) { return Number(String(item[dayKey] || '').replace(/\D/g, '')) === dayNum; });
        if (!row) continue;
        var values = Object.keys(row).filter(function (key) { return key !== dayKey && key !== 'dow'; });
        var written = values.filter(function (key) { return String(row[key] || '').trim(); }).length;
        var bad = values.some(function (key) { return row[key] === '부' || row[key] === 'X'; });
        rowState = best(rowState, !written ? { state: 'todo', note: '오늘 행 미입력' } :
          bad ? { state: 'ng', note: '기준 이탈 있음' } : { state: 'done', note: '오늘 행 입력됨' });
      }
      // 입력 중인 임시본은 기록보관함의 확정 기록이 아니다. 따라서 값이
      // 채워져 있어도 완료가 아니라 작성 중으로만 표시한다.
      if (draft && draft.rows && yearMonthOf(draft, monthField) === targetYm && (!rowState || rowState.state === 'todo')) {
        var draftRow = draft.rows.find(function (item) {
          return Number(String(item[dayKey] || '').replace(/\D/g, '')) === dayNum;
        });
        if (draftRow) {
          var draftValues = Object.keys(draftRow).filter(function (key) {
            return key !== dayKey && key !== 'dow';
          });
          var draftWritten = draftValues.some(function (key) {
            return String(draftRow[key] || '').trim();
          });
          if (draftWritten) return { state: 'part', note: '작성 중' };
        }
      }
      if (!rowState) return { state: 'todo', note: '이번 시트 없음' };
      // monthRows — 매일 적는 대장이지만 월 단위로 마감하는 서식(예: 작업장 온도).
      // 오늘 행만 채워졌다고 바로 '완료'로 숨기면, 한 달 중 하루만 적고도 완료된
      // 일지로 분류되어 다음날 다시 찾으려면 '완료된 일지 숨기기'를 눌러야 하는
      // 불편이 있었다(2026-09-11). 오늘 행이 비어 있으면 기존 dayRow 와 똑같이
      // '작성 필요'로 재촉하되, 오늘 행을 채운 뒤에도 이번 달 나머지 생산일 행이
      // 다 채워지기 전까지는 '작성 중'으로 남겨 목록에서 사라지지 않게 한다.
      if (mode === 'monthRows' && rowState.state === 'done' && monthRec) {
        var daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        var needDays = [];
        for (var d = 1; d <= daysInMonth; d++) {
          var dd = new Date(date.getFullYear(), date.getMonth(), d);
          if (isProductionDay(dd)) needDays.push(d);
        }
        var filledDays = needDays.filter(function (nd) {
          var r = monthRec.rows.find(function (item) { return Number(String(item[dayKey] || '').replace(/\D/g, '')) === nd; });
          if (!r) return false;
          var vals = Object.keys(r).filter(function (key) { return key !== dayKey && key !== 'dow'; });
          return vals.some(function (key) { return String(r[key] || '').trim(); });
        }).length;
        if (filledDays < needDays.length) {
          return { state: 'part', note: '오늘 입력됨 · 이번 달 ' + filledDays + '/' + needDays.length + ' 완료' };
        }
        return { state: 'done', note: '이번 달 전체(' + needDays.length + '일) 입력 완료' };
      }
      return rowState;
    }
    return { state: 'none', note: '' };
  }

  global.DkjRecordEvaluator = { evaluate: evaluate, rank: RANK };
})(window);
