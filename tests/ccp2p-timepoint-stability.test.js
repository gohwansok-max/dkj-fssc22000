const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('CCP-2P print copies the adjacent product adjust/stable values into start/end rows (2026-10-16 현장 요청)', () => {
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
    rows: [
      { item: '작업시작전', time: '08:00', fe: 'O', sus: 'O', adjust: '70', stable: '450' },
      { item: '작업중', product: '제품A', time: '09:00', fe: 'O', sus: 'O', adjust: '70', stable: '450' },
      { item: '작업종료시', time: '17:00', fe: 'O', sus: 'O', adjust: '70', stable: '450' }
    ]
  });
  const rowFor = (label) => {
    const found = html.match(new RegExp('<tr><td class="c strong">' + label + '</td>[\\s\\S]*?</tr>'));
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
});
