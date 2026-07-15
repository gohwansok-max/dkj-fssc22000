/**
 * FR-014 원부자재 입고검사 기록
 */
(function () {
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
      remark: ''
    };
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
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
    renderOxGrid();
    renderJudge();
    if (state.linkedProduct) {
      DkjMaster.renderProductChips('linkedProductChips', function (code) {
        state.linkedProduct = code;
        scheduleDraft();
      }, state.linkedProduct);
    }
  }

  function collect() {
    return JSON.parse(JSON.stringify(state));
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
    draftTimer = setTimeout(function () {
      DkjRecordStore.saveDraft(FORM_ID, collect());
      setStatus('임시저장 ' + new Date().toLocaleTimeString('ko-KR'), false);
    }, 800);
  }

  function saveRecord(lock) {
    var data = collect();
    var err = validate(data);
    if (err) {
      alert(err);
      return;
    }
    if (editingId) data.id = editingId;
    data.locked = !!lock;
    var saved = DkjRecordStore.save(FORM_ID, data);
    editingId = saved.id;
    setStatus(lock ? '작성완료 저장됨' : '저장 완료', true);
    renderHistory();
    if (data.judge === '부적합') {
      showFr015Banner(true, saved.id);
      showStoreBanner(false);
    } else if (data.judge === '적합') {
      showFr015Banner(false);
      showStoreBanner(true, saved);
    }
    if (lock) $('btnLock').disabled = true;
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

  function renderHistory() {
    var list = DkjRecordStore.list(FORM_ID);
    var el = $('historyList');
    if (!list.length) {
      el.innerHTML = '<p style="color:#888;font-size:13px;">저장된 입고검사 기록이 없습니다.</p>';
      return;
    }
    el.innerHTML = list.slice(0, 20).map(function (r) {
      var badge = r.judge === '적합' ? 'done' : 'wip';
      return '<div class="dkj-history-item">' +
        '<div class="meta"><strong>' + (r.itemName || '-') + '</strong>' +
        r.receiveDate + ' · ' + (r.supplier || '') + ' · LOT ' + (r.lot || '') +
        ' <span class="badge ' + badge + '">' + (r.judge || '-') + '</span></div>' +
        '<div style="display:flex;gap:6px;">' +
          '<button type="button" class="pill-btn ghost" data-edit="' + r.id + '">불러오기</button>' +
          '<button type="button" class="pill-btn ghost" data-del="' + r.id + '">삭제</button>' +
        '</div></div>';
    }).join('');

    el.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var rec = DkjRecordStore.get(FORM_ID, btn.getAttribute('data-edit'));
        if (rec) {
          editingId = rec.id;
          fillForm(rec);
          setStatus('기록 불러옴', true);
          $('btnLock').disabled = !!rec.locked;
          showFr015Banner(rec.judge === '부적합', rec.id);
          showStoreBanner(rec.judge === '적합', rec);
        }
      });
    });
    el.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (confirm('이 기록을 삭제할까요?')) {
          DkjRecordStore.remove(FORM_ID, btn.getAttribute('data-del'));
          renderHistory();
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
    setStatus('새 입고 작성', false);
  }

  function init() {
    renderOxGrid();
    renderJudge();
    bindFields();

    var draft = DkjRecordStore.loadDraft(FORM_ID);
    if (draft && !draft.id) fillForm(draft);
    else fillForm(emptyState());

    $('btnSave').addEventListener('click', function () { saveRecord(false); });
    $('btnLock').addEventListener('click', function () {
      if (confirm('작성완료 후에는 수정이 제한됩니다. 완료할까요?')) saveRecord(true);
    });
    $('btnNew').addEventListener('click', newEntry);
    if (!window._dkjDoPrintReady) { window._dkjDoPrintReady = true; }

  function dkjDoPrint() {
    var st = (typeof collect === 'function') ? collect() : (typeof state !== 'undefined' ? state : {});
    if (window.DkjPrint) {
      var tmpl = {
        layout: 'ox',
        columnMode: 'result',
        orgName: '동김제농협 가공센터',
        docNo: FORM_ID,
        title: document.title.split('|')[0].trim(),
        rev: '0',
        enactDate: '2026.07.10',
        reviseDate: '2026.07.10',
        rows: (typeof CHECK_ITEMS !== 'undefined' ? CHECK_ITEMS : []).map(function (it) {
          return { key: it.key, group: it.group || '', label: it.label, freq: 'D', hint: it.hint || '' };
        }),
        note: '※ 평가 — 양호: ○ , 부적합: ×   ※ 작성화면과 분리된 정본형 출력'
      };
      if (!tmpl.rows.length && st.checks) {
        tmpl.rows = Object.keys(st.checks).map(function (k) {
          return { key: k, group: '', label: k, freq: 'D' };
        });
      }
      // CCP: synthesize rows from known fields
      if (!tmpl.rows.length) {
        tmpl.rows = [
          { key: '_judge', group: '판정', label: '종합판정', freq: 'D' },
          { key: '_corr', group: '조치', label: '즉시조치', freq: 'D' }
        ];
        st.checks = st.checks || {};
        st.checks._judge = st.judge || st.result || '';
        st.checks._corr = (st.corrective || '').slice(0, 20) ? 'O' : '';
      }
      DkjPrint.print(tmpl, st);
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

    var params = new URLSearchParams(location.search);
    var loadId = params.get('id');
    if (loadId) {
      var rec = DkjRecordStore.get(FORM_ID, loadId);
      if (rec) {
        editingId = rec.id;
        fillForm(rec);
        $('btnLock').disabled = !!rec.locked;
      }
    }

    renderHistory();
    setInterval(function () {
      if (!editingId) DkjRecordStore.saveDraft(FORM_ID, collect());
    }, 120000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
