const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const sidebar = fs.readFileSync(path.join(root, 'js', 'dkj-sidebar.js'), 'utf8');

test('side menu uses one record-center entry and every menu destination exists', () => {
  const links = [...sidebar.matchAll(/\['([^']+)'\s*,\s*'([^']+)'\]/g)].map((m) => ({ label: m[1], href: m[2] }));
  assert.equal(links.filter((link) => link.href.split(/[?#]/)[0] === 'records-center.html').length, 1);
  assert.ok(links.some((link) => link.label.includes('기록센터')));
  for (const link of links) {
    const relative = link.href.split(/[?#]/)[0];
    assert.ok(fs.existsSync(path.join(root, relative)), `${link.label}: ${relative}`);
  }
});

test('sidebar gives record entry one route and preserves compact form navigation', () => {
  assert.match(sidebar, /\['기록센터 · 서식 작성', 'records-center\.html'\]/);
  assert.match(sidebar, /dkj-sidebar-compact/);
  assert.match(sidebar, /dkjSidebarTrigger/);
  const navBar = fs.readFileSync(path.join(root, 'js', 'dkj-nav-bar.js'), 'utf8');
  assert.match(navBar, /nv-sidebar-toggle/);
  assert.match(navBar, /compact: true/);
});
