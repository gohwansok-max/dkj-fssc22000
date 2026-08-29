/**
 * 업무 콘솔(index.html) — 수율 추이 위젯
 * DKJ-F-053 생산일지에 저장된 값으로 가중평균 실적수율을 계산해 보여준다.
 * 계산은 폼·생산분석 대시보드와 동일하게 DkjProductionCalc 하나만 쓴다
 * (숫자가 화면마다 어긋나는 사고를 막는다). 저장 데이터는 읽기만 한다.
 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtPct(n) { return (n == null || isNaN(n)) ? '—' : (Math.round(n * 1000) / 10) + '%'; }
  function fmtPctSigned(n) {
    if (n == null || isNaN(n)) return '';
    var v = Math.round(n * 1000) / 10;
    return (v > 0 ? '+' : '') + v + '%p';
  }

  var FORM_ID = 'DKJ-F-053';
  var MAX_POINTS = 10;

  function dailyYield(record, master, calc) {
    var rows = record.materialRows || [];
    var calcs = rows.map(function (r) { return calc.rowCalc(r, master, record.info.workDate); });
    var grand = calc.grandTotal(rows, calcs, master);
    return grand.input > 0 ? grand.yield : null;
  }

  /** 최근 저장된 생산일지에서 날짜별 수율을 뽑는다. 같은 날짜가 여러 건이면 최신 수정본만 쓴다. */
  function buildSeries(master, calc) {
    var records = (window.DkjRecordStore ? DkjRecordStore.list(FORM_ID) : [])
      .filter(function (r) { return r && r.info && r.info.workDate; });

    var latestByDate = {};
    records.forEach(function (r) {
      var d = r.info.workDate;
      var prev = latestByDate[d];
      if (!prev || String(r.updatedAt || '') > String(prev.updatedAt || '')) latestByDate[d] = r;
    });

    return Object.keys(latestByDate)
      .sort()
      .map(function (d) { return { date: d, value: dailyYield(latestByDate[d], master, calc) }; })
      .filter(function (p) { return p.value != null; })
      .slice(-MAX_POINTS);
  }

  function niceDomain(values, target) {
    var all = values.slice();
    if (target != null) all.push(target);
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    var pad = Math.max(0.02, (hi - lo) * 0.3);
    lo = Math.max(0, lo - pad);
    hi = Math.min(1, hi + pad);
    if (hi - lo < 0.06) { var mid = (hi + lo) / 2; lo = Math.max(0, mid - 0.03); hi = Math.min(1, mid + 0.03); }
    return { lo: lo, hi: hi };
  }

  function renderChart(series, target) {
    var w = 640, h = 176;
    var padL = 42, padR = 14, padT = 16, padB = 28;
    var plotW = w - padL - padR, plotH = h - padT - padB;
    var values = series.map(function (p) { return p.value; });
    var dom = niceDomain(values, target);

    function y(v) { return padT + plotH - ((v - dom.lo) / (dom.hi - dom.lo)) * plotH; }
    function x(i) { return series.length > 1 ? padL + (i / (series.length - 1)) * plotW : padL + plotW / 2; }

    var yTicks = [dom.lo, (dom.lo + dom.hi) / 2, dom.hi];
    var gridHtml = yTicks.map(function (v) {
      return '<line x1="' + padL + '" y1="' + y(v) + '" x2="' + (w - padR) + '" y2="' + y(v) +
        '" stroke="var(--line)" stroke-width="1"></line>' +
        '<text x="' + (padL - 8) + '" y="' + (y(v) + 3) + '" text-anchor="end" font-size="10" fill="var(--ink-3)">' + fmtPct(v) + '</text>';
    }).join('');

    var targetHtml = '';
    if (target != null && target >= dom.lo && target <= dom.hi) {
      targetHtml = '<line x1="' + padL + '" y1="' + y(target) + '" x2="' + (w - padR) + '" y2="' + y(target) +
        '" stroke="var(--ink-3)" stroke-width="1.4" stroke-dasharray="5,3"></line>' +
        '<text x="' + (w - padR) + '" y="' + (y(target) - 5) + '" text-anchor="end" font-size="10" fill="var(--ink-3)">목표 ' + fmtPct(target) + '</text>';
    }

    var points = series.map(function (p, i) { return { x: x(i), y: y(p.value), p: p }; });

    var linePath = points.map(function (pt, i) { return (i === 0 ? 'M' : 'L') + pt.x.toFixed(1) + ',' + pt.y.toFixed(1); }).join(' ');
    var areaPath = linePath +
      ' L' + points[points.length - 1].x.toFixed(1) + ',' + (padT + plotH) +
      ' L' + points[0].x.toFixed(1) + ',' + (padT + plotH) + ' Z';

    var areaHtml = '<path d="' + areaPath + '" fill="var(--nh-green)" fill-opacity="0.12" stroke="none"></path>';
    var lineHtml = '<path d="' + linePath + '" fill="none" stroke="var(--nh-green)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>';

    var showEvery = Math.max(1, Math.ceil(series.length / 10));
    var xLabelsHtml = series.map(function (p, i) {
      if (i % showEvery !== 0 && i !== series.length - 1) return '';
      return '<text x="' + x(i).toFixed(1) + '" y="' + (h - 8) + '" text-anchor="middle" font-size="9.5" fill="var(--ink-3)">' + esc(p.date.slice(5)) + '</text>';
    }).join('');

    var lastIdx = points.length - 1;
    var dotsHtml = points.map(function (pt, i) {
      var ok = target == null ? true : pt.p.value >= target;
      var color = 'var(' + (ok ? '--st-done' : '--st-ng') + ')';
      var isLast = i === lastIdx;
      var r = isLast ? 6 : 4;
      var ring = isLast ? ' stroke="var(--card)" stroke-width="2"' : '';
      return '<circle cx="' + pt.x.toFixed(1) + '" cy="' + pt.y.toFixed(1) + '" r="' + r + '" fill="' + color + '"' + ring + '>' +
        '<title>' + esc(pt.p.date) + ' · ' + fmtPct(pt.p.value) + (ok ? ' (목표 이상)' : ' (목표 미달)') + '</title></circle>';
    }).join('');

    var axisHtml = '<line x1="' + padL + '" y1="' + (padT + plotH) + '" x2="' + (w - padR) + '" y2="' + (padT + plotH) + '" stroke="var(--line)"></line>';

    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" preserveAspectRatio="xMinYMin meet" role="img" aria-label="최근 생산일지 가중평균 실적수율 추이">' +
      gridHtml + axisHtml + areaHtml + lineHtml + targetHtml + dotsHtml + xLabelsHtml + '</svg>' +
      '<div class="ck-yield-legend">' +
      '<span><i class="ckyw-dot-ok"></i>목표 이상</span>' +
      '<span><i class="ckyw-dot-ng"></i>목표 미달</span>' +
      '<span class="ckyw-legend-note">점에 커서를 올리면 날짜별 수치가 보입니다</span>' +
      '</div>';
  }

  function renderEmpty(reason) {
    var host = $('ckYieldChart');
    if (host) host.innerHTML = '<p class="ck-yield-empty">' + esc(reason) + '</p>';
    var v = $('ckYieldValue'); if (v) v.textContent = '—';
    var d = $('ckYieldDeltaText'); if (d) d.textContent = '';
    var kpi = $('ckYieldKpi'); if (kpi) kpi.className = 'ck-kpi';
  }

  function renderHead(series, target) {
    var last = series[series.length - 1];
    var kpi = $('ckYieldKpi'), valueEl = $('ckYieldValue'), deltaEl = $('ckYieldDeltaText'), subEl = $('ckYieldSub');
    if (valueEl) valueEl.textContent = fmtPct(last.value);
    if (subEl) subEl.textContent = '최근 작성일 ' + last.date + ' 기준 · 최근 ' + series.length + '건의 저장된 생산일지';
    if (target == null) {
      if (kpi) kpi.className = 'ck-kpi';
      if (deltaEl) deltaEl.textContent = '가중평균 실적수율';
      return;
    }
    var delta = last.value - target;
    var ok = delta >= 0;
    if (kpi) kpi.className = 'ck-kpi ' + (ok ? 'ok' : 'ng');
    if (deltaEl) deltaEl.textContent = (ok ? '✓ 목표 대비 ' : '! 목표 대비 ') + fmtPctSigned(delta);
  }

  function refresh(master, calc) {
    var series = buildSeries(master, calc);
    if (!series.length) {
      renderEmpty('저장된 생산일지가 아직 없습니다. 생산일지(DKJ-F-053)를 작성하면 여기에 수율 추이가 표시됩니다.');
      return;
    }
    renderHead(series, master.contractYield);
    var host = $('ckYieldChart');
    if (host) host.innerHTML = renderChart(series, master.contractYield);
  }

  function init() {
    var host = $('ckYieldChart');
    if (!host) return;
    if (!window.DkjMaster || !window.DkjProductionCalc || !window.DkjRecordStore) {
      renderEmpty('수율 위젯을 불러오지 못했습니다.');
      return;
    }
    var calc = window.DkjProductionCalc;
    DkjMaster.loadProductionMaster().then(function (master) {
      refresh(master, calc);
      window.addEventListener('dkj:records-changed', function (e) {
        var key = e && e.detail && e.detail.key;
        if (!key || key.indexOf(':' + FORM_ID + ':') !== -1) refresh(master, calc);
      });
    }).catch(function (err) {
      console.error('[dkj-yield-widget] init failed', err);
      renderEmpty('기준 데이터를 불러오지 못했습니다.');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
