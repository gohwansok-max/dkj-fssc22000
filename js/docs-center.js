/**
 * 동김제 문서센터 — 목록·검색·필터
 */
(function () {
  'use strict';

  var catalog = null;
  var activeCategory = 'procedure';
  var searchQuery = '';
  var statusFilter = 'all';

  /* 정본 PDF 가 연결된 문서 코드 모음.
     카탈로그의 '완료'는 문서관리대장 기준(문서 자체가 제정 완료)이라, 시스템에 원문이
     올라와 있는지와는 별개다. 그 둘이 같은 뜻으로 보이면 사용자는 143건 전부 열람
     가능하다고 여기고 들어갔다가 'PDF가 아직 없습니다'를 만난다. 목록에서 미리 구분한다. */
  var pdfSet = null;
  var driveSet = null;

  var listEl = document.getElementById('docList');
  var countEl = document.getElementById('docCount');
  var searchEl = document.getElementById('docSearch');
  var filterEl = document.getElementById('docStatusFilter');
  var sidebarEl = document.getElementById('docsSidebar');

  function statusClass(s) {
    return s === '완료' ? 'done' : 'wip';
  }

  function catCount(cat) {
    if (typeof cat.count === 'number') return cat.count;
    if (!catalog || !catalog.documents) return 0;
    return catalog.documents.filter(function (d) { return d.category === cat.id; }).length;
  }

  function fileTypeLabel(t) {
    return (t || 'file').toUpperCase();
  }

  function hasPdf(doc) {
    if (!pdfSet) return false;   // 아직 안 읽혔으면 없는 쪽으로 — 읽히면 다시 그린다
    return pdfSet[doc.id] === true || pdfSet[doc.code] === true;
  }

  function hasDrive(doc) {
    if (!driveSet) return false;
    return driveSet[doc.id] === true || driveSet[doc.code] === true;
  }

  /** pdf-manifest 와 doc-assets 를 한 번만 읽어 '정본 PDF 있는 문서' 색인을 만든다. */
  function loadPdfIndex() {
    if (!window.DkjLinks || !DkjLinks.pdfIndex) return Promise.resolve({});
    return DkjLinks.pdfIndex().catch(function () { return {}; });
  }

  function renderSidebar() {
    if (!sidebarEl || !catalog) return;
    sidebarEl.innerHTML = catalog.categories.map(function (cat) {
      var cls = cat.id === activeCategory ? 'active' : '';
      var stCls = statusClass(cat.workflowStatus);
      var n = catCount(cat);
      return '<button type="button" class="' + cls + '" data-cat="' + cat.id + '">' +
        '<span>' + cat.icon + ' ' + cat.label + ' <small style="opacity:.7;">(' + n + ')</small></span>' +
        '<span class="cat-status ' + stCls + '">' + cat.workflowStatus + '</span>' +
        '</button>';
    }).join('');

    sidebarEl.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeCategory = btn.getAttribute('data-cat');
        renderSidebar();
        renderList();
        updateCategoryHead();
      });
    });
  }

  function updateCategoryHead() {
    var cat = catalog.categories.find(function (c) { return c.id === activeCategory; });
    var head = document.getElementById('categoryHead');
    if (head && cat) {
      head.innerHTML = '<h2>' + cat.icon + ' ' + cat.label + ' <small style="font-weight:500;color:#666;">(' + cat.code + ')</small></h2>' +
        '<p style="margin:6px 0 0;color:#666;font-size:14px;">' + cat.description + '</p>';
    }
  }

  function filteredDocs() {
    return catalog.documents.filter(function (doc) {
      if (doc.category !== activeCategory) return false;
      if (statusFilter !== 'all' && doc.workflowStatus !== statusFilter) return false;
      if (!searchQuery) return true;
      var hay = [doc.code, doc.title, (doc.tags || []).join(' '), (doc.highlights || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(searchQuery) !== -1;
    });
  }

  function renderList() {
    if (!listEl || !catalog) return;
    var docs = filteredDocs();
    if (countEl) {
      countEl.textContent = '총 ' + docs.length + '건';
    }

    if (!docs.length) {
      listEl.innerHTML = '<div class="docs-empty">검색 조건에 맞는 문서가 없습니다.</div>';
      return;
    }

    listEl.innerHTML = docs.map(function (doc) {
      var st = statusClass(doc.workflowStatus);
      var tags = (doc.tags || []).map(function (t) {
        return '<span class="doc-tag">' + t + '</span>';
      }).join('');

      var frLink = '';
      if (doc.category === 'procedure') {
        frLink = '<a class="link-chip sm" href="records-center.html?procedure=' + encodeURIComponent(doc.id) + '">FR 보기</a>';
      } else if (doc.category === 'form') {
        frLink = '<a class="link-chip sm" href="records-center.html">기록센터</a>';
      } else if (doc.category === 'prp_form' || doc.category === 'haccp') {
        frLink = '<a class="link-chip sm" href="records-center.html?cat=daily">현장기록</a>';
      }

      return '<article class="doc-row">' +
        '<div class="doc-row-main">' +
          '<h3><span class="doc-code">' + doc.code + '</span> ' + doc.title +
          ' <span class="doc-rev">' + doc.rev + '</span></h3>' +
          '<div class="doc-tags">' + tags + frLink + '</div>' +
        '</div>' +
        '<div class="doc-actions">' +
          '<span class="badge ' + st + '">' + doc.workflowStatus + '</span>' +
          '<span class="badge type">' + fileTypeLabel(doc.fileType) + '</span>' +
          (hasPdf(doc)
            ? '<span class="badge pdf-ok" title="Google Drive의 PDF 정본을 바로 볼 수 있습니다">정본 PDF</span>'
            : hasDrive(doc)
              ? '<span class="badge pdf-ok" title="Google Drive 원본을 바로 볼 수 있습니다">Drive 원본</span>'
              : '<span class="badge pdf-none" title="연결된 원본 또는 PDF가 없습니다. 요약만 볼 수 있습니다">요약만</span>') +
          '<a class="pill-btn green" href="doc-viewer.html?id=' + encodeURIComponent(doc.id) + '">열람</a>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function bindToolbar() {
    if (searchEl) {
      searchEl.addEventListener('input', function () {
        searchQuery = (searchEl.value || '').trim().toLowerCase();
        renderList();
      });
    }
    if (filterEl) {
      filterEl.addEventListener('change', function () {
        statusFilter = filterEl.value;
        renderList();
      });
    }

    var params = new URLSearchParams(window.location.search);
    var cat = params.get('cat');
    if (cat) activeCategory = cat;
  }

  function renderStatusRow() {
    var row = document.getElementById('docsStatusRow');
    if (!row || !catalog) return;
    var source = catalog.sourceLabel ? ' · ' + catalog.sourceLabel : '';
    row.innerHTML =
      '<span class="status-pill done">FSSC22000 V6' + source + ' · 총 ' + (catalog.documents || []).length + '건</span>' +
      catalog.categories.map(function (cat) {
        var st = statusClass(cat.workflowStatus);
        return '<span class="status-pill ' + st + '">' + cat.label + ' ' + catCount(cat) + ' · ' + cat.workflowStatus + '</span>';
      }).join('');
  }

  function loadDocCatalog() {
    if (window.DKJ_DOC_CATALOG) return Promise.resolve(window.DKJ_DOC_CATALOG);
    return fetch('data/doc-catalog.json')
      .then(function (r) {
        if (!r.ok) throw new Error('doc-catalog');
        return r.json();
      })
      .catch(function () {
        return new Promise(function (resolve, reject) {
          var s = document.createElement('script');
          s.src = 'js/doc-catalog.bundle.js';
          s.onload = function () {
            window.DKJ_DOC_CATALOG ? resolve(window.DKJ_DOC_CATALOG) : reject(new Error('bundle empty'));
          };
          s.onerror = function () { reject(new Error('bundle fail')); };
          document.head.appendChild(s);
        });
      });
  }

  loadDocCatalog()
    .then(function (data) {
      catalog = data;
      bindToolbar();
      renderStatusRow();
      renderSidebar();
      updateCategoryHead();
      renderList();
      // 정본 PDF 색인은 목록보다 늦게 와도 된다 — 도착하면 뱃지만 다시 그린다
      Promise.all([
        loadPdfIndex(),
        window.DkjLinks && DkjLinks.driveIndex ? DkjLinks.driveIndex().catch(function () { return {}; }) : Promise.resolve({})
      ]).then(function (res) {
        pdfSet = res[0];
        driveSet = res[1];
        renderList();
      });
    })
    .catch(function (err) {
      console.error(err);
      if (listEl) {
        listEl.innerHTML = '<div class="docs-empty">문서 목록을 불러오지 못했습니다. <code>run_server.bat</code>로 열거나 새로고침 하세요.</div>';
      }
    });
})();
