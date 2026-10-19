const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'dkj-print-official.js'), 'utf8');

function loadPrinter() {
  const context = {
    esc(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[ch]));
    }
  };
  context.window = context;
  vm.runInNewContext(source, context);
  return context.DkjPrintOfficial;
}

function cells(html) {
  return [...html.matchAll(/<tr>(.*?)<\/tr>/g)].map((m) =>
    [...m[1].matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/g)].map((c) => c[1].replace(/<[^>]+>/g, '')));
}

const product = (name, time, stable) => ({
  item: '작업중', product: name, time, fe: 'O', sus: 'O',
  prodOnly: 'X', prodFe: 'O', prodSus: 'O', adjust: '70', stable, judge: 'O'
});

test('CCP-2P 정본: 제품 종료시각은 다음 행(다음 제품 시작·작업종료시)의 시각이다', () => {
  const html = loadPrinter().ccp2p({
    workDate: '2026-10-16', monitorName: 'A',
    rows: [
      { item: '작업시작전', time: '08:22', fe: 'O', sus: 'O' },
      product('P1', '08:27', '252'),
      { item: '작업종료시', time: '08:37', fe: 'O', sus: 'O', judge: 'O' },
      { item: '작업시작전', time: '09:22', fe: 'O', sus: 'O' },
      product('P2', '09:40', '954'),
      product('P3', '09:42', '954'),
      { item: '작업종료시', time: '09:56', fe: 'O', sus: 'O', judge: 'O' }
    ]
  });
  const rows = cells(html);
  const pass = (name) => rows.find((r) => r[0] === name && r.length === 8);
  assert.deepEqual(pass('P1').slice(1, 3), ['08:27', '08:37']);
  assert.deepEqual(pass('P2').slice(1, 3), ['09:40', '09:42']);
  assert.deepEqual(pass('P3').slice(1, 3), ['09:42', '09:56']);
});

test('CCP-2P 정본: 시작전·종료시 행은 해당 없음 칸에 하이픈, 물성보정·안정도는 인접 제품 값', () => {
  const html = loadPrinter().ccp2p({
    workDate: '2026-10-16', monitorName: 'A',
    rows: [
      { item: '작업시작전', time: '08:22', fe: 'O', sus: 'O' },
      product('P1', '08:27', '252'),
      { item: '작업종료시', time: '08:37', fe: 'O', sus: 'O', judge: 'O' }
    ]
  });
  const rows = cells(html);
  const start = rows.find((r) => r[0] === '작업시작전' && r[1] === '08:22');
  const end = rows.find((r) => r[0] === '작업종료시' && r[1] === '08:37');
  assert.deepEqual(start.slice(4, 9), ['-', '-', '-', '70', '252']);
  assert.deepEqual(end.slice(4, 9), ['-', '-', '-', '70', '252']);
});
