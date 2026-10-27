#!/usr/bin/env node
/**
 * 자가품질검사·보건증 일일 텔레그램 알림 (GitHub Actions 스케줄 실행 전용)
 *
 * 이 앱은 서버가 없다 — 화면을 아무도 안 열어도 알림이 가려면 바깥에서 주기적으로 찔러주는
 * 무언가가 필요하다. .github/workflows/quality-scheduler-alert.yml 이 매일 09:00(KST)에
 * 이 스크립트를 돌려 RTDB 를 REST 로 직접 읽고(database.rules.json 이 이미 열어둔 경로만
 * 사용 — 규칙 변경·별도 비밀값 불필요) 텔레그램으로 보낸다.
 *
 *  - 데이터: records/<nodeKey('dkj:records:QS-ITEMS:list:v1')>  (화면과 같은 저장소)
 *  - 봇 토큰·Chat ID: system/settings/telegram  (시스템 설정 화면에서 등록한 값 — 불편접수·미작성 알림과 공용)
 *  - 판정: js/quality-scheduler-core.js  (화면과 동일한 함수)
 *
 * 환경변수: DRY_RUN=true (발송 없이 본문만 출력) / TEST_SEND=true (판정과 무관하게 연결 시험 1건)
 */
'use strict';
const path = require('path');
const core = require(path.join(__dirname, '..', 'js', 'quality-scheduler-core.js'));

const DB_URL = 'https://dkj-fssc22000-default-rtdb.asia-southeast1.firebasedatabase.app';
const ROOT = 'dkj-fssc22000';
const SITE_BASE = 'https://dkj.qaplus.kr/';
const FORM_ID = 'QS-ITEMS';
const DRY_RUN = /^(1|true|yes)$/i.test(process.env.DRY_RUN || '');
const TEST_SEND = /^(1|true|yes)$/i.test(process.env.TEST_SEND || '');

function nodeKey(value) {
  return Buffer.from(String(value), 'utf8').toString('base64').replace(/\//g, '_').replace(/\+/g, '-').replace(/=+$/, '');
}

async function rtdbGet(p) {
  const res = await fetch(`${DB_URL}/${ROOT}/${p}.json`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`RTDB ${p} HTTP ${res.status}`);
  return res.json();
}

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === 'object') return Object.keys(value).map((k) => value[k]).filter(Boolean);
  return [];
}

function splitItems(rows) {
  const live = rows.filter((r) => r && !r.deleted);
  const byKind = (kind) => live.filter((r) => r.kind === kind);
  const setting = live.find((r) => r.kind === 'setting') || {};
  return {
    types: byKind('type'), products: byKind('product'), health: byKind('health'), certs: byKind('cert'),
    settings: setting
  };
}

async function sendTelegram(token, chatId, text, buttons) {
  const res = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true,
      reply_markup: { inline_keyboard: buttons }
    })
  });
  const body = await res.json().catch(() => ({}));
  if (!body.ok) throw new Error(body.description || `HTTP ${res.status}`);
}

async function main() {
  const today = core.todayKst();
  const tg = (await rtdbGet('system/settings/telegram')) || {};
  const token = String(tg.botToken || '').trim();
  const chatIds = [...new Set(String(tg.chatId || '').split(/[\s,;]+/).map((v) => v.trim()).filter(Boolean))];
  if (tg.enabled === false || !token || !chatIds.length) {
    console.log('텔레그램 설정이 없거나 꺼져 있어 알림을 보내지 않습니다. (시스템 설정 화면에서 등록)');
    return;
  }
  const buttons = [[{ text: '🗓️ 스케줄러 열기', url: `${SITE_BASE}periodic-alerts.html#quality` }]];

  if (TEST_SEND) {
    const text = `🔧 <b>[동김제농협] 자가품질검사·보건증 알림 — 연결 테스트</b>\n실행 ${today} (KST)\n이 메시지가 보이면 일일 알림 발송 경로가 정상입니다.`;
    for (const id of chatIds) await sendTelegram(token, id, text, buttons);
    console.log('테스트 메시지 발송 완료');
    return;
  }

  const node = await rtdbGet(`records/${nodeKey(`dkj:records:${FORM_ID}:list:v1`)}`);
  const data = splitItems(toArray(node && node.value));
  const alerts = core.buildAlerts(data, today);
  const text = core.telegramMessage(alerts, today);
  console.log(`제품 ${data.products.length} · 보건증 ${data.health.length} · 성적서 ${data.certs.length} → 알림 ${alerts.total}건`);
  if (DRY_RUN) { console.log('[dry-run] 발송 내용:\n' + text); return; }
  // 등록된 데이터가 아직 하나도 없으면 "정상"이라는 거짓 안심 메시지를 보내지 않는다.
  if (!data.products.length && !data.health.length) { console.log('등록된 제품·보건증이 없어 발송하지 않습니다.'); return; }

  const failures = [];
  for (const id of chatIds) {
    try { await sendTelegram(token, id, text, buttons); console.log(`발송 완료: ${id}`); }
    catch (e) { failures.push(`${id}: ${e.message}`); }
  }
  if (failures.length) { console.error('텔레그램 발송 실패\n' + failures.join('\n')); process.exitCode = 1; }
}

main().catch((e) => { console.error('오류:', e.message); process.exitCode = 1; });
