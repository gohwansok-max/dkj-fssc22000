const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const chatbotSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'dkj-chatbot.js'), 'utf8');

function memoryStorage(initial) {
  const values = new Map(Object.entries(initial || {}));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  toggle(value, force) {
    if (force === undefined ? !this.values.has(value) : force) this.values.add(value);
    else this.values.delete(value);
  }
  contains(value) { return this.values.has(value); }
}

function createDocument() {
  const elements = new Map();
  const document = {
    activeElement: null,
    documentElement: { lang: 'ko' },
    readyState: 'complete',
    title: '현장 일지',
    addEventListener() {},
    getElementById(id) { return elements.get(id) || null; }
  };

  class FakeElement {
    constructor(tagName) {
      this.tagName = String(tagName || 'div').toUpperCase();
      this.attributes = new Map();
      this.children = [];
      this.classList = new FakeClassList();
      this.disabled = false;
      this.listeners = new Map();
      this.scrollHeight = 0;
      this.scrollTop = 0;
      this.textContent = '';
      this.title = '';
      this.value = '';
      this._innerHTML = '';
    }
    set id(value) { this._id = value; if (value) elements.set(value, this); }
    get id() { return this._id || ''; }
    set innerHTML(value) {
      this._innerHTML = String(value);
      for (const match of this._innerHTML.matchAll(/id="([^"]+)"/g)) {
        if (!elements.has(match[1])) {
          const child = new FakeElement(match[1] === 'dkjChatbotInput' ? 'textarea' : 'div');
          child.id = match[1];
        }
      }
    }
    get innerHTML() { return this._innerHTML; }
    addEventListener(type, handler) { this.listeners.set(type, handler); }
    appendChild(child) {
      this.children.push(child);
      if (child.id) elements.set(child.id, child);
      return child;
    }
    focus() { document.activeElement = this; }
    getAttribute(name) { return this.attributes.get(name) || null; }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
  }

  document.createElement = (tagName) => new FakeElement(tagName);
  document.head = new FakeElement('head');
  document.body = new FakeElement('body');
  return document;
}

function loadChatbot(sendMessage) {
  let recognitionInstance;
  class FakeRecognition {
    constructor() { recognitionInstance = this; }
    start() { if (this.onstart) this.onstart(); }
    stop() { if (this.onend) this.onend(); }
    emit(transcript) {
      if (this.onresult) this.onresult({ results: [[{ transcript }]] });
      if (this.onend) this.onend();
    }
  }

  const document = createDocument();
  const context = {
    console,
    document,
    location: { href: 'https://example.test/records/DKJ-S-02-01.html', pathname: '/records/DKJ-S-02-01.html' },
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage(),
    setTimeout(fn, delay) { if (delay < 1000) fn(); return 1; },
    clearTimeout() {},
    SpeechRecognition: FakeRecognition,
    DkjTelegram: { sendMessage }
  };
  context.window = context;
  vm.runInContext(chatbotSource, vm.createContext(context));
  return { context, document, recognition: () => recognitionInstance, widget: context.__dkjChatbotInstance };
}

test('opens with a direct input and converts Korean speech into editable text', () => {
  const app = loadChatbot(async () => ({ success: true }));
  const { widget } = app;

  assert.ok(widget.elInput);
  assert.ok(widget.elMic);
  assert.equal(widget.messages[0].chips.length, 0);

  widget.elInput.value = '기존 내용';
  widget.toggleSpeechRecognition();
  assert.equal(app.recognition().lang, 'ko-KR');
  assert.equal(widget.isListening, true);

  app.recognition().emit('소독수 교체 알림이 안 떠요');
  assert.equal(widget.elInput.value, '기존 내용 소독수 교체 알림이 안 떠요');
  assert.equal(widget.isListening, false);
  assert.match(widget.elSpeechStatus.textContent, /내용을 확인하고 전송/);
});

test('sends the direct message to Telegram with current page and user context', async () => {
  let sent;
  const app = loadChatbot(async (payload) => { sent = payload; return { success: true }; });
  const { widget } = app;

  widget.elInput.value = '헹굼수 교체시간 입력칸이 저장되지 않습니다';
  await widget.handleSend();

  assert.equal(sent.category, '현장 불편사항');
  assert.equal(sent.message, '헹굼수 교체시간 입력칸이 저장되지 않습니다');
  assert.equal(sent.pageTitle, '현장 일지');
  assert.equal(sent.pageUrl, 'https://example.test/records/DKJ-S-02-01.html');
  assert.equal(sent.user.name, '현장직원');
  assert.equal(widget.isSending, false);
  assert.match(widget.messages.at(-1).text, /텔레그램 전송 완료/);
});

test('restores the original message when Telegram delivery fails', async () => {
  const app = loadChatbot(async () => ({ success: false, message: '테스트 전송 실패' }));
  const { widget } = app;

  widget.elInput.value = '저장 실패 제보';
  await widget.handleSend();

  assert.equal(widget.elInput.value, '저장 실패 제보');
  assert.equal(widget.isSending, false);
  assert.match(widget.elSpeechStatus.textContent, /입력 내용은 그대로 보존/);
  assert.match(widget.messages.at(-1).text, /텔레그램 전송 실패/);
});
