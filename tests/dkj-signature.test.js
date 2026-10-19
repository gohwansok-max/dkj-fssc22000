const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
// 1x1 투명 PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function load(file, extra) {
  const store = {};
  const ctx = Object.assign({
    esc: (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    }
  }, extra || {});
  ctx.window = ctx;
  vm.runInNewContext(read('dkj-signature.js'), ctx);
  if (file) vm.runInNewContext(read(file), ctx);
  return { ctx, store };
}

test('서명 그림은 우리가 만든 PNG data URL 만 받는다', () => {
  const { ctx } = load();
  const S = ctx.DkjSignature;
  assert.ok(S.isValid(PNG));
  assert.ok(!S.isValid('data:image/svg+xml;base64,AAAA'));
  assert.ok(!S.isValid('javascript:alert(1)'));
  assert.ok(!S.isValid('data:image/png;base64,AAAA" onerror="x'));
  assert.ok(!S.isValid(null));
});

test('저장된 서명은 사번별로 이 기기에만 보관한다', () => {
  const { ctx, store } = load();
  const S = ctx.DkjSignature;
  assert.equal(S.getSaved('0001'), null);
  assert.ok(S.setSaved('0001', PNG));
  assert.equal(S.getSaved('0001').data, PNG);
  assert.equal(S.getSaved('0002'), null);          // 다른 사번 서명은 꺼낼 수 없다
  assert.ok(Object.keys(store).every((k) => k.startsWith('dkj:signature:')));
  assert.ok(!S.setSaved('0001', 'not-a-png'));
  S.clearSaved('0001');
  assert.equal(S.getSaved('0001'), null);
});

test('결재칸 HTML: 서명 그림이 있으면 그림+이름, 없으면 이름만, 잘못된 값은 이름만', () => {
  const { ctx } = load();
  const S = ctx.DkjSignature;
  assert.match(S.cellHtml({ name: '홍길동', signature: PNG }, ''), /<img class="sig-img" src="data:image\/png;base64,/);
  assert.match(S.cellHtml({ name: '홍길동', signature: PNG }, ''), /홍길동/);
  assert.equal(S.cellHtml({ name: '홍길동' }, ''), '홍길동');
  assert.equal(S.cellHtml({ name: '<b>x</b>', signature: 'bad' }, ''), '&lt;b&gt;x&lt;/b&gt;');
});

test('정본 인쇄(CCP-2P): 서명한 단계의 칸에만 서명 그림이 들어간다(승인 전 칸은 비어 있다)', () => {
  const { ctx } = load('dkj-print-official.js');
  const at = '2026-10-19T01:00:00Z';
  const signed = {
    workDate: '2026-10-19', monitorName: 'A', rows: [],
    signoff: {
      writer: { name: '작성자', at, signature: PNG },
      reviewer: { name: '검토자', at, signature: PNG },
      approver: { name: '승인자', at, signature: PNG }
    }
  };
  const html = ctx.DkjPrintOfficial.ccp2p(signed);
  assert.equal((html.match(/class="sig-img"/g) || []).length, 3);
  const partial = ctx.DkjPrintOfficial.ccp2p(Object.assign({}, signed, { signoff: { writer: signed.signoff.writer } }));
  assert.equal((partial.match(/class="sig-img"/g) || []).length, 1);   // 작성만 서명 → 작성칸만
  const none = ctx.DkjPrintOfficial.ccp2p(Object.assign({}, signed, { signoff: {}, confirmer: '검토자', approver: '승인자' }));
  assert.equal((none.match(/class="sig-img"/g) || []).length, 0);
  const signCells = [...none.matchAll(/<td class="off-sign">(.*?)<\/td>/g)].map((m) => m[1]);
  assert.deepEqual(signCells, ['', '', '']);                            // 결재 전에는 이름도 찍지 않는다
});
