const crypto = require('node:crypto');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { logger } = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const { onSchedule } = require('firebase-functions/v2/scheduler');

initializeApp();

const ROOT = 'dkj-fssc22000';
const REGION = 'asia-southeast1';
const KST_TIME_ZONE = 'Asia/Seoul';
const PERIODIC_FORM_ID = 'PERIODIC-ALERTS';
const PERIODIC_SETTINGS_FORM_ID = 'PERIODIC-ALERT-SETTINGS';
const PERIODIC_ALERT_WEBHOOK_URL = defineSecret('DKJ_PERIODIC_ALERT_WEBHOOK_URL');
const PERIODIC_ALERT_WEBHOOK_SECRET = defineSecret('DKJ_PERIODIC_ALERT_WEBHOOK_SECRET');

function compact(value) {
  return String(value == null ? '' : value).trim().slice(0, 400);
}

function signature(secret, body) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

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

exports._test = { periodicAlertItems, isDispatchWindow };
