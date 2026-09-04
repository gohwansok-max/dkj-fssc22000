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
      $(id).addEventListener('keydown', function (e) {
        if (e.key === 'Enter') apply();
      });
    });
    $('arcSearch').addEventListener('click', apply);

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

    // 다른 기기가 방금 저장한 기록이 30초 주기를 기다리지 않고 바로 반영되게
    // 수동으로 동기화를 돌린다. 진짜로 놓친 게 있었으면 dkj:records-changed 가
    // 떠서 refreshFromCloud() 가 알아서 다시 그린다.
    $('arcSyncNow').addEventListener('click', function () {
      var btn = $('arcSyncNow');
      if (!(window.DkjCloudSync && window.DkjCloudSync.ready && window.DkjCloudSync.ready())) {
        alert('클라우드 동기화가 꺼져 있습니다 (로그인 상태를 확인하세요).');
        return;
      }
      btn.disabled = true;
      btn.textContent = '⏳ 동기화 중…';
      window.DkjCloudSync.sync().then(function (stats) {
        // "확인 완료"라고만 뜨면 실제로 뭘 받았는지 알 길이 없어서 지연인지 진짜
        // 안 되는 건지 구분이 안 됐다 — 클라우드에 서식이 몇 종 있었고 그중 몇 건을
        // 새로 받았는지(pulled) 숫자로 보여준다.
        var detail = stats
          ? ' (클라우드 ' + (stats.cloudKeyCount || 0) + '종 · 새로 받음 ' + (stats.pulled || 0) + '건)'
          : '';
        btn.textContent = '✅ 확인 완료' + detail;
        setTimeout(function () { btn.textContent = '🔄 지금 동기화'; }, 6000);
      }).catch(function (err) {
        // 실패 이유를 화면에 그대로 보여준다 — "실패"라고만 뜨면 원인을 알 방법이
        // 없어서 사용자도 나도 다음 대응(네트워크 문제인지, 로그인 문제인지)을
        // 판단할 수가 없었다. 사라지는 시간도 길게 둬서 캡처해 알려줄 여유를 준다.
        console.error('[기록보관함] 지금 동기화 실패:', err);
        btn.textContent = '⚠️ 실패: ' + ((err && err.message) || '알 수 없는 오류');
        setTimeout(function () { btn.textContent = '🔄 지금 동기화'; }, 8000);
      }).finally(function () {
        btn.disabled = false;
      });
    });

    // 시스템 관리자(4343) 전용 — 버튼 자체는 data-system-admin 으로 화면에서 숨겨지지만,
    // 콘솔 등으로 직접 눌러도 막히도록 여기서도 한 번 더 확인한다.
    $('arcDelete').addEventListener('click', function () {
      if (!(window.DkjAuth && window.DkjAuth.isSystemAdmin && window.DkjAuth.isSystemAdmin())) {
        alert('시스템 관리자만 기록을 삭제할 수 있습니다.');
        return;
      }
      var picked = view.filter(function (r) { return selected[r.id]; });
      if (!picked.length) { alert('삭제할 기록을 먼저 선택하세요.'); return; }
      if (!confirm(picked.length + '건을 완전히 삭제합니다. 이 작업은 되돌릴 수 없습니다.\n계속할까요?')) return;
      picked.forEach(function (r) { window.DkjRecordStore.remove(r.formId, r.id); });
      selected = {};
      load();
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
    var syncing = window.DkjCloudSync && window.DkjCloudSync.ready && window.DkjCloudSync.ready();
    if (syncing && user) {
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

  // 클라우드에서 다른 기기(태블릿 등)가 저장한 기록이 들어왔을 때 다시 그린다.
  // fillFormOptions()가 <select> 내용을 통째로 새로 그리므로, 사용자가 고른 서식
  // 필터를 그대로 유지해야 화면을 보던 중 필터가 "전체 서식"으로 되돌아가지 않는다.
  function refreshFromCloud() {
    var formSel = $('arcForm');
    var prevForm = formSel ? formSel.value : '';
    all = window.DkjExport.collect();
    fillFormOptions();
    if (formSel && prevForm) formSel.value = prevForm;
    apply();
  }

  bind();
  load();
  // 로그인은 페이지가 로드된 뒤 비동기로 완료된다 — 로그인 직후에도 배지가 갱신되도록 다시 그린다.
  document.addEventListener('dkj:auth-ready', syncPill);
  window.addEventListener('dkj:records-changed', refreshFromCloud);
})();
