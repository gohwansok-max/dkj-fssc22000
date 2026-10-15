const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const printerSource = fs.readFileSync(path.join(root, 'js', 'dkj-print-official.js'), 'utf8');
const formSource = fs.readFileSync(path.join(root, 'js', 'DKJ-H-01-01.js'), 'utf8');

function loadPrinter() {
  const context = {
    esc(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[ch]));
    }
  };
  context.window = context;
  vm.runInNewContext(printerSource, context);
  return context.DkjPrintOfficial;
}

test('CCP-1BC form stores raw material input on each monitoring row', () => {
  assert.match(formSource, /time: '', productName: '', rawMaterialKg: ''/);
  assert.match(formSource, /data-f="rawMaterialKg" min="0" max="7\.99" step="0\.01"/);
  assert.match(formSource, /f === 'rawMaterialKg'/);
});

test('CCP-1BC official print shows each row product and raw material quantity', () => {
  const html = loadPrinter().ccp1bc({
    workDate: '2026-10-15', monitorName: '담당자',
    rows: [
      { time: '09:00', productName: '농협 채소믹스', rawMaterialKg: '2.35', ppm: '250', soak: '25', rinseSec: '55', residualCl: '0.5', judge: 'O' },
      { time: '10:00', productName: '샐러디아', rawMaterialKg: '1.25', ppm: '260', soak: '26', rinseSec: '56', residualCl: '1', judge: 'O' }
    ]
  });

  assert.match(html, /품목명/);
  assert.match(html, /원물 투입량<br>\(kg\)/);
  assert.match(html, /농협 채소믹스/);
  assert.match(html, /샐러디아/);
  assert.match(html, /2\.35/);
  assert.match(html, /1\.25/);
});

test('CCP-1BC official print preserves legacy top-level product name', () => {
  const html = loadPrinter().ccp1bc({
    productName: '구형 기록 품목',
    rows: [{ time: '09:00', ppm: '250', soak: '25', rinseSec: '55', residualCl: '0.5', judge: 'O' }]
  });
  assert.match(html, /구형 기록 품목/);
});
