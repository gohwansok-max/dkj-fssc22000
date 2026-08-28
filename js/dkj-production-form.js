/**
 * DkjProductionForm — 생산일지(DKJ-F-053) 입력 엔진
 *
 * DKJ-F-053_생산일지_개정본.xlsx 의 02_생산일지(+04_원인분석)를 화면으로 옮긴다.
 * "생산일보, 이렇게 쓰면 쉬워요" 교육자료의 색상 규칙을 그대로 따른다 —
 *   입력칸(파란 굵게) 은 현장이 매일 채우고, 계산칸(회색) 은 절대 손대지 않는다.
 * 계산은 전부 DkjProductionCalc(js/dkj-production-calc.js) 에 위임한다 —
 * 대시보드가 같은 공식을 재사용해야 두 화면 숫자가 어긋나지 않는다.
 *
 * 저장/이력/결재는 기존 엔진과 동일하게 DkjRecordStore/DkjApproval 를 그대로 쓴다.
 * 행 단위 교차계산(재고일수·수율·물질수지)이 필요해 dkj-ledger-form 을 그대로
 * 재사용하지 않고 별도 구현했다.
 */
(function (global) {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function today() { return new Date().toISOString().slice(0, 10); }

  function fmt1(n) {
    return (n == null || isNaN(n)) ? '—' : (Math.round(n * 10) / 10).toLocaleString('ko-KR');
  }
  function fmtPct(n) {
    return (n == null || isNaN(n)) ? '—' : (Math.round(n * 1000) / 10) + '%';
  }
  function fmtPctSigned(n) {
    if (n == null || isNaN(n)) return '—';
    var v = Math.round(n * 1000) / 10;
    return (v > 0 ? '+' : '') + v + '%p';
  }
  function checkBadge(check) {
    if (check === 'ok') return '<span class="prod-badge ok">OK</span>';
    if (check === 'mismatch') return '<span class="prod-badge ng">불일치</span>';
    return '<span class="prod-badge off">미입력</span>';
  }

  var MATERIAL_HEAD = ['원재료명', '로트번호', '입고일자', '재고\n일수', '전일재고', '입고량', '원물\n투입량',
    '사용량', '이월\n전처리', '폐기량', '원물\n재고량', '실적\n수율', '표준\n수율', '기준대비\n(%p)',
    '실측구중\n(g)', '감량대상\n(kg)', ''];
  var CAUSE_HEAD = ['원재료명', '폐기량(kg)', '빠른입력', 'A 정상제거', 'B 원물불량', 'C 저장열화', 'D 작업로스',
    'E 이물기타', '입력합계', '검증', '파레토\n순위'];
  var BYPRODUCT_HEAD = ['부자재명', '로트번호', '입고일자', '재고\n일수', '전일재고', '입고량', '사용량', '재고량', ''];
  var FINISHED_FIELDS = [
    { f: 'madeKg', label: '생산량(kg)' }, { f: 'madeBag', label: '생산량(봉)' },
    { f: 'prevStockKg', label: '전일재고(kg)' }, { f: 'prevStockBag', label: '전일재고(봉)' },
    { f: 'shippedKg', label: '출고량(kg)' }, { f: 'shippedBag', label: '출고량(봉)' },
    { f: 'actualStockKg', label: '실사재고(kg) ★' }, { f: 'actualStockBag', label: '실사재고(봉) ★' }
  ];
  var INFO_FIELDS = [
    { f: 'workDate', label: '작업일 *', type: 'date' },
    { f: 'staff', label: '직원(명)', type: 'number' },
    { f: 'prep', label: '전처리(명)', type: 'number' },
    { f: 'pack', label: '외포장(명)', type: 'number' },
    { f: 'season', label: '계절(명)', type: 'number' }
  ];

  function round1(n) { return Math.round(n * 10) / 10; }

  function emptyMaterialRow(name) {
    return {
      name: name || '', lot: '', receivedDate: '', prevStock: '', receivedQty: '',
      inputQty: '', usedQty: '', carryQty: '', measuredWeightG: '',
      wasteA: '', wasteB: '', wasteC: '', wasteD: '', wasteE: ''
    };
  }
  function emptyByproductRow() {
    return { name: '', lot: '', receivedDate: '', prevStock: '', receivedQty: '', usedQty: '' };
  }
  function emptyState(master, products) {
    var rows = (master.items || []).filter(function (it) { return it.activeByDefault; })
      .map(function (it) { return emptyMaterialRow(it.name); });
    return {
      info: { workDate: today(), staff: '', prep: '', pack: '', season: '' },
      materialRows: rows,
      byproductRows: [emptyByproductRow()],
      finished: {
        madeKg: '', madeBag: '', prevStockKg: '', prevStockBag: '',
        shippedKg: '', shippedBag: '', actualStockKg: '', actualStockBag: ''
      },
      skuOutputs: (products || []).filter(function (p) { return p.bom && p.bom.length; })
        .map(function (p) { return { code: p.code, name: p.name, kg: '' }; }),
      note: '',
      approvals: { writer: '', reviewer: '', approver: '' },
      signoff: {},
      audit: [],
      locked: false
    };
  }

  function mount(spec) {
    if (!spec || !spec.code) throw new Error('DkjProductionForm: spec.code required');
    var FORM_ID = spec.code;
    var CALC = global.DkjProductionCalc;
    var master = null, state = null, editingId = null, draftTimer = null;
    var apvUi = null;
    var STAFF_NAMES = [];
    var PRODUCTS = [];
    var PRODUCTS_BOM_NOTE = '';
    var APPROVAL_LABELS = { writer: '작성자', reviewer: '검토자', approver: '승인자' };
    var REMARK_PRESETS = ['정상 — 특이사항 없음', '설비 고장/점검', '정전', '원료 입고 지연·결품', '이물 발견', '인력 부족', '포장재 부족'];

    function loadStaffNames() {
      return (global.DkjMaster && DkjMaster.loadStaff ? DkjMaster.loadStaff() : Promise.resolve({ staff: [] }))
        .then(function (d) {
          return (d.staff || []).map(function (s) { return typeof s === 'string' ? s : (s && s.name) || ''; }).filter(Boolean);
        }).catch(function () { return []; });
    }

    /* 작성자/검토자/승인자 — 등록된 직원 목록(staff.json)에서 고른다. 목록에 없으면 + 직접입력. */
    function renderApproverFields() {
      ['writer', 'reviewer', 'approver'].forEach(function (k) {
        var host = $(k + 'Field'); if (!host) return;
        var value = state.approvals[k] || '';
        var opts = STAFF_NAMES.map(function (n) {
          return '<option value="' + esc(n) + '"' + (n === value ? ' selected' : '') + '>' + esc(n) + '</option>';
        }).join('');
        var customOpt = (value && STAFF_NAMES.indexOf(value) === -1)
          ? '<option value="' + esc(value) + '" selected>' + esc(value) + '</option>' : '';
        host.innerHTML = '<select data-approver="' + k + '"><option value="">선택</option>' + customOpt + opts + '<option value="__custom__">+ 직접입력</option></select>';
        host.querySelector('select').addEventListener('change', function () {
          if (state.locked) return;
          var v = this.value;
          if (v === '__custom__') {
            var name = prompt(APPROVAL_LABELS[k] + ' 이름을 입력하세요.', '');
            state.approvals[k] = name ? name.trim() : '';
            renderApproverFields();
          } else {
            state.approvals[k] = v;
          }
          scheduleDraft();
        });
      });
    }

    /* 특이사항 — 자주 쓰는 항목을 선택. 목록에 없으면 + 직접입력. */
    function renderRemarkField() {
      var host = $('remarkField'); if (!host) return;
      var value = state.note || '';
      var opts = REMARK_PRESETS.map(function (p) {
        return '<option value="' + esc(p) + '"' + (p === value ? ' selected' : '') + '>' + esc(p) + '</option>';
      }).join('');
      var customOpt = (value && REMARK_PRESETS.indexOf(value) === -1)
        ? '<option value="' + esc(value) + '" selected>' + esc(value) + '</option>' : '';
      host.innerHTML = '<select data-remark-select="1"><option value="">선택</option>' + customOpt + opts + '<option value="__custom__">+ 직접입력</option></select>';
      host.querySelector('select').addEventListener('change', function () {
        if (state.locked) return;
        var v = this.value;
        if (v === '__custom__') {
          var text = prompt('특이사항을 입력하세요.', '');
          state.note = text ? text.trim() : '';
          renderRemarkField();
        } else {
          state.note = v;
        }
        scheduleDraft();
      });
    }

    /* 어제 저장분에서 오늘 값을 이어받는다 — 전일재고·로트·인원수를 매일 다시 치지 않도록.
       "재고"는 정의상 어제의 원물재고량과 같아야 하므로 자동 이월이 더 정확하기도 하다. */
    function findPrevRecord(beforeDate) {
      var list = DkjRecordStore.list(FORM_ID);
      var candidates = list.filter(function (r) {
        return r.info && r.info.workDate && (!beforeDate || r.info.workDate < beforeDate);
      });
      candidates.sort(function (a, b) { return a.info.workDate < b.info.workDate ? 1 : -1; });
      return candidates[0] || null;
    }

    function buildNextState() {
      var base = emptyState(master, PRODUCTS);
      var prev = findPrevRecord(base.info.workDate);
      if (!prev) return base;

      base.info.staff = prev.info.staff || '';
      base.info.prep = prev.info.prep || '';
      base.info.pack = prev.info.pack || '';
      base.info.season = prev.info.season || '';

      if (prev.materialRows && prev.materialRows.length) {
        base.materialRows = prev.materialRows.map(function (pr) {
          var calc = CALC.rowCalc(pr, master, prev.info.workDate);
          return {
            name: pr.name, lot: pr.lot, receivedDate: pr.receivedDate,
            prevStock: String(round1(calc.remainStock)), receivedQty: '', inputQty: '', usedQty: '', carryQty: '',
            measuredWeightG: '', wasteA: '', wasteB: '', wasteC: '', wasteD: '', wasteE: ''
          };
        });
      }
      if (prev.byproductRows && prev.byproductRows.length) {
        base.byproductRows = prev.byproductRows.map(function (pr) {
          var c = CALC.byproductCalc(pr, prev.info.workDate);
          return { name: pr.name, lot: pr.lot, receivedDate: pr.receivedDate, prevStock: String(round1(c.remainStock)), receivedQty: '', usedQty: '' };
        });
      }
      if (prev.finished) {
        base.finished.prevStockKg = prev.finished.actualStockKg || '';
        base.finished.prevStockBag = prev.finished.actualStockBag || '';
      }
      return base;
    }

    function quickWasteButtonsInner(ri, calc) {
      if (!calc || calc.waste <= 0.5) return '';
      return '<div class="prod-quick">' + ['A', 'B', 'C', 'D', 'E'].map(function (code) {
        return '<button type="button" class="prod-quickbtn" data-qr="' + ri + '" data-qc="' + code + '">' + code + '</button>';
      }).join('') + '</div>';
    }
    function bindQuickWasteButtons(container) {
      container.querySelectorAll('.prod-quickbtn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (state.locked) return;
          var ri = Number(btn.getAttribute('data-qr'));
          var code = btn.getAttribute('data-qc');
          var row = state.materialRows[ri];
          var calc = CALC.rowCalc(row, master, state.info.workDate);
          ['A', 'B', 'C', 'D', 'E'].forEach(function (c) {
            row['waste' + c] = (c === code) ? String(round1(calc.waste)) : '';
          });
          renderCauseBody();
          recalcAll();
          scheduleDraft();
        });
      });
    }

    function materialNameSelect(value, ri) {
      var opts = (master.items || []).map(function (it) {
        return '<option value="' + esc(it.name) + '"' + (it.name === value ? ' selected' : '') + '>' + esc(it.name) + '</option>';
      }).join('');
      var custom = (value && !CALC.findItem(master, value))
        ? '<option value="' + esc(value) + '" selected>' + esc(value) + '(미등록)</option>' : '';
      return '<select data-r="' + ri + '" data-f="name"><option value="">선택</option>' + custom + opts + '</select>';
    }

    function materialRowHtml(r, calc, ri) {
      return '<tr>' +
        '<td>' + materialNameSelect(r.name, ri) + '</td>' +
        '<td><input type="text" data-r="' + ri + '" data-f="lot" value="' + esc(r.lot) + '" placeholder="로트번호"></td>' +
        '<td><input type="date" data-r="' + ri + '" data-f="receivedDate" value="' + esc(r.receivedDate) + '"></td>' +
        '<td class="prod-calc" id="mr-days-' + ri + '">' + (calc.days == null ? '—' : calc.days) + '</td>' +
        '<td><input type="number" inputmode="decimal" step="0.1" title="어제 원물재고량에서 자동으로 이어받은 값입니다. 다르면 고쳐도 됩니다." data-r="' + ri + '" data-f="prevStock" value="' + esc(r.prevStock) + '"></td>' +
        '<td><input type="number" inputmode="decimal" step="0.1" data-r="' + ri + '" data-f="receivedQty" value="' + esc(r.receivedQty) + '"></td>' +
        '<td><input type="number" inputmode="decimal" step="0.1" class="prod-key" data-r="' + ri + '" data-f="inputQty" value="' + esc(r.inputQty) + '"></td>' +
        '<td><input type="number" inputmode="decimal" step="0.1" class="prod-key" data-r="' + ri + '" data-f="usedQty" value="' + esc(r.usedQty) + '"></td>' +
        '<td><input type="number" inputmode="decimal" step="0.1" data-r="' + ri + '" data-f="carryQty" value="' + esc(r.carryQty) + '"></td>' +
        '<td class="prod-calc" id="mr-waste-' + ri + '">' + fmt1(calc.waste) + '</td>' +
        '<td class="prod-calc" id="mr-remain-' + ri + '">' + fmt1(calc.remainStock) + '</td>' +
        '<td class="prod-calc" id="mr-yield-' + ri + '">' + fmtPct(calc.yieldActual) + '</td>' +
        '<td class="prod-calc" id="mr-std-' + ri + '">' + fmtPct(calc.yieldStd) + '</td>' +
        '<td class="prod-calc" id="mr-gap-' + ri + '">' + fmtPctSigned(calc.gap) + '</td>' +
        '<td><input type="number" inputmode="decimal" step="1" data-r="' + ri + '" data-f="measuredWeightG" value="' + esc(r.measuredWeightG) + '" placeholder="선택"></td>' +
        '<td class="prod-calc" id="mr-discount-' + ri + '">' + fmt1(calc.discountKg) + '</td>' +
        '<td class="prod-act"><button type="button" class="prod-del" data-delr="' + ri + '">삭제</button></td>' +
        '</tr>';
    }

    function materialTotalsHtml(groups, grand) {
      var rowsHtml = groups.map(function (g) {
        var gGap = g.yield != null ? g.yield - master.contractYield : null;
        return '<tr class="prod-subtotal"><td colspan="4">' + esc(g.group) + ' 소계</td>' +
          '<td>' + fmt1(g.prev) + '</td><td>' + fmt1(g.recv) + '</td><td>' + fmt1(g.input) + '</td>' +
          '<td>' + fmt1(g.used) + '</td><td>' + fmt1(g.carry) + '</td><td>' + fmt1(g.waste) + '</td>' +
          '<td>' + fmt1(g.remain) + '</td><td>' + fmtPct(g.yield) + '</td><td>—</td>' +
          '<td class="' + (gGap != null && gGap < 0 ? 'prod-neg' : 'prod-pos') + '">' + fmtPctSigned(gGap) + '</td>' +
          '<td>—</td><td>' + fmt1(g.discountKg) + '</td><td></td></tr>';
      }).join('');
      var grandHtml = '<tr class="prod-grandtotal"><td colspan="4">원물 총합계</td>' +
        '<td>' + fmt1(grand.prev) + '</td><td>' + fmt1(grand.recv) + '</td><td>' + fmt1(grand.input) + '</td>' +
        '<td>' + fmt1(grand.used) + '</td><td>' + fmt1(grand.carry) + '</td><td>' + fmt1(grand.waste) + '</td>' +
        '<td>' + fmt1(grand.remain) + '</td><td>' + fmtPct(grand.yield) + '</td><td>—</td>' +
        '<td class="' + (grand.gap != null && grand.gap < 0 ? 'prod-neg' : 'prod-pos') + '">' + fmtPctSigned(grand.gap) + '</td>' +
        '<td>—</td><td>' + fmt1(grand.discountKg) + '</td><td></td></tr>';
      return rowsHtml + grandHtml;
    }

    function causeRowHtml(r, calc, causeRow, ri) {
      return '<tr>' +
        '<td>' + esc(r.name || '—') + '</td>' +
        '<td id="ca-waste-' + ri + '">' + fmt1(calc.waste) + '</td>' +
        '<td id="ca-wastebtn-' + ri + '">' + quickWasteButtonsInner(ri, calc) + '</td>' +
        '<td><input type="number" inputmode="decimal" step="0.1" data-r="' + ri + '" data-f="wasteA" value="' + esc(r.wasteA) + '"></td>' +
        '<td><input type="number" inputmode="decimal" step="0.1" data-r="' + ri + '" data-f="wasteB" value="' + esc(r.wasteB) + '"></td>' +
        '<td><input type="number" inputmode="decimal" step="0.1" data-r="' + ri + '" data-f="wasteC" value="' + esc(r.wasteC) + '"></td>' +
        '<td><input type="number" inputmode="decimal" step="0.1" data-r="' + ri + '" data-f="wasteD" value="' + esc(r.wasteD) + '"></td>' +
        '<td><input type="number" inputmode="decimal" step="0.1" data-r="' + ri + '" data-f="wasteE" value="' + esc(r.wasteE) + '"></td>' +
        '<td id="ca-sum-' + ri + '">' + fmt1(calc.wasteSum) + '</td>' +
        '<td id="ca-check-' + ri + '">' + checkBadge(calc.wasteCheck) + '</td>' +
        '<td id="ca-rank-' + ri + '">' + (causeRow ? causeRow.rank : '—') + '</td>' +
        '</tr>';
    }

    function renderCauseSummary(cause) {
      var host = $('causeSummary'); if (!host) return;
      var codeRows = cause.byCode.map(function (c) {
        return '<tr><td>' + esc(c.code) + '</td><td>' + esc(c.label) + '</td><td>' + fmt1(c.kg) + '</td>' +
          '<td>' + (c.ratio == null ? '—' : fmtPct(c.ratio)) + '</td><td>' + esc(c.owner) + '</td>' +
          '<td>' + fmt1(c.recoverable) + '</td><td class="prod-action">' + esc(c.action || '') + '</td></tr>';
      }).join('');
      var topName = cause.top1 ? esc(cause.top1.name || '—') : '—';
      host.innerHTML =
        '<div class="prod-table-wrap"><table class="prod-table prod-table-sm"><thead><tr>' +
        '<th>코드</th><th>정의</th><th>폐기량(kg)</th><th>구성비</th><th>조치주체</th><th>회수가능(kg)</th><th>즉시 조치</th>' +
        '</tr></thead><tbody>' + codeRows + '</tbody></table></div>' +
        '<div class="prod-kpi-row">' +
        '<div class="prod-kpi"><span>총 폐기량</span><strong>' + fmt1(cause.totalWaste) + ' kg</strong></div>' +
        '<div class="prod-kpi"><span>최다 폐기 품목</span><strong>' + topName + '</strong></div>' +
        '<div class="prod-kpi"><span>상위 1개 품목 집중도</span><strong>' + (cause.top1Ratio == null ? '—' : fmtPct(cause.top1Ratio)) + '</strong></div>' +
        '<div class="prod-kpi"><span>상위 3개 품목 집중도</span><strong>' + (cause.top3Ratio == null ? '—' : fmtPct(cause.top3Ratio)) + '</strong></div>' +
        '</div>';
    }

    function byproductRowHtml(r, calc, bi) {
      return '<tr>' +
        '<td><input type="text" list="byproductPresets" data-target="byproduct" data-r="' + bi + '" data-f="name" value="' + esc(r.name) + '" placeholder="부자재명"></td>' +
        '<td><input type="text" data-target="byproduct" data-r="' + bi + '" data-f="lot" value="' + esc(r.lot) + '"></td>' +
        '<td><input type="date" data-target="byproduct" data-r="' + bi + '" data-f="receivedDate" value="' + esc(r.receivedDate) + '"></td>' +
        '<td class="prod-calc" id="br-days-' + bi + '">' + (calc.days == null ? '—' : calc.days) + '</td>' +
        '<td><input type="number" inputmode="decimal" step="0.1" title="어제 재고량에서 자동 이어받은 값입니다." data-target="byproduct" data-r="' + bi + '" data-f="prevStock" value="' + esc(r.prevStock) + '"></td>' +
        '<td><input type="number" inputmode="decimal" step="0.1" data-target="byproduct" data-r="' + bi + '" data-f="receivedQty" value="' + esc(r.receivedQty) + '"></td>' +
        '<td><input type="number" inputmode="decimal" step="0.1" data-target="byproduct" data-r="' + bi + '" data-f="usedQty" value="' + esc(r.usedQty) + '"></td>' +
        '<td class="prod-calc" id="br-remain-' + bi + '">' + fmt1(calc.remainStock) + '</td>' +
        '<td class="prod-act"><button type="button" class="prod-del" data-delb="' + bi + '">삭제</button></td>' +
        '</tr>';
    }
    function byproductTotalsHtml(t) {
      return '<tr class="prod-subtotal"><td colspan="4">부자재 소계</td>' +
        '<td>' + fmt1(t.prev) + '</td><td>' + fmt1(t.recv) + '</td><td>' + fmt1(t.used) + '</td>' +
        '<td>' + fmt1(t.remain) + '</td><td></td></tr>';
    }

    /* ---------- 구조 렌더 (행 추가/삭제·최초 로드 시에만 다시 그린다) ---------- */

    function renderInfoFields() {
      var host = $('prodInfo'); if (!host) return;
      host.innerHTML = INFO_FIELDS.map(function (f) {
        var v = state.info[f.f] || '';
        var input;
        if (f.type === 'date') {
          input = '<input type="date" data-target="info" data-f="' + f.f + '" value="' + esc(v) + '">';
        } else {
          input = '<div class="prod-stepper">' +
            '<button type="button" class="prod-step-btn" data-target="info" data-f="' + f.f + '" data-step="-1">−</button>' +
            '<input type="number" inputmode="decimal" step="0.5" class="prod-step-input" data-target="info" data-f="' + f.f + '" value="' + esc(v) + '">' +
            '<button type="button" class="prod-step-btn" data-target="info" data-f="' + f.f + '" data-step="1">+</button>' +
            '</div>';
        }
        return '<div class="dkj-field"><label>' + esc(f.label) + '</label>' + input + '</div>';
      }).join('');
      bindDataInputs(host);
      bindSteppers(host);
    }

    function renderMaterialTable() {
      var host = $('materialGrid'); if (!host) return;
      host.innerHTML = '<div class="prod-table-wrap"><table class="prod-table"><thead><tr>' +
        MATERIAL_HEAD.map(function (h) { return '<th>' + esc(h).replace(/\n/g, '<br>') + '</th>'; }).join('') +
        '</tr></thead><tbody id="materialBody"></tbody><tbody id="materialTotals"></tbody></table></div>';
      renderMaterialBody();
    }
    function renderMaterialBody() {
      var body = $('materialBody'); if (!body) return;
      body.innerHTML = state.materialRows.map(function (r, ri) {
        return materialRowHtml(r, CALC.rowCalc(r, master, state.info.workDate), ri);
      }).join('');
      bindDataInputs(body);
      body.querySelectorAll('[data-delr]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (state.locked) return;
          var idx = Number(b.getAttribute('data-delr'));
          state.materialRows.splice(idx, 1);
          if (!state.materialRows.length) state.materialRows.push(emptyMaterialRow());
          renderMaterialBody(); renderCauseBody(); recalcAll(); scheduleDraft();
        });
      });
    }

    function renderCauseTable() {
      var host = $('causeGrid'); if (!host) return;
      host.innerHTML = '<div class="prod-table-wrap"><table class="prod-table"><thead><tr>' +
        CAUSE_HEAD.map(function (h) { return '<th>' + esc(h).replace(/\n/g, '<br>') + '</th>'; }).join('') +
        '</tr></thead><tbody id="causeBody"></tbody></table></div><div id="causeSummary"></div>';
      renderCauseBody();
    }
    function renderCauseBody() {
      var body = $('causeBody'); if (!body) return;
      var rows = state.materialRows;
      var calcs = rows.map(function (r) { return CALC.rowCalc(r, master, state.info.workDate); });
      var cause = CALC.causeAnalysis(rows, calcs, master);
      body.innerHTML = rows.map(function (r, ri) {
        return causeRowHtml(r, calcs[ri], cause.perRow[ri], ri);
      }).join('');
      bindDataInputs(body);
      bindQuickWasteButtons(body);
    }

    function renderByproductTable() {
      var host = $('byproductGrid'); if (!host) return;
      host.innerHTML = '<datalist id="byproductPresets"></datalist>' +
        '<div class="prod-table-wrap"><table class="prod-table"><thead><tr>' +
        BYPRODUCT_HEAD.map(function (h) { return '<th>' + esc(h).replace(/\n/g, '<br>') + '</th>'; }).join('') +
        '</tr></thead><tbody id="byproductBody"></tbody><tbody id="byproductTotals"></tbody></table></div>';
      renderByproductBody();
      loadByproductPresets();
    }
    function renderByproductBody() {
      var body = $('byproductBody'); if (!body) return;
      body.innerHTML = state.byproductRows.map(function (r, bi) {
        return byproductRowHtml(r, CALC.byproductCalc(r, state.info.workDate), bi);
      }).join('');
      bindDataInputs(body);
      body.querySelectorAll('[data-delb]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (state.locked) return;
          var idx = Number(b.getAttribute('data-delb'));
          state.byproductRows.splice(idx, 1);
          if (!state.byproductRows.length) state.byproductRows.push(emptyByproductRow());
          renderByproductBody(); recalcAll(); scheduleDraft();
        });
      });
    }
    function loadByproductPresets() {
      if (!global.DkjMaster) return;
      DkjMaster.loadProducts().then(function (data) {
        var dl = $('byproductPresets'); if (!dl) return;
        dl.innerHTML = (data.rawMaterialPresets || [])
          .filter(function (p) { return p.materialType !== '원료'; })
          .map(function (p) { return '<option value="' + esc(p.name) + '">'; }).join('');
      }).catch(function () {});
    }

    function renderFinishedFields() {
      var host = $('finishedFields'); if (!host) return;
      host.innerHTML = FINISHED_FIELDS.map(function (ff) {
        var v = state.finished[ff.f] || '';
        return '<div class="dkj-field"><label>' + esc(ff.label) + '</label>' +
          '<input type="number" step="0.1" data-target="finished" data-f="' + ff.f + '" value="' + esc(v) + '"></div>';
      }).join('');
      bindDataInputs(host);
    }

    /* 완제품별 생산량(kg) → 합계를 생산량(kg)에 자동 반영, BOM 역산의 입력이 된다 */
    function renderSkuOutputs() {
      var host = $('skuOutputs'); if (!host) return;
      if (!state.skuOutputs || !state.skuOutputs.length) {
        host.innerHTML = '<p class="prod-help">완제품 목록을 불러오는 중입니다…</p>';
        return;
      }
      host.innerHTML = '<div class="prod-table-wrap"><table class="prod-table prod-table-sm"><thead><tr><th>완제품</th><th>생산량(kg)</th></tr></thead><tbody>' +
        state.skuOutputs.map(function (s, i) {
          return '<tr><td class="l">' + esc(s.name) + '</td><td><input type="number" inputmode="decimal" step="0.1" data-sku-r="' + i + '" value="' + esc(s.kg) + '"></td></tr>';
        }).join('') + '</tbody></table></div>';
      host.querySelectorAll('[data-sku-r]').forEach(function (el) {
        el.addEventListener('input', function () {
          if (state.locked) return;
          state.skuOutputs[Number(el.getAttribute('data-sku-r'))].kg = el.value;
          syncMadeKgFromSku();
          recalcAll();
          scheduleDraft();
        });
      });
    }

    function syncMadeKgFromSku() {
      var sum = (state.skuOutputs || []).reduce(function (s, r) { return s + CALC.toNum(r.kg); }, 0);
      if (sum <= 0) return;
      state.finished.madeKg = String(round1(sum));
      var el = document.querySelector('#finishedFields input[data-f="madeKg"]');
      if (el) el.value = state.finished.madeKg;
    }

    function materialInputMap() {
      var m = {};
      state.materialRows.forEach(function (r) {
        if (!r.name) return;
        m[r.name] = (m[r.name] || 0) + CALC.toNum(r.inputQty);
      });
      return m;
    }

    function renderBomSection(bom) {
      var host = $('bomSection'); if (!host) return;
      if (!bom.materials.length) {
        host.innerHTML = '<p class="prod-help">완제품별 생산량을 입력하면 BOM(배합비) 기준 원료 소요량과 제품별 수율이 여기 표시됩니다.</p>';
        return;
      }
      var matRows = bom.materials.map(function (m) {
        var bad = m.yieldPct != null && m.yieldPct < 1;
        return '<tr><td class="l">' + esc(m.material) + '</td><td>' + fmt1(m.theoreticalKg) + '</td><td>' + fmt1(m.actualKg) + '</td>' +
          '<td class="' + (bad ? 'prod-neg' : 'prod-pos') + '">' + (m.yieldPct == null ? '—' : fmtPct(m.yieldPct)) + '</td></tr>';
      }).join('');
      var prodRows = bom.products.map(function (p) {
        return '<tr><td class="l">' + esc(p.name) + '</td><td>' + fmt1(p.kg) + '</td><td>' + fmt1(p.actualRawKg) + '</td>' +
          '<td>' + (p.yieldPct == null ? '—' : fmtPct(p.yieldPct)) + '</td></tr>';
      }).join('');
      host.innerHTML =
        '<h4 class="prod-subhead">원료별 BOM 이론소요 대비 실투입</h4>' +
        '<div class="prod-table-wrap"><table class="prod-table prod-table-sm"><thead><tr><th>원재료</th><th>이론소요(kg)</th><th>실투입(kg)</th><th>BOM수율</th></tr></thead><tbody>' + matRows + '</tbody></table></div>' +
        '<h4 class="prod-subhead">제품별 환산수율</h4>' +
        '<div class="prod-table-wrap"><table class="prod-table prod-table-sm"><thead><tr><th>제품</th><th>생산량(kg)</th><th>배분 실투입(kg)</th><th>제품수율</th></tr></thead><tbody>' + prodRows + '</tbody></table></div>' +
        (PRODUCTS_BOM_NOTE ? '<p class="prod-help">' + esc(PRODUCTS_BOM_NOTE) + '</p>' : '') +
        '<p class="prod-help">공용 원료(여러 제품이 같이 쓰는 원료)는 제품별 이론소요 비율로 배분한 추정치입니다.</p>';
    }

    /* ---------- 값 반영 (매 입력마다 — DOM 재생성 없이 계산칸만 갱신) ---------- */

    function setText(id, text) { var el = $(id); if (el) el.textContent = text; }

    function recalcAll() {
      var rows = state.materialRows;
      var calcs = rows.map(function (r) { return CALC.rowCalc(r, master, state.info.workDate); });

      calcs.forEach(function (calc, ri) {
        setText('mr-days-' + ri, calc.days == null ? '—' : calc.days);
        setText('mr-waste-' + ri, fmt1(calc.waste));
        setText('mr-remain-' + ri, fmt1(calc.remainStock));
        setText('mr-yield-' + ri, fmtPct(calc.yieldActual));
        setText('mr-std-' + ri, fmtPct(calc.yieldStd));
        var gapEl = $('mr-gap-' + ri);
        if (gapEl) {
          gapEl.textContent = fmtPctSigned(calc.gap);
          gapEl.className = 'prod-calc' + (calc.gap != null ? (calc.gap < 0 ? ' prod-neg' : ' prod-pos') : '');
        }
        setText('mr-discount-' + ri, fmt1(calc.discountKg));
        setText('ca-waste-' + ri, fmt1(calc.waste));
        setText('ca-sum-' + ri, fmt1(calc.wasteSum));
        var checkEl = $('ca-check-' + ri);
        if (checkEl) checkEl.innerHTML = checkBadge(calc.wasteCheck);
        var btnHost = $('ca-wastebtn-' + ri);
        if (btnHost) {
          btnHost.innerHTML = quickWasteButtonsInner(ri, calc);
          bindQuickWasteButtons(btnHost);
        }
      });

      var groups = CALC.groupBy(rows, calcs);
      var grand = CALC.grandTotal(rows, calcs, master);
      var totalsHost = $('materialTotals');
      if (totalsHost) totalsHost.innerHTML = materialTotalsHtml(groups, grand);

      var cause = CALC.causeAnalysis(rows, calcs, master);
      cause.perRow.forEach(function (pr, ri) { setText('ca-rank-' + ri, pr.rank); });
      renderCauseSummary(cause);

      var byRows = state.byproductRows;
      var byCalcs = byRows.map(function (r) { return CALC.byproductCalc(r, state.info.workDate); });
      byCalcs.forEach(function (c, bi) {
        setText('br-days-' + bi, c.days == null ? '—' : c.days);
        setText('br-remain-' + bi, fmt1(c.remainStock));
      });
      var byTotal = CALC.byproductTotal(byRows, state.info.workDate);
      var byTotalsHost = $('byproductTotals');
      if (byTotalsHost) byTotalsHost.innerHTML = byproductTotalsHtml(byTotal);

      var fin = CALC.finishedCalc(state.finished, grand, byTotal);
      var finHost = $('finishedCalcBox');
      if (finHost) {
        finHost.innerHTML =
          '<div class="prod-kpi"><span>계산재고(kg)</span><strong>' + fmt1(fin.calcStockKg) + '</strong></div>' +
          '<div class="prod-kpi"><span>재고 차이(kg)</span><strong>' + fmt1(fin.diffKg) + '</strong></div>' +
          '<div class="prod-kpi"><span>이론 투입합계(kg)</span><strong>' + fmt1(fin.theoreticalInputKg) + '</strong></div>' +
          '<div class="prod-kpi"><span>물질수지 차이(kg)</span><strong>' + fmt1(fin.massBalanceDiffKg) + '</strong></div>' +
          '<div class="prod-judge ' + (fin.ok ? 'ok' : 'ng') + '">' + esc(fin.judge) + '</div>';
      }

      renderSummary(grand, fin, cause);

      var bom = CALC.bomVariance(state.skuOutputs || [], PRODUCTS, master, materialInputMap());
      renderBomSection(bom);

      return { calcs: calcs, groups: groups, grand: grand, cause: cause, byCalcs: byCalcs, byTotal: byTotal, fin: fin, bom: bom };
    }

    function renderSummary(grand, fin, cause) {
      var host = $('prodSummary'); if (!host) return;
      var candidates = cause.byCode.filter(function (c) { return c.kg > 0.5; }).sort(function (a, b) { return b.kg - a.kg; });
      var top = candidates[0];
      var tip = top
        ? ('오늘 가장 큰 폐기 원인은 ' + esc(top.code) + '(' + esc(top.label) + ') · ' + fmt1(top.kg) + 'kg — ' + esc(top.action || ''))
        : '폐기 원인 코드(A~E)를 입력하면 개선 포인트가 표시됩니다.';
      host.innerHTML =
        '<div class="prod-kpi-row">' +
        '<div class="prod-kpi"><span>원물 총투입량</span><strong>' + fmt1(grand.input) + ' kg</strong></div>' +
        '<div class="prod-kpi"><span>총 사용량(+이월)</span><strong>' + fmt1(grand.used + grand.carry) + ' kg</strong></div>' +
        '<div class="prod-kpi"><span>가중평균 실적수율</span><strong>' + fmtPct(grand.yield) + '</strong></div>' +
        '<div class="prod-kpi"><span>불량율(폐기/투입)</span><strong>' + fmtPct(grand.defectRate) + '</strong></div>' +
        '<div class="prod-kpi"><span>계약기준 대비</span><strong class="' + (grand.gap != null && grand.gap < 0 ? 'prod-neg' : 'prod-pos') + '">' + fmtPctSigned(grand.gap) + '</strong></div>' +
        '</div>' +
        '<div class="prod-judge ' + (fin.ok ? 'ok' : 'ng') + '">완제품 물질수지: ' + esc(fin.judge) + '</div>' +
        '<div class="prod-tip">' + tip + '</div>';
    }

    /* ---------- 입력 바인딩 ---------- */

    function bindSteppers(container) {
      container.querySelectorAll('.prod-step-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (state.locked) return;
          var f = btn.getAttribute('data-f');
          var target = btn.getAttribute('data-target');
          var delta = Number(btn.getAttribute('data-step'));
          var input = btn.parentElement.querySelector('.prod-step-input');
          var next = Math.max(0, CALC.toNum(input.value) + delta);
          input.value = next;
          if (target === 'info') state.info[f] = String(next);
          recalcAll();
          scheduleDraft();
        });
      });
    }

    function bindDataInputs(container) {
      container.querySelectorAll('[data-f]').forEach(function (el) {
        var ev = el.tagName === 'SELECT' ? 'change' : 'input';
        el.addEventListener(ev, function () {
          var f = el.getAttribute('data-f');
          var target = el.getAttribute('data-target') || 'material';
          if (target === 'material') state.materialRows[Number(el.getAttribute('data-r'))][f] = el.value;
          else if (target === 'byproduct') state.byproductRows[Number(el.getAttribute('data-r'))][f] = el.value;
          else if (target === 'finished') state.finished[f] = el.value;
          else if (target === 'info') state.info[f] = el.value;
          recalcAll();
          scheduleDraft();
        });
      });
    }

    /* ---------- 저장/이력/결재 ---------- */

    function setStatus(msg, saved) {
      var el = $('saveStatus'); if (!el) return;
      el.innerHTML = '<span class="dot"></span> ' + msg;
      el.className = 'dkj-status' + (saved ? ' saved' : '');
    }

    function scheduleDraft() {
      clearTimeout(draftTimer);
      draftTimer = setTimeout(function () {
        DkjRecordStore.saveDraft(FORM_ID, state);
        setStatus('임시저장 ' + new Date().toLocaleTimeString(), false);
      }, 400);
    }

    function filledMaterialRows() {
      return state.materialRows.filter(function (r) {
        return CALC.toNum(r.inputQty) > 0 || CALC.toNum(r.usedQty) > 0 || CALC.hasVal(r.lot);
      });
    }

    function validate() {
      if (!state.info.workDate) return '작업일을 입력하세요.';
      if (!state.approvals.writer) return '작성자를 입력하세요.';
      if (!filledMaterialRows().length) return '최소 1개 원재료 행에 로트·투입량·사용량을 입력하세요.';
      return '';
    }

    function save(lock) {
      var err = validate();
      if (err) { alert(err); return; }
      state.locked = !!lock;
      var snap = recalcAll();
      var rec = DkjRecordStore.save(FORM_ID, Object.assign({}, state, {
        id: editingId || undefined,
        title: (state.info.workDate || '') + ' · 생산일지 · 투입 ' + fmt1(snap.grand.input) + 'kg',
        judge: snap.fin.ok ? '정상' : '부적합',
        summary: {
          input: snap.grand.input, used: snap.grand.used + snap.grand.carry,
          yield: snap.grand.yield, defectRate: snap.grand.defectRate, gap: snap.grand.gap,
          massBalanceOk: snap.fin.ok, totalWaste: snap.cause.totalWaste
        }
      }));
      editingId = rec.id;
      setStatus(lock ? '작성완료 저장됨' : '저장됨', true);
      applyLock();
      refreshApproval();
      renderHistory();
    }

    function applyLock() {
      var hostEl = document.querySelector('.dkj-form-body');
      if (!hostEl) return;
      hostEl.classList.toggle('is-locked', !!state.locked);
      hostEl.querySelectorAll(
        '#materialGrid input, #materialGrid select, #materialGrid button, ' +
        '#causeGrid input, #byproductGrid input, #byproductGrid select, #byproductGrid button, ' +
        '#finishedFields input, #skuOutputs input, #prodInfo input, #remark, #btnAddMaterialRow, #btnAddByproductRow'
      ).forEach(function (el) { el.disabled = !!state.locked; });
    }

    function renderHistory() {
      var el = $('historyList'); if (!el) return;
      var list = DkjRecordStore.list(FORM_ID).slice(0, 14);
      if (!list.length) { el.innerHTML = '<p style="color:#888;font-size:13px;">저장 기록 없음</p>'; return; }
      el.innerHTML = list.map(function (r) {
        var s = r.summary || {};
        return '<div class="dkj-history-item"><div><strong>' + esc((r.info && r.info.workDate) || r.title || '') + '</strong>' +
          (r.locked ? ' <span class="badge done">잠금</span>' : '') +
          (s.yield != null ? ' <span class="badge">수율 ' + Math.round(s.yield * 1000) / 10 + '%</span>' : '') +
          (s.massBalanceOk === false ? ' <span class="badge ng">물질수지 확인필요</span>' : '') +
          '</div><div style="display:flex;gap:6px;">' +
          '<button type="button" class="pill-btn ghost" data-load="' + r.id + '">불러오기</button>' +
          '<button type="button" class="pill-btn ghost" data-del2="' + r.id + '">삭제</button></div></div>';
      }).join('');
      el.querySelectorAll('[data-load]').forEach(function (b) {
        b.addEventListener('click', function () {
          var r = DkjRecordStore.get(FORM_ID, b.getAttribute('data-load'));
          if (!r) return;
          editingId = r.id;
          state = Object.assign(emptyState(master, PRODUCTS), r);
          writeForm();
          setStatus('기록 불러옴', true);
        });
      });
      el.querySelectorAll('[data-del2]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (!confirm('삭제할까요?')) return;
          DkjRecordStore.remove(FORM_ID, b.getAttribute('data-del2'));
          renderHistory();
        });
      });
    }

    /* 04_원인분석·02_생산일지 요약을 인쇄 시트(.ps-*, dkj-print.css)로 옮긴다.
       공식 사전인쇄 양식 복제는 하지 않는다 — 화면 데이터를 그대로 인쇄 가능한 표로만 옮긴다. */
    function doPrint() {
      var sheet = $('printSheet');
      if (!sheet) { window.print(); return; }
      var rows = state.materialRows;
      var calcs = rows.map(function (r) { return CALC.rowCalc(r, master, state.info.workDate); });
      var grand = CALC.grandTotal(rows, calcs, master);
      var cause = CALC.causeAnalysis(rows, calcs, master);
      var byTotal = CALC.byproductTotal(state.byproductRows, state.info.workDate);
      var fin = CALC.finishedCalc(state.finished, grand, byTotal);

      var signRows = (global.DkjApproval && global.DkjApproval.signRows) ? global.DkjApproval.signRows(state, {}) : [];
      var fmtAt = (global.DkjApproval && global.DkjApproval.formatAt) || function (iso) { return iso ? iso.slice(0, 16).replace('T', ' ') : ''; };
      var apvHead = signRows.length ? signRows.map(function (r) { return '<th class="ps-apv">' + esc(r.label) + '</th>'; }).join('')
        : '<th class="ps-apv">작성</th><th class="ps-apv">검토</th><th class="ps-apv">승인</th>';
      var apvCells = signRows.length ? signRows.map(function (r) {
        return '<td class="ps-sign">' + esc(r.name || '') + (r.signed ? '<div style="font-size:7pt;color:#555;">' + esc(fmtAt(r.at)) + '</div>' : '') + '</td>';
      }).join('') : '<td class="ps-sign"></td><td class="ps-sign"></td><td class="ps-sign"></td>';

      /* 그날 실제로 움직인 행만 인쇄한다 — 미사용 원재료까지 다 찍으면 한 장을 넘긴다 */
      var activeIdx = [];
      rows.forEach(function (r, ri) {
        if (CALC.toNum(r.inputQty) > 0 || CALC.toNum(r.usedQty) > 0 || CALC.hasVal(r.lot)) activeIdx.push(ri);
      });
      if (!activeIdx.length) activeIdx = rows.map(function (r, ri) { return ri; });
      var matRows = activeIdx.map(function (ri) {
        var r = rows[ri], c = calcs[ri];
        return '<tr><td class="l">' + esc(r.name) + '</td><td>' + esc(r.lot) + '</td><td>' + esc(r.receivedDate) + '</td>' +
          '<td>' + (c.days == null ? '' : c.days) + '</td><td>' + fmt1(r.inputQty) + '</td><td>' + fmt1(r.usedQty) + '</td>' +
          '<td>' + fmt1(r.carryQty) + '</td><td>' + fmt1(c.waste) + '</td><td>' + fmtPct(c.yieldActual) + '</td>' +
          '<td>' + fmtPctSigned(c.gap) + '</td></tr>';
      }).join('');
      var causeRows = cause.byCode.filter(function (c) { return c.kg > 0.5; }).map(function (c) {
        return '<tr><td>' + esc(c.code) + '</td><td class="l">' + esc(c.label) + '</td><td>' + fmt1(c.kg) + '</td>' +
          '<td>' + (c.ratio == null ? '' : fmtPct(c.ratio)) + '</td><td class="l">' + esc(c.owner) + '</td></tr>';
      }).join('');

      sheet.innerHTML =
        '<div class="ps-page prod-print-page">' +
        '<div class="ps-org">동김제농협 가공센터</div>' +
        '<table class="ps-meta"><tr>' +
        '<td class="ps-title-cell" rowspan="2"><div class="ps-docno">문서번호: DKJ-F-053</div><div class="ps-title">생산일지</div></td>' +
        '<th class="ps-apv-lab" rowspan="2">결재</th>' + apvHead +
        '</tr><tr>' + apvCells + '</tr></table>' +
        '<table class="ps-info"><tr><th>작업일</th><td>' + esc(state.info.workDate) + '</td>' +
        '<th>인원(직원/전처리/외포장/계절)</th><td>' + esc(state.info.staff) + ' / ' + esc(state.info.prep) + ' / ' + esc(state.info.pack) + ' / ' + esc(state.info.season) + '</td></tr></table>' +
        '<table class="ps-grid"><thead><tr><th>원재료명</th><th>로트번호</th><th>입고일자</th><th>재고일수</th><th>투입량</th><th>사용량</th><th>이월전처리</th><th>폐기량</th><th>실적수율</th><th>기준대비</th></tr></thead>' +
        '<tbody>' + matRows + '</tbody></table>' +
        (causeRows ? '<table class="ps-grid" style="margin-top:6pt;"><thead><tr><th>코드</th><th>정의</th><th>폐기량(kg)</th><th>구성비</th><th>조치주체</th></tr></thead>' +
        '<tbody>' + causeRows + '</tbody></table>' : '') +
        '<div class="ps-foot">' +
        '<div><strong>가중평균 실적수율:</strong> ' + fmtPct(grand.yield) + ' · <strong>계약기준 대비:</strong> ' + fmtPctSigned(grand.gap) + '</div>' +
        '<div><strong>완제품 물질수지:</strong> ' + esc(fin.judge) + '</div>' +
        '<div><strong>특이사항:</strong> ' + esc(state.note || '') + '</div>' +
        '</div>' +
        '<div class="ps-brand">동김제농협 가공센터 · DKJ-F-053 · FSSC22000</div>' +
        '</div>';
      setTimeout(function () { window.print(); }, 120);
    }

    function mountApproval() {
      if (!global.DkjApproval || apvUi) return;
      apvUi = global.DkjApproval.mount({
        getState: function () { return state; },
        onChange: function () { scheduleDraft(); }
      });
    }
    function refreshApproval() { if (apvUi) apvUi.render(); }

    function writeForm() {
      renderApproverFields();
      renderRemarkField();
      renderInfoFields();
      renderMaterialTable();
      renderCauseTable();
      renderByproductTable();
      renderFinishedFields();
      renderSkuOutputs();
      recalcAll();
      applyLock();
      refreshApproval();
    }

    function bind() {
      if ($('btnAddMaterialRow')) $('btnAddMaterialRow').addEventListener('click', function () {
        if (state.locked) return;
        state.materialRows.push(emptyMaterialRow());
        renderMaterialBody(); renderCauseBody(); recalcAll(); scheduleDraft();
      });
      if ($('btnAddByproductRow')) $('btnAddByproductRow').addEventListener('click', function () {
        if (state.locked) return;
        state.byproductRows.push(emptyByproductRow());
        renderByproductBody(); recalcAll(); scheduleDraft();
      });
      if ($('btnSave')) $('btnSave').addEventListener('click', function () { save(false); });
      if ($('btnLock')) $('btnLock').addEventListener('click', function () { save(true); });
      if ($('btnNew')) $('btnNew').addEventListener('click', function () {
        editingId = null; state = buildNextState(); writeForm(); setStatus('새 기록 — 어제 기록에서 이어받음', false);
      });
      if ($('btnPrint')) $('btnPrint').addEventListener('click', doPrint);
    }

    function init() {
      Promise.all([DkjMaster.loadProductionMaster(), loadStaffNames(), DkjMaster.loadProducts()]).then(function (results) {
        master = results[0];
        STAFF_NAMES = results[1];
        PRODUCTS = (results[2] && results[2].finishedProducts) || [];
        PRODUCTS_BOM_NOTE = (results[2] && results[2].bomNote) || '';
        var draft = DkjRecordStore.loadDraft(FORM_ID);
        state = draft ? Object.assign(emptyState(master, PRODUCTS), draft) : buildNextState();
        writeForm();
        bind();
        renderHistory();
        mountApproval();
        setStatus('준비', false);
        if (global.DkjDeepLink) {
          var opened = DkjDeepLink.apply(FORM_ID, function (rec) {
            editingId = rec.id;
            state = Object.assign(emptyState(master, PRODUCTS), rec);
            writeForm();
          });
          if (opened) setStatus('기록 불러옴', true);
        }
      }).catch(function (err) {
        console.error('[DKJ-F-053] init failed', err);
        var host = $('materialGrid');
        if (host) host.innerHTML = '<p style="color:#c62828;padding:12px;">기준 데이터를 불러오지 못했습니다. 새로고침해 주세요.</p>';
      });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    return { getState: function () { return state; } };
  }

  global.DkjProductionForm = { mount: mount, emptyState: emptyState };
})(window);
