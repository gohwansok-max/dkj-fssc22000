/**
 * 생산분석 대시보드 — DKJ-F-053 생산일지 누적 데이터를 모아 보여준다.
 * 계산은 전부 DkjProductionCalc 를 재사용한다(폼과 같은 공식 — 숫자가 어긋나지 않도록).
 * 외부 차트 라이브러리 없이 순수 SVG 막대그래프로 그린다.
 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmt1(n) { return (n == null || isNaN(n)) ? '—' : (Math.round(n * 10) / 10).toLocaleString('ko-KR'); }
  function fmtPct(n) { return (n == null || isNaN(n)) ? '—' : (Math.round(n * 1000) / 10) + '%'; }
  function fmtPctSigned(n) {
    if (n == null || isNaN(n)) return '—';
    var v = Math.round(n * 1000) / 10;
    return (v > 0 ? '+' : '') + v + '%p';
  }
  function fmtWon(n) { return (n == null || isNaN(n)) ? '—' : Math.round(n).toLocaleString('ko-KR') + '원'; }

  var CALC = window.DkjProductionCalc;
  var FORM_ID = 'DKJ-F-053';
  var TARGET_KEY = 'dkj:prod:yieldTarget:v1';
  var COLOR_OK = '#2563eb';   // 목표 이상 — 파랑
  var COLOR_NG = '#dc2626';   // 목표 미달 — 빨강
  var COLOR_NONE = '#d8ddd9'; // 기록 없음

  var master = null, allRecords = [], filtered = [], itemFilter = 'ALL';

  function daysAgo(n) {
    var d = new Date(); d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  function getTarget() {
    var el = $('yieldTarget');
    var v = el ? parseFloat(el.value) : NaN;
    if (!isFinite(v) || v <= 0 || v > 100) v = master ? master.contractYield * 100 : 75;
    return v / 100;
  }

  function loadRecords() {
    allRecords = (window.DkjRecordStore ? DkjRecordStore.list(FORM_ID) : [])
      .filter(function (r) { return r && r.info && r.info.workDate; });
  }

  function applyFilter() {
    var from = $('rangeFrom').value, to = $('rangeTo').value;
    filtered = allRecords.filter(function (r) {
      var d = r.info.workDate;
      return (!from || d >= from) && (!to || d <= to);
    }).sort(function (a, b) { return a.info.workDate < b.info.workDate ? 1 : -1; });
  }

  /* ---------- SVG 막대그래프 (목표선 + 파랑/빨강 상태색) ---------- */
  function renderBarChart(series, target, opts) {
    opts = opts || {};
    var w = opts.width || 640, h = opts.height || 170;
    var padL = 32, padR = 10, padT = 14, padB = 26;
    var plotW = w - padL - padR, plotH = h - padT - padB;
    var n = series.length || 1;
    var slot = plotW / n;
    var barW = Math.max(3, slot - 4);

    function y(v) { return padT + plotH - Math.max(0, Math.min(1, v)) * plotH; }
    function x(i) { return padL + i * slot; }

    var bars = series.map(function (s, i) {
      if (s.value == null) {
        return '<rect x="' + (x(i) + 2) + '" y="' + (padT + plotH - 2) + '" width="' + barW + '" height="2" fill="' + COLOR_NONE + '"><title>' + esc(s.label) + ' · 기록 없음</title></rect>';
      }
      var v = Math.max(0, Math.min(1, s.value));
      var barH = v * plotH;
      var color = (target != null) ? (v >= target ? COLOR_OK : COLOR_NG) : '#009a44';
      return '<rect x="' + (x(i) + 2) + '" y="' + y(v) + '" width="' + barW + '" height="' + Math.max(1, barH) + '" rx="2" fill="' + color + '">' +
        '<title>' + esc(s.label) + ' · ' + fmtPct(s.value) + '</title></rect>';
    }).join('');

    var targetLine = (target != null)
      ? '<line x1="' + padL + '" y1="' + y(target) + '" x2="' + (w - padR) + '" y2="' + y(target) + '" stroke="#5c6a63" stroke-width="1.4" stroke-dasharray="5,3"></line>' +
        '<text x="' + (w - padR) + '" y="' + (y(target) - 4) + '" text-anchor="end" font-size="10" fill="#43544b">목표 ' + fmtPct(target) + '</text>'
      : '';

    var showEvery = Math.max(1, Math.ceil(n / 9));
    var xLabels = series.map(function (s, i) {
      if (i % showEvery !== 0 && i !== n - 1) return '';
      return '<text x="' + (x(i) + barW / 2) + '" y="' + (h - 8) + '" text-anchor="middle" font-size="9" fill="#7d8b84">' + esc(s.shortLabel || '') + '</text>';
    }).join('');

    var axis = '<line x1="' + padL + '" y1="' + (padT + plotH) + '" x2="' + (w - padR) + '" y2="' + (padT + plotH) + '" stroke="#dfe5e1"></line>';

    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" preserveAspectRatio="xMinYMin meet" role="img" aria-label="수율 추이 막대그래프">' +
      axis + bars + targetLine + xLabels + '</svg>' +
      '<div class="prod-chart-legend"><span><i style="background:' + COLOR_OK + '"></i>목표 이상</span>' +
      '<span><i style="background:' + COLOR_NG + '"></i>목표 미달</span>' +
      '<span><i style="background:' + COLOR_NONE + '"></i>기록 없음</span></div>';
  }

  function overallSeries() {
    return filtered.slice().reverse().map(function (r) {
      var rows = r.materialRows || [];
      var calcs = rows.map(function (rr) { return CALC.rowCalc(rr, master, r.info.workDate); });
      var grand = CALC.grandTotal(rows, calcs, master);
      return { label: r.info.workDate, shortLabel: r.info.workDate.slice(5), value: grand.input > 0 ? grand.yield : null };
    });
  }

  function itemDayYield(record, itemName) {
    var matches = (record.materialRows || []).filter(function (rr) { return rr.name === itemName; });
    if (!matches.length) return null;
    var calcs = matches.map(function (rr) { return CALC.rowCalc(rr, master, record.info.workDate); });
    var grand = CALC.grandTotal(matches, calcs, master);
    return grand.input > 0 ? grand.yield : null;
  }

  function itemSeries(itemName) {
    return filtered.slice().reverse().map(function (r) {
      return { label: r.info.workDate, shortLabel: r.info.workDate.slice(5), value: itemDayYield(r, itemName) };
    });
  }

  function activeItemNames() {
    var present = {};
    filtered.forEach(function (r) { (r.materialRows || []).forEach(function (rr) { if (rr.name) present[rr.name] = true; }); });
    return (master.items || []).map(function (it) { return it.name; }).filter(function (n) { return present[n]; });
  }

  /* ---------- KPI / 요약 ---------- */
  function computeKpis() {
    var totalInput = 0, totalUsedCarry = 0, totalWaste = 0, totalMadeKg = 0, warnDays = 0;
    filtered.forEach(function (r) {
      var rows = r.materialRows || [];
      var calcs = rows.map(function (row) { return CALC.rowCalc(row, master, r.info.workDate); });
      var grand = CALC.grandTotal(rows, calcs, master);
      totalInput += grand.input; totalUsedCarry += grand.used + grand.carry; totalWaste += grand.waste;
      totalMadeKg += CALC.toNum(r.finished && r.finished.madeKg);
      var byTotal = CALC.byproductTotal(r.byproductRows || [], r.info.workDate);
      var fin = CALC.finishedCalc(r.finished || {}, grand, byTotal);
      if (!fin.ok) warnDays++;
    });
    var yieldW = totalInput > 0 ? totalUsedCarry / totalInput : null;
    var defectRate = totalInput > 0 ? totalWaste / totalInput : null;
    var gap = yieldW != null ? yieldW - master.contractYield : null;
    return { days: filtered.length, totalInput: totalInput, totalMadeKg: totalMadeKg, yieldW: yieldW, defectRate: defectRate, gap: gap, warnDays: warnDays, totalWaste: totalWaste };
  }

  function renderKpis(k) {
    var host = $('dashKpis'); if (!host) return;
    var target = getTarget();
    var vsTarget = k.yieldW != null ? k.yieldW - target : null;
    host.innerHTML =
      '<div class="prod-kpi"><span>조회 일수(저장된 일지)</span><strong>' + k.days + '일</strong></div>' +
      '<div class="prod-kpi"><span>누적 원물투입량</span><strong>' + fmt1(k.totalInput) + ' kg</strong></div>' +
      '<div class="prod-kpi"><span>누적 생산량</span><strong>' + fmt1(k.totalMadeKg) + ' kg</strong></div>' +
      '<div class="prod-kpi"><span>가중평균 실적수율</span><strong class="' + (vsTarget != null && vsTarget < 0 ? 'prod-neg' : 'prod-pos') + '">' + fmtPct(k.yieldW) + '</strong></div>' +
      '<div class="prod-kpi"><span>목표 대비</span><strong class="' + (vsTarget != null && vsTarget < 0 ? 'prod-neg' : 'prod-pos') + '">' + fmtPctSigned(vsTarget) + '</strong></div>' +
      '<div class="prod-kpi"><span>불량율(폐기/투입)</span><strong>' + fmtPct(k.defectRate) + '</strong></div>' +
      '<div class="prod-kpi"><span>물질수지 경고 발생일</span><strong class="' + (k.warnDays > 0 ? 'prod-neg' : 'prod-pos') + '">' + k.warnDays + '일</strong></div>';
  }

  function renderOverallChart() {
    var host = $('dashOverallChart'); if (!host) return;
    var series = overallSeries();
    if (!series.length) { host.innerHTML = '<p style="color:#888;padding:12px;">해당 기간 저장된 생산일지가 없습니다.</p>'; return; }
    host.innerHTML = renderBarChart(series, getTarget(), { height: 190 });
  }

  /* ---------- 원료별 필터 + 소그룹 차트 ---------- */
  function renderItemFilterOptions() {
    var sel = $('itemFilter'); if (!sel) return;
    var names = activeItemNames();
    sel.innerHTML = '<option value="ALL">전체 원재료</option>' +
      names.map(function (n) { return '<option value="' + esc(n) + '"' + (n === itemFilter ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('');
    if (names.indexOf(itemFilter) === -1 && itemFilter !== 'ALL') itemFilter = 'ALL';
    sel.value = itemFilter;
  }

  function itemStatsHtml(name) {
    var series = itemSeries(name);
    var target = getTarget();
    var vals = series.map(function (s) { return s.value; }).filter(function (v) { return v != null; });
    var avg = vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : null;
    var belowDays = vals.filter(function (v) { return v < target; }).length;
    var last = vals.length ? vals[vals.length - 1] : null;
    return '<div class="prod-lever-meta">' +
      '<span>평균수율 ' + fmtPct(avg) + '</span>' +
      '<span>최근값 ' + fmtPct(last) + '</span>' +
      '<span class="' + (belowDays > 0 ? 'prod-neg' : 'prod-pos') + '">목표 미달 ' + belowDays + '일 / ' + vals.length + '일</span>' +
      '</div>';
  }

  function renderItemBreakdown() {
    var host = $('dashItemGrid'); if (!host) return;
    var target = getTarget();
    var names = itemFilter === 'ALL' ? activeItemNames() : [itemFilter];
    if (!names.length) { host.innerHTML = '<p style="color:#888;padding:12px;">해당 기간에 사용된 원재료가 없습니다.</p>'; return; }
    var big = itemFilter !== 'ALL';
    host.className = big ? 'prod-item-grid single' : 'prod-item-grid';
    host.innerHTML = names.map(function (name) {
      var series = itemSeries(name);
      return '<div class="prod-item-card"><h4>' + esc(name) + '</h4>' +
        renderBarChart(series, target, { height: big ? 220 : 130 }) +
        itemStatsHtml(name) +
        '</div>';
    }).join('');
  }

  /* ---------- 일별 추이 표 ---------- */
  function renderTrend() {
    var host = $('dashTrend'); if (!host) return;
    var rowsHtml = filtered.map(function (r) {
      var rows = r.materialRows || [];
      var calcs = rows.map(function (row) { return CALC.rowCalc(row, master, r.info.workDate); });
      var grand = CALC.grandTotal(rows, calcs, master);
      var byTotal = CALC.byproductTotal(r.byproductRows || [], r.info.workDate);
      var fin = CALC.finishedCalc(r.finished || {}, grand, byTotal);
      return '<tr><td>' + esc(r.info.workDate) + '</td><td>' + fmt1(grand.input) + '</td><td>' + fmtPct(grand.yield) + '</td>' +
        '<td>' + fmtPct(grand.defectRate) + '</td><td>' + fmt1(grand.waste) + '</td>' +
        '<td class="' + (fin.ok ? '' : 'prod-neg') + '">' + esc(fin.judge) + '</td>' +
        '<td>' + (r.locked ? '<span class="badge done">잠금</span>' : '<span class="badge">저장</span>') + '</td>' +
        '<td><a class="link-chip sm" href="records/DKJ-F-053.html?record=' + encodeURIComponent(r.id) + '">열기</a></td></tr>';
    }).join('');
    host.innerHTML = '<div class="prod-table-wrap"><table class="prod-table"><thead><tr>' +
      '<th>작업일</th><th>투입량(kg)</th><th>실적수율</th><th>불량율</th><th>폐기량(kg)</th><th>물질수지</th><th>상태</th><th></th>' +
      '</tr></thead><tbody>' + (rowsHtml || '<tr><td colspan="8" style="padding:16px;color:#888;">해당 기간 저장된 생산일지가 없습니다.</td></tr>') + '</tbody></table></div>';
  }

  /* ---------- 폐기 원인 파레토 ---------- */
  function renderCause() {
    var host = $('dashCause'); if (!host) return;
    var codeTotals = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    var itemTotals = {};
    filtered.forEach(function (r) {
      (r.materialRows || []).forEach(function (row) {
        var calc = CALC.rowCalc(row, master, r.info.workDate);
        codeTotals.A += CALC.toNum(row.wasteA); codeTotals.B += CALC.toNum(row.wasteB);
        codeTotals.C += CALC.toNum(row.wasteC); codeTotals.D += CALC.toNum(row.wasteD);
        codeTotals.E += CALC.toNum(row.wasteE);
        if (row.name) itemTotals[row.name] = (itemTotals[row.name] || 0) + calc.waste;
      });
    });
    var codeSum = codeTotals.A + codeTotals.B + codeTotals.C + codeTotals.D + codeTotals.E;
    var codeRows = (master.wasteCodes || []).map(function (wc) {
      var kg = codeTotals[wc.code] || 0;
      return '<tr><td>' + esc(wc.code) + '</td><td class="l">' + esc(wc.label) + '</td><td>' + fmt1(kg) + '</td>' +
        '<td>' + (codeSum > 0 ? fmtPct(kg / codeSum) : '—') + '</td><td class="l">' + esc(wc.owner) + '</td>' +
        '<td>' + fmt1(kg * (wc.recoverRate || 0)) + '</td></tr>';
    }).join('');
    var totalItemWaste = Object.keys(itemTotals).reduce(function (s, k) { return s + itemTotals[k]; }, 0);
    var itemRows = Object.keys(itemTotals).map(function (name) { return { name: name, waste: itemTotals[name] }; })
      .sort(function (a, b) { return b.waste - a.waste; }).slice(0, 5)
      .map(function (it, i) {
        return '<tr><td>' + (i + 1) + '</td><td class="l">' + esc(it.name) + '</td><td>' + fmt1(it.waste) + '</td>' +
          '<td>' + (totalItemWaste > 0 ? fmtPct(it.waste / totalItemWaste) : '—') + '</td></tr>';
      }).join('');
    host.innerHTML =
      '<div class="prod-table-wrap"><table class="prod-table prod-table-sm"><thead><tr><th>코드</th><th>정의</th><th>폐기량(kg)</th><th>구성비</th><th>조치주체</th><th>회수가능(kg)</th></tr></thead>' +
      '<tbody>' + codeRows + '</tbody></table></div>' +
      '<div class="prod-table-wrap" style="margin-top:12px;"><table class="prod-table prod-table-sm"><thead><tr><th>순위</th><th>품목</th><th>폐기량(kg)</th><th>구성비</th></tr></thead>' +
      '<tbody>' + (itemRows || '<tr><td colspan="4" style="padding:12px;color:#888;">데이터 없음</td></tr>') + '</tbody></table></div>';
  }

  /* ---------- 개선안 (05_개선시뮬 로직 이식) ---------- */
  function computeLevers() {
    var pooled = [];
    filtered.forEach(function (r) { (r.materialRows || []).forEach(function (row) { pooled.push({ row: row, workDate: r.info.workDate }); }); });
    var periodDays = filtered.length || 1;
    var monthlyWorkDays = master.monthlyWorkDays || 22;
    var totalInput = 0, totalDcode = 0;
    pooled.forEach(function (p) {
      totalInput += CALC.toNum(p.row.inputQty);
      totalDcode += CALC.toNum(p.row.wasteD);
    });

    return (master.improvementLevers || []).map(function (lv) {
      var dailyKg = 0, note = '';
      if (lv.id === 'fifo') {
        var target = lv.defaultTargetDays, sum = 0;
        pooled.forEach(function (p) {
          var calc = CALC.rowCalc(p.row, master, p.workDate);
          var input = CALC.toNum(p.row.inputQty);
          if (typeof calc.days === 'number' && calc.days > target) sum += (calc.days - target) * input * master.k2;
        });
        dailyKg = sum / periodDays;
        note = '목표 재고일수 D+' + target;
      } else if (lv.id === 'resort') {
        dailyKg = (totalDcode / periodDays) * (lv.defaultTargetRatio || 1) * 0.7;
        note = 'D코드(작업로스) 회수율 70% 가정';
      } else if (lv.id === 'sizeCheck') {
        var sum2 = 0, n2 = 0;
        pooled.forEach(function (p) {
          var calc = CALC.rowCalc(p.row, master, p.workDate);
          if (calc.predicted != null) {
            n2++;
            var item = CALC.findItem(master, p.row.name);
            if (item) {
              var measured = CALC.toNum(p.row.measuredWeightG);
              var ratio = Math.max(0, (item.standardWeightG - measured) / item.standardWeightG);
              sum2 += ratio * master.k1 * CALC.toNum(p.row.inputQty);
            }
          }
        });
        dailyKg = (sum2 / periodDays) * (lv.defaultTargetRatio || 0.5);
        note = n2 ? (n2 + '건 구중 실측 데이터 기반') : '구중 실측 데이터 없음 — 실측구중 입력 필요';
      } else if (lv.id === 'cutStd') {
        dailyKg = (totalDcode / periodDays) * (lv.defaultTargetRatio || 0.03);
        note = 'D코드(작업로스) 총량 기준';
      } else if (lv.id === 'washStd') {
        dailyKg = (totalInput / periodDays) * (lv.defaultTargetRatio || 0.005);
        note = '총 투입량 기준';
      }
      return { label: lv.label, dailyKg: dailyKg, monthlyKg: dailyKg * monthlyWorkDays, difficulty: lv.difficulty, action: lv.action, note: note };
    });
  }

  function renderLevers() {
    var host = $('dashLevers'); if (!host) return;
    var levers = computeLevers();
    host.innerHTML = levers.map(function (lv) {
      return '<div class="prod-lever-card"><h4>' + esc(lv.label) + '</h4><p>' + esc(lv.action) + '</p>' +
        '<div class="prod-lever-meta"><span>일 평균 회수 추정 ' + fmt1(lv.dailyKg) + ' kg</span>' +
        '<span>월 환산 ' + fmt1(lv.monthlyKg) + ' kg</span><span>' + esc(lv.difficulty || '') + '</span>' +
        '<span>' + esc(lv.note) + '</span></div></div>';
    }).join('');
  }

  /* ---------- 감량 청구 대상 ---------- */
  function renderClaimList() {
    var host = $('dashClaims'); if (!host) return;
    var rows = [];
    filtered.forEach(function (r) {
      (r.materialRows || []).forEach(function (row) {
        var calc = CALC.rowCalc(row, master, r.info.workDate);
        if (calc.discountKg > 0.5) rows.push({ date: r.info.workDate, name: row.name, lot: row.lot, discountKg: calc.discountKg, claim: calc.claim });
      });
    });
    rows.sort(function (a, b) { return b.discountKg - a.discountKg; });
    var body = rows.slice(0, 30).map(function (r) {
      return '<tr><td>' + esc(r.date) + '</td><td class="l">' + esc(r.name) + '</td><td>' + esc(r.lot || '—') + '</td>' +
        '<td>' + fmt1(r.discountKg) + '</td><td>' + fmtWon(r.claim) + '</td></tr>';
    }).join('');
    host.innerHTML = '<div class="prod-table-wrap"><table class="prod-table prod-table-sm"><thead><tr><th>작업일</th><th>품목</th><th>로트번호</th><th>감량대상(kg)</th><th>청구액</th></tr></thead>' +
      '<tbody>' + (body || '<tr><td colspan="5" style="padding:12px;color:#888;">면책수율 미달 로트 없음</td></tr>') + '</tbody></table></div>' +
      (rows.length ? '<p class="prod-help">단가가 등록되지 않은 품목은 청구액이 0원으로 표시됩니다 — production-master.json 품목 마스터에서 단가를 입력하면 자동 반영됩니다.</p>' : '');
  }

  function renderAll() {
    applyFilter();
    renderKpis(computeKpis());
    renderOverallChart();
    renderItemFilterOptions();
    renderItemBreakdown();
    renderTrend();
    renderCause();
    renderLevers();
    renderClaimList();
  }

  function init() {
    if (!$('rangeFrom').value) $('rangeFrom').value = daysAgo(30);
    if (!$('rangeTo').value) $('rangeTo').value = new Date().toISOString().slice(0, 10);

    DkjMaster.loadProductionMaster().then(function (m) {
      master = m;
      var savedTarget = null;
      try { savedTarget = localStorage.getItem(TARGET_KEY); } catch (e) {}
      $('yieldTarget').value = savedTarget || Math.round(master.contractYield * 1000) / 10;

      loadRecords();
      renderAll();

      $('rangeFrom').addEventListener('change', renderAll);
      $('rangeTo').addEventListener('change', renderAll);
      $('yieldTarget').addEventListener('change', function () {
        try { localStorage.setItem(TARGET_KEY, $('yieldTarget').value); } catch (e) {}
        renderAll();
      });
      $('itemFilter').addEventListener('change', function () {
        itemFilter = $('itemFilter').value;
        renderItemBreakdown();
      });
      $('btnRefresh').addEventListener('click', function () { loadRecords(); renderAll(); });
    }).catch(function (err) {
      console.error('[production-dashboard] init failed', err);
      $('dashKpis').innerHTML = '<p style="color:#c62828;">기준 데이터를 불러오지 못했습니다.</p>';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
