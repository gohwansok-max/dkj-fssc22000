(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var forms = { capa: 'CAPA-MANAGEMENT', drill: 'TRACE-DRILL', recall: 'FR-016', mock: 'FR-017', trace: 'FR-040', link: 'TRACE-LINK' };
  var ALERT_SETTINGS_KEY = 'dkj:quality-dashboard:alert-settings:v1';
  var ALERT_SEEN_KEY = 'dkj:quality-dashboard:alert-seen:v1';
  var ALERT_CHECK_MS = 30000;
  var state = { all: [], filtered: [], alerts: [], initialized: false, alertTimer: null };

  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function list(formId) { try { return (window.DkjRecordStore && DkjRecordStore.list(formId)) || []; } catch (e) { return []; } }
  function n(v) { var x = Number(v); return isFinite(x) ? x : 0; }
  function dateVal(r) {
    var v = r.closureDate || r.finishedAt || r.verifyDate || r.drillDate || r.docDate || r.processDate || r.receiveDate || r.createdAt || '';
    var d = new Date(v); return isNaN(d.getTime()) ? null : d;
  }
  function dateText(r) { var d = dateVal(r); return d ? d.toISOString().slice(0, 10) : '-'; }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function bool(v) { return v === true || v === 1 || String(v).toLowerCase() === 'true' || ['o', 'y', 'yes', '적합', '완료', '확인'].indexOf(String(v).toLowerCase()) >= 0; }
  function validChecks(r, keys, min) { return keys.filter(function (k) { return bool(r[k]); }).length >= min; }
  function linkFor(type, r) {
    var id = encodeURIComponent(r.id || ''); var lot = encodeURIComponent(r.lot || r.targetLot || '');
    if (type === 'capa') return 'capa-management.html?record=' + id;
    if (type === 'drill') return 'traceability.html?lot=' + lot;
    if (type === 'recall') return 'records/FR-016.html?record=' + id;
    if (type === 'mock') return 'records/FR-017.html?record=' + id;
    return 'records/FR-040.html?record=' + id;
  }
  function inPeriod(r) {
    var p = $('period').value; if (p === 'all') return true;
    var d = dateVal(r); if (!d) return false;
    return (today().getTime() - d.getTime()) <= n(p) * 86400000;
  }
  function setText(id, text) { var el = $(id); if (el) el.textContent = text; }
  function pct(numer, denom) { return denom ? Math.round((numer / denom) * 100) : null; }
  function bar(label, value, total, klass, suffix) {
    var p = total ? Math.max(0, Math.min(100, Math.round(value / total * 100))) : 0;
    return '<div class="bar-row"><span>' + esc(label) + '</span><div class="bar"><i class="' + esc(klass || '') + '" style="width:' + p + '%"></i></div><span class="bar-val">' + esc(value + (suffix || '')) + (total ? ' / ' + esc(total + (suffix || '')) : '') + '</span></div>';
  }
  function statusLabel(r) {
    if (r.locked) return '종결·잠금';
    return ({ containment: '즉시조치', root: '원인분석', action: '조치 실행', verification: '효과검증', closed: '종결 요청' })[r.status] || '진행 중';
  }
  function register(type, records, doneFn, label, urlType) {
    records.forEach(function (r) {
      state.all.push({ type: type, label: label, record: r, done: !!doneFn(r), href: linkFor(urlType || type, r) });
    });
  }
  function data() {
    state.all = [];
    register('capa', list(forms.capa), function (r) { return !!r.locked; }, 'CAPA', 'capa');
    register('drill', list(forms.drill), function (r) { return !!r.locked && (r.checks ? Object.keys(r.checks).length >= 8 : true); }, '모의회수', 'drill');
    register('recall', list(forms.recall), function (r) { return !!r.locked || !!(r.result && r.approver); }, '제품회수', 'recall');
    register('mock', list(forms.mock), function (r) { return !!r.locked || validChecks(r, ['d01', 'd02', 'd03', 'd04'], 3); }, 'FR-017 모의회수', 'mock');
    register('trace', list(forms.trace), function (r) { return !!r.locked || validChecks(r, ['t01', 't02', 't03'], 2); }, 'FR-040 추적성 점검', 'trace');
    state.filtered = state.all.filter(function (x) { return inPeriod(x.record); });
  }
  function metrics() {
    var xs = state.filtered, caps = xs.filter(function (x) { return x.type === 'capa'; });
    var closed = caps.filter(function (x) { return x.done; }), open = caps.filter(function (x) { return !x.done; });
    var overdue = open.filter(function (x) { var d = new Date(x.record.dueDate); return x.record.dueDate && !isNaN(d.getTime()) && d < today(); });
    var mock = xs.filter(function (x) { return x.type === 'drill' || x.type === 'mock'; });
    var mockDone = mock.filter(function (x) { return x.done; });
    var timed = mockDone.filter(function (x) { return n(x.record.elapsedMinutes || x.record.minutes) > 0 || typeof x.record.withinTwoHours === 'boolean'; });
    var within = timed.filter(function (x) { var r = x.record; return r.withinTwoHours === true || (n(r.elapsedMinutes || r.minutes) > 0 && n(r.elapsedMinutes || r.minutes) <= 120); });
    var lots = {}, isolated = 0;
    xs.forEach(function (x) {
      var r = x.record, lot = r.lot || r.targetLot || r.rawLot || r.productionLot || r.packLot || '';
      if (lot) lots[lot] = 1;
      if (x.type === 'drill') isolated += n(r.isolatedQty || (r.locationQty && r.locationQty.isolated));
      if (x.type === 'capa' && r.isolation) isolated += n(r.qty);
    });
    setText('mClosedCapa', closed.length); setText('mClosedCapaSub', '전체 CAPA ' + caps.length + '건 중');
    setText('mOpenCapa', open.length + ' / ' + overdue.length); setText('mMockDone', mockDone.length); setText('mMockSub', '전체 훈련 ' + mock.length + '건 중');
    setText('mTwoHour', timed.length ? pct(within.length, timed.length) + '%' : '—');
    setText('mLots', Object.keys(lots).length + ' / ' + Math.round(isolated * 1000) / 1000);
    return { caps: caps, closed: closed, open: open, overdue: overdue, mock: mock, mockDone: mockDone, timed: timed, within: within, lots: Object.keys(lots).length, isolated: isolated };
  }
  function renderBars(m) {
    var rootPending = m.open.filter(function (x) { return !x.record.rootCause; }).length;
    var verifyPending = m.open.filter(function (x) { return !x.record.verificationResult || x.record.verificationResult === '검증 대기'; }).length;
    $('capaBars').innerHTML = bar('종결·잠금', m.closed.length, m.caps.length, 'green') + bar('미종결', m.open.length, m.caps.length, 'red') + bar('기한 초과', m.overdue.length, m.open.length, 'amber') + bar('원인분석 대기', rootPending, m.open.length, 'amber') + bar('효과검증 대기', verifyPending, m.open.length, 'amber');
    var trace = state.filtered.filter(function (x) { return x.type === 'trace'; }), traceDone = trace.filter(function (x) { return x.done; });
    var recalls = state.filtered.filter(function (x) { return x.type === 'recall'; }), recallDone = recalls.filter(function (x) { return x.done; });
    $('traceBars').innerHTML = bar('모의회수 완료', m.mockDone.length, m.mock.length, 'green') + bar('2시간 목표 충족', m.within.length, m.timed.length, m.timed.length && m.within.length === m.timed.length ? 'green' : 'amber') + bar('추적성 점검 완료', traceDone.length, trace.length, 'green') + bar('제품회수 종결', recallDone.length, recalls.length, 'green');
  }
  function renderSources() {
    var map = [['CAPA', 'capa'], ['모의회수', 'drill'], ['제품회수', 'recall'], ['FR-017 훈련', 'mock'], ['FR-040 추적점검', 'trace'], ['생산·출하 LOT 연결', 'link']];
    var links = list(forms.link).filter(inPeriod).length;
    $('sourceGrid').innerHTML = map.map(function (x) {
      var c = x[1] === 'link' ? links : state.filtered.filter(function (r) { return r.type === x[1]; }).length;
      return '<div class="source"><b>' + esc(x[0]) + '</b><span>' + c + '건</span><small>' + (c ? '대시보드 집계 반영' : '입력 기록 없음') + '</small></div>';
    }).join('');
  }
  function renderAlerts(m) {
    var out = [];
    if (m.overdue.length) out.push(['danger', '기한 초과 CAPA ' + m.overdue.length + '건이 있습니다. 조치기한·연장승인·효과검증 증빙을 우선 확인하세요.']);
    if (m.open.length) out.push(['', '미종결 CAPA ' + m.open.length + '건이 있습니다. 원인분석, 예방조치, 효과검증 및 HACCP팀 결재 상태를 확인하세요.']);
    if (m.timed.length && m.within.length < m.timed.length) out.push(['', '2시간 목표를 초과한 모의회수 기록이 ' + (m.timed.length - m.within.length) + '건 있습니다. 연락·추적·의사결정 병목을 CAPA로 연결하세요.']);
    if (!m.mockDone.length) out.push(['', '완료된 모의회수 기록이 없습니다. 최신 훈련 결과를 저장하고 수량대조·효과검증 증빙을 남기세요.']);
    if (!out.length) out.push(['ok', '현재 선택 기간에 기한초과 CAPA와 모의회수 시간 목표 미달 경보가 없습니다. 신규 기록은 새로고침하면 즉시 반영됩니다.']);
    $('alerts').innerHTML = out.map(function (x) { return '<div class="alert ' + x[0] + '">' + esc(x[1]) + '</div>'; }).join('');
    var notice = $('qualityNotice');
    if (m.overdue.length || m.open.length) { notice.className = 'notice'; notice.innerHTML = '<strong>심사 우선 확인:</strong> 미종결·기한초과 CAPA와 모의회수 개선조치의 근거·책임자·기한·효과검증 증빙을 먼저 검토하세요.'; }
    else { notice.className = 'notice ok'; notice.innerHTML = '<strong>현재 집계 기준:</strong> 완료 CAPA는 승인·종결 잠금 기록, 완료 모의회수는 필수 확인·잠금 또는 공식 훈련 점검 충족 기록입니다.'; }
  }
  function readJson(key, fallback) { try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; } }
  function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  function alertSettings() {
    var saved = readJson(ALERT_SETTINGS_KEY, {});
    return { enabled: saved.enabled !== false, severity: saved.severity === 'danger' ? 'danger' : 'warning' };
  }
  function saveAlertSettings(next) { writeJson(ALERT_SETTINGS_KEY, next); }
  function alertItem(level, code, item, title, detail) {
    var r = item.record || item || {}, ref = r.id || r.capaNo || r.lot || r.targetLot || 'record';
    return { id: code + ':' + ref, level: level, title: title, detail: detail, href: item.href || linkFor(item.type || 'trace', r), fingerprint: level + '|' + title + '|' + detail };
  }
  function buildLiveAlerts(m) {
    var out = [];
    m.overdue.forEach(function (x) {
      out.push(alertItem('danger', 'capa-overdue', x, 'CAPA 기한 초과', (x.record.capaNo || 'CAPA') + ' · ' + (x.record.item || '품목 미입력') + ' · 기한 ' + (x.record.dueDate || '-')));
    });
    m.open.filter(function (x) { return m.overdue.indexOf(x) < 0; }).forEach(function (x) {
      out.push(alertItem('warning', 'capa-open', x, '미종결 CAPA', (x.record.capaNo || 'CAPA') + ' · ' + (x.record.item || '품목 미입력') + ' · ' + statusLabel(x.record)));
    });
    m.mockDone.filter(function (x) { var r = x.record; return r.withinTwoHours === false || n(r.elapsedMinutes || r.minutes) > 120; }).forEach(function (x) {
      out.push(alertItem('danger', 'drill-late', x, '모의회수 2시간 목표 미달', (x.record.targetLot || x.record.lot || 'LOT 미입력') + ' · ' + n(x.record.elapsedMinutes || x.record.minutes) + '분 소요'));
    });
    m.mockDone.filter(function (x) { return n(x.record.recoveryRate) >= 0 && x.record.recoveryRate !== '' && n(x.record.recoveryRate) < 100; }).forEach(function (x) {
      out.push(alertItem('warning', 'drill-recovery', x, '모의회수 수량대조 확인 필요', (x.record.targetLot || x.record.lot || 'LOT 미입력') + ' · 회수·확보율 ' + n(x.record.recoveryRate) + '%'));
    });
    m.mockDone.filter(function (x) { return x.record.locationQty && Math.abs(n(x.record.locationQty.gap)) > 0; }).forEach(function (x) {
      out.push(alertItem('danger', 'drill-gap', x, '모의회수 수량 차이 발생', (x.record.targetLot || x.record.lot || 'LOT 미입력') + ' · 수량차이 ' + n(x.record.locationQty.gap)));
    });
    state.filtered.filter(function (x) { return x.type === 'recall' && !x.done; }).forEach(function (x) {
      out.push(alertItem('warning', 'recall-open', x, '미종결 제품회수 보고서', (x.record.subject || x.record.item || '제품회수') + ' · LOT ' + (x.record.lot || '-')));
    });
    state.filtered.filter(function (x) { return x.type === 'trace' && !x.done; }).forEach(function (x) {
      out.push(alertItem('warning', 'trace-open', x, '추적성 점검 후속 확인 필요', (x.record.lot || x.record.targetLot || 'LOT 미입력') + ' · 완료·잠금 또는 점검 확인을 검토하세요.'));
    });
    return out.sort(function (a, b) { return (a.level === 'danger' ? -1 : 1) - (b.level === 'danger' ? -1 : 1); });
  }
  function browserPermission() { return 'Notification' in window ? Notification.permission : 'unsupported'; }
  function severityPass(item, settings) { return settings.severity !== 'danger' || item.level === 'danger'; }
  function notifyNewAlerts(items, settings) {
    var stored = readJson(ALERT_SEEN_KEY, {}), next = {}, fresh = [];
    items.forEach(function (item) {
      var fingerprint = item.fingerprint;
      next[item.id] = fingerprint;
      if (state.initialized && stored[item.id] !== fingerprint && settings.enabled && severityPass(item, settings)) fresh.push(item);
    });
    writeJson(ALERT_SEEN_KEY, next);
    if (!fresh.length) return;
    var first = fresh[0], label = fresh.length > 1 ? ' 외 ' + (fresh.length - 1) + '건' : '';
    showToast('새 품질 경보: ' + first.title + label, first.level);
    if (browserPermission() === 'granted') {
      try { new Notification('동김제농협 품질 경보' + label, { body: first.title + ' — ' + first.detail, tag: 'dkj-quality-' + first.id, renotify: true }); } catch (e) {}
    }
  }
  function showToast(text, level) {
    var toast = $('qualityToast'); if (!toast) return;
    toast.textContent = text; toast.className = 'toast show ' + (level === 'danger' ? 'danger' : 'warn');
    clearTimeout(toast._timer); toast._timer = setTimeout(function () { toast.className = 'toast'; }, 5000);
  }
  function renderLiveAlerts(m) {
    var settings = alertSettings(), items = buildLiveAlerts(m), dangerous = items.filter(function (x) { return x.level === 'danger'; }).length;
    state.alerts = items;
    $('liveAlertEnabled').checked = settings.enabled; $('alertSeverity').value = settings.severity;
    var permission = browserPermission(), status = $('liveStatus');
    if (!settings.enabled) { status.className = 'live-status off'; status.textContent = '웹 알림 꺼짐'; }
    else if (dangerous) { status.className = 'live-status danger'; status.textContent = '긴급 ' + dangerous + '건 감지'; }
    else { status.className = 'live-status'; status.textContent = '실시간 감시 중'; }
    var permissionText = permission === 'granted' ? '브라우저 알림 허용됨' : (permission === 'denied' ? '브라우저 알림 차단됨' : (permission === 'unsupported' ? '이 브라우저는 알림 미지원' : '브라우저 알림 권한 필요'));
    $('requestAlertPermission').textContent = permissionText;
    $('requestAlertPermission').disabled = permission === 'unsupported' || permission === 'denied';
    $('liveSummary').innerHTML = '<span class="danger">긴급 ' + dangerous + '건</span><span class="warn">주의 ' + (items.length - dangerous) + '건</span><span>' + (settings.severity === 'danger' ? '브라우저: 긴급만' : '브라우저: 주의·긴급') + '</span><span>' + esc(permissionText) + '</span>';
    $('liveAlertFeed').innerHTML = items.length ? items.map(function (item) {
      return '<div class="live-alert ' + esc(item.level) + '"><i aria-hidden="true"></i><div><b>' + esc(item.title) + '</b><small>' + esc(item.detail) + '</small></div><button class="open" type="button" data-href="' + esc(item.href) + '">기록 열기</button></div>';
    }).join('') : '<div class="live-alert ok"><i aria-hidden="true"></i><div><b>현재 감지된 품질 경보가 없습니다.</b><small>새 기록 또는 다른 기기 동기화가 들어오면 자동으로 다시 확인합니다.</small></div></div>';
    $('liveAlertFeed').querySelectorAll('.open').forEach(function (b) { b.addEventListener('click', function () { window.location.href = b.getAttribute('data-href'); }); });
    notifyNewAlerts(items, settings);
  }
  function history() {
    var filter = $('historyType').value;
    var rows = state.filtered.filter(function (x) { return (filter === 'all' || x.type === filter) && (x.done || filter === 'all'); }).sort(function (a, b) { return (dateVal(b.record) || 0) - (dateVal(a.record) || 0); });
    if (!rows.length) { $('history').innerHTML = '<div class="empty">선택 조건의 완료 이력이 없습니다.</div>'; return; }
    $('history').innerHTML = rows.slice(0, 30).map(function (x) {
      var r = x.record, title = r.capaNo || r.subject || r.targetLot || r.lot || r.item || '기록';
      var lot = r.lot || r.targetLot || r.rawLot || r.productionLot || '-';
      var sub = x.type === 'capa' ? statusLabel(r) : (x.done ? '완료' : '진행');
      return '<div class="row"><span class="tag">' + esc(dateText(r)) + '</span><span class="badge ' + (x.type === 'capa' ? 'capa' : (x.done ? 'done' : 'warn')) + '">' + esc(x.label) + '</span><div><b>' + esc(title) + '</b><br><span class="tag">LOT ' + esc(lot) + ' · ' + esc(sub) + '</span></div><span class="tag">' + esc(r.verificationResult || r.result || r.scenario || r.direction || '-') + '</span><button class="open" type="button" data-href="' + esc(x.href) + '">기록 열기</button></div>';
    }).join('');
    $('history').querySelectorAll('.open').forEach(function (b) { b.addEventListener('click', function () { window.location.href = b.getAttribute('data-href'); }); });
  }
  function render() {
    data(); var m = metrics(); renderBars(m); renderSources(); renderAlerts(m); renderLiveAlerts(m); history();
    var total = state.filtered.length, synced = window.DkjCloudSync && DkjCloudSync.enabled && DkjCloudSync.enabled();
    setText('dataInfo', '전자기록 ' + total + '건 집계 · ' + (synced ? '클라우드 동기화 사용' : '현재 기기 저장 기록 기준') + ' · ' + new Date().toLocaleString('ko-KR') + ' 갱신');
    state.initialized = true;
  }
  function requestPermission() {
    if (!('Notification' in window)) { showToast('이 브라우저는 브라우저 알림을 지원하지 않습니다.', 'warning'); return; }
    if (Notification.permission === 'denied') { showToast('브라우저 설정에서 이 사이트의 알림 차단을 해제해 주세요.', 'warning'); render(); return; }
    Notification.requestPermission().then(function (permission) { showToast(permission === 'granted' ? '브라우저 알림이 허용되었습니다.' : '브라우저 알림이 허용되지 않았습니다.', permission === 'granted' ? 'ok' : 'warning'); render(); });
  }
  function bindLiveSettings() {
    $('liveAlertEnabled').addEventListener('change', function () { var s = alertSettings(); s.enabled = this.checked; saveAlertSettings(s); render(); });
    $('alertSeverity').addEventListener('change', function () { var s = alertSettings(); s.severity = this.value; saveAlertSettings(s); render(); });
    $('requestAlertPermission').addEventListener('click', requestPermission);
  }
  function onStorage(event) {
    var key = String(event && event.key || '');
    if (key.indexOf('dkj:records:') === 0 || key === ALERT_SETTINGS_KEY) render();
  }
  function init() {
    $('refresh').addEventListener('click', function () { render(); showToast('품질 지표와 경보를 새로 확인했습니다.', 'ok'); });
    $('period').addEventListener('change', render); $('historyType').addEventListener('change', history); bindLiveSettings();
    document.addEventListener('dkj:cloud-ready', render); document.addEventListener('dkj:records-changed', render);
    window.addEventListener('dkj:records-changed', render); window.addEventListener('storage', onStorage);
    state.alertTimer = setInterval(render, ALERT_CHECK_MS); render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
