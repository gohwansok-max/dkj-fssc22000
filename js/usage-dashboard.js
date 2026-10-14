/**
 * 사용현황 모니터링 — scripts/snapshot_usage.py 가 매일 쌓는 스냅샷을 읽어 보여준다.
 * 시스템 관리자(사번 4343) 전용. 집계 로직은 전부 서버 쪽(GitHub Actions)에 있고,
 * 이 화면은 읽기만 한다 — database.rules.json 의 records/$recordKey 는 이미
 * .read:true 라 로그인 토큰 없이도 조회된다(system-settings.js의 게이트는 "누가
 * 볼 수 있는가"를 화면에서만 가리는 것이지 RTDB 쪼기와는 별개다).
 */
(function () {
  'use strict';

  var DAYS = 14;

  function $(id) { return document.getElementById(id); }

  function kstToday() {
    var now = new Date();
    var kst = new Date(now.getTime() + (9 * 60 - now.getTimezoneOffset()) * 60000);
    return kst;
  }

  function dateStr(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function lastNDates(n) {
    var out = [];
    var base = kstToday();
    for (var i = 0; i < n; i++) {
      var d = new Date(base.getTime());
      d.setDate(d.getDate() - i);
      out.push(dateStr(d));
    }
    return out;
  }

  function dbRoot() {
    var cfg = window.DKJ_FIREBASE || {};
    if (!cfg.databaseURL) return '';
    return String(cfg.databaseURL).replace(/\/$/, '') + '/' + (cfg.root || 'dkj-fssc22000');
  }

  function fetchSnapshot(day) {
    var root = dbRoot();
    var sync = window.DkjCloudSync;
    if (!root || !sync || !sync.nodeKey) return Promise.resolve(null);
    var key = sync.nodeKey('dkj:usage-daily:' + day + ':v1');
    var url = root + '/records/' + key + '.json?_=' + Date.now();
    return fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        return (data && data.value) ? data.value : null;
      })
      .catch(function () { return null; });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderMetrics(latest) {
    var el = $('usageMetrics');
    if (!el) return;
    if (!latest) {
      el.innerHTML = '';
      return;
    }
    var logins = latest.logins || {};
    var records = latest.records || {};
    el.innerHTML =
      '<div class="metric"><span class="label">등록 계정 수</span><strong>' + (logins.totalAccounts || 0) + '</strong><small>시스템 설정 기준</small></div>' +
      '<div class="metric"><span class="label">오늘 로그인</span><strong>' + (logins.loggedInToday || 0) + '</strong><small>' + esc(latest.date) + '</small></div>' +
      '<div class="metric"><span class="label">최근 7일 로그인</span><strong>' + (logins.loggedInLast7d || 0) + '</strong><small>누적 계정 수</small></div>' +
      '<div class="metric"><span class="label">오늘 작성·수정 기록</span><strong>' + (records.writtenToday || 0) + '</strong><small>' + (records.formsTouched || 0) + '/' + (records.formsTotal || 0) + '개 서식</small></div>';
  }

  function renderTable(rows) {
    var wrap = $('usageTableWrap');
    if (!wrap) return;
    var withData = rows.filter(function (r) { return r.snapshot; });
    if (!withData.length) {
      wrap.innerHTML = '<div class="empty">아직 수집된 스냅샷이 없습니다.</div>';
      return;
    }
    var body = rows.map(function (r) {
      if (!r.snapshot) {
        return '<tr><td>' + esc(r.date) + '</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td>—</td></tr>';
      }
      var s = r.snapshot;
      var logins = s.logins || {};
      var records = s.records || {};
      var forms = Object.keys(records.byForm || {}).sort(function (a, b) {
        return (records.byForm[b] || 0) - (records.byForm[a] || 0);
      }).slice(0, 6).map(function (code) {
        return '<span class="form-chip">' + esc(code) + ' ' + records.byForm[code] + '</span>';
      }).join('');
      return '<tr>' +
        '<td>' + esc(r.date) + '</td>' +
        '<td class="num">' + (logins.loggedInToday || 0) + '</td>' +
        '<td class="num">' + (logins.loggedInLast7d || 0) + '</td>' +
        '<td class="num">' + (records.writtenToday || 0) + '</td>' +
        '<td>' + (forms || '<span style="color:#9aa">—</span>') + '</td>' +
        '</tr>';
    }).join('');
    wrap.innerHTML = '<table class="usage-table"><thead><tr>' +
      '<th>날짜</th><th>오늘 로그인</th><th>최근 7일 로그인</th><th>작성·수정 기록</th><th>서식별 상위</th>' +
      '</tr></thead><tbody>' + body + '</tbody></table>';
  }

  function renderEmptyNote(hasAny) {
    var note = $('usageEmptyNote');
    var card = note && note.closest('.card');
    if (!card) return;
    if (hasAny) { card.hidden = true; return; }
    card.hidden = false;
    note.textContent = '스냅샷은 매일 23:50(KST) GitHub Actions(.github/workflows/usage-snapshot.yml)가 자동으로 생성합니다. ' +
      '지금 비어 있다면 아직 한 번도 실행되지 않았거나 배포 직후입니다 — GitHub Actions 탭에서 "사용현황 일일 스냅샷" 워크플로를 수동 실행(dry_run 끄고)하면 바로 채워집니다. ' +
      '로그인 집계는 2026-10-09 이후 로그인부터 쌓이므로, 그 전 활동은 반영되지 않습니다.';
  }

  function load() {
    var days = lastNDates(DAYS);
    Promise.all(days.map(function (day) {
      return fetchSnapshot(day).then(function (snapshot) { return { date: day, snapshot: snapshot }; });
    })).then(function (rows) {
      var hasAny = rows.some(function (r) { return !!r.snapshot; });
      renderMetrics(rows[0] && rows[0].snapshot);
      renderTable(rows);
      renderEmptyNote(hasAny);
    });
  }

  function gate() {
    var auth = window.DkjAuth;
    var me = auth && auth.user ? auth.user() : null;
    var status = $('systemStatus');
    if (!me || String(me.empId) !== '4343') {
      if (status) { status.className = 'system-status bad'; status.textContent = '시스템 관리자 권한이 필요합니다. 사번 4343으로 로그인하세요.'; }
      $('usageDenied').hidden = false;
      $('usageContent').hidden = true;
      return;
    }
    if (status) { status.className = 'system-status ok'; status.textContent = '시스템 관리자 ' + (me.name || me.empId) + '님 — 사용현황을 불러오는 중입니다.'; }
    $('usageDenied').hidden = true;
    $('usageContent').hidden = false;
    load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', gate);
  } else {
    gate();
  }
  document.addEventListener('dkj:auth-ready', gate);
})();
