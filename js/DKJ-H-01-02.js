/**
 * DKJ-H-01-02 CCP-2P 금속검출공정 점검표
 * 코엔에프 CONF-H-01-06 벤치마크 → 동김제 신선편의 CCP-2P
 */
(async function () {
  'use strict';

  var FORM_ID = 'DKJ-H-01-02';
  var state = emptyState();
  var editingId = null;
  var draftTimer = null;

  function emptyRow() {
    return { item: '', product: '', time: '', fe: '', sus: '', prodOnly: '', prodFe: '', prodSus: '', judge: '' };
  }

  /* "구분"(점검 시점) 3종. 예전엔 "작업전"이었는데, 그 시점엔 제품이 지나가는지
     아닌지가 애매해 현장에서 헷갈린다는 요청(2026-10-15)으로 "작업중"으로 바꿨다 —
     "작업중"일 때만 실제로 제품이 지나가므로, row.product(품목)도 "작업중"일 때만
     고를 수 있다("작업시작전"·"작업종료시"는 제품이 지나가기 전/후라 품목 칸 자체가
     비활성화된다, renderRows() 참고). 구분(row.item)과 품목(row.product)은 이제
     완전히 분리된 칸이다 — 전엔 한 칸(row.item)을 돌려썼는데, 품목을 고르면 그
     칸이 더는 "작업중"을 담지 못해 어느 시점 점검인지가 지워지는 문제가 있었다. */
  var ITEM_TIMEPOINTS = ['작업시작전', '작업중', '작업종료시'];

  /* 구분 선택에 따라 검출확인 O/X 기본값을 채운다 — 표준시편(Fe/SUS)은 항상 검출(O)
     이어야 한다. "작업시작전"은 제품이 아직 지나가기 전이라 제품만/제품+시편 칸이
     해당 없음(공란 "-")이지만, "작업중"·"작업종료시"는 실제 제품이 지나가는 시점이라
     제품만 X(불검출)·제품+시편 O/O 를 기본값으로 채운다(2026-10-15 현장 요청). 이미
     값이 있어도 구분을 바꾸면 그 기본값으로 다시 맞춘다 — 필요하면 그 다음에
     사용자가 직접 O/X 셀렉트로 고칠 수 있다. */
  function applyItemDefaults(row) {
    var v = (row.item || '').trim();
    if (!v) return;
    if (v === '작업시작전') {
      row.fe = 'O'; row.sus = 'O'; row.prodOnly = ''; row.prodFe = ''; row.prodSus = '';
    } else {
      row.fe = 'O'; row.sus = 'O'; row.prodOnly = 'X'; row.prodFe = 'O'; row.prodSus = 'O';
    }
  }

  /* "제품명" 칸 — 예전엔 datalist 자동완성 입력칸이었는데, mon-table 이 overflow-x
     로 가로 스크롤되는 좁은 표 안이라 태블릿에서 입력칸도 좁고 자동완성 목록도
     잘리거나 너무 작아 탭이 안 된다는 현장 피드백(2026-10-14)을 받아 전체화면 팝업
     선택창으로 바꿨다. 아래 ensureProductPicker()~chooseProduct() 참고. */

  /* 작업일자 → LOT 자동생성: "2026-09-11" → "20260911-1" (하이픈 제거 + "-1" 접미) */
  function dateToLot(d) {
    if (!d) return '';
    return String(d).replace(/[^0-9]/g, '') + '-1';
  }

  /* 물성보정/안정도 — 인쇄물 한계기준표의 중량구간별 고정값(임시 운영값, 확정 전).
     매 행마다 같은 값이라 행 데이터로 안 두고 중량구간 선택 하나로 도출한다. */
  var WEIGHT_CLASS = {
    fresh500: { label: '신선편의식품 500g 이하', adjust: '70', stable: '450', fe: '2.0', sus: '3.0' },
    fresh1kg: { label: '신선편의식품 500g 이상', adjust: '70', stable: '954', fe: '2.5', sus: '3.5' },
    freshOver1kg: { label: '신선편의식품 1kg 이상', adjust: '70', stable: '252', fe: '3.0', sus: '3.5' },
    material: { label: '부재료(기타가공품)', adjust: '70', stable: '70', fe: '1.5', sus: '2.5' }
  };

  /* 제품명 선택에 맞는 한계기준·중량구간을 자동 적용한다. */
  var PRODUCT_WEIGHT_CLASS = {
    '양상추샐러드': 'freshOver1kg',
    '양상추 샐러드': 'freshOver1kg',
    '농협 채소믹스': 'fresh1kg',
    '농협채소믹스': 'fresh1kg',
    '샐러디아 채소믹스': 'fresh1kg',
    '샐러디아채소믹스': 'fresh1kg',
    '급식)바로먹는 유러피언 샐러드 채소믹스': 'fresh1kg',
    '급식 바로먹는 유러피언 샐러드 채소믹스': 'fresh1kg',
    '급식바로먹는 유러피언샐러드채소믹스': 'fresh1kg',
    '슬로우캘리샐러드믹스': 'fresh500',
    '슬로우캘리 샐러드믹스': 'fresh500'
  };

  function productWeightClassKey(name) {
    var product = (name || '').trim();
    return PRODUCT_WEIGHT_CLASS[product] || PRODUCT_WEIGHT_CLASS[product.replace(/\s/g, '')] || '';
  }

  function applyRowStandards() {
    (state.rows || []).forEach(function (row) {
      var product = (row.item === '작업중' && row.product) ? row.product : state.productName;
      var wc = WEIGHT_CLASS[productWeightClassKey(product)];
      if (!wc) return;
      row.adjust = wc.adjust;
      row.stable = wc.stable;
      row.feSize = wc.fe;
      row.susSize = wc.sus;
    });
  }

  function applyProductWeightClass(name) {
    var wcKey = productWeightClassKey(name);
    var wc = WEIGHT_CLASS[wcKey];
    if (!wc) return;
    state.weightClass = wcKey;
    $('feSize').value = wc.fe;
    $('susSize').value = wc.sus;
    applyRowStandards();
  }

  var PRODUCT_OPTIONS = [];
  /* 이 서식(CCP-2P 금속검출)에서만 제외/추가할 품목 — 생산일지(DKJ-F-053)의
     BOM 마스터(products.json)는 그대로 두고 이 폼의 드롭다운만 조정한다. */
  var PRODUCT_EXCLUDE = ['샐러디 채소믹스', '슬로우캘리 채소믹스', '포케올데이 채소믹스', 'NH닭가슴살샐러드'];
  var PRODUCT_EXTRA = ['급식)바로먹는 유러피언 샐러드 채소믹스'];

  function loadProductOptions() {
    if (!window.DkjMaster || !DkjMaster.loadProducts) { PRODUCT_OPTIONS = PRODUCT_EXTRA.slice(); return Promise.resolve(PRODUCT_OPTIONS); }
    return DkjMaster.loadProducts().then(function (data) {
      var names = (data.finishedProducts || []).map(function (p) { return p.name; })
        .filter(function (n) { return PRODUCT_EXCLUDE.indexOf(n) === -1; });
      PRODUCT_EXTRA.forEach(function (n) { if (names.indexOf(n) === -1) names.push(n); });
      PRODUCT_OPTIONS = names;
      return PRODUCT_OPTIONS;
    }).catch(function () { PRODUCT_OPTIONS = PRODUCT_EXTRA.slice(); return PRODUCT_OPTIONS; });
  }

  function syncProductUi() {
    var pSel = $('productSelect');
    var pInp = $('productName');
    var val = (state.productName || '').trim();
    if (!pSel) return;

    var opts = '<option value="">-- 품목 선택 --</option>';
    PRODUCT_OPTIONS.forEach(function (name) {
      opts += '<option value="' + esc(name) + '"' + (name === val ? ' selected' : '') + '>' + esc(name) + '</option>';
    });
    var isCustom = val && PRODUCT_OPTIONS.indexOf(val) === -1;
    opts += '<option value="__custom__"' + (isCustom ? ' selected' : '') + '>✏️ 직접 입력...</option>';
    pSel.innerHTML = opts;

    if (pInp) {
      pInp.style.display = isCustom ? 'block' : 'none';
      pInp.value = val;
    }
  }

  /* 포장재 정보 — 한 번의 점검에 포장재가 여러 건 들어가므로 5행 고정 표로 받는다. */
  var PACK_ROWS = 5;

  function emptyPackagings() {
    var out = [];
    for (var i = 0; i < PACK_ROWS; i++) out.push({ lot: '', usage: '', defect: '' });
    return out;
  }

  /** 예전 기록(포장재 1건을 낱개 필드로 저장하던 구조)을 5행 표로 옮긴다.
      이 이관을 빼면 이미 저장된 CCP 기록의 포장재 LOT 이 화면에서 사라진다. */
  function normalizePackagings(st) {
    var list = Array.isArray(st.packagings) ? st.packagings.slice(0, PACK_ROWS) : [];
    // 빈 5행은 '아직 없음'과 같다 — 이걸 값이 있는 것으로 보면 옛 기록의 낱개 필드가
    // 영영 이관되지 않는다(기록 불러오기는 emptyState() 위에 덮어쓰기 때문).
    var hasAny = list.some(function (r) {
      return r && (String(r.lot || '') || String(r.usage || '') || String(r.defect || ''));
    });
    if (!hasAny && (st.packagingLot || st.packagingUsage || st.packagingDefectCount)) {
      list = [{
        lot: st.packagingLot || '',
        usage: st.packagingUsage || '',
        defect: st.packagingDefectCount || ''
      }];
    }
    while (list.length < PACK_ROWS) list.push({ lot: '', usage: '', defect: '' });
    st.packagings = list.map(function (r) {
      return { lot: (r && r.lot) || '', usage: (r && r.usage) || '', defect: (r && r.defect) || '' };
    });
    // 낱개 필드는 더 쓰지 않지만, 옛 기록을 다시 열었을 때 값이 되살아나지 않도록 지운다
    delete st.packagingLot;
    delete st.packagingUsage;
    delete st.packagingDefectCount;
    return st;
  }

  function renderPackagings() {
    var body = $('packBody');
    if (!body) return;
    body.innerHTML = state.packagings.map(function (row, i) {
      return '<tr data-p="' + i + '">' +
        '<td>' + (i + 1) + '</td>' +
        '<td><input type="date" class="mon-in pack-in" data-pf="lot" value="' +
        esc(row.lot) + '"></td>' +
        '<td><div class="mon-unit-wrap"><input type="number" class="mon-in pack-in" data-pf="usage" min="0" step="1" value="' +
        esc(row.usage) + '" placeholder="예: 200"><span class="mon-unit">EA</span></div></td>' +
        '<td><input type="number" class="mon-in pack-in" data-pf="defect" min="0" step="1" value="' +
        esc(row.defect) + '" placeholder="0"></td>' +
        '</tr>';
    }).join('');
    body.querySelectorAll('.pack-in').forEach(function (inp) {
      inp.disabled = !!state.locked;
      var onPackInput = function (e) {
        if (state.locked) return;
        var i = Number(e.target.closest('tr').getAttribute('data-p'));
        state.packagings[i][e.target.getAttribute('data-pf')] = e.target.value;
        scheduleDraft();
      };
      inp.addEventListener('input', onPackInput);
      inp.addEventListener('change', onPackInput);
    });
  }

  /** 제품 날인(일부인) 촬영본 — 1일 3회 고정 슬롯. 촬영본은 dkj-util.js 의
   *  compressImageToDataUrl 로 압축해 그대로 상태에 저장한다(서버가 없는 구조라
   *  여기 dataURL 이 정본). 인쇄 시 맨 뒤 별첨으로도 나간다 — ccp2p() 참고. */
  function buildStampSlot(i) {
    var photo = state.stampPhotos[i];
    var label = (i + 1) + '차 날인';
    if (photo) {
      return '<div class="dkj-photo-card">' +
        '<img src="' + photo + '" data-view-stamp="' + i + '" title="클릭하여 원본보기">' +
        '<div class="dkj-photo-card-cap">' + label +
        ((state.stampCarried || [])[i] ? ' <span class="dkj-photo-carried" title="최근기록 복사로 가져온 이전 사진입니다. 오늘 촬영본으로 바꾸세요.">전일 사진</span>' : '') + '</div>' +
        '<div class="dkj-photo-card-actions">' +
        '<button type="button" class="pill-btn ghost sm" data-del-stamp="' + i + '">사진 삭제</button>' +
        '</div></div>';
    }
    return '<label class="dkj-photo-dropzone">' +
      '<input type="file" accept="image/*" capture="environment" data-stamp-inp="' + i + '">' +
      '<span class="icon">📷</span><span class="txt">' + label + ' 촬영</span>' +
      '</label>';
  }

  function renderStampPhotos() {
    var host = $('stampPhotos');
    if (!host) return;
    if (!Array.isArray(state.stampPhotos)) state.stampPhotos = [];
    while (state.stampPhotos.length < 6) state.stampPhotos.push(null);
    if (!Array.isArray(state.stampCarried)) state.stampCarried = [];
    while (state.stampCarried.length < 6) state.stampCarried.push(false);

    host.innerHTML = [0, 1, 2, 3, 4, 5].map(buildStampSlot).join('');

    host.querySelectorAll('[data-stamp-inp]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        if (state.locked) return;
        var i = Number(inp.getAttribute('data-stamp-inp'));
        var file = inp.files && inp.files[0];
        if (!file) return;
        var apply = function (dataUrl) {
          state.stampPhotos[i] = dataUrl;
          state.stampCarried[i] = false;
          renderStampPhotos();
          scheduleDraft();
          if (window.DkjUtil && window.DkjUtil.toast) window.DkjUtil.toast('📷 ' + (i + 1) + '차 날인 사진이 첨부되었습니다.');
        };
        if (window.DkjUtil && window.DkjUtil.compressImageToDataUrl) {
          window.DkjUtil.compressImageToDataUrl(file, apply);
        } else {
          var reader = new FileReader();
          reader.onload = function (e) { apply(e.target.result); };
          reader.readAsDataURL(file);
        }
      });
    });
    host.querySelectorAll('[data-view-stamp]').forEach(function (img) {
      img.addEventListener('click', function () {
        var i = Number(img.getAttribute('data-view-stamp'));
        if (state.stampPhotos[i]) window.open(state.stampPhotos[i]);
      });
    });
    host.querySelectorAll('[data-del-stamp]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var i = Number(btn.getAttribute('data-del-stamp'));
        state.stampPhotos[i] = null;
        state.stampCarried[i] = false;
        renderStampPhotos();
        scheduleDraft();
      });
    });
  }

  function emptyState() {
    var td = today();
    return {
      workDate: td,
      equipment: 'MD-01',
      productName: '',
      lot: dateToLot(td),
      feSize: '2.0',
      susSize: '3.0',
      weightClass: 'fresh500',
      monitorName: '',
      timing: '시작전',
      packagings: emptyPackagings(),
      // 작업 중 모니터링 회차가 보통 3회보다 많다는 현장 요청(2026-10-14)으로
      // 기본 측정행을 7개로 늘렸다 — 필요 없으면 "삭제"로 줄이면 된다.
      rows: [emptyRow(), emptyRow(), emptyRow(), emptyRow(), emptyRow(), emptyRow(), emptyRow()],
      // 제품 날인(일부인) 촬영본 — 1일 6회(1~6차, 2026-10-15 현장 요청으로 3회→6회).
      // 인쇄 시 맨 뒤에 별첨으로 붙는다.
      stampPhotos: [null, null, null, null, null, null],
      // 최근기록 복사로 따라온 슬롯이면 true — '전일 사진' 배지(화면 전용)
      stampCarried: [false, false, false, false, false, false],
      deviation: '',
      corrective: '',
      confirmer: '',
      approver: '',
      remark: '',
      // 전자결재 — 모니터링 담당(작성)·확인자(검토)·승인자(승인) 3단. 정본 인쇄
      // 서명란(signBox)도 작성/검토/승인 3칸이라 여기서도 맞춘다. audit 는 여기서
      // 만들어 둬야 저장 훅이 같은 배열에 이어 붙는다(없으면 저장할 때마다 이력이 초기화된다).
      approvals: { writer: '', reviewer: '', approver: '' },
      signoff: {},
      audit: [],
      locked: false,
      hasDeviation: false
    };
  }

  /* 전자결재 패널 — 모듈이 없으면 그냥 건너뛴다 */
  var apvUi = null;

  function syncApprovals() {
    if (!window.DkjApproval) return;
    DkjApproval.bindFlat(state, { writer: 'monitorName', reviewer: 'confirmer', approver: 'approver' });
  }

  function mountApproval() {
    if (!window.DkjApproval || apvUi) return;
    apvUi = DkjApproval.mount({
      stages: ['writer', 'reviewer', 'approver'],
      getState: function () { readForm(); return state; },
      // 결재 서명은 임시저장(이 기기에만 남고 클라우드 동기화 안 됨)이 아니라
      // 실제 저장 레코드에 바로 반영해야 다른 기기·다른 사람에게도 보인다.
      onChange: async function () {
        if (editingId) {
          // title/judge 는 save() 안에서만 계산되고 state 에는 남지 않으므로,
          // 이전에 저장된 기록을 바탕으로 덮어써야 결재만 눌러도 제목이 비지 않는다.
          var prev = (await DkjRecordStore.get(FORM_ID, editingId)) || {};
          (await DkjRecordStore.save(FORM_ID, Object.assign({}, prev, state, { id: editingId })));
          setStatus('결재 저장됨 · ' + new Date().toLocaleTimeString('ko-KR'), true);
          (await renderHistory());
        } else {
          scheduleDraft();
        }
      }
    });
  }

  function refreshApproval() {
    if (apvUi) apvUi.render();
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function nowTime() {
    var d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function $(id) { return document.getElementById(id); }

  function setStatus(msg, saved) {
    var el = $('saveStatus');
    if (!el) return;
    el.innerHTML = '<span class="dot"></span> ' + msg;
    el.className = 'dkj-status' + (saved ? ' saved' : '');
  }

  function oxSelect(val, field) {
    var next = val === 'O' ? 'X' : val === 'X' ? '' : 'O';
    return '<button type="button" class="mon-in ox-cycle" style="min-width:42px;min-height:40px;font-weight:700" data-cycle="' + field + '" data-next="' + next + '" aria-label="' + field + ' ' + (val || '-') + '">' + (val || '-') + '</button>';
  }

  function criteriaForProduct(name) {
    var key = productWeightClassKey(name);
    var wc = WEIGHT_CLASS[key] || WEIGHT_CLASS[state.weightClass] || WEIGHT_CLASS.fresh500;
    var band = wc.label.replace('신선편의식품 ', '');
    return band + ' · Fe Ø' + wc.fe + '㎜ · SUS Ø' + wc.sus + '㎜';
  }

  function evaluateRow(row) {
    var vals = [row.fe, row.sus, row.prodFe, row.prodSus].filter(Boolean);
    if (!vals.length) {
      row.judge = '';
      return;
    }
    if (vals.indexOf('X') !== -1) row.judge = 'X';
    else if (vals.every(function (v) { return v === 'O'; })) row.judge = 'O';
    else row.judge = '';
  }

  function refreshDeviation() {
    state.hasDeviation = state.rows.some(function (r) { return r.judge === 'X'; });
    var ban = $('deviationBanner');
    if (ban) ban.hidden = !state.hasDeviation;
  }

  function renderRows() {
    var body = $('monBody');
    body.innerHTML = state.rows.map(function (row, i) {
      evaluateRow(row);
      // "작업중"일 때만 제품이 지나간다 — 품목(제품명) 선택은 그 시점에만 연다.
      // 작업시작전·작업종료시는 품목 칸 자체를 비활성화한다(2026-10-15 현장 요청).
      var isWorking = row.item === '작업중';
      var productValue = isWorking ? (row.product || '') : '';
      return '<tr data-i="' + i + '">' +
        '<td><button type="button" class="mon-in mon-picker-btn" data-pick-timepoint="' + i + '">' +
        (row.item ? esc(row.item) : '<span class="ph">구분 선택</span>') + '</button></td>' +
        '<td><button type="button" class="mon-in mon-picker-btn" data-pick-product="' + i + '"' + (isWorking ? '' : ' disabled') + '>' +
        (productValue ? esc(productValue) : '<span class="ph">' + (isWorking ? '품목 선택' : '작업중만 선택') + '</span>') + '</button></td>' +
        '<td><input type="time" class="mon-in" data-f="time" value="' + (row.time || '') + '">' +
        '<button type="button" class="mon-now-row-btn" data-now-row="' + i + '">⏱ 지금시각</button></td>' +
        '<td class="criteria-cell">' + esc(criteriaForProduct(productValue)) + '</td>' +
        '<td>' + oxSelect(row.fe, 'fe') + '</td>' +
        '<td>' + oxSelect(row.sus, 'sus') + '</td>' +
        '<td>' + oxSelect(row.prodOnly, 'prodOnly') + '</td>' +
        '<td>' + oxSelect(row.prodFe, 'prodFe') + '</td>' +
        '<td>' + oxSelect(row.prodSus, 'prodSus') + '</td>' +
        '<td class="mon-judge ' + (row.judge === 'X' ? 'ng' : row.judge === 'O' ? 'ok' : '') + '">' + (row.judge === 'X' ? '부적합' : row.judge === 'O' ? '적합' : '·') + '</td>' +
        '<td><button type="button" class="pill-btn ghost mon-del" data-del="' + i + '">삭제</button></td>' +
        '</tr>';
    }).join('');

    body.querySelectorAll('.mon-in').forEach(function (inp) {
      inp.addEventListener('change', onRowInput);
      inp.addEventListener('input', onRowInput);
    });
    body.querySelectorAll('[data-pick-timepoint]').forEach(function (btn) {
      btn.addEventListener('click', function () { openTimepointPicker(Number(btn.getAttribute('data-pick-timepoint'))); });
    });
    body.querySelectorAll('[data-pick-product]').forEach(function (btn) {
      btn.addEventListener('click', function () { openProductPicker(Number(btn.getAttribute('data-pick-product'))); });
    });
    body.querySelectorAll('[data-now-row]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var i = Number(btn.getAttribute('data-now-row'));
        state.rows[i].time = nowTime();
        renderRows();
        scheduleDraft();
      });
    });
    body.querySelectorAll('[data-cycle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var tr = btn.closest('tr'), i = Number(tr.getAttribute('data-i'));
        state.rows[i][btn.getAttribute('data-cycle')] = btn.getAttribute('data-next');
        renderRows(); scheduleDraft();
      });
    });
    body.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var i = Number(btn.getAttribute('data-del'));
        state.rows.splice(i, 1);
        if (!state.rows.length) state.rows.push(emptyRow());
        renderRows();
        scheduleDraft();
      });
    });
    refreshDeviation();
  }

  function onRowInput(e) {
    if (state.locked) return;
    var tr = e.target.closest('tr');
    var i = Number(tr.getAttribute('data-i'));
    var f = e.target.getAttribute('data-f');
    state.rows[i][f] = e.target.value;
    renderRows();
    scheduleDraft();
  }

  /* "구분"(점검 시점) 선택 팝업 — 원래 <select> 였는데, 제품명과 같은 이유(mon-table
     이 가로 스크롤되는 좁은 표라 태블릿에서 옵션이 안 보이거나 탭이 안 됨, 현장
     피드백 2026-10-14)로 같은 .dkj-picker-* 팝업을 재사용한다. 옵션이 3개뿐이라
     검색칸 없이 목록만 보여준다. */
  var timepointPickerRowIndex = null;

  function ensureTimepointPicker() {
    if ($('timepointPickerOverlay')) return;
    var ov = document.createElement('div');
    ov.id = 'timepointPickerOverlay';
    ov.className = 'dkj-picker-overlay';
    ov.hidden = true;
    ov.innerHTML =
      '<div class="dkj-picker-sheet" role="dialog" aria-modal="true" aria-label="구분 선택">' +
      '<div class="dkj-picker-head"><h3>구분(점검 시점) 선택</h3><button type="button" class="dkj-picker-close" aria-label="닫기">✕</button></div>' +
      '<div class="dkj-picker-list" id="timepointPickerList"></div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) closeTimepointPicker(); });
    ov.querySelector('.dkj-picker-close').addEventListener('click', closeTimepointPicker);

    var list = $('timepointPickerList');
    var html = '<button type="button" class="dkj-picker-item" data-pick-tp="">✕ 선택 안 함(비우기)</button>' +
      ITEM_TIMEPOINTS.map(function (tp) {
        return '<button type="button" class="dkj-picker-item" data-pick-tp="' + esc(tp) + '">' + esc(tp) + '</button>';
      }).join('');
    list.innerHTML = html;
    list.querySelectorAll('[data-pick-tp]').forEach(function (btn) {
      btn.addEventListener('click', function () { chooseTimepoint(btn.getAttribute('data-pick-tp')); });
    });
  }

  function openTimepointPicker(i) {
    if (state.locked) return;
    ensureTimepointPicker();
    timepointPickerRowIndex = i;
    $('timepointPickerOverlay').hidden = false;
  }

  function closeTimepointPicker() {
    var ov = $('timepointPickerOverlay');
    if (ov) ov.hidden = true;
    timepointPickerRowIndex = null;
  }

  function chooseTimepoint(tp) {
    if (timepointPickerRowIndex == null) return;
    var row = state.rows[timepointPickerRowIndex];
    if (!row) { closeTimepointPicker(); return; }
    row.item = tp;
    // "작업중"이 아니면 품목 칸이 비활성화되므로 값도 비운다 — 안 비우면 작업중→
    // 작업종료시로 바꿨다가 다시 작업중으로 돌아왔을 때나 화면에 안 보이는 옛 값이
    // 저장 데이터에만 조용히 남는다.
    if (tp !== '작업중') row.product = '';
    applyItemDefaults(row);
    closeTimepointPicker();
    renderRows();
    scheduleDraft();
  }

  /* 제품명 선택 팝업 — mon-table 칸 안이 아니라 document.body 에 바로 붙는
     전체화면 오버레이라 표의 overflow-x(가로 스크롤)에 안 잘린다. 목록 탭으로만
     고른다 — 처음엔 검색칸(직접 입력 겸용)이 있었는데, 그 칸에 포커스가 가면서
     태블릿 키보드가 떴다 내려갔다 하는 게 거슬린다는 현장 피드백(2026-10-14)으로
     "구분" 팝업과 같은 목록 전용 방식으로 바꿨다 — 품목 마스터에 없는 이름은 더
     이상 이 화면에서 직접 입력할 수 없다(필요해지면 시스템 설정의 품목 마스터에
     등록해서 목록에 넣는 쪽으로 간다). */
  var productPickerRowIndex = null;

  function ensureProductPicker() {
    if ($('productPickerOverlay')) return;
    var ov = document.createElement('div');
    ov.id = 'productPickerOverlay';
    ov.className = 'dkj-picker-overlay';
    ov.hidden = true;
    ov.innerHTML =
      '<div class="dkj-picker-sheet" role="dialog" aria-modal="true" aria-label="제품명 선택">' +
      '<div class="dkj-picker-head"><h3>제품명 선택</h3><button type="button" class="dkj-picker-close" aria-label="닫기">✕</button></div>' +
      '<div class="dkj-picker-list" id="productPickerList"></div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) closeProductPicker(); });
    ov.querySelector('.dkj-picker-close').addEventListener('click', closeProductPicker);

    var list = $('productPickerList');
    var html = '<button type="button" class="dkj-picker-item" data-pick="">✕ 선택 안 함(비우기)</button>' +
      PRODUCT_OPTIONS.map(function (name) {
        return '<button type="button" class="dkj-picker-item" data-pick="' + esc(name) + '">' + esc(name) + '</button>';
      }).join('');
    list.innerHTML = html;
    list.querySelectorAll('[data-pick]').forEach(function (btn) {
      btn.addEventListener('click', function () { chooseProduct(btn.getAttribute('data-pick')); });
    });
  }

  function openProductPicker(i) {
    if (state.locked) return;
    var row = state.rows[i];
    // "작업중"이 아닌 행은 버튼 자체가 disabled 라 보통 여기까지 안 오지만,
    // 혹시 모를 직접 호출에 대비해 한 번 더 막는다.
    if (!row || row.item !== '작업중') return;
    ensureProductPicker();
    productPickerRowIndex = i;
    $('productPickerOverlay').hidden = false;
  }

  function closeProductPicker() {
    var ov = $('productPickerOverlay');
    if (ov) ov.hidden = true;
    productPickerRowIndex = null;
  }

  function chooseProduct(name) {
    if (productPickerRowIndex == null) return;
    var row = state.rows[productPickerRowIndex];
    if (!row) { closeProductPicker(); return; }
    row.product = name;
    // 품목 마스터에 있는 이름을 고르면(=중량구간 매핑이 있으면) 헤더의 한계기준값도
    // 같이 맞춘다 — 2026-10-14 현장 개선(온라인 중량구간 자동화)과 같은 동작이다.
    if (name) {
      state.productName = name;
      applyProductWeightClass(name);
    }
    closeProductPicker();
    renderRows();
    scheduleDraft();
  }


  function readForm() {
    state.workDate = $('workDate').value;
    state.equipment = $('equipment').value;
    var pSel = $('productSelect');
    var pInp = $('productName');
    var rowProduct = state.rows && state.rows.find(function (r) { return r.item === '작업중' && r.product; });
    if (rowProduct) state.productName = rowProduct.product;
    else if (pSel && pSel.value === '__custom__') state.productName = pInp ? pInp.value.trim() : '';
    else if (pSel && pSel.value) state.productName = pSel.value;
    else state.productName = pInp ? pInp.value.trim() : '';
    applyRowStandards();
    state.lot = $('lot').value;
    state.feSize = $('feSize').value;
    state.susSize = $('susSize').value;
    var selectedProduct = (state.rows || []).find(function (r) { return r.item === '작업중' && r.product; });
    var selectedKey = productWeightClassKey(selectedProduct ? selectedProduct.product : state.productName);
    if (selectedKey) state.weightClass = selectedKey;
    var wc = WEIGHT_CLASS[state.weightClass] || WEIGHT_CLASS.fresh500;
    state.adjust = wc.adjust;
    state.stable = wc.stable;
    state.monitorName = $('monitorName').value;
    state.timing = $('timing').value;
    state.deviation = $('deviation').value;
    state.corrective = $('corrective').value;
    state.confirmer = $('confirmer').value;
    state.approver = $('approver').value;
    state.remark = $('remark').value;
    syncApprovals();
  }

  function writeForm() {
    $('workDate').value = state.workDate || today();
    $('equipment').value = state.equipment || 'MD-01';
    syncProductUi();
    $('lot').value = state.lot || dateToLot(state.workDate || today());
    $('feSize').value = state.feSize || '2.0';
    $('susSize').value = state.susSize || '3.0';
    $('monitorName').value = state.monitorName || '';
    $('timing').value = state.timing || '시작전';
    $('deviation').value = state.deviation || '';
    $('corrective').value = state.corrective || '';
    $('confirmer').value = state.confirmer || '';
    $('approver').value = state.approver || '';
    $('remark').value = state.remark || '';
    if (!state.rows || !state.rows.length) state.rows = [emptyRow()];
    renderRows();
    renderStampPhotos();
    syncApprovals();
    refreshApproval();
  }

  function scheduleDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(async function () {
      readForm();
      (await DkjRecordStore.saveDraft(FORM_ID, state));
      setStatus('임시저장 ' + new Date().toLocaleTimeString(), false);
    }, 400);
  }

  function validate() {
    readForm();
    state.rows.forEach(evaluateRow);
    refreshDeviation();
    if (!state.workDate) return '작업일자를 입력하세요.';
    if (!state.productName) return '품목을 입력하세요.';
    if (!state.lot) return 'LOT를 입력하세요.';
    if (!state.monitorName) return '모니터링 담당자를 입력하세요.';
    var filled = state.rows.filter(function (r) {
      return r.fe || r.sus || r.prodOnly || r.prodFe || r.prodSus;
    });
    if (!filled.length) return '시편 검출 결과를 1건 이상 입력하세요.';
    if (state.hasDeviation) {
      if (!(state.deviation || '').trim() || state.deviation === '해당없음') {
        return '불검출(이탈) 시 이탈 내용을 기록하세요.';
      }
      if (!(state.corrective || '').trim()) {
        return '이탈 시 시정조치(제품 격리·재검사 등)를 기록하세요.';
      }
    }
    return '';
  }

  var saveInFlight = false;
  async function save(lock) {
    if (saveInFlight) return;
    saveInFlight = true;
    try {
      var err = validate();
      if (err) { alert(err); return; }
      // 대기 중인 임시저장 타이머를 지운다 — 안 지우면 저장 직후 "저장됨"이 잠깐
      // 떴다가 그 타이머가 뒤늦게 "임시저장"으로 덮어써 버린다.
      clearTimeout(draftTimer);
      state.locked = !!lock;
      var rec;
      try {
        rec = (await DkjRecordStore.save(FORM_ID, Object.assign({}, state, {
          id: editingId || undefined,
          title: 'CCP-2P ' + state.productName,
          judge: state.hasDeviation ? '이탈' : '적합'
        })));
      } catch (e) {
        // 저장소가 가득 차면 setItem 이 예외를 던진다 — 예전엔 눌러도 반응이 없었다.
        state.locked = false;
        var quota = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
        alert(quota
          ? '저장 공간이 가득 차서 저장하지 못했습니다.\n기록보관함에서 백업한 뒤 불필요한 기록을 삭제하고 다시 저장하세요.'
          : '저장에 실패했습니다: ' + (e && e.message || e));
        setStatus('저장 실패', false);
        return;
      }
      editingId = rec.id;
      setStatus(lock ? '작성완료 저장됨' : '저장됨 ' + new Date().toLocaleTimeString(), true);
      refreshApproval();
      (await renderHistory());
    } finally { saveInFlight = false; }
  }

  async function renderHistory() {
    var list = (await DkjRecordStore.list(FORM_ID)).slice(0, 12);
    var el = $('historyList');
    if (!list.length) {
      el.innerHTML = '<p style="color:#888;font-size:13px;">저장된 기록이 없습니다.</p>';
      return;
    }
    el.innerHTML = list.map(function (r) {
      return '<div class="dkj-history-item">' +
        '<div><strong>' + esc(r.workDate || '') + '</strong> · ' + esc(r.productName || '') + ' / ' + esc(r.lot || '') +
        ' <span class="badge ' + (r.hasDeviation ? 'wip' : 'done') + '">' + esc(r.judge || '-') + '</span></div>' +
        '<div style="display:flex;gap:6px;">' +
        '<button type="button" class="pill-btn ghost" data-load="' + r.id + '">불러오기</button>' +
        '<button type="button" class="pill-btn ghost" data-del="' + r.id + '">삭제</button></div></div>';
    }).join('');
    el.querySelectorAll('[data-load]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var r = (await DkjRecordStore.get(FORM_ID, b.getAttribute('data-load')));
        if (!r) return;
        editingId = r.id;
        state = Object.assign(emptyState(), r);
        writeForm();
        setStatus('기록 불러옴', true);
      });
    });
    el.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('삭제할까요?')) return;
        (await DkjRecordStore.remove(FORM_ID, b.getAttribute('data-del')));
        if (editingId === b.getAttribute('data-del')) {
          editingId = null;
          state = emptyState();
          writeForm();
        }
        (await renderHistory());
      });
    });
  }

  async function bind() {
    ['workDate', 'equipment', 'productName', 'lot', 'feSize', 'susSize',
      'monitorName', 'timing', 'deviation', 'corrective', 'confirmer', 'approver', 'remark'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      var onFieldInput = function () {
        if (id === 'workDate') {
          // 작업일자 변경 시 LOT가 빈값이거나 이전 날짜의 자동생성 형태(YYYYMMDD-1)일 때만 자동 동기화 —
          // 사용자가 LOT를 직접 고쳐 썼으면 덮어쓰지 않는다.
          var newLot = dateToLot(el.value);
          var curLot = $('lot').value;
          if (!curLot || /^\d{8}-1$/.test(curLot)) {
            $('lot').value = newLot;
            state.lot = newLot;
          }
          loadForDate(el.value, true);
        }
        readForm();
        refreshApproval();
        scheduleDraft();
      };
      el.addEventListener('input', onFieldInput);
      el.addEventListener('change', onFieldInput);
    });
    var pSel = $('productSelect');
    if (pSel) {
      pSel.addEventListener('change', function () {
        var pInp = $('productName');
        if (pSel.value === '__custom__') {
          if (pInp) { pInp.style.display = 'block'; pInp.value = ''; pInp.focus(); }
          state.productName = '';
        } else {
          if (pInp) { pInp.style.display = 'none'; pInp.value = pSel.value; }
          state.productName = pSel.value;
          applyProductWeightClass(pSel.value);
        }
        readForm();
        refreshApproval();
        scheduleDraft();
      });
    }
    var btnSyncLot = $('btnSyncLot');
    if (btnSyncLot) {
      btnSyncLot.addEventListener('click', function () {
        if (state.locked) return;
        var d = $('workDate').value || today();
        var l = dateToLot(d);
        $('lot').value = l;
        state.lot = l;
        scheduleDraft();
        if (window.DkjUtil && window.DkjUtil.toast) {
          window.DkjUtil.toast('LOT를 ' + l + ' (으)로 생성했습니다.');
        }
      });
    }
    $('btnAddRow').addEventListener('click', function () {
      if (state.locked) return;
      state.rows.push(emptyRow());
      renderRows();
      scheduleDraft();
    });
    $('btnNow').addEventListener('click', function () {
      if (state.locked) return;
      var empty = state.rows.find(function (r) { return !r.time; });
      if (empty) empty.time = nowTime();
      else state.rows.push(Object.assign(emptyRow(), { time: nowTime() }));
      renderRows();
      scheduleDraft();
    });
    $('btnSave').addEventListener('click', async function () { (await save(false)); });
    $('btnLock').addEventListener('click', async function () { (await save(true)); });
    $('btnNew').addEventListener('click', function () {
      editingId = null;
      state = emptyState();
      writeForm();
      setStatus('새 일보', false);
    });
    $('btnPrint').addEventListener('click', function () {
      if (typeof readForm === 'function') readForm();
      if (window.DkjPrint) {
        DkjPrint.print({ layout: 'official-ccp2p' }, state);
      } else {
        window.print();
      }
    });
    if (window.DkjUtil) {
      (await window.DkjUtil.attachQuickToolbar($('btnSave') ? $('btnSave').parentNode : null, {
        formId: FORM_ID,
        hasChecks: false,
        keepPhotos: true,
        onClonePrev: function (cloned) {
          if (state.locked) return;
          cloned.stampCarried = (cloned.stampPhotos || []).map(function (ph) { return !!ph; });
          state = Object.assign(emptyState(), cloned);
          editingId = null;
          writeForm();
          scheduleDraft();
        }
      }));
      window.DkjUtil.attachChips(document);
    }
  }

  /** 날짜에 저장된 기록(없으면 같은 날짜 임시본)을 화면에 올린다. 불러왔으면 true. */
  async function loadForDate(date, userDriven) {
    if (!window.DkjDateLoad || !date) return false;
    var hit = (await DkjDateLoad.resolve(FORM_ID, date, 'workDate'));
    if (hit.kind === 'none') return false;
    if (hit.kind === 'record' && hit.data.id && hit.data.id === editingId) return false;
    // 아직 저장하지 않은 새 입력이 있으면 덮어쓰기 전에 확인한다.
    if (userDriven && !editingId) {
      readForm();
      if (JSON.stringify(state.rows) !== JSON.stringify(emptyState().rows) &&
          !confirm(date + ' 저장 기록을 불러오면 지금 입력 중인 내용은 사라집니다. 불러올까요?')) return false;
    }
    editingId = hit.kind === 'record' ? hit.data.id : (hit.data.id || null);
    state = Object.assign(emptyState(), hit.data);
    writeForm();
    refreshApproval();
    setStatus(hit.kind === 'record' ? date + ' 저장 기록 불러옴' : date + ' 임시저장 불러옴', true);
    return true;
  }

  async function init() {
    var draft = (await DkjRecordStore.loadDraft(FORM_ID));
    if (draft) state = Object.assign(emptyState(), draft);
    // 업무 콘솔·달력에서 ?date= 로 들어오면 그 날짜의 기록을 바로 연다(없으면 그 날짜의 새 일지).
    var qd = window.DkjDateLoad ? DkjDateLoad.queryDate() : '';
    if (qd) {
      var hit = (await DkjDateLoad.resolve(FORM_ID, qd, 'workDate'));
      if (hit.kind === 'none') {
        state = emptyState();
        state.workDate = qd;
        state.lot = dateToLot(qd);
        editingId = null;
      } else {
        editingId = hit.data.id || null;
        state = Object.assign(emptyState(), hit.data);
      }
    }
    loadProductOptions().then(async function () {
      writeForm();
      (await bind());
      (await renderHistory());
      mountApproval();
      refreshApproval();
      if (window.DkjUtil) {
        window.DkjUtil.autoFillUser(state, ['monitorName', 'confirmer', 'approver'], function () {
          writeForm();
        });
      }
      setStatus('준비', false);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else (await init());
})();
