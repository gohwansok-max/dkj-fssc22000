/* Print-only dash placeholders for daily logs. This file is included only by daily-log pages. */
(function (global) {
  'use strict';

  var DAILY_FORM_CODES = {
    'DKJ-QC-001': 1,
    'DKJ-S-02-01': 1,
    'DKJ-S-02-03': 1,
    'DKJ-S-02-04': 1,
    'DKJ-S-02-05': 1,
    'DKJ-S-02-06': 1,
    'DKJ-S-02-09': 1,
    'DKJ-S-02-12': 1,
    'DKJ-S-02-32': 1,
    'DKJ-H-01-01': 1,
    'DKJ-H-01-02': 1,
    'DKJ-F-053': 1
  };

  function currentFormCode() {
    var pathname = (global.location && global.location.pathname) || '';
    var file = pathname.substring(pathname.lastIndexOf('/') + 1).replace(/\?.*$/, '');
    return file.replace(/\.html?$/i, '').toUpperCase();
  }

  function hasVisibleControlValue(element) {
    if (!element.querySelectorAll) return false;
    var controls = element.querySelectorAll('input, textarea, select');
    for (var i = 0; i < controls.length; i++) {
      var control = controls[i];
      var type = String(control.type || '').toLowerCase();
      if (type === 'checkbox' || type === 'radio') {
        if (control.checked) return true;
        continue;
      }
      if (String(control.value == null ? '' : control.value).replace(/\u00a0/g, ' ').trim()) return true;
    }
    return false;
  }

  function isBlank(element) {
    return !String(element.textContent || '').replace(/[\s\u00a0]/g, '').trim();
  }

  function markBlank(element, isCell) {
    if (!isBlank(element)) return;
    if (element.querySelector && element.querySelector('table, img, svg, canvas, video, iframe, button' + (isCell ? ', .off-box' : ''))) return;
    if (hasVisibleControlValue(element)) return;
    element.textContent = '-';
  }

  function normalizeBlankCells(root) {
    if (!root || !root.querySelectorAll) return;
    // Empty callout boxes appear outside table cells on a few official layouts.
    var boxes = root.querySelectorAll('.off-box');
    for (var i = 0; i < boxes.length; i++) markBlank(boxes[i], false);
    // Keep headings and structural outer cells intact; replace only blank data cells.
    var cells = root.querySelectorAll('td');
    for (var j = 0; j < cells.length; j++) markBlank(cells[j], true);
  }

  function beforePrint() {
    if (!DAILY_FORM_CODES[currentFormCode()]) return;
    var sheet = global.document && global.document.getElementById('printSheet');
    if (sheet) normalizeBlankCells(sheet);
  }

  if (global.addEventListener) global.addEventListener('beforeprint', beforePrint);

  global.DkjPrintDashes = {
    currentFormCode: currentFormCode,
    isDailyFormCode: function (code) { return !!DAILY_FORM_CODES[String(code || '').toUpperCase()]; },
    normalizeBlankCells: normalizeBlankCells
  };
})(window);
