/**
 * 자가품질검사·보건증 스케줄러 화면 — 정기 알림 화면(periodic-alerts.html)의 '자가품질검사 · 보건증' 탭
 *
 * 저장: 제품·유형·보건증·성적서·설정을 모두 서식 'QS-ITEMS' 하나의 기록 목록에 kind 로 구분해 담는다
 *       (DkjRecordStore → 이 기기 IndexedDB + 클라우드 동기화. 정기 알림 화면과 같은 방식).
 * 파일: 성적서·보건증 사본은 목록에 넣지 않는다(목록 전체가 30초마다 동기화되므로 다운로드가 폭증한다).
 *       RTDB records/<nodeKey('dkj:qsfile:<id>:v1')> 에 파일 1개씩 따로 저장하고, 열 때만 내려받는다.
 *       키가 dkj:records:*:list:v1 형식이 아니라 기록 동기화(KEY_RE)가 건드리지 않는다.
 * 판정: 날짜 계산·상태·알림 대상은 js/quality-scheduler-core.js (매일 텔레그램 발송 스크립트와 공용).
 */
(function () {
  'use strict';

  var FORM_ID = 'QS-ITEMS';
  var SETTING_ID = 'qs-settings';
  var KINDS = ['type', 'product', 'history', 'health', 'cert', 'setting'];
  var MAX_PDF_BYTES = 3 * 1024 * 1024;
  var MAX_DATAURL_CHARS = 4 * 1024 * 1024;
  var MAX_IMPORT_ROWS = 500;
  var EXCELJS_SRC = 'js/vendor/exceljs.bare.min.js';
  var core = window.DkjQualityCore;
  /* 이 사업장의 기본 식품유형(2026-10-27 사용자 확인): 신선편의식품 — 세척·소독·헹굼만 하고 살균·멸균 처리를 하지 않는다.
   * 주기 1개월은 영업 종류가 식품제조·가공업일 때의 기준(즉석판매제조·가공업은 9개월)이고,
   * 검사항목은 '식품등의 자가품질검사항목 지정' 고시의 필수 4종이다. 조건부 항목(장염비브리오균: 살균·멸균 안 한 해산물 함유 제품,
   * 세균수: 멸균제품)은 이 제품에 해당하지 않아 뺐다. 첫 실행 때 한 번만 등록하고(settings.seededDefaults) 이후에는 되살리지 않는다. */
  var DEFAULT_TYPE = { id: 'qt-fresh-cut', name: '신선편의식품', intervalMonths: 1, testItems: '대장균, 황색포도상구균, 살모넬라, 바실루스 세레우스' };
  var $ = function (id) { return document.getElementById(id); };

  var S = {
    items: { type: [], product: [], history: [], health: [], cert: [], setting: null },
    tab: 'dashboard', dashStatus: 'all', healthFilter: 'all', busy: false, loaded: false
  };

  /* ------------------------------ 공통 ------------------------------ */
  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function today() { return core.todayKst(); }
  function toast(text, bad) {
    var el = $('qsToast'); if (!el) return;
    el.textContent = text; el.className = 'qs-toast show' + (bad ? ' bad' : '');
    clearTimeout(el._t); el._t = setTimeout(function () { el.className = 'qs-toast'; }, 4200);
  }
  function setStatus(text, bad) {
    var el = $('qsStatus'); if (!el) return;
    el.textContent = text || ''; el.className = 'qs-status' + (text ? ' show' : '') + (bad ? ' bad' : '');
    clearTimeout(el._t); if (text) el._t = setTimeout(function () { el.className = 'qs-status'; el.textContent = ''; }, 5200);
  }
  function role() { try { return window.DkjAuth && DkjAuth.role ? DkjAuth.role() : ''; } catch (e) { return ''; } }
  /** 삭제는 관리자 이상. 작업자는 등록·수정만 한다(역할 체계: 작업자=작성만). */
  function canDelete() { var r = role(); return !!r && r !== 'worker'; }
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function fmtSize(n) {
    n = Number(n || 0);
    if (n >= 1048576) return (n / 1048576).toFixed(1) + 'MB';
    if (n >= 1024) return Math.round(n / 1024) + 'KB';
    return n ? n + 'B' : '-';
  }
  function fmtDateTime(iso) {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false }); } catch (e) { return iso; }
  }
  function settings() {
    var s = S.items.setting || {};
    return {
      warningDays: Number(s.warningDays) > 0 ? Number(s.warningDays) : core.DEFAULT_WARNING_DAYS,
      healthAlertDays: core.normalizeHealthAlertDays(s.healthAlertDays),
      mainProductByType: s.mainProductByType || {},
      hiddenTypeIds: Array.isArray(s.hiddenTypeIds) ? s.hiddenTypeIds : [],
      certPrefix: String(s.certPrefix || 'DKJ-QC'),
      certSequence: Number(s.certSequence) > 0 ? Number(s.certSequence) : 1
    };
  }

  /* ------------------------------ 저장소 ------------------------------ */
  async function load() {
    var rows = [];
    try { rows = (window.DkjRecordStore && (await DkjRecordStore.list(FORM_ID))) || []; } catch (e) { rows = []; }
    var next = { type: [], product: [], history: [], health: [], cert: [], setting: null };
    rows.forEach(function (r) {
      if (!r || r.deleted || KINDS.indexOf(r.kind) === -1) return;
      if (r.kind === 'setting') { if (r.id === SETTING_ID) next.setting = r; } else next[r.kind].push(r);
    });
    next.type.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'ko'); });
    next.product.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'ko'); });
    S.items = next; S.loaded = true;
  }
  async function saveRec(rec) {
    if (!window.DkjRecordStore) throw new Error('저장소를 불러오지 못했습니다.');
    var saved = await DkjRecordStore.save(FORM_ID, rec);
    return saved || rec;
  }
  async function delRec(rec) { await DkjRecordStore.remove(FORM_ID, rec.id); }
  async function saveSettings(patch) {
    var cur = S.items.setting || { id: SETTING_ID, kind: 'setting' };
    return saveRec(Object.assign({}, cur, patch, { id: SETTING_ID, kind: 'setting' }));
  }
  function coreData() {
    var certs = S.items.cert;
    return { types: S.items.type, products: S.items.product, health: S.items.health, certs: certs, settings: S.items.setting || {} };
  }

  /* ------------------------------ 파일(RTDB, 1개씩) ------------------------------ */
  function nodeKey(value) {
    return btoa(unescape(encodeURIComponent(String(value)))).replace(/\//g, '_').replace(/\+/g, '-').replace(/=+$/, '');
  }
  function filePath(fileId) { return 'records/' + nodeKey('dkj:qsfile:' + fileId + ':v1'); }
  function newFileId() { return 'qf-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function readAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader(); r.onload = function () { resolve(r.result); }; r.onerror = function () { reject(new Error('파일을 읽지 못했습니다.')); };
      r.readAsDataURL(file);
    });
  }
  /** 업로드할 파일을 검사·축소해 {dataUrl,name,type,size} 로 만든다. */
  async function prepareFile(file) {
    var isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    var isImg = /^image\//.test(file.type);
    if (!isPdf && !isImg) throw new Error('PDF 또는 이미지 파일만 올릴 수 있습니다.');
    var dataUrl;
    if (isImg) {
      dataUrl = await new Promise(function (resolve) { DkjUtil.compressImageToDataUrl(file, resolve, { maxDim: 2000, quality: 0.8 }); });
      if (!dataUrl) throw new Error('이미지를 처리하지 못했습니다.');
    } else {
      if (file.size > MAX_PDF_BYTES) throw new Error('PDF는 ' + fmtSize(MAX_PDF_BYTES) + ' 이하만 올릴 수 있습니다. (현재 ' + fmtSize(file.size) + ')');
      dataUrl = await readAsDataUrl(file);
    }
    if (dataUrl.length > MAX_DATAURL_CHARS) throw new Error('파일이 너무 큽니다. 용량을 줄여 다시 올려 주세요.');
    var name = isImg ? file.name.replace(/\.[^.]+$/, '') + '.jpg' : file.name;
    return { dataUrl: dataUrl, name: name, type: isImg ? 'image/jpeg' : 'application/pdf', size: Math.round(dataUrl.length * 0.75) };
  }
  async function putFile(prepared) {
    if (!window.DkjAuth || !DkjAuth.configured || !DkjAuth.configured()) throw new Error('클라우드 연결이 설정되지 않아 파일을 저장할 수 없습니다.');
    var id = newFileId();
    await DkjAuth.request(filePath(id), 'PUT', {
      value: { name: prepared.name, type: prepared.type, size: prepared.size, dataUrl: prepared.dataUrl },
      updatedAt: Date.now()
    });
    return id;
  }
  async function getFile(fileId) {
    var row = await DkjAuth.request(filePath(fileId), 'GET');
    if (!row || !row.value || !row.value.dataUrl) throw new Error('저장된 파일을 찾지 못했습니다.');
    return row.value;
  }
  async function removeFile(fileId) {
    if (!fileId) return;
    try { await DkjAuth.request(filePath(fileId), 'DELETE'); } catch (e) { /* 목록은 이미 정리됨 — 고아 파일은 무해 */ }
  }
  function dataUrlToBlob(dataUrl) {
    var parts = dataUrl.split(','), mime = (/data:([^;]+)/.exec(parts[0]) || [])[1] || 'application/octet-stream';
    var bin = atob(parts[1]), buf = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return new Blob([buf], { type: mime });
  }
  async function openFile(fileId, download) {
    var win = download ? null : window.open('', '_blank');
    try {
      var f = await getFile(fileId);
      var url = URL.createObjectURL(dataUrlToBlob(f.dataUrl));
      if (download) {
        var a = document.createElement('a'); a.href = url; a.download = f.name || 'file'; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      } else if (win) { win.location.href = url; } else { location.href = url; }
    } catch (e) {
      if (win) win.close();
      toast('파일을 열지 못했습니다: ' + (e.message || e), true);
    }
  }

  /* ------------------------------ 대시보드 ------------------------------ */
  function computedProducts() {
    var st = S.items.setting || {};
    return S.items.product.map(function (p) { return core.productComputed(p, S.items.type, st, today()); });
  }
  function badge(status, dday) {
    var labels = { overdue: '기간 초과', urgent: '사전 알림', safe: '여유 있음', stopped: '생산 중단', paused: '알림 중지', inactive: '재직 제외' };
    var showD = status === 'overdue' || status === 'urgent' || status === 'safe';
    return '<span class="qs-badge ' + status + '"><i></i>' + labels[status] + (showD && dday !== null && dday !== undefined ? ' (' + core.formatDDay(dday) + ')' : '') + '</span>';
  }
  function typeOptions(selected, withAll, allLabel) {
    var html = withAll ? '<option value="all">' + esc(allLabel || '전체 식품유형') + '</option>' : '';
    S.items.type.forEach(function (t) { html += '<option value="' + esc(t.id) + '"' + (t.id === selected ? ' selected' : '') + '>' + esc(t.name) + '</option>'; });
    return html;
  }
  function refreshTypeSelects() {
    [['dashType', '전체 식품유형'], ['prodType', '전체 식품유형'], ['certType', '전체 식품유형']].forEach(function (pair) {
      var el = $(pair[0]); if (!el) return; var prev = el.value || 'all';
      el.innerHTML = typeOptions('', true, pair[1]);
      el.value = byId(S.items.type, prev) ? prev : 'all';
    });
  }
  function dashboardBase(cfg) {
    var all = computedProducts();
    if (!$('dashAll').checked) {
      var repIds = {};
      core.representativeProducts(S.items.product, S.items.setting || {}).forEach(function (p) { repIds[p.id] = true; });
      all = all.filter(function (p) { return repIds[p.id]; });
    }
    var hidden = cfg.hiddenTypeIds;
    return all.filter(function (p) { return !p.typeId || hidden.indexOf(p.typeId) === -1; });
  }
  function weekRange() {
    var t = core.parseDate(today()), dow = (t.getUTCDay() + 6) % 7; // 월=0
    var start = core.addDays(today(), -dow);
    return [start, core.addDays(start, 6)];
  }
  function renderDashboard() {
    var cfg = settings(), base = dashboardBase(cfg);
    var cnt = { overdue: 0, urgent: 0, safe: 0 };
    base.forEach(function (p) { if (cnt[p.status] !== undefined) cnt[p.status]++; });
    $('kpiTotal').textContent = base.length; $('kpiOverdue').textContent = cnt.overdue;
    $('kpiUrgent').textContent = cnt.urgent; $('kpiSafe').textContent = cnt.safe;
    var healthWarn = S.items.health.map(function (h) { return core.healthComputed(h, S.items.setting || {}, today()); })
      .filter(function (h) { return h.status === 'overdue' || h.status === 'urgent'; }).length;
    $('kpiHealth').textContent = healthWarn;
    Array.prototype.forEach.call(document.querySelectorAll('[data-dash-status]'), function (b) { b.classList.toggle('on', b.getAttribute('data-dash-status') === S.dashStatus); });

    var banner = $('qsUrgentBanner'), alerts = core.buildAlerts(coreData(), today());
    var lateHealth = alerts.health.filter(function (h) { return h.dDay < 0; });
    if (alerts.overdue.length || lateHealth.length) {
      var names = alerts.overdue.map(function (p) { return p.name; }).concat(lateHealth.map(function (h) { return h.name + ' 보건증'; }));
      banner.hidden = false;
      banner.innerHTML = '<h3>긴급 조치가 필요한 항목이 있습니다</h3><p>' + esc(names.slice(0, 4).join(', ')) + (names.length > 4 ? ' 외 ' + (names.length - 4) + '건' : '') +
        ' — 검사 기한 초과 ' + alerts.overdue.length + '건, 보건증 만료 ' + lateHealth.length + '명</p>';
    } else banner.hidden = true;

    renderHealthMonthly(); renderMatrix(cfg);

    var q = ($('dashSearch').value || '').trim().toLowerCase(), type = $('dashType').value, quick = $('dashQuick').value;
    var wk = weekRange(), ym = today().slice(0, 7), certs = S.items.cert;
    var rows = base.filter(function (p) {
      if (S.dashStatus !== 'all' && p.status !== S.dashStatus) return false;
      if ($('dashStatus').value !== 'all' && p.status !== $('dashStatus').value) return false;
      if (type !== 'all' && p.typeId !== type) return false;
      if (q && (String(p.name) + ' ' + p.typeName).toLowerCase().indexOf(q) === -1) return false;
      if (quick === 'week' && !(p.nextDeadline >= wk[0] && p.nextDeadline <= wk[1])) return false;
      if (quick === 'month' && String(p.nextDeadline).slice(0, 7) !== ym) return false;
      if (quick === 'missing' && !core.missingCertificate(p, certs)) return false;
      return true;
    });
    var order = { overdue: 0, urgent: 1, safe: 2, paused: 3, stopped: 4 };
    rows.sort(function (a, b) { return (order[a.status] - order[b.status]) || ((a.dDay === null ? 9999 : a.dDay) - (b.dDay === null ? 9999 : b.dDay)); });
    $('dashCount').textContent = rows.length + '건';
    if (!S.items.product.length) {
      $('dashBody').innerHTML = '<tr><td colspan="8"><div class="qs-empty"><b>아직 등록된 제품이 없습니다.</b><br>① 식품유형 관리에서 유형·검사주기 등록 → ② 제품 등록(최근 제조일) → ③ 성적서·보건증 등록 순서로 시작하세요. 엑셀 양식으로 한 번에 가져올 수도 있습니다.</div></td></tr>';
      return;
    }
    $('dashBody').innerHTML = rows.length ? rows.map(function (p) {
      var live = p.status !== 'stopped';
      return '<tr class="' + (p.status === 'stopped' ? 'is-stopped' : '') + '"><td>' + badge(p.status, p.dDay) + '</td>' +
        '<td><b>' + esc(p.name) + '</b>' + (core.missingCertificate(p, certs) && live && p.status !== 'paused' ? '<small>📄 최신 성적서 미등록</small>' : '') + '</td>' +
        '<td>' + esc(p.typeName) + '</td><td>' + esc(p.intervalMonths) + '개월</td><td>' + esc(p.lastManufactureDate || '-') + '</td>' +
        '<td><b>' + esc(p.nextDeadline || '-') + '</b></td>' +
        '<td>' + (live ? '<div class="qs-quick"><input type="date" max="' + today() + '" value="' + today() + '" data-renew-date="' + esc(p.id) + '" aria-label="새 제조(검사)일"><button type="button" class="qs-btn small primary" data-renew="' + esc(p.id) + '">갱신</button></div>' : '-') + '</td>' +
        '<td><div class="qs-row-actions"><button type="button" class="qs-btn small outline" data-edit-product="' + esc(p.id) + '">수정</button>' +
        (p.status !== 'stopped' ? '<button type="button" class="qs-btn small outline" data-toggle-alert="' + esc(p.id) + '">' + (p.alertStatus === 'paused' ? '알림 재개' : '알림 중지') + '</button>' : '') + '</div></td></tr>';
    }).join('') : '<tr><td colspan="8"><div class="qs-empty">조건에 맞는 제품이 없습니다.</div></td></tr>';
  }
  function monthList(n) {
    var out = [], t = core.parseDate(today()), y = t.getUTCFullYear(), m = t.getUTCMonth();
    for (var i = 0; i < n; i++) { var d = new Date(Date.UTC(y, m + i, 1)); out.push(d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0')); }
    return out;
  }
  function renderHealthMonthly() {
    var months = monthList(13), counts = {}, names = {};
    months.forEach(function (m) { counts[m] = 0; names[m] = []; });
    S.items.health.forEach(function (h) {
      if (h.employmentStatus === 'inactive' || !core.parseDate(h.expiresAt)) return;
      var key = h.expiresAt.slice(0, 7); if (key < months[0]) key = months[0];
      if (counts[key] === undefined) return;
      counts[key]++; names[key].push(h.employeeName);
    });
    var max = Math.max.apply(null, months.map(function (m) { return counts[m]; }).concat([1]));
    $('healthMonthly').innerHTML = months.map(function (m, i) {
      var cls = i === 0 && counts[m] ? 'bad' : (i <= 1 && counts[m] ? 'warn' : '');
      return '<div class="qs-bar ' + cls + '"><b>' + counts[m] + '</b><i style="height:' + Math.round(counts[m] / max * 96 + 3) + 'px"></i><span>' + Number(m.slice(5)) + '월</span>' +
        '<span class="qs-bar-names">' + esc(names[m].slice(0, 2).join(', ')) + (names[m].length > 2 ? ' 외' : '') + '</span></div>';
    }).join('');
  }
  function renderMatrix(cfg) {
    var months = monthList(12), st = S.items.setting || {};
    var reps = core.representativeProducts(S.items.product, st).map(function (p) { return core.productComputed(p, S.items.type, st, today()); });
    var head = '<thead><tr><th>식품유형</th>' + months.map(function (m) { return '<th>' + (m.slice(5) === '01' ? m.slice(2, 4) + '년 ' : '') + Number(m.slice(5)) + '월</th>'; }).join('') + '</tr></thead>';
    var body = S.items.type.filter(function (t) { return cfg.hiddenTypeIds.indexOf(t.id) === -1; }).map(function (t) {
      var list = reps.filter(function (p) { return p.typeId === t.id && p.status !== 'stopped' && p.nextDeadline; });
      return '<tr><td><b>' + esc(t.name) + '</b></td>' + months.map(function (m, i) {
        var hits = list.filter(function (p) { var k = p.nextDeadline.slice(0, 7); return k === m || (i === 0 && k < m); });
        if (!hits.length) return '<td></td>';
        var late = hits.some(function (p) { return p.dDay < 0; });
        return '<td class="has' + (late ? ' late' : '') + '" title="' + esc(hits.map(function (p) { return p.name; }).join(', ')) + '">' + esc(hits.map(function (p) { return p.nextDeadline.slice(5).replace('-', '/'); }).join(', ')) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    $('typeMatrix').innerHTML = S.items.type.length ? head + '<tbody>' + body + '</tbody>' : '<tbody><tr><td><div class="qs-empty">식품유형을 먼저 등록하세요.</div></td></tr></tbody>';
  }

  /* ------------------------------ 제품 ------------------------------ */
  function renderProducts() {
    var q = ($('prodSearch').value || '').trim().toLowerCase(), type = $('prodType').value, st = $('prodState').value;
    var rows = computedProducts().filter(function (p) {
      return (type === 'all' || p.typeId === type) && (st === 'all' || (st === 'stopped') === (p.productionStatus === 'stopped')) &&
        (!q || String(p.name).toLowerCase().indexOf(q) !== -1);
    });
    $('prodCount').textContent = rows.length + '개 제품';
    $('prodBody').innerHTML = rows.length ? rows.map(function (p) {
      return '<tr class="' + (p.status === 'stopped' ? 'is-stopped' : '') + '"><td><b>' + esc(p.name) + '</b></td><td>' + esc(p.typeName) + '</td><td>' + esc(p.intervalMonths) + '개월</td>' +
        '<td>' + esc(p.lastManufactureDate || '-') + '</td><td>' + esc(p.nextDeadline || '-') + '</td>' +
        '<td>' + (p.productionStatus === 'stopped' ? badge('stopped') + (p.stopReason ? '<small>' + esc(p.stopReason) + '</small>' : '') : '생산 중') + '</td>' +
        '<td>' + (p.alertStatus === 'paused' ? badge('paused') : '켜짐') + '</td><td>' + esc(p.memo || '') + '</td>' +
        '<td><div class="qs-row-actions"><button type="button" class="qs-btn small outline" data-edit-product="' + esc(p.id) + '">수정</button>' +
        '<button type="button" class="qs-btn small outline" data-product-history="' + esc(p.id) + '">이력</button>' +
        (canDelete() ? '<button type="button" class="qs-btn small outline" data-del-product="' + esc(p.id) + '">삭제</button>' : '') + '</div></td></tr>';
    }).join('') : '<tr><td colspan="9"><div class="qs-empty">등록된 제품이 없습니다.</div></td></tr>';
  }
  async function renewProduct(id, newDate) {
    var p = byId(S.items.product, id); if (!p) return;
    if (!core.parseDate(newDate)) { toast('갱신할 제조(검사)일을 입력하세요.', true); return; }
    if (newDate > today()) { toast('제조(검사)일은 오늘 이후로 정할 수 없습니다.', true); return; }
    if (p.lastManufactureDate && newDate < p.lastManufactureDate && !confirm('현재 기록된 최근 제조일(' + p.lastManufactureDate + ')보다 이전 날짜입니다. 그래도 갱신할까요?')) return;
    if (!confirm('"' + p.name + '"의 최근 제조(검사)일을 ' + newDate + '(으)로 갱신합니다.')) return;
    await saveRec(Object.assign({}, p, { lastManufactureDate: newDate }));
    await saveRec({ kind: 'history', productId: p.id, productName: p.name, manufactureDate: newDate, previousDate: p.lastManufactureDate || '', memo: '빠른 갱신' });
    await refresh(); toast('검사 기준일을 갱신했습니다. 다음 마감 ' + core.addMonths(newDate, core.productComputed(p, S.items.type, {}, today()).intervalMonths));
  }

  /* ------------------------------ 식품유형 ------------------------------ */
  function renderTypes() {
    var cfg = settings();
    $('typeBody').innerHTML = S.items.type.length ? S.items.type.map(function (t) {
      var prods = S.items.product.filter(function (p) { return p.typeId === t.id; });
      var mainId = cfg.mainProductByType[t.id];
      var sel = '<select data-main-product="' + esc(t.id) + '" aria-label="대표 제품"><option value="">자동 (최근 제조일 기준)</option>' +
        prods.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === mainId ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '</select>';
      var hidden = cfg.hiddenTypeIds.indexOf(t.id) !== -1;
      return '<tr><td><b>' + esc(t.name) + '</b></td><td>' + esc(t.intervalMonths) + '개월</td><td>' + esc(t.testItems || '-') + '</td><td>' + prods.length + '개</td><td>' + (prods.length ? sel : '-') + '</td>' +
        '<td><label class="qs-check"><input type="checkbox" data-type-visible="' + esc(t.id) + '"' + (hidden ? '' : ' checked') + '> 표시</label></td>' +
        '<td><div class="qs-row-actions"><button type="button" class="qs-btn small outline" data-edit-type="' + esc(t.id) + '">수정</button>' +
        (canDelete() ? '<button type="button" class="qs-btn small outline" data-del-type="' + esc(t.id) + '">삭제</button>' : '') + '</div></td></tr>';
    }).join('') : '<tr><td colspan="7"><div class="qs-empty">식품유형을 등록하면 유형별 검사주기로 제품 마감일이 계산됩니다.</div></td></tr>';
  }

  /* ------------------------------ 보건증 ------------------------------ */
  function renderHealth() {
    var q = ($('healthSearch').value || '').trim().toLowerCase(), asc = $('healthSort').value !== 'desc', st = S.items.setting || {};
    var rows = S.items.health.map(function (h) { return core.healthComputed(h, st, today()); }).filter(function (h) {
      if (S.healthFilter === 'inactive' ? h.status !== 'inactive' : (S.healthFilter !== 'all' && h.status !== S.healthFilter)) return false;
      return !q || (String(h.employeeName) + ' ' + String(h.department || '')).toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return asc ? String(a.expiresAt).localeCompare(String(b.expiresAt)) : String(b.expiresAt).localeCompare(String(a.expiresAt)); });
    $('healthCount').textContent = rows.length + '명';
    $('healthBody').innerHTML = rows.length ? rows.map(function (h) {
      return '<tr class="' + (h.status === 'inactive' ? 'is-inactive' : '') + '"><td>' + badge(h.status, h.dDay) + '</td><td><b>' + esc(h.employeeName) + '</b></td><td>' + esc(h.department || '-') + '</td>' +
        '<td>' + esc(h.issuedAt || '-') + '</td><td><b>' + esc(h.expiresAt || '-') + '</b></td>' +
        '<td>' + (h.fileId ? '<button type="button" class="qs-btn small outline" data-open-file="' + esc(h.fileId) + '">열람</button> <button type="button" class="qs-btn small outline" data-dl-file="' + esc(h.fileId) + '">저장</button><small>' + esc(h.fileName || '') + ' · ' + fmtSize(h.fileSize) + '</small>' : '<small>미등록</small>') + '</td>' +
        '<td>' + esc(h.memo || '') + '</td>' +
        '<td><div class="qs-row-actions"><button type="button" class="qs-btn small outline" data-edit-health="' + esc(h.id) + '">수정</button>' +
        (h.status !== 'inactive' ? '<button type="button" class="qs-btn small outline" data-health-alert="' + esc(h.id) + '">' + (h.alertStatus === 'paused' ? '알림 재개' : '알림 중지') + '</button>' : '') +
        (canDelete() ? '<button type="button" class="qs-btn small outline" data-del-health="' + esc(h.id) + '">삭제</button>' : '') + '</div></td></tr>';
    }).join('') : '<tr><td colspan="8"><div class="qs-empty">등록된 보건증이 없습니다.</div></td></tr>';
  }

  /* ------------------------------ 성적서 ------------------------------ */
  function renderCerts() {
    var q = ($('certSearch').value || '').trim().toLowerCase(), type = $('certType').value;
    var rows = S.items.cert.filter(function (c) {
      if (type !== 'all' && c.typeId !== type) return false;
      var p = byId(S.items.product, c.productId);
      return !q || (String(c.certNumber) + ' ' + (p ? p.name : '')).toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return String(b.inspectionDate).localeCompare(String(a.inspectionDate)); });
    $('certCount').textContent = rows.length + '건';
    $('certBody').innerHTML = rows.length ? rows.map(function (c) {
      var p = byId(S.items.product, c.productId), t = byId(S.items.type, c.typeId);
      return '<tr><td><b>' + esc(c.certNumber) + '</b></td><td>' + esc(p ? p.name : '(삭제된 제품)') + '</td><td>' + esc(t ? t.name : '-') + '</td><td>' + esc(c.inspectionDate) + '</td>' +
        '<td>' + esc(c.fileName || '-') + '<small>' + fmtSize(c.fileSize) + '</small></td><td>' + esc(fmtDateTime(c.createdAt)) + '</td>' +
        '<td><div class="qs-row-actions">' + (c.fileId ? '<button type="button" class="qs-btn small outline" data-open-file="' + esc(c.fileId) + '">열람</button><button type="button" class="qs-btn small outline" data-dl-file="' + esc(c.fileId) + '">저장</button>' : '') +
        '<button type="button" class="qs-btn small outline" data-edit-cert="' + esc(c.id) + '">수정</button>' +
        (canDelete() ? '<button type="button" class="qs-btn small outline" data-del-cert="' + esc(c.id) + '">삭제</button>' : '') + '</div></td></tr>';
    }).join('') : '<tr><td colspan="7"><div class="qs-empty">등록된 성적서가 없습니다.</div></td></tr>';
  }

  /* ------------------------------ 설정·텔레그램 ------------------------------ */
  function telegramInfo() {
    var cfg = (window.DkjTelegram && DkjTelegram.getConfig()) || {};
    var ids = String(cfg.chatId || '').split(/[\s,;]+/).filter(Boolean);
    return { ready: !!(String(cfg.botToken || '').trim() && ids.length) && cfg.enabled !== false, ids: ids, enabled: cfg.enabled !== false };
  }
  function renderSettingsTab() {
    var cfg = settings();
    $('setWarning').value = cfg.warningDays; $('setHealthDays').value = cfg.healthAlertDays.join(', ');
    $('setCertPrefix').value = cfg.certPrefix; $('setCertSeq').value = cfg.certSequence;
    var tg = telegramInfo(), el = $('tgStatus');
    if (tg.ready) { el.className = 'qs-tg ok'; el.innerHTML = '✅ 텔레그램 연결됨 · 수신 Chat ID ' + tg.ids.length + '개 · 매일 09:00(KST) 자동 발송'; }
    else { el.className = 'qs-tg warn'; el.innerHTML = '⚠️ ' + (tg.enabled ? '봇 토큰 또는 Chat ID가 등록되지 않았습니다.' : '텔레그램 알림이 꺼져 있습니다.') + ' <a href="system-settings.html">시스템 설정</a>에서 등록하세요. (시스템 관리자 전용)'; }
  }
  async function sendToday(testOnly) {
    var tg = telegramInfo();
    if (!tg.ready) { toast('텔레그램 설정이 없습니다. 시스템 설정에서 등록하세요.', true); return; }
    var buttons = location.protocol === 'https:' ? [[{ text: '🗓️ 스케줄러 열기', url: location.origin + location.pathname.replace(/[^/]*$/, '') + 'periodic-alerts.html#quality' }]] : [];
    var res;
    if (testOnly) res = await DkjTelegram.sendRaw({ text: '🔧 <b>[동김제농협] 자가품질검사·보건증 알림 — 시험 메시지</b>\n이 메시지가 보이면 텔레그램 연결이 정상입니다.', buttons: buttons });
    else {
      var alerts = core.buildAlerts(coreData(), today());
      res = await DkjTelegram.sendRaw({ text: core.telegramMessage(alerts, today()), buttons: buttons });
    }
    toast(res.message, !res.success);
  }
  async function sendHealthTest() {
    var tg = telegramInfo();
    if (!tg.ready) { toast('텔레그램 설정이 없습니다. 시스템 설정에서 등록하세요.', true); return; }
    var cfg = settings(), st = S.items.setting || {};
    var list = S.items.health.map(function (h) { return core.healthComputed(h, st, today()); }).filter(function (h) { return h.status === 'overdue' || h.status === 'urgent'; })
      .sort(function (a, b) { return a.dDay - b.dDay; }).map(function (h) {
        return { id: h.id, name: h.employeeName, department: String(h.department || '').trim() || '미지정', expiresAt: h.expiresAt, dDay: h.dDay };
      });
    var alerts = { overdue: [], urgent: [], missingCert: [], health: list, total: list.length, healthAlertDays: cfg.healthAlertDays };
    var text = '🧪 <i>[시험 발송] 만료된 보건증과 기준일 이내 대상을 모두 표시합니다. 실제 자동 알림은 기준일에만 발송됩니다.</i>\n\n' + core.telegramMessage(alerts, today());
    var res = await DkjTelegram.sendRaw({ text: text });
    toast(res.message, !res.success);
  }

  /* ------------------------------ 대화상자 ------------------------------ */
  var dlg = { onSave: null };
  function openDialog(title, bodyHtml, opts) {
    opts = opts || {};
    $('qsDialogTitle').textContent = title; $('qsDialogBody').innerHTML = bodyHtml;
    $('qsDialogActions').innerHTML = (opts.extra || '') + '<span class="spacer"></span><button type="button" class="qs-btn outline" id="qsDialogCancel">' + (opts.onSave ? '취소' : '닫기') + '</button>' +
      (opts.onSave ? '<button type="submit" class="qs-btn primary" id="qsDialogSave">' + esc(opts.saveLabel || '저장') + '</button>' : '');
    dlg.onSave = opts.onSave || null;
    $('qsDialogCancel').onclick = closeDialog;
    var d = $('qsDialog'); if (d.showModal) { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
    var first = $('qsDialogBody').querySelector('input:not([type=hidden]),select,textarea'); if (first) setTimeout(function () { first.focus(); }, 30);
  }
  function closeDialog() { var d = $('qsDialog'); if (d.close) d.close(); else d.removeAttribute('open'); dlg.onSave = null; }
  function fv(id) { var el = $(id); return el ? String(el.value).trim() : ''; }
  function field(label, html, wide, req) { return '<label' + (wide ? ' class="wide"' : '') + '>' + esc(label) + (req ? ' <span class="req">*</span>' : '') + html + '</label>'; }

  /** opts.prefillName: 새 유형의 기본 이름 / opts.thenProduct: 저장 후 이어서 제품 등록 창을 연다 */
  function openTypeDialog(id, opts) {
    opts = opts || {};
    var t = id ? byId(S.items.type, id) : null;
    openDialog(t ? '식품유형 수정' : (opts.thenProduct ? '식품유형 등록 (제품 등록 전 1회)' : '새 식품유형 등록'),
      '<div class="qs-form-grid">' +
      field('식품유형명', '<input id="fName" maxlength="60" value="' + esc(t ? t.name : (opts.prefillName || '')) + '" placeholder="예: 액상차">', true, true) +
      field('기준 검사 주기(개월)', '<input id="fInterval" type="number" min="1" max="60" step="1" value="' + esc(t ? t.intervalMonths : (opts.prefillInterval || 2)) + '">', false, true) +
      field('주요 시험 검사항목', '<input id="fItems" maxlength="200" value="' + esc(t ? t.testItems || '' : (opts.prefillItems || '')) + '" placeholder="예: 대장균, 황색포도상구균">', false) +
      '</div><p class="qs-hint">검사주기는 식품유형별 법정 기준과 사내 기준 중 더 짧은 쪽으로 입력하세요. 수정하면 이 유형 제품의 주기도 함께 바뀝니다. [확인 필요: 식품위생법 시행규칙 자가품질검사 기준]</p>' +
      (opts.thenProduct ? '<p class="qs-hint warn">제품은 식품유형을 먼저 정해야 등록할 수 있습니다. 아래 유형과 <b>검사 주기를 확인</b>한 뒤 저장하면 바로 제품 등록 창이 열립니다.</p>' : ''),
      { saveLabel: opts.thenProduct ? '저장 후 제품 등록' : '저장', onSave: async function () {
        var name = fv('fName'), interval = Number(fv('fInterval'));
        if (!name) return toast('식품유형명을 입력하세요.', true);
        if (!Number.isInteger(interval) || interval < 1 || interval > 60) return toast('검사 주기는 1~60 사이의 정수(개월)로 입력하세요.', true);
        if (S.items.type.some(function (x) { return x.name === name && (!t || x.id !== t.id); })) return toast('같은 이름의 식품유형이 이미 있습니다.', true);
        var saved = await saveRec(Object.assign({}, t || {}, { kind: 'type', name: name, intervalMonths: interval, testItems: fv('fItems') }));
        if (t && t.intervalMonths !== interval) {
          await DkjAsync.forEach(S.items.product.filter(function (p) { return p.typeId === t.id; }), async function (p) { await saveRec(Object.assign({}, p, { intervalMonths: interval })); });
        }
        closeDialog(); await refresh(); toast('식품유형을 저장했습니다.');
        if (opts.thenProduct) openProductDialog();
        return saved;
      } });
  }

  function openProductDialog(id) {
    var p = id ? byId(S.items.product, id) : null;
    // 식품유형이 하나도 없으면 막지 않고 유형 등록 창을 먼저 열어 준다(저장 후 제품 등록 창으로 이어짐).
    // 이 사업장은 신선편의식품 한 종류가 기본이라 이름을 미리 채운다. 주기(개월)는 사용자가 확인해 저장한다.
    if (!S.items.type.length) return openTypeDialog(null, { thenProduct: true, prefillName: DEFAULT_TYPE.name, prefillInterval: DEFAULT_TYPE.intervalMonths, prefillItems: DEFAULT_TYPE.testItems });
    openDialog(p ? '제품 수정' : '새 제품 등록',
      '<div class="qs-form-grid">' +
      field('제품명', '<input id="fName" maxlength="100" value="' + esc(p ? p.name : '') + '">', true, true) +
      field('식품유형', '<select id="fType">' + typeOptions(p ? p.typeId : '') + '</select>', false, true) +
      field('검사 주기(개월) — 비우면 유형 기준', '<input id="fInterval" type="number" min="1" max="60" step="1" value="' + esc(p && p.intervalMonths ? p.intervalMonths : '') + '">', false) +
      field('최근 제조(검사)일', '<input id="fLast" type="date" max="' + today() + '" value="' + esc(p ? p.lastManufactureDate || '' : '') + '">', false, true) +
      field('생산 상태', '<select id="fProd"><option value="active"' + (!p || p.productionStatus !== 'stopped' ? ' selected' : '') + '>생산 중</option><option value="stopped"' + (p && p.productionStatus === 'stopped' ? ' selected' : '') + '>생산 중단</option></select>', false) +
      field('중단 사유', '<input id="fStop" maxlength="100" value="' + esc(p ? p.stopReason || '' : '') + '">', false) +
      field('알림', '<select id="fAlert"><option value="active"' + (!p || p.alertStatus !== 'paused' ? ' selected' : '') + '>켜짐</option><option value="paused"' + (p && p.alertStatus === 'paused' ? ' selected' : '') + '>일시 중지</option></select>', false) +
      field('비고', '<textarea id="fMemo" maxlength="300">' + esc(p ? p.memo || '' : '') + '</textarea>', true) +
      '</div>',
      { onSave: async function () {
        var name = fv('fName'), typeId = fv('fType'), last = fv('fLast'), intervalRaw = fv('fInterval');
        if (!name) return toast('제품명을 입력하세요.', true);
        if (!typeId) return toast('식품유형을 선택하세요.', true);
        if (!core.parseDate(last)) return toast('최근 제조(검사)일을 입력하세요.', true);
        if (last > today()) return toast('제조(검사)일은 오늘 이후로 정할 수 없습니다.', true);
        var interval = intervalRaw ? Number(intervalRaw) : 0;
        if (intervalRaw && (!Number.isInteger(interval) || interval < 1 || interval > 60)) return toast('검사 주기는 1~60 사이의 정수로 입력하세요.', true);
        if (S.items.product.some(function (x) { return x.name === name && x.typeId === typeId && (!p || x.id !== p.id); })) return toast('같은 식품유형에 같은 이름의 제품이 있습니다.', true);
        var stopped = fv('fProd') === 'stopped';
        if (stopped && !fv('fStop')) return toast('생산 중단 사유를 입력하세요.', true);
        var saved = await saveRec(Object.assign({}, p || {}, {
          kind: 'product', name: name, typeId: typeId, intervalMonths: interval || (byId(S.items.type, typeId) || {}).intervalMonths || 2,
          lastManufactureDate: last, productionStatus: stopped ? 'stopped' : 'active', stopReason: stopped ? fv('fStop') : '',
          alertStatus: fv('fAlert'), memo: fv('fMemo')
        }));
        if (!p || p.lastManufactureDate !== last) {
          await saveRec({ kind: 'history', productId: saved.id, productName: name, manufactureDate: last, previousDate: p ? p.lastManufactureDate || '' : '', memo: p ? '제품 수정에서 변경' : '최초 등록' });
        }
        closeDialog(); await refresh(); toast('제품을 저장했습니다.'); return saved;
      } });
  }

  function openHistoryDialog(id) {
    var p = byId(S.items.product, id); if (!p) return;
    var rows = S.items.history.filter(function (h) { return h.productId === id; }).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    openDialog('검사(제조) 갱신 이력 — ' + p.name,
      rows.length ? '<table class="qs-table"><thead><tr><th>변경 일시</th><th>이전 기준일</th><th>새 기준일</th><th>작성자</th><th>비고</th></tr></thead><tbody>' +
        rows.map(function (h) { return '<tr><td>' + esc(fmtDateTime(h.createdAt)) + '</td><td>' + esc(h.previousDate || '-') + '</td><td><b>' + esc(h.manufactureDate) + '</b></td><td>' + esc(h.createdBy || '-') + '</td><td>' + esc(h.memo || '') + '</td></tr>'; }).join('') + '</tbody></table>'
        : '<div class="qs-empty">갱신 이력이 없습니다.</div>');
  }

  function fileField(existing) {
    return field('사본 파일 (PDF 또는 이미지)', '<input id="fFile" type="file" accept="application/pdf,image/*">' + (existing ? '<small>현재: ' + esc(existing.fileName || '') + ' (' + fmtSize(existing.fileSize) + ') — 새 파일을 고르면 교체됩니다.</small>' : ''), true);
  }
  /** 폼의 파일 입력이 있으면 올리고 {fileId,fileName,fileSize}를 돌려준다. 없으면 null. */
  async function uploadFromForm() {
    var el = $('fFile'); if (!el || !el.files || !el.files[0]) return null;
    var prepared = await prepareFile(el.files[0]);
    var fileId = await putFile(prepared);
    return { fileId: fileId, fileName: prepared.name, fileSize: prepared.size };
  }

  function openHealthDialog(id) {
    var h = id ? byId(S.items.health, id) : null;
    openDialog(h ? '보건증 수정' : '보건증 등록',
      '<div class="qs-form-grid">' +
      field('담당자명', '<input id="fName" list="dkjStaffList" maxlength="40" value="' + esc(h ? h.employeeName : '') + '" autocomplete="off">', false, true) +
      field('부서/직무', '<input id="fDept" maxlength="60" value="' + esc(h ? h.department || '' : '') + '" placeholder="예: 생산팀 / 선별">', false) +
      field('발급일자', '<input id="fIssued" type="date" max="' + today() + '" value="' + esc(h ? h.issuedAt || '' : '') + '">', false, true) +
      field('만료일자 (발급일 +1년 자동)', '<input id="fExpires" type="date" value="' + esc(h ? h.expiresAt || '' : '') + '">', false, true) +
      field('재직 상태', '<select id="fEmp"><option value="active"' + (!h || h.employmentStatus !== 'inactive' ? ' selected' : '') + '>재직</option><option value="inactive"' + (h && h.employmentStatus === 'inactive' ? ' selected' : '') + '>퇴직·제외</option></select>', false) +
      field('알림', '<select id="fAlert"><option value="active"' + (!h || h.alertStatus !== 'paused' ? ' selected' : '') + '>켜짐</option><option value="paused"' + (h && h.alertStatus === 'paused' ? ' selected' : '') + '>일시 중지</option></select>', false) +
      fileField(h && h.fileId ? h : null) +
      field('비고', '<textarea id="fMemo" maxlength="300">' + esc(h ? h.memo || '' : '') + '</textarea>', true) +
      '</div><p class="qs-hint warn">보건증 사본에는 주민등록번호 등 개인정보가 있습니다. 가능하면 뒷자리를 가린 사본을 올리세요. 사본은 클라우드에 저장됩니다.</p>',
      { onSave: async function () {
        var name = fv('fName'), issued = fv('fIssued'), expires = fv('fExpires');
        if (!name) return toast('담당자명을 입력하세요.', true);
        if (!core.parseDate(issued)) return toast('발급일자를 입력하세요.', true);
        if (!expires) expires = core.addMonths(issued, 12);
        if (!core.parseDate(expires)) return toast('만료일자를 확인하세요.', true);
        if (expires < issued) return toast('만료일자가 발급일자보다 빠릅니다.', true);
        var up;
        try { up = await uploadFromForm(); } catch (e) { return toast(e.message || '파일을 올리지 못했습니다.', true); }
        var rec = Object.assign({}, h || {}, { kind: 'health', employeeName: name, department: fv('fDept'), issuedAt: issued, expiresAt: expires, employmentStatus: fv('fEmp'), alertStatus: fv('fAlert'), memo: fv('fMemo') });
        var oldFile = h && h.fileId;
        if (up) Object.assign(rec, up);
        await saveRec(rec);
        if (up && oldFile) await removeFile(oldFile);
        closeDialog(); await refresh(); toast('보건증을 저장했습니다.');
      } });
    var issuedEl = $('fIssued'), expEl = $('fExpires');
    issuedEl.addEventListener('change', function () { if (!expEl.value && core.parseDate(issuedEl.value)) expEl.value = core.addMonths(issuedEl.value, 12); });
  }

  function nextCertNumber() {
    var cfg = settings(), year = today().slice(0, 4), n = cfg.certSequence;
    var make = function (x) { return cfg.certPrefix + '-' + year + '-' + String(x).padStart(3, '0'); };
    while (S.items.cert.some(function (c) { return c.certNumber === make(n); })) n++;
    return { number: make(n), seq: n };
  }
  function openCertDialog(id) {
    var c = id ? byId(S.items.cert, id) : null;
    if (!S.items.product.length) return toast('먼저 제품을 등록하세요.', true);
    var auto = c ? null : nextCertNumber();
    var prodOpts = S.items.product.map(function (p) {
      var t = byId(S.items.type, p.typeId);
      return '<option value="' + esc(p.id) + '"' + (c && c.productId === p.id ? ' selected' : '') + '>' + esc(p.name) + (t ? ' (' + esc(t.name) + ')' : '') + '</option>';
    }).join('');
    openDialog(c ? '성적서 수정' : '성적서 등록',
      '<div class="qs-form-grid">' +
      field('성적서 번호', '<input id="fNo" maxlength="60" value="' + esc(c ? c.certNumber : auto.number) + '">', false, true) +
      field('검사일자', '<input id="fInsp" type="date" max="' + today() + '" value="' + esc(c ? c.inspectionDate : today()) + '">', false, true) +
      field('제품', '<select id="fProduct">' + prodOpts + '</select>', true, true) +
      fileField(c && c.fileId ? c : null) +
      field('비고', '<textarea id="fMemo" maxlength="300" placeholder="검사기관, 판정(적합/부적합) 등">' + esc(c ? c.memo || '' : '') + '</textarea>', true) +
      '</div><p class="qs-hint">성적서는 제품의 식품유형 단위로 인정됩니다. 검사일이 같은 유형 대표 제품의 최근 제조일 이후여야 “미등록” 알림이 해소됩니다.</p>',
      { onSave: async function () {
        var no = fv('fNo'), insp = fv('fInsp'), p = byId(S.items.product, fv('fProduct'));
        if (!no) return toast('성적서 번호를 입력하세요.', true);
        if (!core.parseDate(insp)) return toast('검사일자를 입력하세요.', true);
        if (insp > today()) return toast('검사일자는 오늘 이후로 정할 수 없습니다.', true);
        if (!p) return toast('제품을 선택하세요.', true);
        if (S.items.cert.some(function (x) { return x.certNumber === no && (!c || x.id !== c.id); })) return toast('이미 등록된 성적서 번호입니다.', true);
        var up;
        try { up = await uploadFromForm(); } catch (e) { return toast(e.message || '파일을 올리지 못했습니다.', true); }
        if (!c && !up) return toast('성적서 파일(PDF 또는 이미지)을 선택하세요.', true);
        var rec = Object.assign({}, c || {}, { kind: 'cert', certNumber: no, productId: p.id, typeId: p.typeId, inspectionDate: insp, memo: fv('fMemo') });
        var oldFile = c && c.fileId;
        if (up) Object.assign(rec, up);
        await saveRec(rec);
        if (up && oldFile) await removeFile(oldFile);
        if (auto && no === auto.number) await saveSettings({ certSequence: auto.seq + 1 });
        closeDialog(); await refresh(); toast('성적서를 저장했습니다.');
      } });
  }

  /* ------------------------------ 삭제·토글 ------------------------------ */
  async function deleteItem(kind, id) {
    if (!canDelete()) return toast('삭제는 관리자 이상만 할 수 있습니다.', true);
    var rec = byId(S.items[kind], id); if (!rec) return;
    if (kind === 'type' && S.items.product.some(function (p) { return p.typeId === id; })) return toast('이 식품유형에 등록된 제품이 있어 삭제할 수 없습니다. 제품을 먼저 옮기거나 삭제하세요.', true);
    var label = rec.name || rec.employeeName || rec.certNumber;
    if (!confirm('"' + label + '"을(를) 삭제합니다.' + (kind === 'product' ? '\n연결된 성적서는 남지만 제품 정보는 "삭제된 제품"으로 표시됩니다.' : '') + '\n계속할까요?')) return;
    await delRec(rec);
    if (kind === 'product') {
      await DkjAsync.forEach(S.items.history.filter(function (h) { return h.productId === id; }), async function (h) { await delRec(h); });
    }
    if (rec.fileId) await removeFile(rec.fileId);
    await refresh(); toast('삭제했습니다.');
  }

  /* ------------------------------ 엑셀 ------------------------------ */
  function loadExcelJs() {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script'); s.src = EXCELJS_SRC;
      s.onload = function () { window.ExcelJS ? resolve(window.ExcelJS) : reject(new Error('EXCELJS_LOAD_FAILED')); };
      s.onerror = function () { reject(new Error('EXCELJS_LOAD_FAILED')); };
      document.head.appendChild(s);
    });
  }
  function stamp() { return today().replace(/-/g, ''); }
  async function download(wb, name) {
    var buf = await wb.xlsx.writeBuffer();
    var url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function styleHeader(ws) {
    var row = ws.getRow(1); row.font = { bold: true }; row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7F1EC' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }
  async function exportExcel() {
    try {
      var X = await loadExcelJs(), wb = new X.Workbook();
      var ws = wb.addWorksheet('자가품질검사 스케줄');
      ws.columns = [['상태', 10], ['제품명', 30], ['식품유형', 16], ['검사주기(개월)', 12], ['최근 제조(검사)일', 16], ['검사 마감일', 14], ['D-Day', 12], ['생산 상태', 10], ['알림', 10], ['비고', 28]].map(function (c) { return { header: c[0], width: c[1] }; });
      var labels = { overdue: '기간 초과', urgent: '사전 알림', safe: '여유', stopped: '생산 중단', paused: '알림 중지' };
      computedProducts().sort(function (a, b) { return String(a.nextDeadline).localeCompare(String(b.nextDeadline)); }).forEach(function (p) {
        ws.addRow([labels[p.status], p.name, p.typeName, p.intervalMonths, p.lastManufactureDate || '', p.nextDeadline || '', core.formatDDay(p.dDay), p.productionStatus === 'stopped' ? '중단' : '생산 중', p.alertStatus === 'paused' ? '중지' : '켜짐', p.memo || '']);
      });
      styleHeader(ws);
      var hs = wb.addWorksheet('보건증');
      hs.columns = [['상태', 10], ['성명', 14], ['부서/직무', 18], ['발급일', 13], ['만료일', 13], ['D-Day', 12], ['재직', 8], ['사본', 8], ['비고', 28]].map(function (c) { return { header: c[0], width: c[1] }; });
      var hl = { overdue: '기간 초과', urgent: '임박', safe: '여유', inactive: '재직 제외', paused: '알림 중지' };
      S.items.health.map(function (h) { return core.healthComputed(h, S.items.setting || {}, today()); }).sort(function (a, b) { return String(a.expiresAt).localeCompare(String(b.expiresAt)); }).forEach(function (h) {
        hs.addRow([hl[h.status], h.employeeName, h.department || '', h.issuedAt || '', h.expiresAt || '', core.formatDDay(h.dDay), h.employmentStatus === 'inactive' ? '제외' : '재직', h.fileId ? '있음' : '없음', h.memo || '']);
      });
      styleHeader(hs);
      var cs = wb.addWorksheet('성적서');
      cs.columns = [['성적서 번호', 20], ['제품명', 30], ['식품유형', 16], ['검사일자', 13], ['파일명', 30], ['비고', 28]].map(function (c) { return { header: c[0], width: c[1] }; });
      S.items.cert.forEach(function (c) {
        var p = byId(S.items.product, c.productId), t = byId(S.items.type, c.typeId);
        cs.addRow([c.certNumber, p ? p.name : '', t ? t.name : '', c.inspectionDate, c.fileName || '', c.memo || '']);
      });
      styleHeader(cs);
      await download(wb, '동김제농협_자가품질검사_보건증_' + stamp() + '.xlsx'); toast('엑셀 파일을 내려받았습니다.');
    } catch (e) { toast('엑셀 파일을 만들지 못했습니다. 다시 시도해 주세요.', true); }
  }
  async function downloadTemplate() {
    try {
      var X = await loadExcelJs(), wb = new X.Workbook();
      var info = wb.addWorksheet('안내');
      info.getColumn(1).width = 100;
      ['자가품질검사·보건증 일괄 등록 양식', '', '1. [제품] 시트: 제품명·식품유형·최근제조일은 필수입니다. 식품유형이 앱에 없으면 새로 만듭니다(검사주기 빈칸이면 2개월).',
        '2. [보건증] 시트: 성명·발급일은 필수입니다. 만료일이 비어 있으면 발급일 +1년으로 계산합니다.', '3. 날짜는 2026-10-27 형식(또는 엑셀 날짜)으로 입력하세요.',
        '4. 같은 제품명(같은 식품유형)·같은 성명은 새로 만들지 않고 날짜를 갱신합니다.', '5. 오류가 한 행이라도 있으면 아무것도 저장하지 않고 행 번호와 사유를 안내합니다.',
        '6. 보건증 사본·성적서 파일은 엑셀로 올릴 수 없습니다. 화면에서 개별 등록하세요.'].forEach(function (t) { info.addRow([t]); });
      info.getRow(1).font = { bold: true, size: 14 };
      var ps = wb.addWorksheet('제품');
      ps.columns = [['제품명*', 32], ['식품유형*', 16], ['검사주기(개월)', 14], ['최근제조일*', 14], ['비고', 28]].map(function (c) { return { header: c[0], width: c[1] }; });
      styleHeader(ps);
      var hs = wb.addWorksheet('보건증');
      hs.columns = [['성명*', 14], ['부서/직무', 20], ['발급일*', 14], ['만료일', 14], ['비고', 28]].map(function (c) { return { header: c[0], width: c[1] }; });
      styleHeader(hs);
      await download(wb, '동김제농협_자가품질검사_보건증_등록양식.xlsx');
    } catch (e) { toast('엑셀 양식을 만들지 못했습니다.', true); }
  }
  function cellText(v) {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
    if (typeof v === 'object') {
      if (v.richText) return v.richText.map(function (r) { return r.text; }).join('').trim();
      if (v.result !== undefined) return cellText(v.result);
      if (v.text !== undefined) return String(v.text).trim();
      return '';
    }
    return String(v).trim();
  }
  function normDate(v) {
    var s = cellText(v).replace(/[./]/g, '-').replace(/\s+/g, '');
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    return m ? m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0') : s;
  }
  function showImportErrors(errors) {
    var box = $('qsImportErrors');
    if (!errors.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = '<b>가져오기 차단: 오류 ' + errors.length + '건 — 모두 고친 뒤 다시 올려 주세요.</b><ul>' + errors.slice(0, 15).map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' + (errors.length > 15 ? '<p>외 ' + (errors.length - 15) + '건</p>' : '');
  }
  async function importExcel(file) {
    showImportErrors([]);
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return toast('엑셀 파일은 3MB 이하만 가져올 수 있습니다.', true);
    try {
      var X = await loadExcelJs(), wb = new X.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      var errors = [], newTypes = {}, prodRows = [], healthRows = [], t0 = today();
      var typeByName = {}; S.items.type.forEach(function (t) { typeByName[t.name] = t; });
      var ps = wb.getWorksheet('제품'), hs = wb.getWorksheet('보건증');
      if (!ps && !hs) return toast('[제품] 또는 [보건증] 시트가 없습니다. 양식을 다시 내려받아 사용하세요.', true);
      if (ps) ps.eachRow(function (row, n) {
        if (n === 1) return;
        var name = cellText(row.getCell(1).value), tname = cellText(row.getCell(2).value);
        if (!name && !tname && !cellText(row.getCell(4).value)) return;
        var iv = cellText(row.getCell(3).value), interval = iv ? Number(iv) : 0, last = normDate(row.getCell(4).value), e0 = errors.length;
        if (!name) errors.push('[제품] ' + n + '행: 제품명이 비었습니다.');
        if (!tname) errors.push('[제품] ' + n + '행: 식품유형이 비었습니다.');
        if (iv && (!Number.isInteger(interval) || interval < 1 || interval > 60)) errors.push('[제품] ' + n + '행: 검사주기는 1~60 사이의 정수여야 합니다.');
        if (!core.parseDate(last)) errors.push('[제품] ' + n + '행: 최근제조일 형식이 올바르지 않습니다(예: 2026-10-27).');
        else if (last > t0) errors.push('[제품] ' + n + '행: 최근제조일이 오늘 이후입니다.');
        if (errors.length === e0) prodRows.push({ name: name, typeName: tname, interval: interval, last: last, memo: cellText(row.getCell(5).value), row: n });
      });
      if (hs) hs.eachRow(function (row, n) {
        if (n === 1) return;
        var name = cellText(row.getCell(1).value);
        if (!name && !cellText(row.getCell(3).value)) return;
        var issued = normDate(row.getCell(3).value), expires = normDate(row.getCell(4).value), e0 = errors.length;
        if (!name) errors.push('[보건증] ' + n + '행: 성명이 비었습니다.');
        if (!core.parseDate(issued)) errors.push('[보건증] ' + n + '행: 발급일 형식이 올바르지 않습니다.');
        if (expires && !core.parseDate(expires)) errors.push('[보건증] ' + n + '행: 만료일 형식이 올바르지 않습니다.');
        if (errors.length === e0) {
          if (!expires) expires = core.addMonths(issued, 12);
          if (expires < issued) errors.push('[보건증] ' + n + '행: 만료일이 발급일보다 빠릅니다.');
          else healthRows.push({ name: name, dept: cellText(row.getCell(2).value), issued: issued, expires: expires, memo: cellText(row.getCell(5).value), row: n });
        }
      });
      if (prodRows.length + healthRows.length > MAX_IMPORT_ROWS) errors.push('한 번에 ' + MAX_IMPORT_ROWS + '행까지만 가져올 수 있습니다.');
      if (errors.length) return showImportErrors(errors);
      if (!prodRows.length && !healthRows.length) return toast('가져올 데이터 행이 없습니다.', true);
      if (!confirm('제품 ' + prodRows.length + '건, 보건증 ' + healthRows.length + '건을 등록·갱신합니다. 계속할까요?')) return;

      var added = { type: 0, product: 0, productUpd: 0, health: 0, healthUpd: 0 };
      await DkjAsync.forEach(prodRows, async function (r) {
        var t = typeByName[r.typeName];
        if (!t) {
          t = await saveRec({ kind: 'type', name: r.typeName, intervalMonths: r.interval || 2, testItems: '' });
          typeByName[r.typeName] = t; added.type++; S.items.type.push(t);
        }
        var ex = S.items.product.filter(function (p) { return p.name === r.name && p.typeId === t.id; })[0];
        if (ex) {
          if (r.last > (ex.lastManufactureDate || '')) {
            await saveRec(Object.assign({}, ex, { lastManufactureDate: r.last, intervalMonths: r.interval || ex.intervalMonths, memo: r.memo || ex.memo }));
            await saveRec({ kind: 'history', productId: ex.id, productName: ex.name, manufactureDate: r.last, previousDate: ex.lastManufactureDate || '', memo: '엑셀 가져오기' });
          }
          added.productUpd++;
        } else {
          var saved = await saveRec({ kind: 'product', name: r.name, typeId: t.id, intervalMonths: r.interval || t.intervalMonths || 2, lastManufactureDate: r.last, productionStatus: 'active', stopReason: '', alertStatus: 'active', memo: r.memo });
          await saveRec({ kind: 'history', productId: saved.id, productName: r.name, manufactureDate: r.last, previousDate: '', memo: '엑셀 가져오기(최초 등록)' });
          added.product++;
        }
      });
      // 같은 파일의 같은 성명은 만료일이 가장 늦은 행 하나로 합친다
      var latest = {};
      healthRows.forEach(function (r) { if (!latest[r.name] || r.expires > latest[r.name].expires) latest[r.name] = r; });
      await DkjAsync.forEach(Object.keys(latest), async function (name) {
        var r = latest[name], ex = S.items.health.filter(function (h) { return h.employeeName === name; })[0];
        if (ex) {
          if (r.expires > (ex.expiresAt || '')) await saveRec(Object.assign({}, ex, { issuedAt: r.issued, expiresAt: r.expires, department: r.dept || ex.department, memo: r.memo || ex.memo }));
          added.healthUpd++;
        } else {
          await saveRec({ kind: 'health', employeeName: name, department: r.dept, issuedAt: r.issued, expiresAt: r.expires, employmentStatus: 'active', alertStatus: 'active', memo: r.memo, fileId: '', fileName: '', fileSize: 0 });
          added.health++;
        }
      });
      await refresh();
      setStatus('가져오기 완료 — 식품유형 신규 ' + added.type + ', 제품 신규 ' + added.product + '·갱신 ' + added.productUpd + ', 보건증 신규 ' + added.health + '·갱신 ' + added.healthUpd);
    } catch (e) { toast('엑셀 파일을 읽지 못했습니다: ' + (e.message || e), true); }
  }

  /* ------------------------------ 화면 제어 ------------------------------ */
  function switchTab(tab) {
    S.tab = tab;
    Array.prototype.forEach.call(document.querySelectorAll('#qsTabs button'), function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === tab); });
    ['dashboard', 'products', 'types', 'health', 'certs', 'settings'].forEach(function (t) { $('view-' + t).hidden = t !== tab; });
    renderCurrent();
    try { history.replaceState(null, '', '#quality-' + tab); } catch (e) {}
  }
  function renderCurrent() {
    refreshTypeSelects();
    if (S.tab === 'dashboard') renderDashboard();
    else if (S.tab === 'products') renderProducts();
    else if (S.tab === 'types') renderTypes();
    else if (S.tab === 'health') renderHealth();
    else if (S.tab === 'certs') renderCerts();
    else if (S.tab === 'settings') renderSettingsTab();
  }
  async function refresh() { await load(); renderCurrent(); }
  function guarded(fn) {
    return async function () {
      if (S.busy) return;
      S.busy = true;
      try { return await fn.apply(this, arguments); }
      catch (e) { toast((e && e.message) || '처리하지 못했습니다. 다시 시도해 주세요.', true); }
      finally { S.busy = false; }
    };
  }

  function bind() {
    $('qsTabs').addEventListener('click', function (e) { var b = e.target.closest('button[data-tab]'); if (b) switchTab(b.getAttribute('data-tab')); });
    $('qsDialogClose').addEventListener('click', closeDialog);
    $('qsDialogForm').addEventListener('submit', guarded(async function (e) { e.preventDefault(); if (dlg.onSave) await dlg.onSave(); }));
    ['dashSearch', 'dashStatus', 'dashType', 'dashQuick', 'dashAll'].forEach(function (id) { $(id).addEventListener('input', renderDashboard); $(id).addEventListener('change', renderDashboard); });
    ['prodSearch', 'prodType', 'prodState'].forEach(function (id) { $(id).addEventListener('input', renderProducts); $(id).addEventListener('change', renderProducts); });
    ['certType', 'certSearch'].forEach(function (id) { $(id).addEventListener('input', renderCerts); $(id).addEventListener('change', renderCerts); });
    ['healthSearch', 'healthSort'].forEach(function (id) { $(id).addEventListener('input', renderHealth); $(id).addEventListener('change', renderHealth); });
    $('healthFilter').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-hf]'); if (!b) return;
      S.healthFilter = b.getAttribute('data-hf');
      Array.prototype.forEach.call($('healthFilter').children, function (x) { x.classList.toggle('on', x === b); });
      renderHealth();
    });
    $('qsExcelExport').addEventListener('click', exportExcel);
    $('qsPrint').addEventListener('click', function () { window.print(); });
    $('qsTemplate').addEventListener('click', downloadTemplate);
    $('qsImportBtn').addEventListener('click', function () { $('qsImportFile').click(); });
    $('qsImportFile').addEventListener('change', guarded(async function (e) { var f = e.target.files[0]; e.target.value = ''; await importExcel(f); }));
    $('qsHealthTest').addEventListener('click', guarded(sendHealthTest));
    $('tgSendToday').addEventListener('click', guarded(function () { return sendToday(false); }));
    $('tgTest').addEventListener('click', guarded(function () { return sendToday(true); }));
    $('setSave').addEventListener('click', guarded(async function () {
      var warn = Number(fv('setWarning')), seq = Number(fv('setCertSeq')), days = core.normalizeHealthAlertDays(fv('setHealthDays'));
      if (!Number.isInteger(warn) || warn < 1 || warn > 90) return toast('검사 사전 알림 일수는 1~90 사이의 정수로 입력하세요.', true);
      if (!Number.isInteger(seq) || seq < 1) return toast('성적서 일련번호를 확인하세요.', true);
      var prefix = fv('setCertPrefix') || 'DKJ-QC';
      await saveSettings({ warningDays: warn, healthAlertDays: days, certPrefix: prefix, certSequence: seq });
      await refresh(); toast('설정을 저장했습니다. (보건증 알림 기준일: ' + days.map(function (d) { return 'D-' + d; }).join(' · ') + ')');
    }));

    document.addEventListener('click', guarded(async function (e) {
      var t = e.target.closest('button,[data-goto]'); if (!t) return;
      var a;
      if ((a = t.getAttribute('data-open'))) { return ({ product: openProductDialog, type: openTypeDialog, health: openHealthDialog, cert: openCertDialog })[a](); }
      if ((a = t.getAttribute('data-goto'))) return switchTab(a);
      if ((a = t.getAttribute('data-dash-status'))) { S.dashStatus = a; return renderDashboard(); }
      if ((a = t.getAttribute('data-edit-product'))) return openProductDialog(a);
      if ((a = t.getAttribute('data-product-history'))) return openHistoryDialog(a);
      if ((a = t.getAttribute('data-del-product'))) return deleteItem('product', a);
      if ((a = t.getAttribute('data-renew'))) { var inp = document.querySelector('[data-renew-date="' + a + '"]'); return renewProduct(a, inp ? inp.value : ''); }
      if ((a = t.getAttribute('data-toggle-alert'))) {
        var p = byId(S.items.product, a); if (!p) return;
        await saveRec(Object.assign({}, p, { alertStatus: p.alertStatus === 'paused' ? 'active' : 'paused' })); await refresh(); return toast(p.alertStatus === 'paused' ? '알림을 다시 켰습니다.' : '알림을 일시 중지했습니다.');
      }
      if ((a = t.getAttribute('data-edit-type'))) return openTypeDialog(a);
      if ((a = t.getAttribute('data-del-type'))) return deleteItem('type', a);
      if ((a = t.getAttribute('data-edit-health'))) return openHealthDialog(a);
      if ((a = t.getAttribute('data-del-health'))) return deleteItem('health', a);
      if ((a = t.getAttribute('data-health-alert'))) {
        var h = byId(S.items.health, a); if (!h) return;
        await saveRec(Object.assign({}, h, { alertStatus: h.alertStatus === 'paused' ? 'active' : 'paused' })); await refresh(); return toast(h.alertStatus === 'paused' ? '알림을 다시 켰습니다.' : '알림을 일시 중지했습니다.');
      }
      if ((a = t.getAttribute('data-edit-cert'))) return openCertDialog(a);
      if ((a = t.getAttribute('data-del-cert'))) return deleteItem('cert', a);
      if ((a = t.getAttribute('data-open-file'))) return openFile(a, false);
      if ((a = t.getAttribute('data-dl-file'))) return openFile(a, true);
    }));
    document.addEventListener('change', guarded(async function (e) {
      var el = e.target, a;
      if ((a = el.getAttribute && el.getAttribute('data-main-product')) !== null && a !== undefined && el.hasAttribute('data-main-product')) {
        var map = Object.assign({}, settings().mainProductByType);
        if (el.value) map[a] = el.value; else delete map[a];
        await saveSettings({ mainProductByType: map }); await refresh(); return toast('대시보드 대표 제품을 저장했습니다.');
      }
      if (el.hasAttribute && el.hasAttribute('data-type-visible')) {
        var id = el.getAttribute('data-type-visible'), hidden = settings().hiddenTypeIds.filter(function (x) { return x !== id; });
        if (!el.checked) hidden.push(id);
        await saveSettings({ hiddenTypeIds: hidden }); await refresh();
        return toast(el.checked ? '대시보드에 표시합니다.' : '대시보드에서 숨겼습니다. (텔레그램 알림은 계속됩니다)');
      }
    }));
    window.addEventListener('dkj:records-changed', function () { if (!$('qsDialog').open) refresh(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden && !$('qsDialog').open) refresh(); });
    setInterval(function () { if (!document.hidden && !$('qsDialog').open) refresh(); }, 60000);
  }

  var TABS = ['dashboard', 'products', 'types', 'health', 'certs', 'settings'];
  /** 정기 알림 화면의 위쪽 구분: periodic(정기 관리 항목) / quality(이 화면) */
  function setTop(which) {
    var quality = which === 'quality';
    $('paPane').hidden = quality; $('qsPane').hidden = !quality;
    Array.prototype.forEach.call(document.querySelectorAll('#paTopTabs button'), function (b) { b.classList.toggle('on', b.getAttribute('data-top') === which); });
    if (quality) renderCurrent();
    try { history.replaceState(null, '', quality ? '#quality-' + S.tab : '#periodic'); } catch (e) {}
  }
  function routeFromHash() {
    var h = (location.hash || '').replace('#', ''), m = /^quality(?:-(\w+))?$/.exec(h);
    if (!m) { setTop('periodic'); return; }
    if (m[1] && TABS.indexOf(m[1]) !== -1) S.tab = m[1];
    setTop('quality'); switchTab(S.tab);
  }
  /** 기본 식품유형을 한 번만 등록한다. 같은 id 로 저장하므로 여러 기기가 동시에 열어도 중복되지 않는다. */
  async function seedDefaults() {
    try {
      if (!S.loaded || (S.items.setting && S.items.setting.seededDefaults) || S.items.type.length) return;
      await saveRec({ id: DEFAULT_TYPE.id, kind: 'type', name: DEFAULT_TYPE.name, intervalMonths: DEFAULT_TYPE.intervalMonths, testItems: DEFAULT_TYPE.testItems });
      await saveSettings({ seededDefaults: true });
      await load();
    } catch (e) { /* 저장소를 못 쓰면 다음 접속에 다시 시도 */ }
  }
  async function init() {
    bind();
    $('paTopTabs').addEventListener('click', function (e) { var b = e.target.closest('button[data-top]'); if (b) setTop(b.getAttribute('data-top')); });
    document.addEventListener('click', function (e) { var a = e.target.closest('[data-go-quality]'); if (a) { e.preventDefault(); setTop('quality'); switchTab('dashboard'); } });
    window.addEventListener('hashchange', routeFromHash);
    try { if (window.DkjUtil && DkjUtil.ensureStaffDatalist) DkjUtil.ensureStaffDatalist(); } catch (e) {}
    await load();
    await seedDefaults();
    routeFromHash();
    if (window.DkjTelegram && DkjTelegram.syncFromCloud) DkjTelegram.syncFromCloud().then(function () { if (S.tab === 'settings') renderSettingsTab(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
