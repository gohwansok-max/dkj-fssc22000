/**
 * FR-014 원부자재 입고검사 기록
 */
(async function () {
  'use strict';

  var FORM_ID = 'FR-014';
  var CHECK_ITEMS = [
    { key: 'c01', label: '승인공급업체', hint: '승인 목록 등록 업체인가?' },
    { key: 'c02', label: '납품서·거래명세', hint: '납품서/명세서 수령' },
    { key: 'c03', label: '표시사항', hint: '품명·LOT·원산지' },
    { key: 'c04', label: '유통기한/제조일', hint: '표시 일자 확인' },
    { key: 'c05', label: '운송차량 위생', hint: '차량 청결·오염 없음' },
    { key: 'c06', label: '입고 온도', hint: '기준 온도 이내' },
    { key: 'c07', label: '외관·이물', hint: '부패·흙·이물 없음' },
    { key: 'c08', label: '냄새·변색', hint: '이상 냄새·변색 없음' },
    { key: 'c09', label: '시험성적서', hint: '유/무/해당없음' },
    { key: 'c10', label: '수량 일치', hint: '발주·납품 수량 일치' }
  ];


  /* 업체·품목 선택 목록 — 구분을 고르면 그 구분의 업체·품목만 나온다. */
  // 정본: data/incoming-catalog.json (번들 js/incoming-catalog.bundle.js) — 여기에 목록을 따로 적지 않는다
  var INCOMING = (window.DKJ_INCOMING_CATALOG && window.DKJ_INCOMING_CATALOG.categories) || {};

  function fillList(id, list) {
    var dl = $(id);
    if (!dl) return;
    dl.innerHTML = (list || []).map(function (v) { return '<option value="' + esc(v) + '"></option>'; }).join('');
  }
  function refreshIncomingLists() {
    var c = INCOMING[state.materialType] || { vendors: [], items: [] };
    fillList('fr014Vendors', c.vendors);
    fillList('fr014Items', c.items);
  }
  /** 구분·품목을 고르면 외관 점검 항목을 O(해당 없는 항목은 -)로, 판정은 적합·입고로 미리 채운다.
      사람이 이미 누른 칸은 덮어쓰지 않고, 측정하는 입고 온도(c06)는 원료일 때 비워 둔다. 작성 확정 때 확인창을 거친다. */
  function applyIncomingDefaults() {
    var c = INCOMING[state.materialType];
    if (!c || c.items.indexOf(state.itemName) === -1) return false;
    if (c.vendors.length === 1 && !state.supplier) state.supplier = c.vendors[0];
    CHECK_ITEMS.forEach(function (it) {
      if (state.checks[it.key]) return;
      if (c.na.indexOf(it.key) !== -1) state.checks[it.key] = '-';
      else if (it.key === 'c06' && state.materialType === '원료') return;
      else state.checks[it.key] = 'O';
    });
    if (!state.lot && state.receiveDate) state.lot = String(state.receiveDate).replace(/[^0-9]/g, '');
    return true;
  }

  var state = emptyState();
  var editingId = null;

  function emptyState() {
    var checks = {};
    CHECK_ITEMS.forEach(function (c) { checks[c.key] = ''; });
    return {
      receiveDate: today(),
      materialType: '원료',
      supplier: '',
      itemName: '',
      lot: '',
      qty: '',
      unit: 'kg',
      temp: '',
      linkedProduct: '',
      checks: checks,
      judge: '',
      action: '입고',
      inspector: '',
      confirmer: '',
      remark: '',
      // 전자결재 — 검사자·확인자 2단
      approvals: { writer: '', reviewer: '', approver: '' },
      signoff: {},
      audit: []
    };
  }

  /* 전자결재 패널 — 모듈이 없으면 그냥 건너뛴다 */
  var apvUi = null;

  function syncApprovals() {
    // 예전에 저장된 기록에는 결재 필드가 없다 — 여기서 기본값을 채운다
    if (!state.signoff) state.signoff = {};
    if (!Array.isArray(state.audit)) state.audit = [];
    if (!window.DkjApproval) return;
    DkjApproval.bindFlat(state, { writer: 'inspector', approver: 'confirmer' });
  }

  function mountApproval() {
    if (!window.DkjApproval || apvUi) return;
    apvUi = DkjApproval.mount({
      // 한 번도 저장 안 한 새 시트에서 결재를 누르면 먼저 저장한다(검증 포함) — 안 그러면 서명이
      // 이 기기 임시본에만 남아 다른 기기의 검토·승인자에게 보이지 않았다(2026-10-23 점검).
      ensureSaved: async function () { if (!editingId) (await saveRecord(false)); return !!editingId; },
      stages: ['writer', 'approver'],
      labels: { writer: '검사', approver: '확인' },
      getState: function () { syncApprovals(); return state; },
      // 결재 서명은 임시저장(이 기기에만 남고 클라우드 동기화 안 됨)이 아니라
      // 실제 저장 레코드에 바로 반영해야 다른 기기·다른 사람에게도 보인다.
      // 이 서식은 state.locked 를 실시간으로 유지하지 않으므로(잠금은 collect() 결과에만
      // 적용) 저장돼 있던 기록의 실제 잠금 여부를 다시 물어 덮어쓰지 않게 한다.
      onChange: async function () {
        if (editingId) {
          var prev = (await DkjRecordStore.get(FORM_ID, editingId)) || {};
          // title·locked 는 saveRecord() 안에서만 계산되고 state 에는 남지 않으므로,
          // 이전에 저장된 기록을 바탕으로 덮어써야 결재만 눌러도 제목·잠금이 사라지지 않는다.
          var data = Object.assign({}, prev, collect(), { id: editingId, locked: !!prev.locked });
          (await DkjRecordStore.save(FORM_ID, data));
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

  function $(id) { return document.getElementById(id); }

  function setStatus(msg, saved) {
    var el = $('saveStatus');
    if (!el) return;
    el.textContent = msg;
    el.className = 'dkj-status' + (saved ? ' saved' : '');
  }

  function renderOxGrid() {
    var grid = $('oxGrid');
    grid.innerHTML = CHECK_ITEMS.map(function (item) {
      var v = state.checks[item.key] || '';
      function btn(val) {
        return '<button type="button" class="ox-btn' + (v === val ? ' on' : '') + '" data-key="' + item.key + '" data-v="' + val + '">' + val + '</button>';
      }
      return '<div class="ox-row">' +
        '<div><label>' + item.label + '<small>' + item.hint + '</small></label></div>' +
        '<div class="ox-btns">' + btn('O') + btn('X') + btn('-') + '</div></div>';
    }).join('');

    grid.querySelectorAll('.ox-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.checks[btn.getAttribute('data-key')] = btn.getAttribute('data-v');
        renderOxGrid();
        autoJudge();
        scheduleDraft();
      });
    });
  }

  function renderJudge() {
    ['judgeOk', 'judgeNg'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      var j = el.getAttribute('data-judge');
      el.classList.toggle('on', state.judge === j);
    });
  }

  function autoJudge() {
    var vals = Object.values(state.checks).filter(Boolean);
    if (!vals.length) return;
    if (vals.indexOf('X') !== -1) {
      state.judge = '부적합';
      if (state.action === '입고') state.action = '격리';
    } else if (vals.every(function (v) { return v === 'O' || v === '-'; }) && vals.indexOf('O') !== -1) {
      state.judge = '적합';
      if (state.action === '격리') state.action = '입고';
    }
    renderJudge();
    if ($('action')) $('action').value = state.action;
  }

  function bindFields() {
    var map = {
      receiveDate: 'receiveDate', materialType: 'materialType', supplier: 'supplier',
      itemName: 'itemName', lot: 'lot', qty: 'qty', unit: 'unit', temp: 'temp',
      action: 'action', inspector: 'inspector', confirmer: 'confirmer', remark: 'remark'
    };
    Object.keys(map).forEach(function (k) {
      var el = $(map[k]);
      if (!el) return;
      el.addEventListener('input', function () {
        state[k] = el.value;
        scheduleDraft();
      });
      el.addEventListener('change', function () {
        state[k] = el.value;
        scheduleDraft();
      });
    });

    $('materialType').addEventListener('change', refreshIncomingLists);
    $('itemName').addEventListener('change', function () {
      if (!applyIncomingDefaults()) return;
      $('supplier').value = state.supplier || '';
      $('lot').value = state.lot || '';
      renderOxGrid();
      autoJudge();
      scheduleDraft();
    });
    refreshIncomingLists();

    $('judgeOk').addEventListener('click', function () {
      state.judge = '적합';
      renderJudge();
      scheduleDraft();
    });
    $('judgeNg').addEventListener('click', function () {
      state.judge = '부적합';
      state.action = '격리';
      $('action').value = '격리';
      renderJudge();
      scheduleDraft();
    });
  }

  function fillForm(data) {
    state = JSON.parse(JSON.stringify(data));
    if (!state.checks) {
      state.checks = emptyState().checks;
    }
    if (!state.approvals) state.approvals = { writer: '', reviewer: '', approver: '' };
    if (!state.signoff) state.signoff = {};
    if (!Array.isArray(state.audit)) state.audit = [];
    $('receiveDate').value = state.receiveDate || today();
    $('materialType').value = state.materialType || '원료';
    $('supplier').value = state.supplier || '';
    $('itemName').value = state.itemName || '';
    $('lot').value = state.lot || '';
    $('qty').value = state.qty || '';
    $('unit').value = state.unit || 'kg';
    $('temp').value = state.temp || '';
    $('action').value = state.action || '입고';
    $('inspector').value = state.inspector || '';
    $('confirmer').value = state.confirmer || '';
    $('remark').value = state.remark || '';
    refreshIncomingLists();
    renderOxGrid();
    renderJudge();
    syncApprovals();
    refreshApproval();
    if (state.linkedProduct) {
      DkjMaster.renderProductChips('linkedProductChips', function (code) {
        state.linkedProduct = code;
        scheduleDraft();
      }, state.linkedProduct);
    }
  }

  function collect() {
    var out = JSON.parse(JSON.stringify(state));
    // 감사이력은 살아있는 배열을 그대로 넘긴다. 깊은 복사본을 넘기면 저장 훅이
    // 복사본에만 append 해서 다음 저장 때 이력이 사라진다.
    out.audit = state.audit;
    out.signoff = state.signoff;
    return out;
  }

  function validate(data) {
    if (!data.receiveDate) return '입고일자를 입력하세요.';
    if (!data.supplier.trim()) return '공급업체명을 입력하세요.';
    if (!data.itemName.trim()) return '품목명을 입력하세요.';
    if (!data.lot.trim()) return 'LOT를 입력하세요.';
    if (!data.inspector.trim()) return '검사자를 입력하세요.';
    var missing = CHECK_ITEMS.filter(function (c) { return !data.checks[c.key]; });
    if (missing.length) return '점검 항목을 모두 선택하세요. (' + missing[0].label + ')';
    if (!data.judge) return '종합판정을 선택하세요.';
    return '';
  }

  var draftTimer;
  function scheduleDraft() {
    clearTimeout(draftTimer);
    setStatus('작성 중…', false);
    draftTimer = setTimeout(async function () {
      (await DkjRecordStore.saveDraft(FORM_ID, collect()));
      setStatus('임시저장 ' + new Date().toLocaleTimeString('ko-KR'), false);
    }, 800);
  }

  var saveInFlight = false;
  async function saveRecord(lock) {
    if (saveInFlight) return;
    saveInFlight = true;
    try {
      var data = collect();
      var err = validate(data);
      if (err) {
        alert(err);
        return;
      }
      if (editingId) data.id = editingId;
      // 대기 중인 임시저장 타이머를 지운다 — 안 지우면 저장 직후 "저장 완료"가 잠깐
      // 떴다가 그 타이머가 뒤늦게 "임시저장"으로 덮어써 버린다.
      clearTimeout(draftTimer);
      data.locked = !!lock;
      // 기록보관함·엑셀의 '기록제목' 칸에 쓰인다. 없으면 목록에서 어느 입고 건인지 구분이 안 된다.
      data.title = '원부자재 입고검사' +
        (data.itemName ? ' · ' + data.itemName : '') +
        (data.lot ? ' ' + data.lot : '');
      var saved = (await DkjRecordStore.save(FORM_ID, data));
      editingId = saved.id;
      setStatus(lock ? '작성완료 저장됨' : '저장 완료', true);
      refreshApproval();
      showTraceBanner(true, saved);
      (await renderHistory());
      if (data.judge === '부적합') {
        showFr015Banner(true, saved.id);
        showStoreBanner(false);
      } else if (data.judge === '적합') {
        showFr015Banner(false);
        showStoreBanner(true, saved);
      }
      if (lock) $('btnLock').disabled = true;
    } finally { saveInFlight = false; }
  }

  function showFr015Banner(show, recordId) {
    var el = $('fr015Banner');
    var link = $('fr015Link');
    if (el) el.hidden = !show;
    if (link && recordId) {
      link.href = 'FR-015.html?from014=' + encodeURIComponent(recordId);
    }
  }

  function showStoreBanner(show, data) {
    var el = $('storeBanner');
    var link = $('storeLink');
    if (el) el.hidden = !show;
    if (link && data) {
      var q = 'from014=' + encodeURIComponent(data.id || '') +
        '&itemName=' + encodeURIComponent(data.itemName || '') +
        '&lot=' + encodeURIComponent(data.lot || '') +
        '&qty=' + encodeURIComponent(data.qty || '') +
        '&unit=' + encodeURIComponent(data.unit || 'kg') +
        '&supplier=' + encodeURIComponent(data.supplier || '') +
        '&receiveDate=' + encodeURIComponent(data.receiveDate || '');
      link.href = 'DKJ-STORE-01.html?' + q;
    }
  }

  function showTraceBanner(show, data) {
    var el = $('traceBanner');
    var link = $('traceLink');
    if (el) el.hidden = !show;
    if (link && data) {
      var q = 'from014=' + encodeURIComponent(data.id || '') +
        '&lot=' + encodeURIComponent(data.lot || '') +
        '&item=' + encodeURIComponent(data.itemName || '') +
        '&supplier=' + encodeURIComponent(data.supplier || '') +
        '&qty=' + encodeURIComponent(data.qty || '') +
        '&unit=' + encodeURIComponent(data.unit || 'kg') +
        '&date=' + encodeURIComponent(data.receiveDate || '') +
        '&mode=quick';
      link.href = '../traceability.html?' + q;
    }
  }

  function showLinkedProducts(codes) {
    var tags = $('linkedProductTags');
    if (!tags || !codes || !codes.length) {
      if (tags) tags.innerHTML = '';
      return;
    }
    DkjMaster.loadProducts().then(function (d) {
      tags.innerHTML = codes.map(function (code) {
        var p = d.finishedProducts.find(function (x) { return x.code === code; });
        return '<span class="tag">' + (p ? p.name : code) + '</span>';
      }).join('');
    });
  }

  function applyPreset(preset) {
    state.itemName = preset.name;
    state.materialType = preset.materialType || '원료';
    state.unit = preset.unit || 'kg';
    $('itemName').value = preset.name;
    $('materialType').value = state.materialType;
    refreshIncomingLists();
    $('unit').value = state.unit;
    if (!state.lot) {
      state.lot = DkjMaster.suggestLot(state.receiveDate);
      $('lot').value = state.lot;
    }
    showLinkedProducts(preset.products);
    if (preset.products && preset.products[0]) {
      state.linkedProduct = preset.products[0];
      DkjMaster.renderProductChips('linkedProductChips', function (code) {
        state.linkedProduct = code;
        scheduleDraft();
      }, state.linkedProduct);
    }
    scheduleDraft();
  }

  async function renderHistory() {
    var list = (await DkjRecordStore.list(FORM_ID));
    var el = $('historyList');
    if (!list.length) {
      el.innerHTML = '<p style="color:#888;font-size:13px;">저장된 입고검사 기록이 없습니다.</p>';
      return;
    }
    el.innerHTML = list.slice(0, 20).map(function (r) {
      var badge = r.judge === '적합' ? 'done' : 'wip';
      return '<div class="dkj-history-item">' +
        '<div class="meta"><strong>' + esc(r.itemName || '-') + '</strong>' +
        esc(r.receiveDate || '') + ' · ' + esc(r.supplier || '') + ' · LOT ' + esc(r.lot || '') +
        ' <span class="badge ' + badge + '">' + esc(r.judge || '-') + '</span></div>' +
        '<div style="display:flex;gap:6px;">' +
          '<button type="button" class="pill-btn ghost" data-edit="' + r.id + '">불러오기</button>' +
          '<button type="button" class="pill-btn ghost" data-del="' + r.id + '">삭제</button>' +
        '</div></div>';
    }).join('');

    el.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var rec = (await DkjRecordStore.get(FORM_ID, btn.getAttribute('data-edit')));
        if (rec) {
          editingId = rec.id;
          fillForm(rec);
          setStatus('기록 불러옴', true);
          $('btnLock').disabled = !!rec.locked;
          showFr015Banner(rec.judge === '부적합', rec.id);
          showStoreBanner(rec.judge === '적합', rec);
          showTraceBanner(true, rec);
        }
      });
    });
    el.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (confirm('이 기록을 삭제할까요?')) {
          (await DkjRecordStore.remove(FORM_ID, btn.getAttribute('data-del')));
          (await renderHistory());
        }
      });
    });
  }

  function newEntry() {
    editingId = null;
    fillForm(emptyState());
    $('btnLock').disabled = false;
    showFr015Banner(false);
    showStoreBanner(false);
    showTraceBanner(false);
    setStatus('새 입고 작성', false);
  }

  async function init() {
    renderOxGrid();
    renderJudge();
    bindFields();
    mountApproval();

    var draft = (await DkjRecordStore.loadDraft(FORM_ID));
    if (draft && !draft.id) fillForm(draft);
    else fillForm(emptyState());

    $('btnSave').addEventListener('click', async function () { (await saveRecord(false)); });
    $('btnLock').addEventListener('click', async function () {
      if (confirm('작성완료 후에는 수정이 제한됩니다. 완료할까요?')) (await saveRecord(true));
    });
    $('btnNew').addEventListener('click', newEntry);

  function dkjDoPrint() {
    var st = (typeof collect === 'function') ? collect() : (typeof state !== 'undefined' ? state : {});
    if (window.DkjPrint) {
      DkjPrint.print({
        layout: 'official-fr014',
        orgName: '동김제농협 산지유통센터',
        docNo: 'FR-014',
        title: '원부자재 입고검사 기록',
        rev: '0',
        enactDate: '2024. 02. 13',
        reviseDate: '-',
        rows: (typeof CHECK_ITEMS !== 'undefined' ? CHECK_ITEMS : []).map(function (it) {
          return { key: it.key, group: it.group || '', label: it.label, freq: 'D', hint: it.hint || '' };
        })
      }, st);
    } else {
      window.print();
    }
  }

    $('btnPrint').addEventListener('click', function () { dkjDoPrint(); });
    $('btnLot').addEventListener('click', function () {
      state.lot = DkjMaster.suggestLot($('receiveDate').value);
      $('lot').value = state.lot;
      scheduleDraft();
    });

    DkjMaster.renderProcessBar('processBar', 'recv');
    DkjMaster.renderRawPresets('rawPresets', applyPreset);
    DkjMaster.renderProductChips('linkedProductChips', function (code) {
      state.linkedProduct = code;
      scheduleDraft();
    }, state.linkedProduct);

    if (window.DkjUtil) {
      (await window.DkjUtil.attachQuickToolbar($('btnSave') ? $('btnSave').parentNode : null, {
        formId: FORM_ID,
        hasChecks: true,
        onAllPass: function () {
          if (state.locked) return;
          CHECK_ITEMS.forEach(function (it) { state.checks[it.key] = 'O'; });
          state.judge = '적합';
          renderOxGrid();
          renderJudge();
          scheduleDraft();
        },
        onClonePrev: function (cloned) {
          if (state.locked) return;
          fillForm(cloned);
          editingId = null;
          state.receiveDate = today();
          $('receiveDate').value = state.receiveDate;
          scheduleDraft();
        }
      }));
      window.DkjUtil.attachChips(document);
      window.DkjUtil.autoFillUser(state, ['inspector', 'confirmer'], function () {
        fillForm(state);
      });
    }

    var params = new URLSearchParams(location.search);
    var loadId = params.get('id');
    if (loadId) {
      var rec = (await DkjRecordStore.get(FORM_ID, loadId));
      if (rec) {
        editingId = rec.id;
        fillForm(rec);
        $('btnLock').disabled = !!rec.locked;
        showFr015Banner(rec.judge === '부적합', rec.id);
        showStoreBanner(rec.judge === '적합', rec);
        showTraceBanner(true, rec);
      }
    }

    (await renderHistory());
    setInterval(async function () {
      if (!editingId) (await DkjRecordStore.saveDraft(FORM_ID, collect()));
    }, 120000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    (await init());
  }
})();
