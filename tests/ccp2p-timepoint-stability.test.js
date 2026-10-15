const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('CCP-2P print applies the selected product standards and start/end times to boundary rows', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'dkj-print-official.js'), 'utf8');
  const context = {
    esc(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[ch]));
    }
  };
  context.window = context;
  vm.runInNewContext(source, context);

  const html = context.DkjPrintOfficial.ccp2p({
    workDate: '2026-10-15', monitorName: '담당자', productName: '제품A', adjust: '70', stable: '450',
    packagings: [
      { lot: 'PKG-LOT-123', usage: '200', defect: '1' },
      { lot: 'PKG-LOT-124', usage: '100', defect: '0' }
    ],
    rows: [
      { item: '작업시작전', time: '08:00', fe: 'O', sus: 'O', adjust: '70', stable: '450' },
      { item: '작업중', product: '제품A', time: '09:00', fe: 'O', sus: 'O', adjust: '70', stable: '450' },
      { item: '작업종료시', time: '17:00', fe: 'O', sus: 'O', adjust: '70', stable: '450' }
    ]
  });
  const rowFor = (label) => {
    const found = html.match(new RegExp('<tr><td class="c strong">' + label + '(?:<br><small>[^<]+</small>)?</td>[\\s\\S]*?</tr>'));
    assert.ok(found, label + ' row should be printed');
    return found[0].match(/<td\b[^>]*>[\s\S]*?<\/td>/g);
  };
  for (const label of ['작업시작전', '작업종료시']) {
    const cells = rowFor(label);
    assert.equal(cells[7], '<td class="c">70</td>');
    assert.equal(cells[8], '<td class="c">450</td>');
  }
  const productRow = html.match(/<tr><td class="l">제품A<\/td>[\s\S]*?<\/tr>/);
  assert.ok(productRow, 'product row should be printed');
  const productCells = productRow[0].match(/<td\b[^>]*>[\s\S]*?<\/td>/g);
  assert.equal(productCells[7], '<td class="c">70</td>');
  assert.equal(productCells[8], '<td class="c">450</td>');
  assert.ok(html.includes('<tr><td class="l">제품A</td><td class="c">PKG-LOT-123</td><td class="c">1</td><td class="c">200 EA</td>'));
  assert.ok(html.includes('포장재 LOT'));
  assert.ok(html.includes('PKG-LOT-124'));
  assert.ok(html.includes('100 EA'));
  assert.ok(html.includes('<td class="c">08:00</td><td class="c">17:00</td>'));
});


test('CCP-2P start/end rows follow first and last products in a multi-product log', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'dkj-print-official.js'), 'utf8');
  const context = {
    esc(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[ch]));
    }
  };
  context.window = context;
  vm.runInNewContext(source, context);

  const html = context.DkjPrintOfficial.ccp2p({
    productName: '제품A', adjust: '70', stable: '450',
    rows: [
      { item: '작업시작전', time: '07:30', adjust: '70', stable: '450' },
      { item: '작업중', product: '제품A', time: '08:00', adjust: '70', stable: '450' },
      { item: '작업중', product: '제품B', time: '12:00', adjust: '70', stable: '954' },
      { item: '작업종료시', time: '19:00', adjust: '70', stable: '954' }
    ]
  });

  assert.ok(html.includes('<tr><td class="l">제품A</td><td class="c"></td><td class="c"></td><td class="c"></td><td class="c">07:30</td><td class="c">08:00</td>'));
  assert.ok(html.includes('<tr><td class="l">제품B</td><td class="c"></td><td class="c"></td><td class="c"></td><td class="c">12:00</td><td class="c">19:00</td>'));
  const end = html.match(/<tr><td class="c strong">작업종료시<br><small>제품B 기준<\/small><\/td>[\s\S]*?<\/tr>/);
  assert.ok(end, 'end-of-work row should show its associated last product');
  const cells = end[0].match(/<td\b[^>]*>[\s\S]*?<\/td>/g);
  assert.equal(cells[8], '<td class="c">954</td>');
});


test('CCP-2P form restores packaging LOT and usage inputs with legacy record migration', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'records', 'DKJ-H-01-02.html'), 'utf8');
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'DKJ-H-01-02.js'), 'utf8');
  assert.match(html, /id="packTable"/);
  assert.match(html, /id="packBody"/);
  assert.match(source, /data-pf="lot"/);
  assert.match(source, /data-pf="usage"/);
  assert.match(source, /normalizePackagings\(state\);\s*renderPackagings\(\);/);
});
