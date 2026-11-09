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
