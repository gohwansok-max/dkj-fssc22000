const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'js', 'production-dashboard.js'), 'utf8');
const form = fs.readFileSync(path.join(root, 'js', 'dkj-production-form.js'), 'utf8');
const boot = fs.readFileSync(path.join(root, 'js', 'DKJ-F-053.js'), 'utf8');

test('production form and analysis dashboard read and write the same DKJ-F-053 records', () => {
  assert.match(boot, /code:\s*'DKJ-F-053'/);
  assert.match(form, /DkjRecordStore\.save\(FORM_ID/);
  assert.match(dashboard, /var FORM_ID = 'DKJ-F-053'/);
  assert.match(dashboard, /DkjRecordStore\.list\(FORM_ID\)/);
});

test('empty analysis points directly to the production form', () => {
  assert.match(dashboard, /생산일지 작성/);
  assert.match(dashboard, /href="records\/DKJ-F-053\.html"/);
});
