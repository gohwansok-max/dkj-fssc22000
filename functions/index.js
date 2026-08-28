'use strict';

/**
 * 동김제농협 품질 경보 함수.
 *
 * records_v2의 단일 기록 변경을 감지해 Make 웹훅으로 전달한다.
 * 실제 Gmail·카카오 알림톡·SMS 발송은 Make 시나리오에서 채널별로 분기한다.
 * 웹훅 URL·공유 비밀은 Secret Manager에만 보관하며 GitHub Pages에는 절대 노출하지 않는다.
 */
const crypto = require('node:crypto');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { logger } = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const { onRequest } = require('firebase-functions/v2/https');
const { onValueWritten } = require('firebase-functions/v2/database');

initializeApp();

const MAKE_WEBHOOK_URL = defineSecret('DKJ_ALERT_WEBHOOK_URL');
const MAKE_WEBHOOK_SECRET = defineSecret('DKJ_ALERT_WEBHOOK_SECRET');
const TELEGRAM_BOT_TOKEN = defineSecret('DKJ_TELEGRAM_BOT_TOKEN');
const TELEGRAM_CHAT_ID = defineSecret('DKJ_TELEGRAM_CHAT_ID');
const ROOT = 'dkj-fssc22000';
const INSTANCE = 'dkj-fssc22000-default-rtdb';
const REGION = 'asia-southeast1';

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dayStart() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value.getTime();
}

function dueOverdue(value) {
  const due = Date.parse(value || '');
  return Boolean(value) && Number.isFinite(due) && due < dayStart();
}

function iso(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

function compact(value) {
  return String(value == null ? '' : value).trim().slice(0, 400);
}

function alert(level, type, title, summary, fingerprint) {
  return { level, type, title, summary, fingerprint: compact(fingerprint) };
}

/** 기록 하나를 감사 대응 우선순위에 맞는 경보로 변환한다. */
function evaluate(record, workflow) {
  const alerts = [];
  const formId = compact(record.formId);
  const locked = Boolean(workflow && workflow.locked);
  const title = compact(record.title || record.capaNo || record.subject || record.targetLot || record.lot || '품질 기록');
  const lot = compact(record.lot || record.targetLot || record.rawLot || record.productionLot || '-');
  if (formId === 'CAPA-MANAGEMENT' && !locked) {
    if (dueOverdue(record.dueDate)) {
      alerts.push(alert('danger', 'capa_overdue', 'CAPA 기한 초과', `${compact(record.capaNo || title)} · ${compact(record.item || '품목 미입력')} · 완료기한 ${compact(record.dueDate)}`, `${record.dueDate}|${record.status}`));
    } else {
      alerts.push(alert('warning', 'capa_open', '미종결 CAPA', `${compact(record.capaNo || title)} · ${compact(record.item || '품목 미입력')} · ${compact(record.status || '진행 중')}`, `${record.status}|${record.dueDate}`));
    }
  }

  if ((formId === 'TRACE-DRILL' || formId === 'FR-017') && locked) {
    const minutes = number(record.elapsedMinutes || record.minutes);
    if (record.withinTwoHours === false || minutes > 120) {
      alerts.push(alert('danger', 'mock_recall_over_2h', '모의회수 2시간 목표 미달', `LOT ${lot} · ${minutes}분 소요`, `${minutes}|${record.withinTwoHours}`));
    }
    if (record.recoveryRate !== '' && record.recoveryRate != null && number(record.recoveryRate) < 100) {
      alerts.push(alert('warning', 'mock_recall_recovery_gap', '모의회수 수량대조 확인 필요', `LOT ${lot} · 회수·확보율 ${number(record.recoveryRate)}%`, `${record.recoveryRate}`));
    }
    if (record.locationQty && Math.abs(number(record.locationQty.gap)) > 0) {
      alerts.push(alert('danger', 'mock_recall_quantity_gap', '모의회수 수량 차이 발생', `LOT ${lot} · 수량차이 ${number(record.locationQty.gap)}`, `${record.locationQty.gap}`));
    }
  }

  if (formId === 'FR-016' && !locked) {
    alerts.push(alert('warning', 'recall_open', '미종결 제품회수 보고서', `${compact(record.subject || title)} · LOT ${lot}`, `${compact(record.result)}|${compact(record.status)}`));
  }

  if (formId === 'FR-040' && !locked) {
    alerts.push(alert('warning', 'traceability_open', '추적성 점검 후속 확인 필요', `LOT ${lot} · 완료·잠금 또는 점검확인 상태를 확인하세요.`, `${compact(record.result)}|${compact(record.status)}`));
  }

  return alerts;
}

function signature(secret, body) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function alreadyDispatched(ref, item) {
  const current = await ref.child(item.type).get();
  return current.exists() && current.val() && current.val().fingerprint === item.fingerprint;
}

async function forwardWebhook(payload) {
  const url = MAKE_WEBHOOK_URL.value();
  const secret = MAKE_WEBHOOK_SECRET.value();
  if (!url || !secret) throw new Error('경보 웹훅 Secret이 설정되지 않았습니다.');
  const body = JSON.stringify(payload);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-dkj-alert-signature': signature(secret, body),
      'x-dkj-alert-version': '1'
    },
    body
  });
  if (!response.ok) throw new Error(`경보 웹훅 응답 실패: HTTP ${response.status}`);
}

