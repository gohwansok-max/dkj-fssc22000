const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const printerSource = fs.readFileSync(path.join(root, 'js', 'dkj-print-official.js'), 'utf8');
const formSource = fs.readFileSync(path.join(root, 'js', 'DKJ-H-01-01.js'), 'utf8');
const formHtmlSource = fs.readFileSync(path.join(root, 'records', 'DKJ-H-01-01.html'), 'utf8');

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

test('CCP-1BC official printer URL uses the updated cache revision', () => {
  assert.match(formHtmlSource, /dkj-print-official\.js\?v=135&rev=137/);
});

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

test('CCP-1BC print lists replacement times separately from monitoring rows', () => {
  const html = loadPrinter().ccp1bc({
    changeTimes: ['08:15', '12:40'],
    rows: [
      { time: '09:00', productName: '품목 A', ppm: '250' },
      { time: '13:00', productName: '품목 B', ppm: '260' }
    ]
  });
  const monitoringTable = html.match(/<table class="off-grid off-mon">[\s\S]*?<\/table>/)[0];
  const changeTimesTable = html.match(/<table class="off-grid off-change-times">[\s\S]*?<\/table>/)[0];

  assert.doesNotMatch(monitoringTable, /교체 시각|08:15|12:40/);
  assert.match(changeTimesTable, /교체 회차/);
  assert.match(changeTimesTable, /1회[\s\S]*08:15/);
  assert.match(changeTimesTable, /2회[\s\S]*12:40/);
  assert.ok(html.indexOf(changeTimesTable) > html.indexOf(monitoringTable));
});

test('CCP-1BC print supports legacy replacement-time string and leaves a blank write-in row when empty', () => {
  const legacyHtml = loadPrinter().ccp1bc({ waterChangeTimes: '08:30, 12:30' });
  const legacyTable = legacyHtml.match(/<table class="off-grid off-change-times">[\s\S]*?<\/table>/)[0];
  assert.match(legacyTable, /08:30/);
  assert.match(legacyTable, /12:30/);

  const emptyHtml = loadPrinter().ccp1bc({ changeTimes: ['', ' '] });
  const emptyTable = emptyHtml.match(/<table class="off-grid off-change-times">[\s\S]*?<\/table>/)[0];
  assert.match(emptyTable, /1회/);
  assert.doesNotMatch(emptyTable, /08:30|12:30/);
});


test('CCP-1BC official header hides all signatory names until final approval is confirmed', () => {
  const state = {
    monitorName: '예정 작성자',
    confirmer: '예정 검토자',
    approver: '예정 승인자',
    signoff: {
      writer: { name: '확정 작성자', at: '2026-10-15T01:00:00.000Z' },
      reviewer: { name: '확정 검토자', at: '2026-10-15T02:00:00.000Z' }
    }
  };
  const signBox = (html) => html.match(/<table class="off-apv">[\s\S]*?<\/table>/)[0];

  let html = loadPrinter().ccp1bc(state);
  for (const name of ['예정 작성자', '예정 검토자', '예정 승인자', '확정 작성자', '확정 검토자']) {
    assert.ok(!signBox(html).includes(name));
  }

  state.signoff.approver = { name: '확정 승인자', at: '2026-10-15T03:00:00.000Z' };
  html = loadPrinter().ccp1bc(state);
  const box = signBox(html);
  for (const name of ['확정 작성자', '확정 검토자', '확정 승인자']) assert.ok(box.includes(name));
  for (const name of ['예정 작성자', '예정 검토자', '예정 승인자']) assert.ok(!box.includes(name));
});
