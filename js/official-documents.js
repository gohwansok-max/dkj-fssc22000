/* 동김제농협 Google Drive 정본 문서 열람실 */
(function () {
  'use strict';
  var manifest = window.DKJ_DRIVE_DOCUMENTS || { documents: [], counts: {} };
  var docs = Array.isArray(manifest.documents) ? manifest.documents : [];
  var search = document.getElementById('documentSearch');
  var typeFilter = document.getElementById('typeFilter');
  var list = document.getElementById('documentList');
  var count = document.getElementById('documentCount');
  var stats = document.getElementById('officialStats');
  var PAGE_SIZE = 80;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function bytes(value) {
    var n = Number(value || 0);
    if (!n) return '';
    if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + ' KB';
    return (n / (1024 * 1024)).toFixed(n >= 100 * 1024 * 1024 ? 0 : 1) + ' MB';
  }
  function fmtDate(value) {
    if (!value) return '';
    var d = new Date(value);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('ko-KR');
  }
  function typeMatch(doc, wanted) {
    if (wanted === 'all') return true;
    if (wanted === 'pptx') return doc.fileType === 'pptx' || doc.fileType === 'ppt';
    if (wanted === 'xlsx') return doc.fileType === 'xlsx' || doc.fileType === 'xls';
    return doc.fileType === wanted;
  }
  function displayPdf(doc) {
    return doc.fileType === 'pdf' ? doc : (doc.pdf || null);
  }
  function previewUrl(doc) {
    var pdf = displayPdf(doc);
    return pdf ? pdf.previewUrl : doc.previewUrl;
  }
  function printUrl(doc) {
    var pdf = displayPdf(doc);
    return pdf ? pdf.viewUrl : doc.viewUrl;
  }
  function renderStats() {
    if (!stats) return;
    var byType = manifest.counts && manifest.counts.byType || {};
    stats.innerHTML = '<span>총 ' + esc(docs.length) + '건</span>' +
      '<span>PDF ' + esc(byType.pdf || 0) + '건</span>' +
      '<span>원본 ' + esc(docs.length - (byType.pdf || 0)) + '건</span>';
  }
  function render() {
    var query = (search && search.value || '').trim().toLowerCase();
    var wanted = typeFilter && typeFilter.value || 'all';
    var filtered = docs.filter(function (doc) {
      if (!typeMatch(doc, wanted)) return false;
      if (!query) return true;
      return [doc.name, doc.title, doc.code, doc.category, doc.relativePath, doc.fileTypeLabel]
        .join(' ').toLowerCase().indexOf(query) !== -1;
    });
    if (count) count.textContent = '검색 결과 ' + filtered.length + '건 · 처음 ' + Math.min(filtered.length, PAGE_SIZE) + '건을 표시합니다.';
    if (!filtered.length) {
      list.innerHTML = '<div class="empty-docs">조건에 맞는 문서가 없습니다. 검색어 또는 파일 형식을 바꿔 보세요.</div>';
      return;
    }
    list.innerHTML = filtered.slice(0, PAGE_SIZE).map(function (doc) {
      var pdf = displayPdf(doc);
      var safeName = esc(doc.title || doc.name);
      var code = doc.code ? '<span class="official-code">' + esc(doc.code) + '</span>' : '';
      var paired = doc.pdf ? '<span class="pdf-paired">PDF 정본 연결됨</span>' : '';
      var previewLabel = pdf ? (doc.fileType === 'pdf' ? 'PDF 열람' : 'PDF 정본') : '원본 열람';
      var printLabel = pdf ? '인쇄' : '새 탭 열기';
      return '<article class="official-row">' +
        '<div class="official-main"><div class="official-title">' + code + '<h2>' + safeName + '</h2></div>' +
        '<p class="official-path" title="' + esc(doc.relativePath) + '">' + esc(doc.relativePath) + '</p>' +
        '<div class="official-meta"><span class="format-badge ' + esc(doc.fileType) + '">' + esc(doc.fileTypeLabel) + '</span>' + paired +
        '<span class="doc-meta">' + esc(bytes(doc.size)) + (fmtDate(doc.modifiedTime) ? ' · ' + esc(fmtDate(doc.modifiedTime)) : '') + '</span></div></div>' +
        '<div class="official-actions">' +
        '<a class="pill-btn green" href="' + esc(previewUrl(doc)) + '" target="_blank" rel="noopener">' + previewLabel + '</a>' +
        '<a class="pill-btn ghost" href="' + esc(doc.downloadUrl) + '" target="_blank" rel="noopener">원본 다운로드</a>' +
        '<a class="pill-btn ghost" href="' + esc(printUrl(doc)) + '" target="_blank" rel="noopener">' + printLabel + '</a>' +
        '</div></article>';
    }).join('');
    if (filtered.length > PAGE_SIZE) {
      list.insertAdjacentHTML('beforeend', '<div class="empty-docs">검색 결과가 많아 처음 ' + PAGE_SIZE + '건만 표시했습니다. 문서번호 또는 제목으로 검색해 주세요.</div>');
    }
  }
  if (search) search.addEventListener('input', render);
  if (typeFilter) typeFilter.addEventListener('change', render);
  renderStats();
  render();
})();
