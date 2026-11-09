const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const script = path.join(__dirname, '..', 'scripts', 'send_email.py');

function run(args, input, env) {
  return spawnSync('python3', ['-I', script, ...args], {
    input, encoding: 'utf8', env: Object.assign({ PATH: process.env.PATH }, env)
  });
}

test('설정이 없으면 메일을 건너뛰고 정상 종료한다', () => {
  const r = run(['--subject', 'x'], '본문', {});
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /이메일 설정/);
});

test('dry-run 은 텔레그램 HTML 을 평문으로 바꿔 보여 준다', () => {
  const r = run(['--subject', '제목', '--dry-run'], '<b>미작성</b> &amp; <a href="https://x.test/a">열기</a>', {
    SMTP_USER: 'a@example.test', SMTP_PASSWORD: 'pw', MAIL_TO: 'b@example.test, c@example.test'
  });
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /제목/);
  assert.match(r.stdout, /미작성 & 열기 \(https:\/\/x\.test\/a\)/);
  assert.doesNotMatch(r.stdout, /<b>/);
});

test('MAIL_TO 와 --to 수신자를 합쳐 중복 없이 쓰고, 수신자만 있어도 발송 대상이 된다', () => {
  const r = run(['--subject', 's', '--dry-run', '--to', 'B@example.test, d@example.test, 잘못된값'], '본문', {
    SMTP_USER: 'a@example.test', SMTP_PASSWORD: 'pw', MAIL_TO: 'b@example.test'
  });
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /dry-run/);
  const py = spawnSync('python3', ['-I', '-c',
    "import sys;sys.path.insert(0,'scripts');import os;os.environ['MAIL_TO']='b@example.test';" +
    "from send_email import recipients;print(recipients(['B@example.test','d@example.test','잘못된값']))"],
  { cwd: path.join(__dirname, '..'), encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.match(py.stdout, /\['b@example\.test', 'd@example\.test'\]/);
  const only = run(['--subject', 's', '--dry-run', '--to', 'x@example.test'], '본문', { SMTP_USER: 'a@example.test', SMTP_PASSWORD: 'pw' });
  assert.match(only.stdout, /dry-run/);
});
