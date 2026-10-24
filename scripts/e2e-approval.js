/**
 * 전 서식 결재(작성→검토→승인) 점검 — 배포 전에 돌린다.
 *
 *   python -m http.server 5511            # 저장소 루트에서 정적 서버
 *   node scripts/e2e-approval.js          # 77종 전부, 새 시트에 바로 결재
 *   node scripts/e2e-approval.js --lock   # 저장 → 작성완료(잠금) → 결재
 *   node scripts/e2e-approval.js --only FR-001,DKJ-S-02-05
 *
 * 서식마다 화면의 빈 칸을 기본값으로 채우고(O/X·적합은 첫 버튼) 결재 버튼을 차례로 누른 뒤,
 * 저장소(DkjRecordStore)에 서명이 실제로 남았는지 확인한다. 클라우드(Firebase) 요청은 막는다.
 * 일반 채우기로 검증을 통과하지 못하는 서식(행 단위 입력·전용 선택 팝업)은 SPECIAL 에 따로 채운다.
 * 시스템 관리자(4343) 계정으로 로그인한다 — 비밀번호가 바뀐 환경이면 DKJ_E2E_PW 로 넘긴다.
 * Playwright 가 필요하다(외부 패키지 없는 tests/ 와 분리). 배포 대상에서 빠진다(scripts/).
 */
