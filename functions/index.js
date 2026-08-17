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
const { onValueWritten } = require('firebase-functions/v2/database');

initializeApp();

const MAKE_WEBHOOK_URL = defineSecret('DKJ_ALERT_WEBHOOK_URL');
const MAKE_WEBHOOK_SECRET = defineSecret('DKJ_ALERT_WEBHOOK_SECRET');
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