exports.dispatchQualityAlert = onValueWritten({
  ref: `/${ROOT}/records_v2/{formKey}/{recordKey}`,
  instance: INSTANCE,
  region: REGION,
  secrets: [MAKE_WEBHOOK_URL, MAKE_WEBHOOK_SECRET],
  timeoutSeconds: 60,
  memory: '256MiB'
}, async (event) => {
  if (!event.data.after.exists()) return null;

  const raw = event.data.after.val() || {};
  const record = raw.data || {};
  const workflow = raw.workflow || {};
  if (!record.formId || !record.id) return null;

  const candidates = evaluate(record, workflow);
  if (!candidates.length) return null;

  const dispatchRef = getDatabase().ref(`${ROOT}/alert_dispatches/${event.params.formKey}/${event.params.recordKey}`);
  const pending = [];
  for (const item of candidates) {
    if (!(await alreadyDispatched(dispatchRef, item))) pending.push(item);
  }
  if (!pending.length) return null;

  const payload = {
    version: 1,
    source: 'dkj-fssc22000',
    eventId: event.id || '',
    occurredAt: new Date().toISOString(),
    record: {
      formId: compact(record.formId),
      recordId: compact(record.id),
      title: compact(record.title || record.capaNo || record.subject || '품질 기록'),
      lot: compact(record.lot || record.targetLot || record.rawLot || record.productionLot || ''),
      item: compact(record.item || record.subject || ''),
      dueDate: compact(record.dueDate || ''),
      updatedAt: iso(record.updatedAt || workflow.updatedAt || record.finishedAt || record.createdAt),
      locked: Boolean(workflow.locked),
      dashboardUrl: 'https://gohwansok-max.github.io/dkj-fssc22000/quality-dashboard.html'
    },
    alerts: pending
  };

  await forwardWebhook(payload);

  const completedAt = new Date().toISOString();
  const audit = {};
  pending.forEach((item) => {
    audit[item.type] = {
      fingerprint: item.fingerprint,
      level: item.level,
      title: item.title,
      dispatchedAt: completedAt,
      eventId: payload.eventId,
      delivery: 'make_webhook'
    };
  });
  await dispatchRef.update(audit);
  logger.info('품질 경보를 외부 발송 흐름으로 전달했습니다.', { recordId: record.id, types: pending.map((item) => item.type) });
  return null;
});

exports._test = { evaluate, dueOverdue };


/**
 * 정기 관리 사전 알림 이메일 함수.
 *
 * Cloud Scheduler가 15분마다 실행하고, 화면에 저장한 발송 시각과 일치할 때만
 * 정기관리 예정일을 계산해 전용 Make 웹훅으로 보낸다. Make는 Gmail 모듈로 수신자에게
 * 이메일을 발송한다. 같은 날짜·시각에는 재시도되어도 한 번만 전달한다.
 */
const { onSchedule } = require('firebase-functions/v2/scheduler');
const PERIODIC_ALERT_WEBHOOK_URL = defineSecret('DKJ_PERIODIC_ALERT_WEBHOOK_URL');
const PERIODIC_ALERT_WEBHOOK_SECRET = defineSecret('DKJ_PERIODIC_ALERT_WEBHOOK_SECRET');
const PERIODIC_FORM_ID = 'PERIODIC-ALERTS';
const PERIODIC_SETTINGS_FORM_ID = 'PERIODIC-ALERT-SETTINGS';
const KST_TIME_ZONE = 'Asia/Seoul';

function nodeKey(value) {
  return Buffer.from(String(value || ''), 'utf8').toString('base64')
    .replace(/\//g, '_').replace(/\+/g, '-').replace(/=+$/g, '');
}

function listKey(formId) {
  return `dkj:records:${formId}:list:v1`;
}

function asArray(raw, formId) {
  const rows = [];
  Object.keys(raw || {}).forEach((key) => {
    const item = raw[key] || {};
    const record = item.data || item;
    if (record && typeof record === 'object' && (!formId || record.formId === formId)) rows.push(record);
  });
  return rows;
}

function kstNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: KST_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date()).reduce((out, part) => {
    if (part.type !== 'literal') out[part.type] = part.value;
    return out;
  }, {});
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    time: `${parts.hour}:${parts.minute}`
  };
}

