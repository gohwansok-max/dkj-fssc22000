const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const context = vm.createContext({ document: { readyState: 'loading', addEventListener() {} }, addEventListener() {} });
context.window = context;
vm.runInContext(fs.readFileSync(path.join(root, 'js/dkj-util.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'js/dkj-fr-form.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'js/dkj-print-official.js'), 'utf8'), context);
const spec = JSON.parse(fs.readFileSync(path.join(root, 'data/fr-form-specs/FR-023.json'), 'utf8'));

test('FR-023 stores management review input separately from the approval audit array', () => {
  const state = context.DkjFrForm.emptyState(spec);
  assert.equal(Array.isArray(state.audit), true);
  assert.equal(state.auditInput, '');
  assert.ok(spec.sections.find(section => section.id === 'auditInput'));
});

test('legacy FR-023 text remains readable without mutating the stored record', () => {
  const saved = { id: 'legacy-record', audit: '옛 심사 의견 <보존>', locked: true };
  const before = JSON.stringify(saved);
  const state = context.DkjFrForm.restoreState(spec, saved);
  assert.equal(state.auditInput, '옛 심사 의견 <보존>');
  assert.equal(Array.isArray(state.audit), true);
  assert.equal(state.locked, true);
  assert.equal(JSON.stringify(saved), before);
  const html = context.DkjPrintOfficial.frGeneric(saved, spec.print);
  assert.ok(html.includes('옛 심사 의견 &lt;보존&gt;'));
});

test('valid audit arrays and newly saved input survive reopening and printing', () => {
  const audit = [{ action: 'SAVE', hash: 'existing-hash' }];
  const saved = { audit, auditInput: '새 심사 의견' };
  const state = context.DkjFrForm.restoreState(spec, saved);
  assert.equal(state.audit, audit);
  assert.equal(state.auditInput, '새 심사 의견');
  assert.ok(context.DkjPrintOfficial.frGeneric(state, spec.print).includes('새 심사 의견'));
});
