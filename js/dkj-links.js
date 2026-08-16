/**
 * 동김제 포털 — 문서↔기록 상호링크·PDF 매니페스트
 * file:// 에서도 동작: JSON fetch 실패 시 *.bundle.js 폴백
 */
(function (global) {
  'use strict';

  var cache = { records: null, docs: null, pdf: null, assets: null, drive: null };

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

  /** Google Drive 정본 문서 매니페스트. 기존 로컬 PDF가 없어도 Drive PDF를 우선 사용한다. */
  function loadDriveDocuments() {
    if (cache.drive) return Promise.resolve(cache.drive);
    if (global.DKJ_DRIVE_DOCUMENTS) {
      cache.drive = global.DKJ_DRIVE_DOCUMENTS;
      return Promise.resolve(cache.drive);
    }
    return fetchJson('data/drive-document-manifest.json').then(function (d) {
      cache.drive = d;
      return d;
    }).catch(function () {
      return loadScriptBundle('js/drive-document-manifest.bundle.js', 'DKJ_DRIVE_DOCUMENTS', { documents: [] }).then(function (d) {
        cache.drive = d;
        return d;
      });
    });
  }

  function driveDocumentFor(docId, docCode) {
    return loadDriveDocuments().then(function (manifest) {
      var wanted = String(docCode || docId || '').toUpperCase();
      var matches = (manifest.documents || []).filter(function (doc) {
        return String(doc.code || '').toUpperCase() === wanted || doc.id === docId;
      });
      if (!matches.length) return null;
      return matches.find(function (doc) { return doc.fileType !== 'pdf' && doc.pdf; }) ||
        matches.find(function (doc) { return doc.fileType === 'pdf'; }) || matches[0];
    });
  }

  function getPdfPath(docId, docCode) {
    return driveDocumentFor(docId, docCode).then(function (driveDoc) {
      if (driveDoc) {
        var pdf = driveDoc.fileType === 'pdf' ? driveDoc : driveDoc.pdf;
        if (pdf && pdf.previewUrl) return pdf.previewUrl;
      }
      return Promise.all([loadPdfManifest(), loadDocAssets()]).then(function (res) {
        var m = res[0];
        var a = res[1];
        var hit = (m.files || []).find(function (f) { return f.id === docId || f.id === docCode; });
        if (hit && hit.pdf) return hit.pdf;
        var byMap = (a.map || {})[docId] || (a.map || {})[docCode];
        return byMap && byMap.pdf ? byMap.pdf : null;
      });
    });
  }

  /**
   * 정본 PDF 가 있는 문서의 id·code 를 한 번에 모아 { 'DKJ-P-01': true, … } 로 돌려준다.
   * 목록 화면이 문서 143건마다 getPdfPath 를 부르지 않아도 되게 하기 위함
   * (읽는 파일은 어차피 매니페스트·자산 두 개뿐이라 한 번이면 된다).
   */
  function pdfIndex() {
    return Promise.all([loadPdfManifest(), loadDocAssets(), loadDriveDocuments()]).then(function (res) {
      var out = {};
      ((res[0] && res[0].files) || []).forEach(function (f) {
        if (f && f.id && f.pdf) out[f.id] = true;
      });
      var map = (res[1] && res[1].map) || {};
      Object.keys(map).forEach(function (k) {
        if (map[k] && map[k].pdf) out[k] = true;
      });
      ((res[2] && res[2].documents) || []).forEach(function (doc) {
        if (!doc || !doc.code) return;
        if (doc.fileType === 'pdf' || doc.pdf) out[doc.code] = true;
      });
      return out;
    });
  }

  /** Drive에 원본 또는 PDF가 있는 문서 코드의 색인. */
  function driveIndex() {
    return loadDriveDocuments().then(function (manifest) {
      var out = {};
      (manifest.documents || []).forEach(function (doc) {
        if (doc && doc.code) out[doc.code] = true;
      });
      return out;
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
    loadDriveDocuments: loadDriveDocuments,
    driveDocumentFor: driveDocumentFor,
    getPdfPath: getPdfPath,
    pdfIndex: pdfIndex,
    driveIndex: driveIndex,
    recordsForProcedure: recordsForProcedure,
    proceduresForRecord: proceduresForRecord,
    sopsForRecord: sopsForRecord,
    renderLinkChips: renderLinkChips
  };
})(window);
