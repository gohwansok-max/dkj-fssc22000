/**
 * FR-015 부적합 원부자재 처리기록
 */
(function () {
  'use strict';

  var FORM_ID = 'FR-015';
  var NC_REASONS = [
    { key: 'r01', label: '표시사항 불량' },
    { key: 'r02', label: '유통기한·제조일 이상' },
    { key: 'r03', label: '온도 이탈' },
    { key: 'r04', label: '외관·이물' },
    { key: 'r05', label: '냄새·부패' },
    { key: 'r06', label: '성적서 미비' },
    { key: 'r07', label: '수량 불일치' },
    { key: 'r08', label: '미승인 공급업체' },
    { key: 'r09', label: '차량·운송 위생' },
    { key: 'r10', label: '기타' }
  ];

  var state = emptyState();
  var editingId = null;
  var processSteps = [];

  function emptyState() {
    var reasons = {};
    NC_REASONS.forEach(function (r) { reasons[r.key] = false; });
    return {
      processDate: today(),
      discoverStep: 'recv',
      supplier: '',
      itemName: '',
      lot: '',
      qty: '',
      unit: 'kg',
      linkedFr014: '',
      linkedProduct: '',
      isolateLocation: '부적합 격리구역',
      disposition: '격리',
      notifySupplier: '예',
      reasons: reasons,
      reasonText: '',
      handler: '',
      approver: '',
      remark: '',
      carRequired: '아니오'
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

  function renderReasons() {
    var el = $('reasonGrid');
    if (!el) return;
    el.innerHTML = NC_REASONS.map(function (r) {
      var on = state.reasons[r.key] ? ' on' : '';
      return '<button type="button" class="reason-chip' + on + '" data-key="' + r.key + '">' + r.label + '</button>';
    }).join('');
    el.querySelectorAll('.reason-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-key');
        state.reasons[key] = !state.reasons[key];
        btn.classList.toggle('on', state.reasons[key]);
        scheduleDraft();
      });
    });
  }

  function fillDiscoverSteps() {
    DkjMaster.loadProcess().then(function (proc) {
      processSteps = proc.ncSteps || proc.steps;
      var sel = $('discoverStep');
      if (!sel) return;
      sel.innerHTML = processSteps.map(function (s) {
        return '<option value="' + s.id + '">' + s.label + '</option>';
      }).join('');
      sel.value = state.discoverStep || 'recv';
    });
  }

  function fillFr014Select(selected) {
    var sel = $('linkedFr014');
    if (!sel) return;
    var list = DkjMaster.listFr014ForSelect();
    var opts = '<option value="">— FR-014 선택 (선택) —</option>';
    list.forEach(function (r) {
      var label = r.receiveDate + ' ' + (r.itemName || '') + ' LOT:' + (r.lot || '') + ' [' + (r.judge || '') + ']';
      opts += '<option value="' + r.id + '">' + label + '</option>';
    });
    sel.innerHTML = opts;
    if (selected) sel.value = selected;
  }

  function applyFr014(id) {
    if (!id || !window.DkjRecordStore) return;
    var rec = DkjRecordStore.get('FR-014', id);
    if (!rec) return;
    state.linkedFr014 = id;
    state.supplier = rec.supplier || '';
    state.itemName = rec.itemName || '';
    state.lot = rec.lot || '';
    state.qty = rec.qty || '';
    state.unit = rec.unit || 'kg';
    state.linkedProduct = rec.linkedProduct || '';
    state.processDate = rec.receiveDate || today();
    state.discoverStep = 'recv';
    if (rec.remark) state.reasonText = rec.remark;
    if (rec.judge === '부적합') {
      state.disposition = rec.action === '반품' ? '반품' : rec.action === '폐기' ? '폐기' : '격리';
    }
    syncToForm();
    fillFr014Select(id);
    renderReasons();
    scheduleDraft();
  }

  function syncToForm() {
    $('processDate').value = state.processDate || today();
    $('discoverStep').value = state.discoverStep || 'recv';
    $('supplier').value = state.supplier || '';
    $('itemName').value = state.itemName || '';
    $('lot').value = state.lot || '';
    $('qty').value = state.qty || '';
    $('unit').value = state.unit || 'kg';
    $('isolateLocation').value = state.isolateLocation || '';
    $('disposition').value = state.disposition || '격리';
    $('notifySupplier').value = state.notifySupplier || '예';
    $('reasonText').value = state.reasonText || '';
    $('handler').value = state.handler || '';
    $('approver').value = state.approver || '';
    $('remark').value = state.remark || '';
    $('carRequired').value = state.carRequired || '아니오';
    if ($('linkedFr014')) $('linkedFr014').value = state.linkedFr014 || '';
    DkjMaster.renderProductChips('linkedProductChips', function (code) {
      state.linkedProduct = code;
      scheduleDraft();
    }, state.linkedProduct);
  }

  function bindFields() {
    var fields = ['processDate', 'discoverStep', 'supplier', 'itemName', 'lot', 'qty', 'unit',
      'isolateLocation', 'disposition', 'notifySupplier', 'reasonText', 'handler', 'approver', 'remark', 'carRequired'];
    fields.forEach(function (id) {
      var el = $(id);
      if (!el) return;
      var key = id;
      el.addEventListener('input', function () { state[key] = el.value; scheduleDraft(); });
      el.addEventListener('change', function () { state[key] = el.value; scheduleDraft(); });
    });
    $('linkedFr014').addEventListener('change', function () {
      applyFr014(this.value);
    });
    $('btnLot').addEventListener('click', function () {
      $('lot').value = DkjMaster.suggestLot($('processDate').value);
      state.lot = $('lot').value;
      scheduleDraft();
    });
  }

  function collect() {
    return JSON.parse(JSON.stringify(state));
  }

  function validate(data) {
    if (!data.processDate) return '처리일자를 입력하세요.';
    if (!data.supplier.trim()) return '공급업체명을 입력하세요.';
    if (!data.itemName.trim()) return '품목명을 입력하세요.';
    if (!data.lot.trim()) return 'LOT를 입력하세요.';
    if (!data.handler.trim()) return '처리담당자를 입력하세요.';
    var anyReason = Object.keys(data.reasons).some(function (k) { return data.reasons[k]; });
    if (!anyReason && !data.reasonText.trim()) return '부적합 사유를 선택하거나 입력하세요.';
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
    if (err) { alert(err); return; }
    if (editingId) data.id = editingId;
    data.locked = !!lock;
    var saved = DkjRecordStore.save(FORM_ID, data);
    editingId = saved.id;
    setStatus(lock ? '작성완료' : '저장 완료', true);
    renderHistory();
    if (lock && data.carRequired === '예') {
      $('carBanner').hidden = false;
    }
    if (lock) $('btnLock').disabled = true;
  }

  function renderHistory() {
    var list = DkjRecordStore.list(FORM_ID);
    var el = $('historyList');
    if (!list.length) {
      el.innerHTML = '<p style="color:#888;font-size:13px;">저장된 부적합 처리 기록이 없습니다.</p>';
      return;
    }
    el.innerHTML = list.slice(0, 15).map(function (r) {
      return '<div class="dkj-history-item"><div class="meta"><strong>' + (r.itemName || '-') + '</strong>' +
        r.processDate + ' · ' + (r.disposition || '') + ' · LOT ' + (r.lot || '') +
        '</div><div style="display:flex;gap:6px;">' +
        '<button type="button" class="pill-btn ghost" data-edit="' + r.id + '">불러오기</button>' +
        '<button type="button" class="pill-btn ghost" data-del="' + r.id + '">삭제</button></div></div>';
    }).join('');
    el.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var rec = DkjRecordStore.get(FORM_ID, btn.getAttribute('data-edit'));
        if (rec) {
          editingId = rec.id;
          state = JSON.parse(JSON.stringify(rec));
          syncToForm();
          renderReasons();
          $('btnLock').disabled = !!rec.locked;
        }
      });
    });
    el.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (confirm('삭제할까요?')) {
          DkjRecordStore.remove(FORM_ID, btn.getAttribute('data-del'));
          renderHistory();
        }
      });
    });
  }

  function init() {
    renderReasons();
    fillDiscoverSteps();
    fillFr014Select();
    bindFields();

    var draft = DkjRecordStore.loadDraft(FORM_ID);
    if (draft && !draft.id) state = draft;
    syncToForm();

    var params = new URLSearchParams(location.search);
    var from014 = params.get('from014');
    if (from014) applyFr014(from014);

    $('btnSave').addEventListener('click', function () { saveRecord(false); });
    $('btnLock').addEventListener('click', function () {
      if (confirm('작성완료 처리할까요?')) saveRecord(true);
    });
    $('btnNew').addEventListener('click', function () {
      editingId = null;
      state = emptyState();
      syncToForm();
      renderReasons();
      $('btnLock').disabled = false;
      $('carBanner').hidden = true;
    });
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

    DkjMaster.renderProcessBar('processBar', 'recv');
    DkjMaster.renderRawPresets('rawPresets', function (preset) {
      state.itemName = preset.name;
      state.unit = preset.unit || 'kg';
      state.materialType = preset.materialType;
      $('itemName').value = preset.name;
      $('unit').value = preset.unit || 'kg';
      var tags = $('linkedProductTags');
      if (tags && preset.products && preset.products.length) {
        DkjMaster.loadProducts().then(function (d) {
          tags.innerHTML = preset.products.map(function (code) {
            var p = d.finishedProducts.find(function (x) { return x.code === code; });
            return '<span class="tag">' + (p ? p.name : code) + '</span>';
          }).join('');
        });
      }
      scheduleDraft();
    });

    renderHistory();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
