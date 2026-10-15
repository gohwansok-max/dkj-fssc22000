const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.join(__dirname, '..');
const dashSource = fs.readFileSync(path.join(rootDir, 'js', 'dkj-print-dashes.js'), 'utf8');

function makeCell(text, options = {}) {
  return {
    textContent: text,
    querySelector(selector) {
      if (options.child && selector.includes(options.child)) return {};
      return null;
    },
    querySelectorAll() {
      return options.controls || [];
    }
  };
}

function fireBeforePrint(formCode, cells, boxes = []) {
  const listeners = {};
  const sheet = {
    querySelectorAll(selector) {
      if (selector === '.off-box') return boxes;
      if (selector === 'td') return cells;
      return [];
    }
  };
  const context = {
    location: { pathname: `/records/${formCode}.html` },
    document: { getElementById: (id) => id === 'printSheet' ? sheet : null },
    addEventListener: (event, callback) => { listeners[event] = callback; }
  };
  context.window = context;
  vm.runInNewContext(dashSource, context);
  assert.equal(typeof listeners.beforeprint, 'function');
  listeners.beforeprint();
  return context.DkjPrintDashes;
}

test('daily print changes empty and whitespace-only cells to dashes, preserving values and media', () => {
  const blank = makeCell('');
  const whitespace = makeCell('  \u00a0\n');
  const populated = makeCell('0');
  const photo = makeCell('', { child: 'img' });
  const nestedTable = makeCell('', { child: 'table' });
  const inputValue = makeCell('', { controls: [{ type: 'text', value: '실제값' }] });
  const emptyInput = makeCell('', { controls: [{ type: 'text', value: '' }] });
  const emptyBox = makeCell('');
  const filledBox = makeCell('기록');
  fireBeforePrint('DKJ-H-01-02', [blank, whitespace, populated, photo, nestedTable, inputValue, emptyInput], [emptyBox, filledBox]);

  assert.equal(blank.textContent, '-');
  assert.equal(whitespace.textContent, '-');
  assert.equal(populated.textContent, '0');
  assert.equal(photo.textContent, '');
  assert.equal(nestedTable.textContent, '');
  assert.equal(inputValue.textContent, '');
  assert.equal(emptyInput.textContent, '-');
  assert.equal(emptyBox.textContent, '-');
  assert.equal(filledBox.textContent, '기록');
});

test('non-daily forms are not normalized by the daily print handler', () => {
  const blank = makeCell('');
  fireBeforePrint('FR-014', [blank]);
  assert.equal(blank.textContent, '');
});

test('every form in the daily console group loads the print dash helper', () => {
  const registrySource = fs.readFileSync(path.join(rootDir, 'js', 'console-forms.bundle.js'), 'utf8');
  const registryContext = { window: {} };
  vm.runInNewContext(registrySource, registryContext);
  const dailyGroup = registryContext.window.DKJ_CONSOLE_FORMS.groups.find((group) => group.id === 'daily');
  assert.ok(dailyGroup, 'daily form registry should exist');

  const codeContext = { window: {}, location: { pathname: '/records/DKJ-H-01-02.html' }, document: { getElementById: () => null }, addEventListener() {} };
  codeContext.window = codeContext;
  vm.runInNewContext(dashSource, codeContext);
  for (const form of dailyGroup.forms) {
    const pagePath = path.join(rootDir, 'records', `${form.code}.html`);
    assert.ok(fs.existsSync(pagePath), `page should exist for ${form.code}`);
    const pageSource = fs.readFileSync(pagePath, 'utf8');
    assert.match(pageSource, /dkj-print-dashes\.js\?v=130&rev=1/, `${form.code} should load dash helper`);
    assert.match(pageSource, /id="printSheet"/, `${form.code} should have a print sheet`);
    assert.equal(codeContext.DkjPrintDashes.isDailyFormCode(form.code), true, `${form.code} should be allowlisted`);
  }
  assert.equal(codeContext.DkjPrintDashes.isDailyFormCode('FR-014'), false);
});
