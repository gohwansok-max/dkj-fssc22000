/**
 * DkjCalendar — 월 단위 기록 캘린더
 *
 * 심사는 "언제 뭘 했고 뭐가 빠졌는가"를 본다. 오늘 화면만으로는
 * 어제 빠뜨린 것이 영영 보이지 않으므로 월 그리드로 누락을 드러낸다.
 *
 * 판정은 DkjConsole.evaluate(form, date) 를 그대로 재사용한다.
 */
(function (global) {
  'use strict';

  var DOW = ['일', '월', '화', '수', '목', '금', '토'];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function iso(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function sameDay(a, b) { return iso(a) === iso(b); }

  var state = {
    year: 0,
    month: 0,        // 0-based
    forms: [],
    selected: null
  };

  /** 하루치 집계 — {done, ng, part, todo, total} */
  function dayStat(date) {
    var st = { done: 0, ng: 0, part: 0, todo: 0, total: state.forms.length, items: [] };
    state.forms.forEach(function (f) {
      var ev = global.DkjConsole.evaluate(f, date);
      st.items.push({ form: f, ev: ev });
      if (ev.state === 'done') st.done++;
      else if (ev.state === 'ng') st.ng++;
      else if (ev.state === 'part') st.part++;
      else st.todo++;
    });
    return st;
  }

  /** 셀 상태 — full | ng | part | miss | future | today */
  function cellState(date, today) {
    if (date > today && !sameDay(date, today)) return { kind: 'future', st: null };
    var st = dayStat(date);
    var written = st.done + st.ng;
    var kind;
    if (st.ng > 0) kind = 'ng';
    else if (written === st.total && st.total > 0) kind = 'full';
    else if (written > 0 || st.part > 0) kind = 'part';
    else kind = sameDay(date, today) ? 'part' : 'miss';
    return { kind: kind, st: st };
  }

  function render() {
    var host = document.getElementById('ckCalGrid');
    if (!host) return;
    var today = new Date();
    today.setHours(23, 59, 59, 999);

    var first = new Date(state.year, state.month, 1);
    var last = new Date(state.year, state.month + 1, 0);
    var lead = first.getDay();                 // 앞쪽 빈칸
    var cells = [];

    for (var i = 0; i < lead; i++) cells.push(null);
    for (var d = 1; d <= last.getDate(); d++) cells.push(new Date(state.year, state.month, d));
    while (cells.length % 7 !== 0) cells.push(null);

    var missTotal = 0, ngTotal = 0, fullTotal = 0;

    var html = '<div class="ck-cal-dow">' +
      DOW.map(function (w, i) {
        return '<span class="' + (i === 0 ? 'sun' : (i === 6 ? 'sat' : '')) + '">' + w + '</span>';
      }).join('') + '</div><div class="ck-cal-body">';

    cells.forEach(function (date) {
      if (!date) { html += '<div class="ck-cal-cell empty"></div>'; return; }
      var r = cellState(date, today);
      var isToday = sameDay(date, new Date());
      var isSel = state.selected && sameDay(date, state.selected);
      if (r.kind === 'miss') missTotal++;
      if (r.kind === 'ng') ngTotal++;
      if (r.kind === 'full') fullTotal++;

      var badge = '';
      if (r.st) {
        var written = r.st.done + r.st.ng;
        badge = '<span class="ck-cal-count">' + written + '/' + r.st.total + '</span>';
      }
      html += '<button type="button" class="ck-cal-cell k-' + r.kind +
        (isToday ? ' is-today' : '') + (isSel ? ' is-sel' : '') +
        '" data-d="' + iso(date) + '">' +
        '<span class="ck-cal-num' + (date.getDay() === 0 ? ' sun' : (date.getDay() === 6 ? ' sat' : '')) +
        '">' + date.getDate() + '</span>' + badge + '</button>';
    });
    html += '</div>';
    host.innerHTML = html;

    var t = document.getElementById('ckCalTitle');
    if (t) t.textContent = state.year + '년 ' + (state.month + 1) + '월';

    var sum = document.getElementById('ckCalSummary');
    if (sum) {
      sum.innerHTML =
        '<span class="ck-cal-lg k-full"></span>전량 기록 ' + fullTotal + '일' +
        '<span class="ck-cal-lg k-ng"></span>부적합 ' + ngTotal + '일' +
        '<span class="ck-cal-lg k-miss"></span>기록 없음 ' + missTotal + '일';
    }

    host.querySelectorAll('[data-d]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = b.getAttribute('data-d').split('-');
        state.selected = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
        render();
        renderDetail();
      });
    });

    if (!state.selected) {
      var n = new Date();
      if (n.getFullYear() === state.year && n.getMonth() === state.month) state.selected = n;
    }
  }

  var LABEL = { todo: '미점검', done: '실시완료', part: '작성 중', ng: '미준수', none: '—' };

  function renderDetail() {
    var host = document.getElementById('ckCalDetail');
    if (!host) return;
    if (!state.selected) { host.innerHTML = '<div class="ck-empty">날짜를 선택하세요.</div>'; return; }

    var d = state.selected;
    var today = new Date();
    today.setHours(23, 59, 59, 999);
    var head = '<div class="ck-cal-dhead">' + d.getFullYear() + '. ' + (d.getMonth() + 1) +
      '. ' + d.getDate() + ' (' + DOW[d.getDay()] + ')</div>';

    if (d > today && !sameDay(d, new Date())) {
      host.innerHTML = head + '<div class="ck-empty">아직 오지 않은 날짜입니다.</div>';
      return;
    }

    var st = dayStat(d);
    host.innerHTML = head + '<div class="ck-list">' + st.items.map(function (it) {
      return '<a class="ck-row" href="' + esc(it.form.href) + '" style="text-decoration:none;color:inherit">' +
        '<span class="ck-sdot s-' + it.ev.state + '"></span>' +
        '<span class="nm">' + esc(it.form.title) + '</span>' +
        '<span class="rt">' + LABEL[it.ev.state] + '</span></a>';
    }).join('') + '</div>';
  }

  function move(delta) {
    var m = state.month + delta;
    state.year += Math.floor(m / 12);
    state.month = ((m % 12) + 12) % 12;
    state.selected = null;
    render();
    renderDetail();
  }

  function mount(cfg) {
    var groups = (cfg && cfg.groups) || [];
    var daily = (groups.find(function (g) { return g.id === 'daily'; }) || {}).forms || [];
    state.forms = daily;

    var now = new Date();
    state.year = now.getFullYear();
    state.month = now.getMonth();
    state.selected = now;

    var prev = document.getElementById('ckCalPrev');
    var next = document.getElementById('ckCalNext');
    var cur = document.getElementById('ckCalToday');
    if (prev) prev.addEventListener('click', function () { move(-1); });
    if (next) next.addEventListener('click', function () { move(1); });
    if (cur) {
      cur.addEventListener('click', function () {
        var n = new Date();
        state.year = n.getFullYear();
        state.month = n.getMonth();
        state.selected = n;
        render();
        renderDetail();
      });
    }

    render();
    renderDetail();
  }

  global.DkjCalendar = { mount: mount, dayStat: dayStat };
})(window);
