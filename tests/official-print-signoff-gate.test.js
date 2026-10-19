const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'dkj-print-official.js'), 'utf8');

function loadPrinter() {
  const context = { esc: (v) => String(v == null ? '' : v) };
  context.window = context;
  vm.runInNewContext(source, context);
  return context.DkjPrintOfficial;
}

const base = { workDate: '2026-10-19', monitorName: '김도성', confirmer: '권화선', approver: '최민재', rows: [] };

test('CCP-2P 정본: 최종 승인 전에는 결재란에 이름을 찍지 않는다', () => {
  const html = loadPrinter().ccp2p(Object.assign({ signoff: {} }, base));
  const sign = html.slice(html.indexOf('off-apv'), html.indexOf('</table>', html.indexOf('off-apv')));
  assert.ok(!sign.includes('권화선') && !sign.includes('최민재') && !sign.includes('김도성'));
});

test('CCP-2P 정본: 최종 승인 뒤에는 서명한 이름이 찍힌다', () => {
  const at = '2026-10-19T01:00:00Z';
  const html = loadPrinter().ccp2p(Object.assign({}, base, {
    signoff: { writer: { name: '김도성', at }, reviewer: { name: '권화선', at }, approver: { name: '최민재', at } }
  }));
  const sign = html.slice(html.indexOf('off-apv'), html.indexOf('</table>', html.indexOf('off-apv')));
  assert.ok(sign.includes('권화선') && sign.includes('최민재') && sign.includes('김도성'));
});

test('CCP-2P 정본: 제품 통과 표에 통과량·포장재 입고일·포장재 사용량·특이사항이 제품별로 실린다', () => {
  const html = loadPrinter().ccp2p({
    workDate: '2026-10-19', monitorName: 'A',
    rows: [
      { item: '작업시작전', time: '08:00', fe: 'O', sus: 'O' },
      { item: '작업중', product: '양상추샐러드', time: '08:10', fe: 'O', sus: 'O', prodOnly: 'X', prodFe: 'O', prodSus: 'O', judge: 'O' },
      { item: '작업종료시', time: '08:35', fe: 'O', sus: 'O', judge: 'O' }
    ],
    passInfo: { 양상추샐러드: { qty: '120.5', packDate: '2026-10-17', packUsage: '300', note: '이상 없음' } }
  });
  const section = html.slice(html.indexOf('제품 통과 시 이탈 여부'));
  ['통과량', '포장재 입고일', '포장재 사용량', '특이사항', '120.5 kg', '2026-10-17', '300 EA', '이상 없음']
    .forEach((t) => assert.ok(section.includes(t), t));
});
