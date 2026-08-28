/**
 * DkjProductionCalc — 생산일지(DKJ-F-053) 계산 엔진 (순수 함수, DOM 없음)
 *
 * DKJ-F-053_생산일지_개정본.xlsx 의 수식을 그대로 이식한다.
 *   02_생산일지 → rowCalc/groupBy/grandTotal (재고일수·폐기량·수율·감량대상)
 *   02_생산일지 완제품 물질수지 → finishedCalc
 *   04_원인분석 → causeAnalysis (A~E 사유코드 귀속 + 파레토)
 * 폼(dkj-production-form.js)과 대시보드(production-dashboard.js)가 같은 수식을 쓰도록
 * 이 파일 하나에 계산 로직을 모은다 — 두 곳에서 공식이 어긋나는 사고를 막는다.
 */
(function (global) {
  'use strict';

  function toNum(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  function hasVal(v) {
    return v !== undefined && v !== null && String(v).trim() !== '';
  }

  /** 작업일 - 입고일자 (일수). 둘 중 하나라도 비어있으면 null */
  function daysBetween(workDate, receivedDate) {
    if (!hasVal(workDate) || !hasVal(receivedDate)) return null;
    var a = new Date(workDate + 'T00:00:00');
    var b = new Date(receivedDate + 'T00:00:00');
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
    return Math.round((a.getTime() - b.getTime()) / 86400000);
  }

  function findItem(master, name) {
    if (!master || !name) return null;
    return (master.items || []).filter(function (it) { return it.name === name; })[0] || null;
  }

  var WASTE_KEYS = ['wasteA', 'wasteB', 'wasteC', 'wasteD', 'wasteE'];

  /** 원재료 한 줄 계산 — 02_생산일지 D~P열 + 03_수율예측(구중 입력 시) */
  function rowCalc(row, master, workDate) {
    var input = toNum(row.inputQty), used = toNum(row.usedQty), carry = toNum(row.carryQty);
    var prev = toNum(row.prevStock), recv = toNum(row.receivedQty);
    var item = findItem(master, row.name);
    var days = daysBetween(workDate, row.receivedDate);

    var waste = input - used - carry;
    var remainStock = prev + recv - input;
    var yieldActual = input > 0 ? (used + carry) / input : null;
    var yieldStd = item ? item.standardYield : 0;
    var gap = (yieldActual != null) ? (yieldActual - master.contractYield) : null;
    var discountKg = input > 0 ? Math.max(0, input - (used + carry) / master.exemptionYield) : 0;
    var unitPrice = item ? (item.unitPrice || 0) : 0;
    var claim = discountKg * unitPrice;

    var wasteEntered = WASTE_KEYS.some(function (k) { return hasVal(row[k]); });
    var wasteSum = WASTE_KEYS.reduce(function (s, k) { return s + toNum(row[k]); }, 0);
    var wasteCheck = !wasteEntered ? 'empty' : (Math.abs(wasteSum - waste) <= 0.5 ? 'ok' : 'mismatch');

    var predicted = null, residual = null, predictNote = '';
    if (item && hasVal(row.measuredWeightG) && item.standardWeightG) {
      var measured = toNum(row.measuredWeightG);
      var sizeDeficitRatio = Math.max(0, (item.standardWeightG - measured) / item.standardWeightG);
      var sizeCut = sizeDeficitRatio * master.k1;
      var storageDays = typeof days === 'number' ? days : 0;
      var storageCut = Math.max(0, storageDays - 1) * master.k2;
      predicted = yieldStd - sizeCut - storageCut;
      if (yieldActual != null) {
        residual = yieldActual - predicted;
        predictNote = residual < -master.k3 ? '작업·공정 요인 확인 필요' : '예측 범위 내';
      }
    }

    return {
      item: item, days: days, waste: waste, remainStock: remainStock,
      yieldActual: yieldActual, yieldStd: yieldStd, gap: gap,
      discountKg: discountKg, unitPrice: unitPrice, claim: claim,
      wasteEntered: wasteEntered, wasteSum: wasteSum, wasteCheck: wasteCheck,
      predicted: predicted, residual: residual, predictNote: predictNote
    };
  }

  /** 품목군(상추/양상추/기타)별 소계 — 가중평균수율(단순평균 아님) */
  function groupBy(rows, calcs) {
    var groups = {}, order = [];
    rows.forEach(function (r, i) {
      var item = calcs[i].item;
      var g = item ? item.group : '기타';
      if (!groups[g]) { groups[g] = { group: g, input: 0, used: 0, carry: 0, waste: 0, recv: 0, prev: 0, remain: 0, discountKg: 0 }; order.push(g); }
      var gr = groups[g];
      gr.input += toNum(r.inputQty); gr.used += toNum(r.usedQty); gr.carry += toNum(r.carryQty);
      gr.waste += calcs[i].waste; gr.recv += toNum(r.receivedQty); gr.prev += toNum(r.prevStock);
      gr.remain += calcs[i].remainStock; gr.discountKg += calcs[i].discountKg;
    });
    return order.map(function (g) {
      var gr = groups[g];
      gr.yield = gr.input > 0 ? (gr.used + gr.carry) / gr.input : null;
      return gr;
    });
  }

  /** 원물 총합계 — 가중평균수율 */
  function grandTotal(rows, calcs, master) {
    var t = { input: 0, used: 0, carry: 0, waste: 0, recv: 0, prev: 0, remain: 0, discountKg: 0, claim: 0 };
    rows.forEach(function (r, i) {
      t.input += toNum(r.inputQty); t.used += toNum(r.usedQty); t.carry += toNum(r.carryQty);
      t.waste += calcs[i].waste; t.recv += toNum(r.receivedQty); t.prev += toNum(r.prevStock);
      t.remain += calcs[i].remainStock; t.discountKg += calcs[i].discountKg; t.claim += calcs[i].claim;
    });
    t.yield = t.input > 0 ? (t.used + t.carry) / t.input : null;
    t.gap = (t.yield != null && master) ? t.yield - master.contractYield : null;
    t.defectRate = t.input > 0 ? t.waste / t.input : null;
    return t;
  }

  function byproductCalc(row, workDate) {
    var prev = toNum(row.prevStock), recv = toNum(row.receivedQty), used = toNum(row.usedQty);
    return { days: daysBetween(workDate, row.receivedDate), remainStock: prev + recv - used };
  }

  function byproductTotal(rows, workDate) {
    var t = { prev: 0, recv: 0, used: 0, remain: 0 };
    rows.forEach(function (r) {
      var c = byproductCalc(r, workDate);
      t.prev += toNum(r.prevStock); t.recv += toNum(r.receivedQty); t.used += toNum(r.usedQty);
      t.remain += c.remainStock;
    });
    return t;
  }

  /** 완제품 물질수지 검증 — 02_생산일지 하단 표, P32 판정식 그대로 */
  function finishedCalc(finished, materialGrand, byproductGrand) {
    var f = finished || {};
    var madeKg = toNum(f.madeKg);
    var calcStockKg = toNum(f.prevStockKg) + madeKg - toNum(f.shippedKg);
    var calcStockBag = toNum(f.prevStockBag) + toNum(f.madeBag) - toNum(f.shippedBag);
    var diffKg = toNum(f.actualStockKg) - calcStockKg;
    var theoreticalInputKg = materialGrand.used + materialGrand.carry + byproductGrand.used;
    var massBalanceDiffKg = madeKg - theoreticalInputKg;
    var stockOk = Math.abs(diffKg) <= 1;
    var balanceOk = Math.abs(massBalanceDiffKg) <= 1;
    var msgs = [];
    if (!stockOk) msgs.push('재고 불일치(실사 대조 필요)');
    if (!balanceOk) msgs.push('물질수지 불일치(전일 이월분·사용량 입력 확인 필요)');
    return {
      calcStockKg: calcStockKg, calcStockBag: calcStockBag, diffKg: diffKg,
      theoreticalInputKg: theoreticalInputKg, massBalanceDiffKg: massBalanceDiffKg,
      judge: msgs.length ? msgs.join(' · ') : '정상', ok: stockOk && balanceOk
    };
  }

  /** 폐기 원인 분석 — 04_원인분석 (사유코드 귀속 + 파레토) */
  function causeAnalysis(rows, calcs, master) {
    var perRow = rows.map(function (r, i) {
      return {
        name: r.name, lot: r.lot, waste: calcs[i].waste,
        wasteEntered: calcs[i].wasteEntered, wasteCheck: calcs[i].wasteCheck,
        a: toNum(r.wasteA), b: toNum(r.wasteB), c: toNum(r.wasteC), d: toNum(r.wasteD), e: toNum(r.wasteE)
      };
    });
    var totalWaste = perRow.reduce(function (s, r) { return s + r.waste; }, 0);
    var sorted = perRow.slice().sort(function (a, b) { return b.waste - a.waste; });
    perRow.forEach(function (r) { r.rank = sorted.indexOf(r) + 1; });

    var codeTotals = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    perRow.forEach(function (r) {
      codeTotals.A += r.a; codeTotals.B += r.b; codeTotals.C += r.c; codeTotals.D += r.d; codeTotals.E += r.e;
    });
    var codeSum = codeTotals.A + codeTotals.B + codeTotals.C + codeTotals.D + codeTotals.E;
    var byCode = (master.wasteCodes || []).map(function (wc) {
      var kg = codeTotals[wc.code] || 0;
      return {
        code: wc.code, label: wc.label, kg: kg,
        ratio: codeSum > 0 ? kg / codeSum : null,
        owner: wc.owner, improveOwner: wc.improveOwner, claimable: wc.claimable,
        recoverable: kg * (wc.recoverRate || 0), action: wc.action || wc.judgeCriteria
      };
    });
    var top1 = sorted.length ? sorted[0] : null;
    var top1Ratio = (top1 && totalWaste > 0) ? top1.waste / totalWaste : null;
    var top3Sum = sorted.slice(0, 3).reduce(function (s, r) { return s + r.waste; }, 0);
    var top3Ratio = totalWaste > 0 ? top3Sum / totalWaste : null;

    return {
      perRow: perRow, totalWaste: totalWaste, codeSum: codeSum, byCode: byCode,
      top1: top1, top1Ratio: top1Ratio, top3Ratio: top3Ratio
    };
  }

  /**
   * BOM(완제품 배합비) 역산 — 완제품 생산량 × 배합비 ÷ 표준수율 = 이론 원료소요량.
   * 여러 제품이 같은 원료를 나눠 쓸 때는 실투입량을 제품별 이론소요 비율로 배분해
   * "제품별 환산수율"을 만든다(로트 단위로 실제 추적하는 게 아니라 추정치).
   *   materialInputs: { 원재료명: 오늘 실제 투입량(kg) }
   */
  function bomVariance(skuOutputs, products, master, materialInputs) {
    var bomByCode = {};
    (products || []).forEach(function (p) { bomByCode[p.code] = p; });

    var theoreticalByMaterial = {};
    var perSku = [];

    (skuOutputs || []).forEach(function (s) {
      var kg = toNum(s.kg);
      if (kg <= 0) return;
      var p = bomByCode[s.code];
      if (!p || !p.bom || !p.bom.length) return;
      var materials = {};
      p.bom.forEach(function (b) {
        var item = findItem(master, b.material);
        var std = item ? item.standardYield : 0;
        if (!std) return;
        var theo = (kg * b.ratio) / std;
        materials[b.material] = theo;
        theoreticalByMaterial[b.material] = (theoreticalByMaterial[b.material] || 0) + theo;
      });
      perSku.push({ code: s.code, name: p.name, kg: kg, materials: materials });
    });

    var materialRows = Object.keys(theoreticalByMaterial).map(function (m) {
      var theo = theoreticalByMaterial[m];
      var actual = toNum((materialInputs || {})[m]);
      return {
        material: m, theoreticalKg: theo, actualKg: actual,
        yieldPct: actual > 0 ? theo / actual : null,
        varianceKg: actual - theo
      };
    });

    var productRows = perSku.map(function (s) {
      var actualRaw = 0;
      Object.keys(s.materials).forEach(function (m) {
        var theoTotal = theoreticalByMaterial[m];
        var actualTotal = toNum((materialInputs || {})[m]);
        actualRaw += (theoTotal > 0 && actualTotal > 0) ? actualTotal * (s.materials[m] / theoTotal) : s.materials[m];
      });
      return {
        code: s.code, name: s.name, kg: s.kg,
        theoreticalRawKg: Object.keys(s.materials).reduce(function (sum, m) { return sum + s.materials[m]; }, 0),
        actualRawKg: actualRaw,
        yieldPct: actualRaw > 0 ? s.kg / actualRaw : null
      };
    });

    return { materials: materialRows, products: productRows };
  }

  global.DkjProductionCalc = {
    toNum: toNum, hasVal: hasVal, daysBetween: daysBetween, findItem: findItem,
    rowCalc: rowCalc, groupBy: groupBy, grandTotal: grandTotal,
    byproductCalc: byproductCalc, byproductTotal: byproductTotal,
    finishedCalc: finishedCalc, causeAnalysis: causeAnalysis, bomVariance: bomVariance
  };
})(window);
