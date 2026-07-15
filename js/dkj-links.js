/**
 * 동김제 포털 — 문서↔기록 상호링크·PDF 매니페스트
 * file:// 에서도 동작: JSON fetch 실패 시 *.bundle.js 폴백
 */
(function (global) {
  'use strict';

  var cache = { records: null, docs: null, pdf: null, assets: null };

  function fetchJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url);
      return r.json();
    });
  }

  function loadScriptBundle(src, globalKey, emptyVal) {
    if (global[globalKey]) return Promise.resolve(global[globalKey]);
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () {
        resolve(global[globalKey] || emptyVal);
      };
      s.onerror = function () {
        resolve(emptyVal);
      };
      document.head.appendChild(s);
    });
  }

  function loadRecords() {
    if (cache.records) return Promise.resolve(cache.records);
    if (global.DKJ_RECORD_CATALOG) {
      cache.records = global.DKJ_RECORD_CATALOG;
      return Promise.resolve(cache.records);
    }
    return fetchJson('data/record-catalog.json').then(function (d) {
      cache.records = d;
      return d;
    }).catch(function () {
      return loadScriptBundle('js/record-catalog.bundle.js', 'DKJ_RECORD_CATALOG', { records: [] }).then(function (d) {
        cache.records = d;
        return d;
      });
    });
  }

  function loadDocs() {
    if (cache.docs) return Promise.resolve(cache.docs);
    if (global.DKJ_DOC_CATALOG) {
      cache.docs = global.DKJ_DOC_CATALOG;
      return Promise.resolve(cache.docs);
    }
    return fetchJson('data/doc-catalog.json').then(function (d) {
      cache.docs = d;
      return d;
    }).catch(function () {
      return loadScriptBundle('js/doc-catalog.bundle.js', 'DKJ_DOC_CATALOG', { documents: [], categories: [] }).then(function (d) {
        cache.docs = d;
        return d;
      });
    });
  }

  function loadPdfManifest() {
    if (cache.pdf) return Promise.resolve(cache.pdf);
    if (global.DKJ_PDF_MANIFEST) {
      cache.pdf = global.DKJ_PDF_MANIFEST;
      return Promise.resolve(cache.pdf);
    }
    return fetchJson('data/pdf-manifest.json').then(function (d) {
      cache.pdf = d;
      return d;
    }).catch(function () {
      return loadScriptBundle('js/pdf-manifest.bundle.js', 'DKJ_PDF_MANIFEST', { files: [] }).then(function (d) {
        cache.pdf = d;
        return d;
      });
    });
  }

  function loadDocAssets() {
    if (cache.assets) return Promise.resolve(cache.assets);
    if (global.DKJ_DOC_ASSETS) {
      cache.assets = global.DKJ_DOC_ASSETS;
      return Promise.resolve(cache.assets);
    }
    return fetchJson('data/doc-assets.json').then(function (d) {
      cache.assets = d;
      return d;
    }).catch(function () {
      return loadScriptBundle('js/doc-assets.bundle.js', 'DKJ_DOC_ASSETS', { map: {} }).then(function (d) {
        cache.assets = d;
        return d;
      });
    });
  }

  function getPdfPath(docId, docCode) {
    return Promise.all([loadPdfManifest(), loadDocAssets()]).then(function (res) {
      var m = res[0];
      var a = res[1];
      var hit = (m.files || []).find(function (f) { return f.id === docId || f.id === docCode; });
      if (hit && hit.pdf) return hit.pdf;
      var byMap = (a.map || {})[docId] || (a.map || {})[docCode];
      return byMap && byMap.pdf ? byMap.pdf : null;
    });
  }

  function recordsForProcedure(procId) {
    return loadRecords().then(function (cat) {
      return (cat.records || []).filter(function (r) {
        return (r.relatedProcedures || []).indexOf(procId) !== -1;
      });
    });
  }

  function proceduresForRecord(recordId) {
    return Promise.all([loadRecords(), loadDocs()]).then(function (res) {
      var rec = (res[0].records || []).find(function (r) { return r.id === recordId; });
      if (!rec) return [];
      var ids = rec.relatedProcedures || [];
      return (res[1].documents || []).filter(function (d) { return ids.indexOf(d.id) !== -1; });
    });
  }

  function sopsForRecord(recordId) {
    return Promise.all([loadRecords(), loadDocs()]).then(function (res) {
      var rec = (res[0].records || []).find(function (r) { return r.id === recordId; });
      if (!rec || !rec.relatedSops) return [];
      return (res[1].documents || []).filter(function (d) {
        return (rec.relatedSops || []).indexOf(d.id) !== -1;
      });
    });
  }

  function renderLinkChips(items, hrefFn, labelFn) {
    if (!items.length) return '<span class="doc-tag">연결 없음</span>';
    return items.map(function (item) {
      return '<a class="link-chip" href="' + hrefFn(item) + '">' + labelFn(item) + '</a>';
    }).join('');
  }

  global.DkjLinks = {
    loadRecords: loadRecords,
    loadDocs: loadDocs,
    loadPdfManifest: loadPdfManifest,
    loadDocAssets: loadDocAssets,
    getPdfPath: getPdfPath,
    recordsForProcedure: recordsForProcedure,
    proceduresForRecord: proceduresForRecord,
    sopsForRecord: sopsForRecord,
    renderLinkChips: renderLinkChips
  };
})(window);
