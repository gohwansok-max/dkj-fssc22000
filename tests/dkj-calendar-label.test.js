const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('calendar detail uses the same explicit nonconformance label as the calendar badge', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'dkj-calendar.js'), 'utf8');
  assert.match(source, /var status = \{ full: '완료', ng: '부적합'/);
  assert.match(source, /ng: '부적합'/);
});
