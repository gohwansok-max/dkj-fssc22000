const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createEventTarget(extra = {}) {
  const listeners = new Map();
  return Object.assign({
    addEventListener(type, listener) {
      const handlers = listeners.get(type) || [];
      handlers.push(listener);
      listeners.set(type, handlers);
    },
    dispatch(type, event = {}) {
      (listeners.get(type) || []).forEach((listener) => listener(event));
    }
  }, extra);
}

function createElement(extra = {}) {
  const attributes = new Map();
  return createEventTarget(Object.assign({
    hidden: true,
    style: {},
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name); },
    focus() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
  }, extra));
}

function loadMenu() {
  const adminLinks = [createElement(), createElement()];
  const toggle = createElement();
  const close = createElement();
  const overlay = createElement({
    querySelector() { return null; },
    querySelectorAll(selector) { return selector === 'a' ? [] : []; }
  });
  overlay.setAttribute('aria-hidden', 'true');

  const document = createEventTarget({
    readyState: 'complete',
    body: { style: {} },
    getElementById(id) {
      return { ckMenuToggle: toggle, ckMenuOverlay: overlay, ckMenuClose: close }[id];
    },
    querySelectorAll(selector) {
      return selector === '[data-system-admin]' ? adminLinks : [];
    }
  });

  let isAdmin = false;
  const window = {
    DkjAuth: { isSystemAdmin: () => isAdmin },
    setTimeout(callback) { callback(); }
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'dkj-menu.js'), 'utf8');
  vm.runInNewContext(source, { window, document, setTimeout: window.setTimeout });

  return {
    adminLinks,
    document,
    setAdmin(value) { isAdmin = value; }
  };
}

test('시스템 설정 메뉴는 인증 준비 이벤트에 맞춰 전체 화면에서 관리자에게만 표시된다', () => {
  const app = loadMenu();

  assert.deepEqual(app.adminLinks.map((link) => link.hidden), [true, true]);

  app.setAdmin(true);
  app.document.dispatch('dkj:auth-ready');
  assert.deepEqual(app.adminLinks.map((link) => link.hidden), [false, false]);

  app.setAdmin(false);
  app.document.dispatch('dkj:auth-ready');
  assert.deepEqual(app.adminLinks.map((link) => link.hidden), [true, true]);
});

test('메인 콘솔 왼쪽 메뉴에 관리자 전용 시스템 설정 링크가 있다', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'dkj-console.css'), 'utf8');
  const header = html.match(/<div class="ck-header-right">([\s\S]*?)<\/div>/);

  assert.ok(header, '메인 헤더 메뉴를 찾을 수 있어야 한다');
  assert.match(
    header[1],
    /href="system-settings\.html"\s+data-system-admin\s+hidden>시스템 설정<\/a>/
  );
  assert.match(css, /\[data-system-admin\]\[hidden\]\s*{[^}]*display:\s*none\s*!important;/);
});
