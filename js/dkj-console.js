/**
 * DkjConsole — 업무 콘솔 홈
 *
 * 저장된 기록(localStorage)에서 "오늘 뭘 써야 하는가"를 계산한다.
 * 서식마다 기입 단위가 달라 data/console-forms.json 의 check.mode 로 분기한다.
 */
(function (global) {
  'use strict';

  var DOW = ['일', '월', '화', '수', '목', '금', '토'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function iso(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /* 한 달치 판정은 31일 x 서식수 만큼 호출된다. 매번 파싱하지 않도록 캐시한다. */
  var _cache = {};

  function clearCache() { _cache = {}; }

  function readList(code) {
    var k = 'L' + code;
    if (k in _cache) return _cache[k];
    var v = [];
    try {
      var raw = localStorage.getItem('dkj:records:' + code + ':list:v1');
      v = raw ? JSON.parse(raw) : [];
    } catch (e) { v = []; }
    _cache[k] = v;
    return v;
  }

  function readDraft(code) {
    var k = 'D' + code;
    if (k in _cache) return _cache[k];
    var v = null;
    try {
      var raw = localStorage.getItem('dkj:records:' + code + ':draft:v1');
      v = raw ? JSON.parse(raw) : null;
    } catch (e) { v = null; }
    _cache[k] = v;
    return v;
  }

  function mondayOf(d) {
    var x = new Date(d.getTime());
    var dow = x.getDay();
    x.setDate(x.getDate() + (dow === 0 ? -6 : 1 - dow));
    x.setHours(0, 0, 0, 0);
    return x;
  }

  /* ---------- 상태 판정 ---------- */

  /** 반환: {state:'todo'|'done'|'part'|'ng'|'none', note:string} */
  function evaluate(form, today) {
    var code = form.code;
    var mode = (form.check || {}).mode || 'event';
    var recs = readList(code);
    var draft = readDraft(code);
    var all = draft ? [draft].concat(recs) : recs;
    var todayIso = iso(today);

    if (mode === 'event') {
      if (!recs.length) return { state: 'none', note: '기록 없음' };
      var latest = recs[0];
      return {
        state: 'none',
        note: '최근 ' + (String(latest.updatedAt || '').slice(0, 10) || '-')
      };
    }

    if (mode === 'perDay') {
      var f = form.check.dateField || 'checkDate';
      var hit = recs.find(function (r) {
        return (r.info && r.info[f]) === todayIso || r[f] === todayIso;
      });
      if (hit) return { state: hit.judge === '부적합' ? 'ng' : 'done', note: '오늘 작성 완료' };
      var dhit = draft && (((draft.info && draft.info[f]) === todayIso) || draft[f] === todayIso);
      if (dhit) return { state: 'part', note: '작성 중' };
      return { state: 'todo', note: '오늘 미작성' };
    }

    if (mode === 'perPeriod') {
      var pf = form.check.dateField || 'checkDate';
      var mon = mondayOf(today);
      var ok = recs.some(function (r) {
        var v = (r.info && r.info[pf]) || r[pf] || '';
        if (!v) return false;
        var d = new Date(v + 'T00:00:00');
        if (isNaN(d)) return false;
        return form.check.period === 'month'
          ? (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth())
          : (d >= mon);
      });
      var unit = form.check.period === 'month' ? '이번 달' : '이번 주';
      return ok
        ? { state: 'done', note: unit + ' 작성 완료' }
        : { state: 'todo', note: unit + ' 미작성' };
    }

    if (mode === 'dayColumn') {
      // 시트의 days 배열에서 오늘 열을 찾아 그 열이 모두 채워졌는지 본다
      var acc = null, seen = false;
      for (var i = 0; i < all.length; i++) {
        var r = all[i];
        if (!r || !r.days || !r.checks) continue;
        var idx = r.days.indexOf(todayIso);
        if (idx < 0) continue;
        var keys = Object.keys(r.checks);
        if (!keys.length) continue;
        seen = true;
        var filled = 0, ng = false;
        keys.forEach(function (k) {
          var v = (r.checks[k] || [])[idx];
          if (v) filled++;
          if (v === 'X') ng = true;
        });
        var cur;
        if (filled === 0) cur = { state: 'todo', note: '오늘 열 미입력' };
        else if (filled < keys.length) cur = { state: 'part', note: '오늘 ' + filled + '/' + keys.length + ' 입력' };
        else cur = ng ? { state: 'ng', note: '부적합 있음' } : { state: 'done', note: '오늘 열 완료' };
        acc = best(acc, cur);
      }
      if (acc) return acc;
      return { state: 'todo', note: seen ? '오늘 열 미입력' : '이번 시트 없음' };
    }

    if (mode === 'dayRow') {
      var dk = form.check.dayKey || 'day';
      var dnum = today.getDate();
      var acc2 = null, seen2 = false;
      for (var j = 0; j < all.length; j++) {
        var rec = all[j];
        if (!rec || !rec.rows) continue;
        var row = rec.rows.find(function (x) {
          return Number(String(x[dk] || '').replace(/\D/g, '')) === dnum;
        });
        if (!row) continue;
        seen2 = true;
        var vals = Object.keys(row).filter(function (k) { return k !== dk && k !== 'dow'; });
        var got = vals.filter(function (k) { return String(row[k] || '').trim(); }).length;
        var cur2;
        if (!got) cur2 = { state: 'todo', note: '오늘 행 미입력' };
        else {
          var bad = vals.some(function (k) { return row[k] === '부' || row[k] === 'X'; });
          cur2 = bad
            ? { state: 'ng', note: '기준 이탈 있음' }
            : { state: 'done', note: '오늘 행 입력됨' };
        }
        acc2 = best(acc2, cur2);
      }
      if (acc2) return acc2;
      return { state: 'todo', note: seen2 ? '오늘 행 미입력' : '이번 시트 없음' };
    }

    return { state: 'none', note: '' };
  }

  /* ---------- 렌더 ---------- */

  /** 상태 우선순위 — 기록된 것(done/ng)이 작성 중(part)보다, 그것이 미작성보다 강하다 */
  var RANK = { none: 0, todo: 1, part: 2, done: 3, ng: 4 };

  function best(a, b) {
    if (!a) return b;
    if (!b) return a;
    return RANK[b.state] > RANK[a.state] ? b : a;
  }

  var LABEL = {
    todo: '작성 필요', done: '작성 완료', part: '작성 중',
    ng: '부적합', none: '기록'
  };

  function tileHtml(form, ev) {
    return '<a class="ck-tile is-' + ev.state + '" href="' + esc(form.href) + '">' +
      '<div class="ck-tile-top">' +
      '<span class="ck-code">' + esc(form.code) + '</span>' +
      (form.ccp ? '<span class="ck-ccp">CCP</span>' : '') +
      '</div>' +
      '<div class="ck-tile-name">' + esc(form.title) + '</div>' +
      '<div class="ck-tile-foot">' +
      '<span class="ck-chip">' + LABEL[ev.state] + '</span>' +
      '<span class="ck-code">' + esc(ev.note) + '</span>' +
      '</div></a>';
  }

  function barRow(label, pct, cls) {
    return '<div class="ck-bar-row">' +
      '<span class="ck-bar-label">' + esc(label) + '</span>' +
      '<span class="ck-bar-track"><span class="ck-bar-fill ' + (cls || '') +
      '" style="width:' + Math.max(0, Math.min(100, pct)) + '%"></span></span>' +
      '<span class="ck-bar-val">' + Math.round(pct) + '%</span></div>';
  }

  /** 최근 7일 작성률 — 매일 서식 기준 */
  function weekStats(dailyForms, today) {
    var out = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(today.getTime());
      d.setDate(d.getDate() - i);
      var done = 0;
      dailyForms.forEach(function (f) {
        var ev = evaluate(f, d);
        if (ev.state === 'done' || ev.state === 'ng') done++;
      });
      out.push({
        date: d, done: done, total: dailyForms.length,
        isToday: iso(d) === iso(today)
      });
    }
    return out;
  }

  function render(cfg) {
    clearCache();
    var today = new Date();
    var groups = cfg.groups || [];
    var daily = (groups.find(function (g) { return g.id === 'daily'; }) || {}).forms || [];

    /* 오늘 할 일 */
    var evals = daily.map(function (f) { return { f: f, ev: evaluate(f, today) }; });
    var todoCnt = evals.filter(function (x) {
      return x.ev.state === 'todo' || x.ev.state === 'part';
    }).length;
    var ngCnt = evals.filter(function (x) { return x.ev.state === 'ng'; }).length;

    var el = document.getElementById('ckToday');
    if (el) el.innerHTML = evals.map(function (x) { return tileHtml(x.f, x.ev); }).join('');
    var cnt = document.getElementById('ckTodayCount');
    if (cnt) {
      cnt.textContent = todoCnt === 0
        ? '오늘 작성할 일지를 모두 마쳤습니다'
        : todoCnt + '건 남음';
    }

    /* 주간·월간 */
    var weekly = (groups.find(function (g) { return g.id === 'weekly'; }) || {}).forms || [];
    var wel = document.getElementById('ckWeekly');
    if (wel) {
      wel.innerHTML = weekly.map(function (f) {
        return tileHtml(f, evaluate(f, today));
      }).join('');
    }

    /* KPI */
    var doneToday = evals.filter(function (x) {
      return x.ev.state === 'done' || x.ev.state === 'ng';
    }).length;
    var setText = function (id, v) {
      var e = document.getElementById(id);
      if (e) e.textContent = v;
    };
    setText('kpiTodo', todoCnt);
    setText('kpiDone', doneToday + ' / ' + daily.length);
    setText('kpiNg', ngCnt);

    /* 최근 7일 작성률 */
    var ws = weekStats(daily, today);
    var wk = document.getElementById('ckWeekDots');
    if (wk) {
      wk.innerHTML = ws.map(function (d) {
        var full = d.total > 0 && d.done === d.total;
        return '<div class="ck-dot' + (full ? ' on' : '') + (d.isToday ? ' today' : '') + '">' +
          '<span>' + DOW[d.date.getDay()] + '</span>' +
          '<b>' + d.done + '/' + d.total + '</b></div>';
      }).join('');
    }

    /* 서식별 이번 주 작성률 */
    var bars = document.getElementById('ckBars');
    if (bars) {
      bars.innerHTML = daily.map(function (f) {
        var hit = 0;
        for (var i = 0; i < 7; i++) {
          var d = new Date(today.getTime());
          d.setDate(d.getDate() - i);
          var s = evaluate(f, d).state;
          if (s === 'done' || s === 'ng') hit++;
        }
        var pct = (hit / 7) * 100;
        return barRow(f.title, pct, pct >= 85 ? '' : (pct >= 50 ? 'warn' : 'ng'));
      }).join('');
    }

    /* 최근 기록 */
    var recent = [];
    groups.forEach(function (g) {
      (g.forms || []).forEach(function (f) {
        readList(f.code).slice(0, 3).forEach(function (r) {
          recent.push({
            title: f.title, code: f.code, href: f.href,
            when: r.updatedAt || r.createdAt || '',
            label: r.title || '', judge: r.judge || ''
          });
        });
      });
    });
    recent.sort(function (a, b) { return (b.when || '').localeCompare(a.when || ''); });
    var rl = document.getElementById('ckRecent');
    if (rl) {
      rl.innerHTML = recent.length
        ? recent.slice(0, 8).map(function (r) {
            return '<a class="ck-row" href="' + esc(r.href) + '" style="text-decoration:none;color:inherit">' +
              '<span class="nm">' + esc(r.title) + '</span>' +
              '<span class="mt">' + esc(r.label) + '</span>' +
              '<span class="rt">' + esc(String(r.when).slice(0, 16).replace('T', ' ')) + '</span></a>';
          }).join('')
        : '<div class="ck-empty">아직 저장된 기록이 없습니다. 위에서 일지를 작성해 보세요.</div>';
    }

    /* 발생 시 작성 */
    var ev2 = (groups.find(function (g) { return g.id === 'event'; }) || {}).forms || [];
    var q = document.getElementById('ckEvent');
    if (q) {
      q.innerHTML = ev2.map(function (f) {
        return '<a class="ck-qbtn" href="' + esc(f.href) + '">' + esc(f.title) + '</a>';
      }).join('');
    }

    /* 오늘 날짜 */
    var td = document.getElementById('ckDate');
    if (td) {
      // 연도를 따로 감싸 두면 좁은 화면에서 CSS 로만 접을 수 있다(.ck-today-year)
      td.innerHTML = '<span class="ck-today-year">' + today.getFullYear() + '년 </span>' +
        (today.getMonth() + 1) + '월 ' + today.getDate() + '일 (' + DOW[today.getDay()] + ')';
    }
  }

  /**
   * 서식 목록 로드.
   * file:// 로 열면 fetch 가 CORS 로 막혀 콘솔이 통째로 비어 버린다.
   * 카탈로그 번들(js/console-forms.bundle.js)로 떨어지는 건 이 저장소의 기존 규약이다
   * (doc-catalog / record-catalog 도 같은 방식). 번들은
   * `python scripts/build-catalog-bundles.py` 로 만든다.
   */
  function loadForms() {
    if (global.DKJ_CONSOLE_FORMS) return Promise.resolve(global.DKJ_CONSOLE_FORMS);
    return fetch('data/console-forms.json')
      .then(function (r) {
        if (!r.ok) throw new Error('console-forms');
        return r.json();
      })
      .catch(function () {
        return new Promise(function (resolve, reject) {
          var s = document.createElement('script');
          s.src = 'js/console-forms.bundle.js';
          s.onload = function () {
            global.DKJ_CONSOLE_FORMS ? resolve(global.DKJ_CONSOLE_FORMS) : reject(new Error('bundle empty'));
          };
          s.onerror = function () { reject(new Error('bundle fail')); };
          document.head.appendChild(s);
        });
      });
  }

  function init() {
    loadForms()
      .then(function (cfg) {
        global.DkjConsole.config = cfg;
        render(cfg);
        if (global.DkjCalendar) global.DkjCalendar.mount(cfg);
      })
      .catch(function (e) {
        var el = document.getElementById('ckToday');
        if (el) el.innerHTML = '<div class="ck-empty">서식 목록을 불러오지 못했습니다: ' + esc(e.message) + '</div>';
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  global.DkjConsole = {
    evaluate: evaluate,
    render: render,
    clearCache: clearCache,
    iso: iso,
    DOW: DOW,
    config: null
  };
})(window);
