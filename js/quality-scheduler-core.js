/**
 * 자가품질검사·보건증 스케줄러 — 날짜 계산·상태 판정·텔레그램 문안 (순수 함수)
 *
 * 화면(js/quality-scheduler.js)과 매일 발송 스크립트(scripts/quality-scheduler-alert.cjs),
 * 단위 테스트(tests/quality-scheduler-core.test.js)가 이 파일 하나를 함께 쓴다.
 * 화면에 뜨는 상태와 텔레그램 알림이 다른 기준으로 판정되면 안 되기 때문이다.
 * DOM·저장소·네트워크에 접근하지 않는다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DkjQualityCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_WARNING_DAYS = 14;
  var DEFAULT_HEALTH_ALERT_DAYS = [30, 7, 1];
  var DEFAULT_INTERVAL_MONTHS = 2;

  function pad(n) { return String(n).padStart(2, '0'); }

  function todayKst(now) {
    var d = now ? new Date(now) : new Date();
    var kst = new Date(d.getTime() + 9 * 3600000);
    return kst.getUTCFullYear() + '-' + pad(kst.getUTCMonth() + 1) + '-' + pad(kst.getUTCDate());
  }

  function parseDate(text) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text || ''));
    if (!m) return null;
    var y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    var t = new Date(Date.UTC(y, mo - 1, d));
    if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
    return t;
  }

  function fmt(t) { return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()); }

  /** 기준일 + N개월. 말일이 없는 달은 그 달의 말일로 맞춘다(1/31 + 1개월 = 2/28). 마감을 늦추지 않는 방향이다. */
  function addMonths(dateText, months) {
    var t = parseDate(dateText);
    if (!t) return '';
    var y = t.getUTCFullYear(), m = t.getUTCMonth() + Number(months || 0), d = t.getUTCDate();
    var lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return fmt(new Date(Date.UTC(y, m, Math.min(d, lastDay))));
  }

  function addDays(dateText, days) {
    var t = parseDate(dateText);
    if (!t) return '';
    return fmt(new Date(t.getTime() + Number(days || 0) * 86400000));
  }

  /** target - today (일). 날짜가 올바르지 않으면 null */
  function dDay(target, today) {
    var a = parseDate(target), b = parseDate(today);
    if (!a || !b) return null;
    return Math.round((a.getTime() - b.getTime()) / 86400000);
  }

  function formatDDay(n) {
    if (n === null || n === undefined) return '-';
    if (n < 0) return Math.abs(n) + '일 초과';
    if (n === 0) return '오늘 마감';
    return 'D-' + n;
  }

  function normalizeHealthAlertDays(value) {
    var source = Array.isArray(value) ? value : String(value == null ? '' : value).split(/[\s,;/]+/);
    var days = source.filter(function (v) { return String(v).trim() !== ''; }).map(Number).filter(function (n) { return Number.isInteger(n) && n >= 0 && n <= 365; });
    var uniq = days.length ? days : DEFAULT_HEALTH_ALERT_DAYS;
    return uniq.filter(function (n, i) { return uniq.indexOf(n) === i; }).sort(function (a, b) { return b - a; });
  }

  function settingsOf(settings) {
    var s = settings || {};
    var warn = Number(s.warningDays);
    return {
      warningDays: Number.isFinite(warn) && warn > 0 ? warn : DEFAULT_WARNING_DAYS,
      healthAlertDays: normalizeHealthAlertDays(s.healthAlertDays),
      mainProductByType: s.mainProductByType && typeof s.mainProductByType === 'object' ? s.mainProductByType : {},
      hiddenTypeIds: Array.isArray(s.hiddenTypeIds) ? s.hiddenTypeIds : []
    };
  }

  function typeOf(types, id) {
    for (var i = 0; i < types.length; i++) if (types[i].id === id) return types[i];
    return null;
  }

  /** 제품 1건의 마감일·D-Day·상태. status: overdue | urgent | safe | stopped | paused */
  function productComputed(product, types, settings, today) {
    var cfg = settingsOf(settings);
    var type = typeOf(types || [], product.typeId);
    var interval = Number(product.intervalMonths || (type && type.intervalMonths) || DEFAULT_INTERVAL_MONTHS);
    var nextDeadline = addMonths(product.lastManufactureDate, interval);
    var d = nextDeadline ? dDay(nextDeadline, today) : null;
    var status = 'safe';
    if (product.productionStatus === 'stopped') status = 'stopped';
    else if (product.alertStatus === 'paused') status = 'paused';
    else if (d !== null) status = d < 0 ? 'overdue' : (d <= cfg.warningDays ? 'urgent' : 'safe');
    return Object.assign({}, product, {
      typeName: type ? type.name : '미분류', intervalMonths: interval, nextDeadline: nextDeadline, dDay: d, status: status
    });
  }

  /** 보건증 1건의 D-Day·상태. status: overdue | urgent | safe | inactive | paused */
  function healthComputed(cert, settings, today) {
    var cfg = settingsOf(settings);
    var d = dDay(cert.expiresAt, today);
    var status = 'safe';
    if (cert.employmentStatus === 'inactive') status = 'inactive';
    else if (cert.alertStatus === 'paused') status = 'paused';
    else if (d !== null) status = d < 0 ? 'overdue' : (d <= Math.max.apply(null, cfg.healthAlertDays) ? 'urgent' : 'safe');
    return Object.assign({}, cert, { dDay: d, status: status });
  }

  /**
   * 식품유형별로 검사주기를 관리하므로 같은 유형에 제품이 여러 개여도 '대표 제품' 1건만 알림 대상으로 삼는다.
   * 대표 = 설정에서 고정한 메인 제품, 없으면 최근 제조일이 가장 늦은 제품. 유형 미지정 제품은 전부 포함한다.
   */
  function representativeProducts(products, settings) {
    var cfg = settingsOf(settings);
    var latest = {}, byId = {}, untyped = [];
    (products || []).forEach(function (p) {
      if (!p.typeId) { untyped.push(p); return; }
      byId[p.id] = p;
      var cur = latest[p.typeId];
      if (!cur || String(p.lastManufactureDate || '') > String(cur.lastManufactureDate || '')) latest[p.typeId] = p;
    });
    Object.keys(cfg.mainProductByType).forEach(function (typeId) {
      var pinned = byId[cfg.mainProductByType[typeId]];
      if (pinned && pinned.typeId === typeId) latest[typeId] = pinned;
    });
    return Object.keys(latest).map(function (k) { return latest[k]; }).concat(untyped);
  }

  /** 최신 성적서가 최근 제조일보다 이전이면(또는 성적서가 없으면) 미등록으로 본다. 생산 중단·알림 중지 제품은 제외. */
  function missingCertificate(product, certs) {
    if (product.productionStatus === 'stopped' || product.alertStatus === 'paused') return null;
    var related = (certs || []).filter(function (c) {
      return c.inspectionDate && c.typeId === product.typeId;
    }).sort(function (a, b) { return String(b.inspectionDate).localeCompare(String(a.inspectionDate)); });
    var latest = related[0];
    var current = latest && (!product.lastManufactureDate || String(latest.inspectionDate) >= String(product.lastManufactureDate));
    return current ? null : { latestInspectionDate: latest ? latest.inspectionDate : '' };
  }

  /** 알림 대상 전체. data = { types, products, health, certs, settings } */
  function buildAlerts(data, today) {
    var types = data.types || [];
    var cfg = settingsOf(data.settings);
    var products = representativeProducts(data.products, data.settings);
    var out = { overdue: [], urgent: [], missingCert: [], health: [] };

    products.forEach(function (p) {
      var c = productComputed(p, types, data.settings, today);
      if (c.status === 'stopped' || c.status === 'paused') return;
      if (c.dDay === null) return;
      var row = { id: p.id, name: p.name, typeName: c.typeName, deadline: c.nextDeadline, dDay: c.dDay };
      if (c.dDay < 0) out.overdue.push(row);
      else if (c.dDay <= cfg.warningDays) out.urgent.push(row);
    });

    products.forEach(function (p) {
      var miss = missingCertificate(p, data.certs);
      if (!miss) return;
      var type = typeOf(types, p.typeId);
      out.missingCert.push({
        id: p.id, name: p.name, typeName: type ? type.name : '미분류',
        lastManufactureDate: p.lastManufactureDate || '미입력', latestInspectionDate: miss.latestInspectionDate
      });
    });

    (data.health || []).forEach(function (h) {
      if (h.employmentStatus === 'inactive' || h.alertStatus === 'paused') return;
      var d = dDay(h.expiresAt, today);
      if (d !== null && (d < 0 || cfg.healthAlertDays.indexOf(d) !== -1)) {
        out.health.push({ id: h.id, name: h.employeeName, department: String(h.department || '').replace(/\s+/g, ' ').trim() || '미지정', expiresAt: h.expiresAt, dDay: d });
      }
    });

    out.overdue.sort(function (a, b) { return a.dDay - b.dDay; });
    out.urgent.sort(function (a, b) { return a.dDay - b.dDay; });
    out.health.sort(function (a, b) { return a.dDay - b.dDay; });
    out.total = out.overdue.length + out.urgent.length + out.missingCert.length + out.health.length;
    out.healthAlertDays = cfg.healthAlertDays;
    return out;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** 텔레그램 HTML 본문 */
  function telegramMessage(alerts, today) {
    var m = '🧪 <b>동김제농협 자가품질검사·보건증 알림</b>\n';
    m += '📅 ' + today + ' · 확인 필요 <b>' + alerts.total + '건</b>\n';
    m += '━━━━━━━━━━━━━━━━\n\n';
    if (alerts.overdue.length) {
      m += '🚨 <b>검사 기한 초과 · ' + alerts.overdue.length + '건</b>\n';
      alerts.overdue.forEach(function (p, i) {
        m += (i + 1) + '. <b>' + escapeHtml(p.name) + '</b>\n   ' + escapeHtml(p.typeName) + ' · <b>' + Math.abs(p.dDay) + '일 초과</b> · 마감 ' + p.deadline + '\n';
      });
      m += '\n';
    }
    if (alerts.urgent.length) {
      m += '⏰ <b>검사 마감 임박 · ' + alerts.urgent.length + '건</b>\n';
      alerts.urgent.forEach(function (p, i) {
        m += (i + 1) + '. <b>' + escapeHtml(p.name) + '</b>\n   ' + escapeHtml(p.typeName) + ' · <b>' + formatDDay(p.dDay) + '</b> · 마감 ' + p.deadline + '\n';
      });
      m += '\n';
    }
    if (alerts.missingCert.length) {
      m += '📄 <b>최신 성적서 미등록 · ' + alerts.missingCert.length + '건</b>\n';
      alerts.missingCert.forEach(function (p, i) {
        var cert = p.latestInspectionDate ? '이전 성적서 ' + p.latestInspectionDate : '등록된 성적서 없음';
        m += (i + 1) + '. <b>' + escapeHtml(p.name) + '</b>\n   ' + escapeHtml(p.typeName) + ' · 제조 ' + p.lastManufactureDate + ' · ' + cert + '\n';
      });
      m += '\n';
    }
    if (alerts.health.length) {
      var label = alerts.healthAlertDays.map(function (d) { return 'D-' + d; }).join(' · ');
      m += '👤 <b>보건증 만료 알림 (' + label + ') · ' + alerts.health.length + '명</b>\n';
      alerts.health.forEach(function (c, i) {
        var s = c.dDay < 0 ? Math.abs(c.dDay) + '일 초과' : formatDDay(c.dDay);
        m += (i + 1) + '. <b>' + escapeHtml(c.name) + '</b>\n   부서/직책: ' + escapeHtml(c.department) + ' · <b>' + s + '</b> · 만료 ' + c.expiresAt + '\n';
      });
      m += '\n';
    }
    if (!alerts.total) {
      m += '✅ <b>오늘 확인이 필요한 품목이 없습니다.</b>\n자가품질검사·성적서·보건증 일정이 정상입니다.\n\n';
    }
    m += '━━━━━━━━━━━━━━━━\n아래 버튼에서 상세 일정과 성적서를 바로 확인하세요.';
    return m;
  }

  return {
    DEFAULT_WARNING_DAYS: DEFAULT_WARNING_DAYS,
    DEFAULT_HEALTH_ALERT_DAYS: DEFAULT_HEALTH_ALERT_DAYS,
    todayKst: todayKst, parseDate: parseDate, addMonths: addMonths, addDays: addDays, dDay: dDay, formatDDay: formatDDay,
    normalizeHealthAlertDays: normalizeHealthAlertDays, settingsOf: settingsOf,
    productComputed: productComputed, healthComputed: healthComputed,
    representativeProducts: representativeProducts, missingCertificate: missingCertificate,
    buildAlerts: buildAlerts, telegramMessage: telegramMessage, escapeHtml: escapeHtml
  };
});
