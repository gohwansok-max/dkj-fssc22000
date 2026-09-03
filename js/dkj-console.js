/**
 * DkjConsole — 현장 우선 HACCP 업무 콘솔
 * 생산일·비생산일을 구분해 작성 의무를 계산하고, 긴급도 순서로 오늘의 조치를 제시한다.
 */
(function (global) {
  'use strict';

  var DOW = ['일', '월', '화', '수', '목', '금', '토'];
  var _cache = {};
  var operationCalendar = { workdays: [1, 2, 3, 4, 5], nonProductionDates: [], productionDates: [] };
  var OPERATION_CALENDAR_KEY = 'dkj:operation-calendar:v1';
  var OPERATION_CALENDAR_REMOTE_NODE = 'ZGtqOm9wZXJhdGlvbi1jYWxlbmRhcjpzaGFyZWQ6djE';
  var operationCalendarLoad = null;
  var recentRecords = [];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function clearCache() { _cache = {}; }

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
  function readCalendarCache() {
    try {
      var raw = localStorage.getItem(OPERATION_CALENDAR_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && parsed.calendar ? { calendar: normalizeCalendar(parsed.calendar), pending: !!parsed.pending } : { calendar: normalizeCalendar(parsed), pending: false };
    } catch (e) { return null; }
  }
  function writeCalendarCache(value, pending) {
    try { localStorage.setItem(OPERATION_CALENDAR_KEY, JSON.stringify({ calendar: normalizeCalendar(value), pending: !!pending })); } catch (e) {}
  }
  function calendarOwner() {
    var auth = global.DkjAuth;
    return auth && auth.user ? auth.user() : null;
  }
  function canEditOperationCalendar() {
    var auth = global.DkjAuth;
    return !!(auth && auth.isSystemAdmin && auth.isSystemAdmin());
  }
  function updateCalendarInMemory(value, pending) {
    operationCalendar = normalizeCalendar(value);
    if (global.DkjConsole && global.DkjConsole.config) global.DkjConsole.config.operationCalendar = operationCalendar;
    writeCalendarCache(operationCalendar, pending);
    clearCache();
  }
  function emitCalendarChanged() {
    try { global.dispatchEvent(new CustomEvent('dkj:operation-calendar-changed', { detail: operationCalendar })); } catch (e) {}
  }
  function refreshCalendarViews() {
    if (global.DkjConsole && global.DkjConsole.config) render(global.DkjConsole.config);
    emitCalendarChanged();
  }
  function remoteCalendarPath() {
    return 'records/' + OPERATION_CALENDAR_REMOTE_NODE;
  }
  function calendarFromRemote(value) {
    if (!value || typeof value !== 'object') return null;
    var stored = value.value && value.value.calendar ? value.value.calendar : value.calendar;
    return stored && typeof stored === 'object' ? normalizeCalendar(stored) : null;
  }
  function saveCalendarRemote(value) {
    var auth = global.DkjAuth;
    var who = calendarOwner() || {};
    var path = remoteCalendarPath();
    if (!auth || !auth.request || !auth.token || !auth.token() || !path) return Promise.reject(new Error('NO_SESSION'));
    var payload = normalizeCalendar(value);
    payload.updatedAt = new Date().toISOString();
    payload.updatedBy = String(who.name || who.empId || '');
    return auth.request(path, 'PUT', {
      value: { calendar: payload },
      updatedAt: Date.now(),
      updatedBy: payload.updatedBy
    }).then(function () {
      updateCalendarInMemory(payload, false);
      refreshCalendarViews();
      return payload;
    });
  }
  function loadOperationCalendar(cfg) {
    var base = normalizeCalendar((cfg && cfg.operationCalendar) || operationCalendar);
    var cached = readCalendarCache();
    if (cached) base = cached.calendar;
    updateCalendarInMemory(base, !!(cached && cached.pending));
    if (operationCalendarLoad) return operationCalendarLoad;
    var auth = global.DkjAuth;
    var path = remoteCalendarPath();
    if (!auth || !auth.request || !auth.token || !auth.token() || !path) return Promise.resolve(operationCalendar);
    operationCalendarLoad = auth.request(path, 'GET').then(function (remote) {
      if (cached && cached.pending && canEditOperationCalendar()) {
        return saveCalendarRemote(cached.calendar);
      }
      var shared = calendarFromRemote(remote);
      if (shared) updateCalendarInMemory(shared, false);
      refreshCalendarViews();
      return operationCalendar;
    }).catch(function () {
      operationCalendarLoad = null;
      refreshCalendarViews();
      return operationCalendar;
    });
    return operationCalendarLoad;
  }
  function setOperationCalendar(value) {
    var next = normalizeCalendar(value);
    if (!canEditOperationCalendar()) return Promise.reject(new Error('ADMIN_REQUIRED'));
    updateCalendarInMemory(next, true);
    refreshCalendarViews();
    return saveCalendarRemote(next).catch(function (err) {
      updateCalendarInMemory(next, true);
      refreshCalendarViews();
      throw err;
    });
  }
  function setOperationDate(date, mode) {
    var day = typeof date === 'string' ? date : iso(date);
    var next = normalizeCalendar(operationCalendar);
    next.productionDates = next.productionDates.filter(function (value) { return value !== day; });
    next.nonProductionDates = next.nonProductionDates.filter(function (value) { return value !== day; });
    if (mode === 'production') next.productionDates.push(day);
    if (mode === 'nonProduction') next.nonProductionDates.push(day);
    return setOperationCalendar(next);
  }

  function readList(code) {
    var key = 'L' + code;
    if (key in _cache) return _cache[key];
    var list = [];
    try {
      var raw = localStorage.getItem('dkj:records:' + code + ':list:v1');
      list = raw ? JSON.parse(raw) : [];
      // 삭제 표식(js/dkj-record-store.js 참고)이 붙은 기록은 '오늘 작성 완료'로 세면 안 된다.
      list = list.filter(function (r) { return !r || !r.deleted; });
    } catch (e) { list = []; }
    _cache[key] = list;
    return list;
  }
  function readDraft(code) {
    var key = 'D' + code;
    if (key in _cache) return _cache[key];
    var draft = null;
    try {
      var raw = localStorage.getItem('dkj:records:' + code + ':draft:v1');
      draft = raw ? JSON.parse(raw) : null;
    } catch (e) { draft = null; }
    _cache[key] = draft;
    return draft;
  }
  function mondayOf(d) {
    var x = new Date(d.getTime());
    var dow = x.getDay();
    x.setDate(x.getDate() + (dow === 0 ? -6 : 1 - dow));
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function hasDate(list, value) { return (list || []).indexOf(value) !== -1; }
  function isProductionDay(date) {
    var day = iso(date);
    if (hasDate(operationCalendar.productionDates, day)) return true;
    if (hasDate(operationCalendar.nonProductionDates, day)) return false;
    return (operationCalendar.workdays || [1, 2, 3, 4, 5]).indexOf(date.getDay()) !== -1;
  }
  function productionLabel(date) {
    return isProductionDay(date) ? '생산일' : '비생산일';
  }

  /* ---------- 상태 판정 ---------- */
  /** 반환: {state:'todo'|'done'|'part'|'ng'|'none'|'off', note:string} */
  function evaluate(form, date) {
    if (form._dailyDuty && !isProductionDay(date)) return { state: 'off', note: '비생산일 · 작성 의무 없음' };

    var code = form.code;
    var mode = (form.check || {}).mode || 'event';
    var recs = readList(code);
    var draft = readDraft(code);
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
      var bestState = null;
      for (var i = 0; i < recs.length; i++) {
        var colRecord = recs[i];
        if (!colRecord || !colRecord.days || !colRecord.checks) continue;
        var idx = colRecord.days.indexOf(target);
        if (idx < 0) continue;
        var keys = Object.keys(colRecord.checks);
        if (!keys.length) continue;
        var filled = 0;
        var ng = false;
        keys.forEach(function (key) {
          var value = (colRecord.checks[key] || [])[idx];
          if (value) filled++;
          if (value === 'X') ng = true;
        });
        var current = !filled ? { state: 'todo', note: '오늘 열 미입력' } :
          filled < keys.length ? { state: 'part', note: '오늘 ' + filled + '/' + keys.length + ' 입력' } :
          ng ? { state: 'ng', note: '기준 이탈 있음' } : { state: 'done', note: '오늘 열 완료' };
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
      return bestState || { state: 'todo', note: '이번 시트 없음' };
    }
    if (mode === 'dayRow') {
      var dayKey = form.check.dayKey || 'day';
      var dayNum = date.getDate();
      var rowState = null;
      for (var j = 0; j < recs.length; j++) {
        var rowRecord = recs[j];
        if (!rowRecord || !rowRecord.rows) continue;
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
      if (draft && draft.rows && (!rowState || rowState.state === 'todo')) {
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
      return rowState || { state: 'todo', note: '이번 시트 없음' };
    }
    return { state: 'none', note: '' };
  }

  var RANK = { off: 0, none: 0, done: 1, part: 2, todo: 3, ng: 4 };
  var PRIORITY = { normal: 1, high: 2, critical: 3 };
  var LABEL = { todo: '작성 필요', done: '작성 완료', part: '작성 중', ng: '부적합', none: '발생 기록', off: '작성 의무 없음' };
  var PRIORITY_LABEL = { normal: '일반', high: '중요', critical: 'CCP 최우선' };
  function best(a, b) { return !a || (b && RANK[b.state] > RANK[a.state]) ? b : a; }
  function priorityValue(form) { return PRIORITY[form.priority] || (form.ccp ? 3 : 1); }
  function stateSort(a, b) {
    var byState = RANK[b.ev.state] - RANK[a.ev.state];
    return byState || priorityValue(b.f) - priorityValue(a.f) || a.f.title.localeCompare(b.f.title);
  }

  /* ---------- 화면 렌더 ---------- */
  function tileHtml(form, ev) {
    var priority = priorityValue(form);
    return '<a class="ck-tile is-' + ev.state + ' p-' + priority + '" href="' + esc(form.href) + '">' +
      '<div class="ck-tile-top"><span class="ck-code">' + esc(form.code) + '</span>' +
      (form.ccp ? '<span class="ck-ccp">CCP</span>' : '') +
      (priority > 1 ? '<span class="ck-priority">' + PRIORITY_LABEL[form.priority || 'critical'] + '</span>' : '') + '</div>' +
      '<div class="ck-tile-name">' + esc(form.title) + '</div>' +
      '<div class="ck-tile-foot"><span class="ck-chip">' + LABEL[ev.state] + '</span>' +
      '<span class="ck-tile-action">' + (ev.state === 'todo' || ev.state === 'part' ? '바로 작성 →' : '열기 →') + '</span></div></a>';
  }
  function barRow(label, hit, required) {
    if (!required) return '<div class="ck-bar-row"><span class="ck-bar-label">' + esc(label) + '</span><span class="ck-bar-track"><span class="ck-bar-fill off" style="width:0%"></span></span><span class="ck-bar-val">의무 없음</span></div>';
    var pct = (hit / required) * 100;
    var cls = pct >= 85 ? '' : (pct >= 50 ? 'warn' : 'ng');
    return '<div class="ck-bar-row"><span class="ck-bar-label">' + esc(label) + '</span><span class="ck-bar-track"><span class="ck-bar-fill ' + cls + '" style="width:' + Math.max(0, Math.min(100, pct)) + '%"></span></span><span class="ck-bar-val">' + hit + '/' + required + '</span></div>';
  }
  function setText(id, value) { var el = document.getElementById(id); if (el) el.textContent = value; }

  function dayRequirement(dailyForms, date) {
    return isProductionDay(date) ? dailyForms : [];
  }
  function weekStats(dailyForms, today) {
    var out = [];
    for (var i = 6; i >= 0; i--) {
      var date = new Date(today.getTime());
      date.setDate(date.getDate() - i);
      var required = dayRequirement(dailyForms, date);
      var done = 0;
      required.forEach(function (form) {
        var ev = evaluate(form, date);
        if (ev.state === 'done' || ev.state === 'ng') done++;
      });
      out.push({ date: date, done: done, total: required.length, isToday: iso(date) === iso(today), production: required.length > 0 });
    }
    return out;
  }
  function renderAlertBanner(ng, ngItems) {
    var banner = document.getElementById('ckAlertBanner');
    if (!banner) {
      var main = document.querySelector('.ck-main');
      if (!main) return;
      banner = document.createElement('div');
      banner.id = 'ckAlertBanner';
      main.insertBefore(banner, main.firstChild);
    }

    if (ng > 0) {
      var itemsList = ngItems.slice(0, 3).map(function (item) {
        return '<li><strong>' + esc(item.f.title) + '</strong> — ' + esc(item.ev.note) + '</li>';
      }).join('');

      banner.innerHTML = '<div class="ck-alert-banner">' +
        '<div class="ck-alert-banner-icon">!</div>' +
        '<div class="ck-alert-banner-content">' +
        '<h3>🚨 부적합 ' + ng + '건 발생 — 즉시 확인 필요</h3>' +
        '<p>CCP 이탈 또는 기준 미준수가 감지되었습니다. 즉시 확인하고 CAPA를 등록하세요.</p>' +
        (ngItems.length > 0 ? '<ul style="margin:8px 0 0; padding-left:20px; font-size:13px;">' + itemsList + '</ul>' : '') +
        '</div>' +
        '<a class="pill-btn green ck-alert-banner-action" href="#ckAlerts">지금 확인하기</a>' +
        '</div>';
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  }

  function renderStatus(today, production, evals) {
    var host = document.getElementById('ckShiftStatus');
    if (!host) return;
    var ng = evals.filter(function (x) { return x.ev.state === 'ng'; }).length;
    var ngItems = evals.filter(function (x) { return x.ev.state === 'ng'; });
    var todo = evals.filter(function (x) { return x.ev.state === 'todo' || x.ev.state === 'part'; }).length;

    // 부적합 발생 시 상단 고정 배너 표시
    renderAlertBanner(ng, ngItems);

    if (!production) {
      host.innerHTML = '<div class="ck-shift-icon off">○</div><div><h1>오늘은 비생산일입니다</h1><p>정기 일지 작성 의무가 없습니다. 입고·부적합·고객불만 같은 발생 기록만 필요 시 작성하세요.</p></div><a class="pill-btn ghost" href="#ckEvent">발생 기록 보기</a>';
    } else if (ng) {
      host.innerHTML = '<div class="ck-shift-icon danger">!</div><div><h1>즉시 확인이 필요한 부적합 ' + ng + '건</h1><p>부적합 기록과 CCP 점검 결과를 먼저 확인하고 필요하면 CAPA를 등록하세요.</p></div><a class="pill-btn green" href="#ckAlerts">우선 처리 보기</a>';
    } else if (todo) {
      host.innerHTML = '<div class="ck-shift-icon warn">!</div><div><h1>오늘 생산일 · 정기 기록 ' + todo + '건이 남아 있습니다</h1><p>CCP와 중요 점검부터 작성하세요. 완료 수는 저장 기록을 기준으로 자동 갱신됩니다.</p></div><a class="pill-btn green" href="#todayTasks">오늘 할 일 보기</a>';
    } else {
      host.innerHTML = '<div class="ck-shift-icon good">✓</div><div><h1>오늘 생산일 · 정기 일지가 모두 완료되었습니다</h1><p>저장된 기록 기준입니다. 발생 기록은 사건이 있을 때만 추가합니다.</p></div><a class="pill-btn ghost" href="quality-dashboard.html">품질 경보 확인</a>';
    }
  }
  function renderAlerts(evals, production) {
    var alerts = [];
    evals.forEach(function (item) {
      if (item.ev.state === 'ng') alerts.push({ level: 'urgent', label: '즉시 확인', text: item.f.title + ' · ' + item.ev.note, href: item.f.href });
      else if (production && item.ev.state === 'todo' && priorityValue(item.f) === 3) alerts.push({ level: 'urgent', label: 'CCP 우선', text: item.f.title + ' · 미작성', href: item.f.href });
      else if (production && (item.ev.state === 'todo' || item.ev.state === 'part') && priorityValue(item.f) > 1) alerts.push({ level: 'notice', label: '오늘 처리', text: item.f.title + ' · ' + item.ev.note, href: item.f.href });
    });
    alerts.sort(function (a, b) { return (a.level === 'urgent' ? -1 : 1) - (b.level === 'urgent' ? -1 : 1); });
    var host = document.getElementById('ckAlerts');
    if (!host) return;
    host.innerHTML = alerts.length ? alerts.slice(0, 5).map(function (alert) {
      return '<a class="ck-alert ' + alert.level + '" href="' + esc(alert.href) + '"><b>' + alert.label + '</b><span>' + esc(alert.text) + '</span><i>→</i></a>';
    }).join('') : '<div class="ck-alert-empty">현재 우선 처리 경보가 없습니다.</div>';
    setText('kpiUrgent', alerts.filter(function (a) { return a.level === 'urgent'; }).length);
  }
  function renderRecentList() {
    var list = document.getElementById('ckRecent');
    if (!list) return;
    var search = (document.getElementById('ckRecentSearch') || {}).value || '';
    var filter = (document.getElementById('ckRecentFilter') || {}).value || 'all';
    var term = search.trim().toLowerCase();
    var today = iso(new Date());
    var rows = recentRecords.filter(function (row) {
      if (filter === 'today' && String(row.when || '').slice(0, 10) !== today) return false;
      if (filter === 'ng' && row.judge !== '부적합') return false;
      return !term || [row.title, row.code, row.label, row.judge, row.when].join(' ').toLowerCase().indexOf(term) !== -1;
    });
    list.innerHTML = rows.length ? rows.slice(0, 12).map(function (row) {
      var state = row.judge === '부적합' ? ' ng' : '';
      return '<a class="ck-row' + state + '" href="' + esc(row.href) + '" style="text-decoration:none;color:inherit">' +
        '<span class="nm">' + esc(row.title) + '</span><span class="mt">' + esc(row.label || row.judge || '저장됨') + '</span>' +
        '<span class="rt">' + esc(String(row.when).slice(0, 16).replace('T', ' ')) + '</span></a>';
    }).join('') : '<div class="ck-empty">조건에 맞는 저장 기록이 없습니다.</div>';
  }
  function bindRecentTools() {
    ['ckRecentSearch', 'ckRecentFilter'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.dataset.bound) return;
      el.dataset.bound = '1';
      el.addEventListener(id === 'ckRecentSearch' ? 'input' : 'change', renderRecentList);
    });
  }

  function render(cfg) {
    clearCache();
    operationCalendar = normalizeCalendar(cfg.operationCalendar || operationCalendar);
    cfg.operationCalendar = operationCalendar;
    var today = new Date();
    var groups = cfg.groups || [];
    var daily = (groups.find(function (g) { return g.id === 'daily'; }) || {}).forms || [];
    daily.forEach(function (form) { form._dailyDuty = true; });
    var production = isProductionDay(today);
    var evals = production ? daily.map(function (form) { return { f: form, ev: evaluate(form, today) }; }).sort(stateSort) : [];
    var todoCnt = evals.filter(function (x) { return x.ev.state === 'todo' || x.ev.state === 'part'; }).length;
    var ngCnt = evals.filter(function (x) { return x.ev.state === 'ng'; }).length;
    var doneToday = evals.filter(function (x) { return x.ev.state === 'done' || x.ev.state === 'ng'; }).length;

    renderStatus(today, production, evals);
    var todayEl = document.getElementById('ckToday');
    if (todayEl) {
      if (!production) {
        todayEl.innerHTML = '<div class="ck-empty ck-empty-prominent">오늘은 <strong>비생산일</strong>입니다. 정기 일지 작성 의무가 없으며, 발생 기록만 필요 시 작성하세요.</div>';
      } else {
        var incomplete = evals.filter(function (x) { return x.ev.state === 'todo' || x.ev.state === 'part' || x.ev.state === 'ng'; });
        var complete = evals.filter(function (x) { return x.ev.state === 'done'; });

        var html = incomplete.map(function (x) { return tileHtml(x.f, x.ev); }).join('');

        if (complete.length > 0) {
          html += '<button class="ck-section-toggle" id="ckToggleCompleted" aria-expanded="false">' +
            '<span class="ck-section-toggle-icon">▼</span>' +
            '<span>완료된 일지 ' + complete.length + '개 보기</span>' +
            '</button>' +
            '<div class="ck-tiles ck-tiles-completed" id="ckCompletedTiles" aria-hidden="true">' +
            complete.map(function (x) { return tileHtml(x.f, x.ev); }).join('') +
            '</div>';
        }

        todayEl.innerHTML = html;

        // 완료 항목 토글 이벤트
        var toggleBtn = document.getElementById('ckToggleCompleted');
        var completedTiles = document.getElementById('ckCompletedTiles');
        if (toggleBtn && completedTiles) {
          toggleBtn.addEventListener('click', function () {
            var isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
            if (isExpanded) {
              toggleBtn.setAttribute('aria-expanded', 'false');
              completedTiles.setAttribute('aria-hidden', 'true');
              completedTiles.classList.remove('is-visible');
              toggleBtn.querySelector('span:last-child').textContent = '완료된 일지 ' + complete.length + '개 보기';
            } else {
              toggleBtn.setAttribute('aria-expanded', 'true');
              completedTiles.setAttribute('aria-hidden', 'false');
              completedTiles.classList.add('is-visible');
              toggleBtn.querySelector('span:last-child').textContent = '완료된 일지 숨기기';
            }
          });
        }
      }
    }
    var count = document.getElementById('ckTodayCount');
    if (count) count.textContent = production ? (todoCnt ? todoCnt + '건 남음' : '정기 일지 완료') : '작성 의무 없음';
    var subtitle = document.getElementById('ckTodaySubtitle');
    if (subtitle) subtitle.textContent = production ? '오늘 생산일에 작성해야 하는 정기 일지입니다' : '오늘은 비생산일입니다. 정기 일지는 작성 의무에서 제외됩니다';

    var weekly = (groups.find(function (g) { return g.id === 'weekly'; }) || {}).forms || [];
    var weeklyEl = document.getElementById('ckWeekly');
    if (weeklyEl) weeklyEl.innerHTML = weekly.map(function (form) { return tileHtml(form, evaluate(form, today)); }).join('');

    setText('kpiTodo', production ? todoCnt : '—');
    setText('kpiDone', production ? doneToday + ' / ' + daily.length : '—');
    setText('kpiNg', ngCnt);
    renderAlerts(evals, production);

    var stats = weekStats(daily, today);
    var dots = document.getElementById('ckWeekDots');
    if (dots) dots.innerHTML = stats.map(function (stat) {
      var full = stat.total > 0 && stat.done === stat.total;
      return '<div class="ck-dot' + (full ? ' on' : '') + (!stat.production ? ' off' : '') + (stat.isToday ? ' today' : '') + '"><span>' + DOW[stat.date.getDay()] + '</span><b>' + (stat.production ? stat.done + '/' + stat.total : '휴무') + '</b></div>';
    }).join('');
    var bars = document.getElementById('ckBars');
    if (bars) bars.innerHTML = daily.map(function (form) {
      var hit = 0, required = 0;
      stats.forEach(function (stat) {
        if (!stat.production) return;
        required++;
        var state = evaluate(form, stat.date).state;
        if (state === 'done' || state === 'ng') hit++;
      });
      return barRow(form.title, hit, required);
    }).join('');
    var rateRule = document.getElementById('ckRateRule');
    if (rateRule) rateRule.textContent = '최근 7일 중 생산일 ' + stats.filter(function (s) { return s.production; }).length + '일을 분모로 계산합니다';

    recentRecords = [];
    groups.forEach(function (group) {
      (group.forms || []).forEach(function (form) {
        readList(form.code).forEach(function (record) {
          recentRecords.push({
            title: form.title, code: form.code, href: form.href,
            when: record.updatedAt || record.createdAt || '',
            label: record.title || '', judge: record.judge || ''
          });
        });
      });
    });
    recentRecords.sort(function (a, b) { return (b.when || '').localeCompare(a.when || ''); });
    bindRecentTools();
    renderRecentList();

    var eventForms = (groups.find(function (g) { return g.id === 'event'; }) || {}).forms || [];
    var eventEl = document.getElementById('ckEvent');
    if (eventEl) eventEl.innerHTML = eventForms.map(function (form) { return '<a class="ck-qbtn" href="' + esc(form.href) + '">' + esc(form.title) + '</a>'; }).join('');

    var dateEl = document.getElementById('ckDate');
    if (dateEl) dateEl.innerHTML = '<span class="ck-today-year">' + today.getFullYear() + '년 </span>' + (today.getMonth() + 1) + '월 ' + today.getDate() + '일 (' + DOW[today.getDay()] + ') · ' + productionLabel(today);
  }

  function loadForms() {
    if (global.DKJ_CONSOLE_FORMS) return Promise.resolve(global.DKJ_CONSOLE_FORMS);
    return fetch('data/console-forms.json').then(function (res) {
      if (!res.ok) throw new Error('console-forms');
      return res.json();
    }).catch(function () {
      return new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = 'js/console-forms.bundle.js';
        script.onload = function () { global.DKJ_CONSOLE_FORMS ? resolve(global.DKJ_CONSOLE_FORMS) : reject(new Error('bundle empty')); };
        script.onerror = function () { reject(new Error('bundle fail')); };
        document.head.appendChild(script);
      });
    });
  }
  function refreshFromRecordChange() {
    if (!global.DkjConsole.config) return;
    render(global.DkjConsole.config);
    if (global.DkjCalendar) global.DkjCalendar.mount(global.DkjConsole.config);
  }
  function refreshAfterAuth() {
    if (!global.DkjConsole.config) return;
    loadOperationCalendar(global.DkjConsole.config).then(refreshCalendarViews);
  }
  function init() {
    loadForms().then(function (cfg) {
      global.DkjConsole.config = cfg;
      refreshFromRecordChange();
      loadOperationCalendar(cfg).then(refreshCalendarViews);
      global.addEventListener('dkj:records-changed', refreshFromRecordChange);
      global.addEventListener('dkj:auth-ready', refreshAfterAuth);
      global.addEventListener('online', function () {
        var cached = readCalendarCache();
        if (cached && cached.pending && canEditOperationCalendar()) {
          saveCalendarRemote(cached.calendar)['catch'](function () {});
        }
      });
      global.addEventListener('storage', function (event) {
        if (!event || !event.key) return;
        if (event.key.indexOf('dkj:records:') === 0) refreshFromRecordChange();
        if (event.key === OPERATION_CALENDAR_KEY) {
          var cached = readCalendarCache();
          if (cached) {
            updateCalendarInMemory(cached.calendar, cached.pending);
            refreshCalendarViews();
          }
        }
      });
    }).catch(function (err) {
      var el = document.getElementById('ckToday');
      if (el) el.innerHTML = '<div class="ck-empty">서식 목록을 불러오지 못했습니다: ' + esc(err.message) + '</div>';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  global.DkjConsole = {
    evaluate: evaluate,
    render: render,
    refresh: refreshFromRecordChange,
    clearCache: clearCache,
    iso: iso,
    isProductionDay: isProductionDay,
    operationCalendar: function () { return normalizeCalendar(operationCalendar); },
    canEditOperationCalendar: canEditOperationCalendar,
    setOperationCalendar: setOperationCalendar,
    setOperationDate: setOperationDate,
    loadOperationCalendar: loadOperationCalendar,
    DOW: DOW,
    config: null
  };
})(window);