function kstDateTime(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00+09:00`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function kstDayDiff(dueDate, todayText) {
  const due = kstDateTime(dueDate);
  const todayDate = kstDateTime(todayText);
  if (!due || !todayDate) return null;
  return Math.round((due.getTime() - todayDate.getTime()) / 86400000);
}

function normalRecipients(value) {
  return (Array.isArray(value) ? value : []).map((item) => String(item || '').trim().toLowerCase())
    .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item))
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 20);
}

function isDispatchWindow(config, now) {
  const match = String(config.dispatchTime || '').match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return false;
  const hour = Number(match[1]), minute = Number(match[2]);
  // 화면은 15분 단위로만 허용한다. 스케줄러 지연은 같은 15분 버킷에서 허용한다.
  return minute % 15 === 0 && now.hour === hour && Math.floor(now.minute / 15) * 15 === minute;
}

function periodicAlertItems(records, config, todayText) {
  const levels = Object.assign({ overdue: true, today: true, soon: true }, config.levels || {});
  return records.filter((record) => record && record.active !== false).map((record) => {
    const diff = kstDayDiff(record.dueDate, todayText);
    const lead = Math.max(0, Number(record.leadDays == null ? 7 : record.leadDays));
    let level = '';
    if (diff !== null && diff < 0 && levels.overdue) level = 'danger';
    else if (diff === 0 && levels.today) level = 'warning';
    else if (diff !== null && diff > 0 && diff <= lead && levels.soon) level = 'info';
    if (!level) return null;
    const status = diff < 0 ? `${Math.abs(diff)}일 지남` : (diff === 0 ? '오늘 실시' : `${diff}일 후`);
    return {
      id: compact(record.id),
      level,
      type: level === 'danger' ? 'periodic_overdue' : (diff === 0 ? 'periodic_today' : 'periodic_soon'),
      title: compact(record.name || '정기 관리 항목'),
      summary: `${compact(record.dueDate)} · ${status}${record.target ? ` · 대상 ${compact(record.target)}` : ''}${record.owner ? ` · 담당 ${compact(record.owner)}` : ''}`,
      status,
      dueDate: compact(record.dueDate),
      target: compact(record.target),
      owner: compact(record.owner),
      category: compact(record.type),
      fingerprint: `${compact(record.id)}|${compact(record.dueDate)}|${level}|${compact(record.target)}`
    };
  }).filter(Boolean).sort((a, b) => (a.level === 'danger' ? -1 : 0) - (b.level === 'danger' ? -1 : 0));
}

async function loadPeriodicRecords(formId) {
  const db = getDatabase();
  const schema = await db.ref(`${ROOT}/sync_meta/schemaVersion`).get();
  if (Number(schema.val()) === 2) {
    const snap = await db.ref(`${ROOT}/records_v2/${nodeKey(formId)}`).get();
    return asArray(snap.val(), formId);
  }
  const snap = await db.ref(`${ROOT}/records/${nodeKey(listKey(formId))}`).get();
  const raw = snap.val() || {};
  return Array.isArray(raw.value) ? raw.value : [];
}

async function forwardPeriodicWebhook(payload) {
  const url = PERIODIC_ALERT_WEBHOOK_URL.value();
  const secret = PERIODIC_ALERT_WEBHOOK_SECRET.value();
  if (!url || !secret) throw new Error('정기 알림 이메일 웹훅 Secret이 설정되지 않았습니다.');
  const body = JSON.stringify(payload);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-dkj-alert-signature': signature(secret, body),
      'x-dkj-alert-version': '1'
    },
    body
  });
  if (!response.ok) throw new Error(`정기 알림 웹훅 응답 실패: HTTP ${response.status}`);
}

exports.dispatchPeriodicEmailAlert = onSchedule({
  schedule: 'every 15 minutes',
  timeZone: KST_TIME_ZONE,
  region: REGION,
  secrets: [PERIODIC_ALERT_WEBHOOK_URL, PERIODIC_ALERT_WEBHOOK_SECRET],
  timeoutSeconds: 120,
  memory: '256MiB'
}, async () => {
  const now = kstNow();
  const settingsRows = await loadPeriodicRecords(PERIODIC_SETTINGS_FORM_ID);
  const config = settingsRows.find((row) => row && row.id === 'pa-email-settings' && row.kind === 'periodic_email_settings');
  if (!config || config.enabled === false || !isDispatchWindow(config, now)) return null;

  const recipients = normalRecipients(config.recipients);
  if (!recipients.length) {
    logger.warn('정기 알림 이메일 수신자가 없어 발송하지 않았습니다.');
    return null;
  }

  const records = await loadPeriodicRecords(PERIODIC_FORM_ID);
  const alerts = periodicAlertItems(records, config, now.date);
  if (!alerts.length) return null;

  const dayKey = now.date.replace(/-/g, '');
  const dispatchRef = getDatabase().ref(`${ROOT}/alert_dispatches/periodic_email/${dayKey}/${String(config.dispatchTime).replace(':', '')}`);
  const already = await dispatchRef.get();
  if (already.exists()) return null;

  const payload = {
    version: 1,
    source: 'dkj-fssc22000',
    channel: 'periodic_email',
    occurredAt: new Date().toISOString(),
    recipients,
    dispatch: { date: now.date, time: config.dispatchTime, timeZone: KST_TIME_ZONE },
    dashboardUrl: 'https://gohwansok-max.github.io/dkj-fssc22000/periodic-alerts.html',
    alerts
  };
  await forwardPeriodicWebhook(payload);
  await dispatchRef.set({
    dispatchedAt: new Date().toISOString(),
    recipientCount: recipients.length,
    alertCount: alerts.length,
    fingerprints: alerts.map((item) => item.fingerprint),
    delivery: 'make_webhook'
  });
  logger.info('정기 관리 이메일 알림을 외부 발송 흐름으로 전달했습니다.', { recipientCount: recipients.length, alertCount: alerts.length, dispatchTime: config.dispatchTime });
  return null;
});

/**
 * 텔레그램 알림 발송 HTTP 함수 (클라이언트 토큰 은닉)
 */
exports.sendTelegramAlert = onRequest({
  region: REGION,
  cors: true,
  secrets: [TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID],
  timeoutSeconds: 30,
  memory: '256MiB'
}, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  try {
    const { category, message, user, pageTitle, pageUrl } = req.body || {};
    if (!message) {
      res.status(400).json({ ok: false, error: 'MESSAGE_REQUIRED' });
      return;
    }

    let botToken = '';
    let chatId = '';

    try {
      botToken = TELEGRAM_BOT_TOKEN.value();
      chatId = TELEGRAM_CHAT_ID.value();
    } catch (e) {}

    if (!botToken || !chatId) {
      const db = getDatabase();
      const cfgSnap = await db.ref(`${ROOT}/system/settings/telegram`).get();
      if (cfgSnap.exists()) {
        const cfg = cfgSnap.val() || {};
        botToken = botToken || cfg.botToken;
        chatId = chatId || cfg.chatId;
      }
    }

    if (!botToken || !chatId) {
      res.status(500).json({ ok: false, error: 'TELEGRAM_CONFIG_MISSING' });
      return;
    }

    const now = new Date();
    const timeStr = now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
    const u = user || { empId: '미로그인', name: '현장직원', roleLabel: '작업자' };

    const escapeHtml = (str) => String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const text = '🚨 <b>[동김제농협 스마트 HACCP] ' + escapeHtml(category || '불편사항 접수') + '</b>\n' +
      '━━━━━━━━━━━━━━━━━━━━\n' +
      '👤 <b>접수자:</b> ' + escapeHtml(u.name || u.empId) + ' (사번: ' + escapeHtml(u.empId) + ' / ' + escapeHtml(u.roleLabel || u.role || '작업자') + ')\n' +
      '📍 <b>발생화면:</b> ' + escapeHtml(pageTitle || '업무 화면') + '\n' +
      '🔗 <b>페이지 URL:</b> ' + escapeHtml(pageUrl || '-') + '\n' +
      '🕒 <b>접수시각:</b> ' + timeStr + '\n' +
      '━━━━━━━━━━━━━━━━━━━━\n' +
      '📝 <b>[상세 내용]</b>\n' +
      escapeHtml(message) + '\n' +
      '━━━━━━━━━━━━━━━━━━━━';

    const tgRes = await fetch(`https://api.telegram.org/bot${encodeURIComponent(botToken.trim())}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    const tgData = await tgRes.json();
    if (tgData.ok) {
      res.status(200).json({ ok: true, message: 'SENT_SUCCESSFULLY' });
    } else {
      res.status(502).json({ ok: false, error: tgData.description || 'TELEGRAM_SEND_FAILED' });
    }
  } catch (err) {
    logger.error('Telegram alert dispatch error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

exports._test.periodicAlertItems = periodicAlertItems;
exports._test.isDispatchWindow = isDispatchWindow;
