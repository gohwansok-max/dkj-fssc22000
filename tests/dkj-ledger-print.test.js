const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const printSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'dkj-ledger-print.js'), 'utf8');

function loadPrint() {
  const escapeHtml = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
  const context = { esc: escapeHtml };
  context.window = context;
  vm.runInContext(printSource, vm.createContext(context));
  return context.DkjLedgerPrint;
}

test('ledger print shows names only for stages with a confirmed signoff timestamp', () => {
  const print = loadPrint();
  const spec = { docNo: 'TEST-LEDGER', code: 'TEST-LEDGER', title: 'Test ledger', rows: 0, columns: [], infoFields: [] };
  const state = {
    rows: [],
    approvals: { writer: 'Planned Writer', reviewer: 'Planned Reviewer', approver: 'Planned Approver' },
    signoff: {}
  };

  let html = print.render(spec, state);
  for (const planned of Object.values(state.approvals)) assert.ok(!html.includes(planned));

  state.signoff.writer = { name: 'Confirmed Writer', at: '2026-10-15T01:00:00.000Z' };
  html = print.render(spec, state);
  assert.ok(html.includes('Confirmed Writer'));
  assert.ok(!html.includes('Planned Reviewer'));
  assert.ok(!html.includes('Planned Approver'));

  state.signoff.reviewer = { name: 'Confirmed Reviewer', at: '2026-10-15T02:00:00.000Z' };
  html = print.render(spec, state);
  assert.ok(html.includes('Confirmed Writer'));
  assert.ok(html.includes('Confirmed Reviewer'));
  assert.ok(!html.includes('Planned Approver'));

  state.signoff.approver = { name: 'Confirmed Approver', at: '2026-10-15T03:00:00.000Z' };
  html = print.render(spec, state);
  assert.ok(html.includes('Confirmed Writer'));
  assert.ok(html.includes('Confirmed Reviewer'));
  assert.ok(html.includes('Confirmed Approver'));
});
