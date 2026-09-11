/**
 * 동김제 기록양식센터 — FR 목록·검색
 */
(function () {
  'use strict';

  var catalog = null;
  var activeCategory = 'all';
  var searchQuery = '';
  var freqFilter = 'all';

  var listEl = document.getElementById('recordList');
  var countEl = document.getElementById('recordCount');
  var searchEl = document.getElementById('recordSearch');
  var freqEl = document.getElementById('recordFreqFilter');
  var sidebarEl = document.getElementById('recordsSidebar');

  function renderSidebar() {
    if (!sidebarEl || !catalog) return;
    var allBtn = '<button type="button" class="' + (activeCategory === 'all' ? 'active' : '') + '" data-cat="all"><span>📚 전체 FR</span><span class="cat-status done">' + catalog.records.length + '</span></button>';
    var cats = catalog.categories.map(function (cat) {
      var cls = cat.id === activeCategory ? 'active' : '';
      return '<button type="button" class="' + cls + '" data-cat="' + cat.id + '"><span>' + cat.icon + ' ' + cat.label + '</span><span class="cat-status done">' + cat.codes.length + '</span></button>';
    }).join('');
    sidebarEl.innerHTML = allBtn + cats;

    sidebarEl.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeCategory = btn.getAttribute('data-cat');
        renderSidebar();
        renderList();
        updateHead();
      });
    });
  }

  function updateHead() {
    var head = document.getElementById('categoryHead');
    if (!head) return;
    if (activeCategory === 'all') {
      head.innerHTML = '<h2>📋 기록양식 FR</h2><p style="margin:6px 0 0;color:#666;font-size:14px;">절차서·SOP와 연결된 현장 작성 양식</p>';
      return;
    }
    var cat = catalog.categories.find(function (c) { return c.id === activeCategory; });
    if (cat) {
      head.innerHTML = '<h2>' + cat.icon + ' ' + cat.label + '</h2><p style="margin:6px 0 0;color:#666;font-size:14px;">' + cat.codes.join(', ') + '</p>';
    }
  }

  function categoryCodes() {
    if (activeCategory === 'all') return null;
    var cat = catalog.categories.find(function (c) { return c.id === activeCategory; });
    return cat ? cat.codes : null;
  }

  function filtered() {
    var codes = categoryCodes();
    return catalog.records.filter(function (rec) {
      if (codes && codes.indexOf(rec.code) === -1) return false;
      if (freqFilter !== 'all' && (rec.period || '').indexOf(freqFilter) !== 0) return false;
      if (!searchQuery) return true;
      var hay = [rec.code, rec.title, rec.summary || ''].join(' ').toLowerCase();
      return hay.indexOf(searchQuery) !== -1;
    });
  }

  function renderList() {
    if (!listEl || !catalog) return;
    var items = filtered();
    if (countEl) countEl.textContent = '총 ' + items.length + '건';

    if (!items.length) {
      listEl.innerHTML = '<div class="docs-empty">검색 조건에 맞는 양식이 없습니다.</div>';
      return;
    }

    listEl.innerHTML = items.map(function (rec) {
      var rev = rec.rev ? ' <span class="doc-rev">' + rec.rev + '</span>' : '';

      return '<article class="doc-row">' +
        '<div class="doc-row-main">' +
          '<h3><span class="doc-code">' + rec.code + '</span> ' + rec.title + rev + '</h3>' +
          '<div class="doc-tags"><span class="doc-tag">' + (rec.period || '') + '</span></div>' +
        '</div>' +
        '<div class="doc-actions"><span class="badge done">HTML</span>' +
          '<a class="pill-btn green" href="' + rec.file + '">작성</a>' +
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
    if (freqEl) {
      freqEl.addEventListener('change', function () {
        freqFilter = freqEl.value;
        renderList();
      });
    }
    var params = new URLSearchParams(window.location.search);
    var cat = params.get('cat');
    if (cat) activeCategory = cat;
    var proc = params.get('procedure');
    if (proc) window.__filterProcedure = proc;
  }

  function loadRecordCatalog() {
    if (window.DKJ_RECORD_CATALOG) return Promise.resolve(window.DKJ_RECORD_CATALOG);
    return fetch('data/record-catalog.json')
      .then(function (r) {
        if (!r.ok) throw new Error('record-catalog');
        return r.json();
      })
      .catch(function () {
        return new Promise(function (resolve, reject) {
          var s = document.createElement('script');
          s.src = 'js/record-catalog.bundle.js';
          s.onload = function () {
            window.DKJ_RECORD_CATALOG ? resolve(window.DKJ_RECORD_CATALOG) : reject(new Error('bundle'));
          };
          s.onerror = function () { reject(new Error('bundle')); };
          document.head.appendChild(s);
        });
      });
  }

  loadRecordCatalog()
    .then(function (data) {
      catalog = data;
      if (window.__filterProcedure) {
        var p = window.__filterProcedure;
        catalog.records = catalog.records.filter(function (rec) {
          return (rec.relatedProcedures || []).indexOf(p) !== -1;
        });
        var head = document.getElementById('recordsHeroNote');
        if (head) head.textContent = p + ' 관련 기록양식만 표시 중';
      }
      bindToolbar();
      renderSidebar();
      updateHead();
      renderList();
    })
    .catch(function () {
      if (listEl) listEl.innerHTML = '<div class="docs-empty">기록 목록을 불러오지 못했습니다.</div>';
    });
})();