'use strict';
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { ({ chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')); }

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i === -1 ? null : (args[i + 1] || ''); };
const BASE = opt('--base') || 'http://localhost:5511';
const LOCK = args.includes('--lock');
const ONLY = opt('--only') ? opt('--only').split(',') : null;
const PW = process.env.DKJ_E2E_PW || '4343';
const ROOT = path.resolve(__dirname, '..');

/** 서식 공통 채우기 — 빈 칸만 채우고 이미 적힌 값은 두 번 건드리지 않는다. 그리드가 다시 그려지므로 여러 번 돈다. */
function fillGeneric() {
  const vis = (e) => e.offsetParent !== null && !e.disabled && !e.readOnly;
  const fire = (e) => { e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
  const today = new Date().toISOString().slice(0, 10);
  document.querySelectorAll('input,textarea,select').forEach((e) => {
    if (!vis(e) || /^dkj/.test(e.id || '') || e.closest('#approvalPanel')) return;
    if (e.tagName === 'SELECT') {
      if (!e.value) { const o = [...e.options].find((x) => x.value && x.value !== '__custom__'); if (o) { e.value = o.value; fire(e); } }
      return;
    }
    if (e.value) return;
    const t = e.type;
    if (t === 'date') e.value = today;
    else if (t === 'time') e.value = '09:00';
    else if (t === 'month') e.value = today.slice(0, 7);
    else if (t === 'number') e.value = e.placeholder && !isNaN(Number(e.placeholder)) ? e.placeholder : '1';
    else if (t === 'text' || e.tagName === 'TEXTAREA') e.value = '점검';
    else return;
    fire(e);
  });
  document.querySelectorAll('.ox-btns, .lgf-tg, .rpf-checks, .qc-seg-control, .qc-spec-control').forEach((g) => {
    const b = g.querySelector('button'); if (b && !g.querySelector('.on,.active')) b.click();
  });
  document.querySelectorAll('.mxf-cell').forEach((c) => { if (!c.textContent.trim() && !c.disabled) c.click(); });
}

/** 일반 채우기로는 검증을 못 넘는 서식 — 실제 현장 입력 순서대로 첫 행만 채운다. */
const SPECIAL = {
  'DKJ-S-02-15': [['#period', '2026.10.23 ~ 10.23'], ['#inspector', '4343'], ['[data-r="0"][data-c="inDate"]', 'today'],
    ['[data-r="0"][data-c="kind"]', '포장재'], ['[data-r="0"][data-c="vendor"]', '영광산업'], ['[data-r="0"][data-c="item"]', '무지 삼방봉투']],
  'DKJ-S-02-14': [['#inspector', '4343'], ['[data-r="0"][data-c="vendor"]', '운봉농협'], ['[data-r="0"][data-c="item"]', '로메인']],
  'DKJ-H-01-02': [['#productSelect', ':first'], ['#lot', '20261023-1'], ['#monitorName', '4343'],
    ['click', '[data-i="0"] [data-cycle="fe"]'], ['[data-i="0"] input[data-f="time"]', '09:00']],
  'DKJ-QC-001': [['#lot', '20261023-01'], ['#inspector', '4343'], ['generic', 3]]
};

async function setField(p, sel, v) {
  await p.evaluate(([sel, v]) => {
    const e = document.querySelector(sel);
    if (!e) throw new Error('없는 칸: ' + sel);
    if (v === 'today') v = new Date().toISOString().slice(0, 10);
    if (v === ':first') v = [...e.options].map((o) => o.value).find((x) => x && x !== '__custom__');
    e.value = v;
    e.dispatchEvent(new Event('input', { bubbles: true }));
    e.dispatchEvent(new Event('change', { bubbles: true }));
  }, [sel, v]);
  await p.waitForTimeout(250);
}

async function fill(p, code) {
  const steps = SPECIAL[code];
  if (!steps) {
    for (let i = 0; i < 4; i++) { await p.evaluate(fillGeneric); await p.waitForTimeout(250); }
    return;
  }
  for (const [a, b] of steps) {
    if (a === 'click') { await p.click(b); await p.waitForTimeout(300); }
    else if (a === 'generic') { for (let i = 0; i < b; i++) { await p.evaluate(fillGeneric); await p.waitForTimeout(400); } }
    else await setField(p, a, b);
  }
}

(async () => {
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.route(/firebasedatabase|google\.com|gstatic|googleapis|telegram/, (r) => r.abort());
  const codes = fs.readdirSync(path.join(ROOT, 'records')).filter((f) => f.endsWith('.html'))
    .map((f) => f.slice(0, -5)).filter((c) => !ONLY || ONLY.includes(c));
  const results = [];
  for (const code of codes) {
    const p = await ctx.newPage();
    const errs = [], alerts = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
    p.on('dialog', async (d) => { if (d.type() === 'alert') alerts.push(d.message().replace(/\s+/g, ' ').slice(0, 100)); await d.accept(); });
    const r = { code, ok: false };
    try {
      await p.goto(BASE + '/records/' + code + '.html', { waitUntil: 'load' });
      await p.waitForTimeout(1200);
      if (await p.$('#dkjEmpId')) {
        await p.fill('#dkjEmpId', '4343'); await p.fill('#dkjPw', PW);
        await p.click('form.dkj-auth-card button[type=submit]'); await p.waitForTimeout(1500);
      }
      await fill(p, code);
      if (LOCK) {
        for (const id of ['btnSave', 'btnLock']) {
          const bt = await p.$('#' + id);
          if (bt && !(await bt.isDisabled())) { await bt.click(); await p.waitForTimeout(900); }
        }
      }
      const stages = await p.$$eval('#approvalPanel .apv-btn', (els) => els.map((e) => e.getAttribute('data-stage')));
      for (const k of stages) {
        const btn = await p.$('#approvalPanel .apv-btn[data-stage="' + k + '"]');
        if (!btn || await btn.isDisabled()) continue;
        await btn.click(); await p.waitForTimeout(900);
      }
      const stored = await p.evaluate(async (c) => {
        const l = await DkjRecordStore.list(c);
        const rec = (l || []).slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
        return rec ? { locked: !!rec.locked, signed: Object.keys(rec.signoff || {}).filter((k) => rec.signoff[k] && rec.signoff[k].at) } : null;
      }, code);
      r.stages = stages;
      r.signed = stored ? stored.signed : [];
      r.locked = stored ? stored.locked : false;
      r.ok = !!stored && stages.length > 0 && stages.every((k) => r.signed.includes(k)) && (!LOCK || r.locked) && !errs.length;
    } catch (e) { r.fatal = e.message.slice(0, 160); }
    if (errs.length) r.errors = errs;
    if (alerts.length) r.alerts = alerts;
    results.push(r);
    console.log((r.ok ? 'OK  ' : 'FAIL') + ' ' + code + (r.ok ? '' : ' ' + JSON.stringify({ signed: r.signed, stages: r.stages, alerts: r.alerts, errors: r.errors, fatal: r.fatal })));
    await p.close();
  }
  await browser.close();
  const bad = results.filter((r) => !r.ok);
  console.log('\n' + (LOCK ? '[저장→작성완료→결재] ' : '[새 시트 결재] ') + (results.length - bad.length) + '/' + results.length + ' 통과');
  process.exit(bad.length ? 1 : 0);
})();
