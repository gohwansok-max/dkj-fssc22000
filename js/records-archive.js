/**
 * 기록보관함 화면 — 저장된 기록 통합 조회·선택·내보내기.
 *
 * 데이터는 DkjExport.collect() 가 localStorage 에서 긁어온다(클라우드가 켜져 있으면
 * dkj-cloud-sync 가 이미 localStorage 를 최신으로 맞춰 둔 상태다).
 */
(function () {
  'use strict';

  var all = [];
  var view = [];
  var selected = {};

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function catalogPath(formId) {
    var cat = window.DKJ_RECORD_CATALOG;
    var hit = cat && cat.records
      ? cat.records.filter(function (r) { return r.code === formId || r.id === formId; })[0]
      : null;
    if (hit && hit.htmlPath) return hit.htmlPath;
    return 'records/' + formId + '.html';
  }

  function conditions() {
    return {
      from: $('arcFrom').value,
      to: $('arcTo').value,
      formId: $('arcForm').value,
      status: $('arcStatus').value,
      writer: $('arcWriter').value,
      q: $('arcQuery').value
    };
  }

  function fillFormOptions() {
    var sel = $('arcForm');
    var seen = {};
    all.forEach(function (r) {
      if (!seen[r.formId]) seen[r.formId] = r.formTitle || '';
    });
    var opts = Object.keys(seen).sort().map(function (id) {
      var label = seen[id] ? id + ' · ' + seen[id] : id;
      return '<option value="' + esc(id) + '">' + esc(label) + '</option>';
    });
    sel.innerHTML = '<option value="">전체 서식 (' + Object.keys(seen).length + '종)</option>' + opts.join('');
  }

  function renderSummary() {
    var done = view.filter(function (r) { return r.status === '작성완료'; }).length;
    var forms = {};
    view.forEach(function (r) { forms[r.formId] = 1; });
    var dates = view.map(function (r) { return r.date; }).filter(Boolean).sort();
    var span = dates.length ? dates[0] + ' ~ ' + dates[dates.length - 1] : '-';
    var picked = Object.keys(selected).length;

    $('arcSummary').innerHTML =
      '<span>표시 <b>' + view.length + '건</b> / 전체 ' + all.length + '건</span>' +
      '<span>작성완료 <b>' + done + '건</b> · 임시저장 ' + (view.length - done) + '건</span>' +
      '<span>서식 <b>' + Object.keys(forms).length + '종</b></span>' +
      '<span>기간 <b>' + span + '</b></span>' +
      (picked ? '<span>선택 <b>' + picked + '건</b> (선택분만 내보냅니다)</span>' : '');
  }

  function renderTable() {
    var body = $('arcBody');
    if (!view.length) {
      body.innerHTML = '<tr><td colspan="9" class="arc-empty">' +
        (all.length ? '조건에 맞는 기록이 없습니다.' : '아직 저장된 기록이 없습니다. 기록양식에서 작성·저장하면 여기 모입니다.') +
        '</td></tr>';
      return;
    }
    body.innerHTML = view.map(function (r) {
      var open = catalogPath(r.formId) + '?record=' + encodeURIComponent(r.id);
      return '<tr class="' + (selected[r.id] ? 'sel' : '') + '">' +
        '<td><input type="checkbox" data-pick="' + esc(r.id) + '"' + (selected[r.id] ? ' checked' : '') + ' aria-label="선택"></td>' +
        '<td><span class="arc-code">' + esc(r.formId) + '</span></td>' +
        '<td>' + esc(r.date || '-') + '</td>' +
        '<td class="wrap">' + esc(r.title || r.formTitle || '-') + '</td>' +
        '<td>' + esc(r.writer || r.createdBy || '-') + '</td>' +
        '<td><span class="arc-status ' + (r.status === '작성완료' ? 'done' : 'wip') + '">' + esc(r.status) + '</span></td>' +
        '<td>' + esc(r.judge || '-') + '</td>' +
        '<td>' + esc((r.updatedAt || '').replace('T', ' ').slice(0, 16)) + '</td>' +
        '<td><a class="arc-btn" style="min-height:32px;padding:0 10px;" href="' + esc(open) + '">열기</a></td>' +
        '</tr>';
    }).join('');

    body.querySelectorAll('[data-pick]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var id = cb.getAttribute('data-pick');
        if (cb.checked) selected[id] = true;
        else delete selected[id];
        cb.closest('tr').classList.toggle('sel', cb.checked);
        renderSummary();
      });
    });
  }

  function apply() {
    view = window.DkjExport.filter(all, conditions());
    // 화면에서 사라진 기록의 선택은 풀어 준다(안 보이는 걸 내보내면 혼란스럽다)
    var visible = {};
    view.forEach(function (r) { visible[r.id] = 1; });
    Object.keys(selected).forEach(function (id) { if (!visible[id]) delete selected[id]; });
    renderTable();
    renderSummary();
  }

  /** 선택이 있으면 선택분, 없으면 화면에 보이는 전부 */
  function targetRows() {
    var picked = Object.keys(selected);
    if (!picked.length) return view;
    return view.filter(function (r) { return selected[r.id]; });
  }

  function busy(btn, text, fn) {
    var old = btn.textContent;
    btn.disabled = true;
    btn.textContent = text;
    Promise.resolve()
      .then(fn)
      .catch(function (e) {
        alert(e && e.message === 'EXCELJS_LOAD_FAILED'
          ? '엑셀 모듈을 불러오지 못했습니다. 인터넷 연결 없이 파일을 직접 연 경우 CSV를 이용하세요.'
          : '내보내기 실패: ' + (e && e.message ? e.message : e));
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = old;
      });
  }

  function bind() {
    ['arcFrom', 'arcTo', 'arcForm', 'arcStatus'].forEach(function (id) {
      $(id).addEventListener('change', apply);
    });
    ['arcWriter', 'arcQuery'].forEach(function (id) {
      $(id).addEventListener('input', apply);
    });

    $('arcAll').addEventListener('change', function () {
      selected = {};
      if (this.checked) view.forEach(function (r) { selected[r.id] = true; });
      renderTable();
      renderSummary();
    });

    $('arcXlsx').addEventListener('click', function () {
      var rows = targetRows();
      if (!rows.length) { alert('내보낼 기록이 없습니다.'); return; }
      busy(this, '만드는 중…', function () {
        return window.DkjExport.toXlsx(rows, null, conditions());
      });
    });

    $('arcCsv').addEventListener('click', function () {
      var rows = targetRows();
      if (!rows.length) { alert('내보낼 기록이 없습니다.'); return; }
      window.DkjExport.toCsv(rows);
    });

    $('arcPrint').addEventListener('click', function () {
      window.print();
    });

    $('arcBackup').addEventListener('click', function () {
      var n = window.DkjExport.toJsonBackup();
      if (!n) alert('백업할 기록이 없습니다.');
    });

    $('arcRestore').addEventListener('click', function () {
      $('arcRestoreFile').click();
    });

    $('arcRestoreFile').addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var added = window.DkjExport.restoreJson(String(reader.result));
          alert('복원 완료 — 새로 추가된 기록 ' + added + '건.\n(같은 기록은 최신본만 남겼습니다.)');
          load();
        } catch (e) {
          alert('복원 실패 — 백업 파일이 아니거나 손상됐습니다.');
        }
      };
      reader.readAsText(file);
      this.value = '';
    });
  }

  function syncPill() {
    var pill = $('arcSyncPill');
    if (!pill) return;
    var on = window.DkjAuth && window.DkjAuth.configured();
    var user = window.DkjAuth && window.DkjAuth.user();
    if (on && user) {
      pill.textContent = '클라우드 동기화 · ' + user.name;
    } else if (on) {
      pill.textContent = '클라우드 동기화 (로그인 필요)';
    } else {
      pill.className = 'status-pill wip';
      pill.textContent = '기기 저장 — 백업을 권합니다';
    }
  }

  function load() {
    all = window.DkjExport.collect();
    fillFormOptions();
    apply();
    syncPill();
  }

  bind();
  load();
})();
