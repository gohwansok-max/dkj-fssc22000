/**
 * 동김제 마스터 데이터 — 제품 8종·공정흐름·LOT
 */
(function (global) {
  'use strict';

  var cache = { products: null, process: null };

  function dataPath(file) {
    var path = location.pathname || '';
    var inRecords = path.indexOf('/records/') !== -1 || path.indexOf('\\records\\') !== -1;
    return (inRecords ? '../data/' : 'data/') + file;
  }

  function loadProducts() {
    if (cache.products) return Promise.resolve(cache.products);
    return fetch(dataPath('products.json')).then(function (r) { return r.json(); }).then(function (d) {
      cache.products = d;
      return d;
    });
  }

  function loadProcess() {
    if (cache.process) return Promise.resolve(cache.process);
    return fetch(dataPath('process-line.json')).then(function (r) { return r.json(); }).then(function (d) {
      cache.process = d;
      return d;
    });
  }

  function suggestLot(dateStr) {
    var d = dateStr || new Date().toISOString().slice(0, 10);
    var compact = d.replace(/-/g, '');
    var seq = String(Math.floor(Math.random() * 900) + 100);
    return compact + '-' + seq;
  }

  function renderProcessBar(containerId, activeStepId) {
    return loadProcess().then(function (proc) {
      var el = document.getElementById(containerId);
      if (!el) return;
      el.innerHTML = '<div class="process-bar" role="list">' + proc.steps.map(function (step, i) {
        var cls = 'process-step';
        if (step.id === activeStepId) cls += ' active';
        if (step.ccp) cls += ' ccp';
        var tag = step.ccp ? '<span class="process-ccp">' + (step.ccpCode || 'CCP') + '</span>' : '';
        return '<div class="' + cls + '" role="listitem" title="' + step.label + '">' +
          '<span class="process-num">' + (i + 1) + '</span>' +
          '<span class="process-label">' + step.label + '</span>' + tag + '</div>';
      }).join('') + '</div>';
    });
  }

  function renderProductChips(containerId, onSelect, selectedCode) {
    return loadProducts().then(function (data) {
      var el = document.getElementById(containerId);
      if (!el) return data;
      el.innerHTML = data.finishedProducts.map(function (p) {
        var on = selectedCode === p.code ? ' on' : '';
        return '<button type="button" class="product-chip' + on + '" data-code="' + p.code + '" data-name="' + p.name + '">' + p.name + '</button>';
      }).join('');
      el.querySelectorAll('.product-chip').forEach(function (btn) {
        btn.addEventListener('click', function () {
          el.querySelectorAll('.product-chip').forEach(function (b) { b.classList.remove('on'); });
          btn.classList.add('on');
          if (onSelect) onSelect(btn.getAttribute('data-code'), btn.getAttribute('data-name'));
        });
      });
      return data;
    });
  }

  function renderRawPresets(containerId, onSelect) {
    return loadProducts().then(function (data) {
      var el = document.getElementById(containerId);
      if (!el) return;
      el.innerHTML = data.rawMaterialPresets.map(function (p) {
        return '<button type="button" class="preset-chip" data-json="' + encodeURIComponent(JSON.stringify(p)) + '">' + p.name + '</button>';
      }).join('');
      el.querySelectorAll('.preset-chip').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var preset = JSON.parse(decodeURIComponent(btn.getAttribute('data-json')));
          if (onSelect) onSelect(preset);
        });
      });
    });
  }

  function productNameByCode(code) {
    if (!cache.products || !code) return '';
    var p = cache.products.finishedProducts.find(function (x) { return x.code === code; });
    return p ? p.name : '';
  }

  function listFr014ForSelect() {
    if (!global.DkjRecordStore) return [];
    return DkjRecordStore.list('FR-014').filter(function (r) {
      return r.judge === '부적합' || r.action === '격리' || r.action === '반품' || r.action === '폐기';
    });
  }

  global.DkjMaster = {
    loadProducts: loadProducts,
    loadProcess: loadProcess,
    suggestLot: suggestLot,
    renderProcessBar: renderProcessBar,
    renderProductChips: renderProductChips,
    renderRawPresets: renderRawPresets,
    productNameByCode: productNameByCode,
    listFr014ForSelect: listFr014ForSelect
  };
})(window);
