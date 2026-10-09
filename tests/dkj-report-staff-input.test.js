const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadReport() {
  function element() {
    const listeners = {};
    return {
      value: '', classList: { toggle() {} },
      querySelectorAll() { return []; },
      addEventListener(name, listener) { (listeners[name] ||= []).push(listener); },
      emit(name, target) { (listeners[name] || []).forEach(listener => listener({ target })); }
    };
  }
  const document = element();
  const elements = Object.fromEntries(['reportBlocks', 'writer', 'btnSave', 'btnLock', 'saveStatus'].map(id => [id, element()]));
  document.readyState = 'loading';
  document.getElementById = id => elements[id] || null;
  document.querySelector = () => null;
  let saved;
  const context = vm.createContext({ document, setTimeout, clearTimeout, alert(message) { throw new Error(message); }, dispatchEvent() {}, CustomEvent: class {} });
  context.window = context;
  // The form uses the shared esc global; omit unrelated toolbar and autofill UI.
  const utilities = vm.createContext({ document: { readyState: 'loading', addEventListener() {} } });
  utilities.window = utilities;
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js/dkj-util.js'), 'utf8'), utilities);
  context.esc = utilities.esc;
  context.DkjRecordStore = { loadDraft: () => null, list: () => [], save(formId, record) { saved = record; return { ...record, id: 'test-record' }; } };
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js/dkj-report-form.js'), 'utf8'), context);
  context.DkjReportForm.mount({ code: 'TEST', blocks: [{ type: 'pairs', fields: [{ id: 'writer2', label: '작성자', required: true }] }, { type: 'table', id: 'entries', defaultRows: 1, columns: [{ key: 'owner', label: '담당자' }] }] });
  document.emit('DOMContentLoaded');
  elements.writer.value = '검증담당';
  elements.writer.id = 'writer';
  document.emit('input', elements.writer);
  return { elements, saved: () => saved };
}

function replacement(attributes, value) {
  // A new select has none of the listeners originally attached to the input.
  return { value, hasAttribute: name => name in attributes, getAttribute: name => attributes[name] };
}

test('replaced report personnel selects are included in the saved record', () => {
  const report = loadReport();
  report.elements.reportBlocks.emit('change', replacement({ 'data-v': 'writer2' }, '본문작성자'));
  report.elements.btnSave.emit('click');
  assert.equal(report.saved().values.writer2, '본문작성자');
});

test('replaced report table personnel selects retain their row and column', () => {
  const report = loadReport();
  report.elements.reportBlocks.emit('input', replacement({ 'data-v': 'writer2' }, '본문작성자'));
  report.elements.reportBlocks.emit('change', replacement({ 'data-t': 'entries', 'data-r': '0', 'data-c': 'owner' }, '표담당자'));
  report.elements.btnSave.emit('click');
  assert.equal(report.saved().tables.entries[0].owner, '표담당자');
});
