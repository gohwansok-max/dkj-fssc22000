/**
 * MDR-001 Rev4 전체 등록대장 뷰어
 * 3버튼: 인라인 PDF / 새 탭 / 원본 다운로드
 */
(function () {
  'use strict';

  var catalog = null;
  var assets = {};
  var filter = 'all';
  var q = '';

  function $(id) { return document.getElementById(id); }

  function showError(msg) {
    var list = $('mdrList');
    var count = $('mdrCount');
    if (count) count.textContent = '로드 실패';
    if (list) list.innerHTML = '<div class="viewer-notice" style="margin:0;">' + msg + '</div>';
  }

  function loadCatalog() {
    if (window.DKJ_MDR_CATALOG) return Promise.resolve(window.DKJ_MDR_CATALOG);
    return fetch('data/mdr-catalog.json').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).catch(function () {
      return new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = 'js/mdr-catalog.bundle.js';
        s.onload = function () { window.DKJ_MDR_CATALOG ? resolve(window.DKJ_MDR_CATALOG) : reject(new Error('bundle empty')); };
        s.onerror = function () { reject(new Error('bundle load failed')); };
        document.head.appendChild(s);
      });
    });
  }

  function loadAssets() {
    if (window.DKJ_DOC_ASSETS) {
      assets = window.DKJ_DOC_ASSETS.map || {};
      return Promise.resolve();
    }
    return fetch('data/doc-assets.json').then(function (r) { return r.json(); }).then(function (d) {
      assets = d.map || {};
    }).catch(function () {
      assets = {};
    });
  }

  function renderStats() {
    var el = $('mdrStats');
    if (!el || !catalog) return;
    el.innerHTML =
      '<span class="status-pill done">MDR-001 ' + catalog.mdrRev + '</span>' +
      '<span class="status-pill done">' + catalog.entryCount + '건 등록</span>' +
      '<span class="status-pill done">파싱 ' + catalog.parsedAt + '</span>';
  }

  function filtered() {
    return catalog.entries.filter(function (e) {
      if (filter !== 'all' && e.category !== filter) return false;
      if (!q) return true;
      var hay = [e.code, e.id, e.title, e.filePath, e.related, e.note].join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  function portalLink(e) {
    var htmlForms = {
      'DKJ-S-02-01': 1, 'DKJ-S-02-02': 1, 'DKJ-S-02-03': 1, 'DKJ-S-02-04': 1,
      'DKJ-S-02-05': 1, 'DKJ-S-02-06': 1, 'DKJ-S-02-07': 1, 'DKJ-S-02-12': 1,
      'DKJ-S-02-13': 1, 'DKJ-S-02-18': 1, 'DKJ-S-02-29': 1, 'DKJ-STORE-01': 1,
      'DKJ-H-01-01': 1, 'DKJ-H-01-02': 1
    };
    var code = e.code || e.id;
    if (htmlForms[code]) return 'records/' + code + '.html';
    if (e.category === 'procedure' || e.category === 'sop' || e.category === 'processmap' ||
        e.category === 'mdr' || e.category === 'manual' ||
        (e.code && /^(DKJ-P|DKJ-W|DKJ-M|PRP|DKJ-H|EDU|PM|MDR|DOC)/i.test(e.code))) {
      return 'doc-viewer.html?id=' + encodeURIComponent(e.code || e.id);
    }
    if (e.category === 'record' || (e.id && e.id.indexOf('FR-') === 0) || (e.code && e.code.indexOf('DKJ-F-') === 0)) {
      if (e.id === 'FR-014' || e.code === 'DKJ-F-014' || code === 'FR-014') return 'records/FR-014.html';
      if (e.id === 'FR-015' || e.code === 'DKJ-F-015' || code === 'FR-015') return 'records/FR-015.html';
      return 'record-viewer.html?id=' + encodeURIComponent(e.id || e.code);
    }
    return 'doc-viewer.html?id=' + encodeURIComponent(e.code || e.id);
  }

  function actionButtons(e) {
    var link = portalLink(e);
    var a = assets[e.code] || assets[e.id] || {};
    var arr = [];
    if (link) arr.push('<a class="pill-btn green" href="' + link + '">열람</a>');
    if (a.pdf) {
      arr.push('<a class="pill-btn ghost" href="' + a.pdf + '" target="_blank" rel="noopener">PDF 새탭</a>');
      arr.push('<a class="pill-btn ghost" href="doc-viewer.html?id=' + encodeURIComponent(e.code) + '&tab=pdf">인라인</a>');
    }
    if (a.source) arr.push('<a class="pill-btn ghost" href="' + a.source + '" target="_blank" rel="noopener">원본</a>');
    if (!arr.length) arr.push('<span class="doc-tag">연결대기</span>');
    return arr.join('');
  }

  function renderList() {
    var list = $('mdrList');
    var count = $('mdrCount');
    var items = filtered();
    if (count) count.textContent = '표시 ' + items.length + '건 / 전체 ' + catalog.entryCount + '건';

    if (!items.length) {
      list.innerHTML = '<div class="docs-empty">검색 결과 없음</div>';
      return;
    }

    list.innerHTML = items.map(function (e) {
      return '<article class="doc-row">' +
        '<div class="doc-row-main">' +
          '<h3><span class="doc-code">' + e.code + '</span> ' + (e.title || e.id) + ' <span class="doc-rev">' + e.rev + '</span></h3>' +
          '<div class="doc-tags"><span class="doc-tag">' + e.docType + '</span><span class="badge done">' + e.status + '</span></div>' +
          (e.filePath ? '<p style="font-size:11px;color:#888;margin:6px 0 0;word-break:break-all;">' + e.filePath + '</p>' : '') +
        '</div>' +
        '<div class="doc-actions">' + actionButtons(e) + '</div>' +
      '</article>';
    }).join('');
  }

  function bindSidebar() {
    var cats = [
      { id: 'all', label: '전체', icon: '📚' },
      { id: 'procedure', label: '절차서 DKJ-P', icon: '📗' },
      { id: 'record', label: '기록 DKJ-F/FR', icon: '📝' },
      { id: 'sop', label: 'SOP WI', icon: '📙' },
      { id: 'processmap', label: '프로세스맵 PM', icon: '🗺️' },
      { id: 'mdr', label: 'MDR·DOC', icon: '📋' },
      { id: 'manual', label: '매뉴얼', icon: '📘' }
    ];
    var el = $('mdrSidebar');
    if (!el) return;
    el.innerHTML = cats.map(function (c) {
      return '<button type="button" class="' + (filter === c.id ? 'active' : '') + '" data-f="' + c.id + '">' + c.icon + ' ' + c.label + '</button>';
    }).join('');
    el.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        filter = btn.getAttribute('data-f');
        bindSidebar();
        renderList();
      });
    });
  }

  function init() {
    Promise.all([loadCatalog(), loadAssets()]).then(function (res) {
      catalog = res[0];
      if (!catalog || !catalog.entries || !catalog.entries.length) throw new Error('MDR empty');
      renderStats();
      bindSidebar();
      var search = $('mdrSearch');
      if (search) search.addEventListener('input', function () { q = (search.value || '').trim().toLowerCase(); renderList(); });
      renderList();
    }).catch(function (err) {
      console.error(err);
      showError('MDR 목록을 불러오지 못했습니다. 새로고침 후 다시 시도하세요.');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
