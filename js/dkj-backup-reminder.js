/**
 * DkjBackupReminder — 시스템 관리자(사번 4343)에게 주 1회 백업을 화면 배너로 안내.
 *
 * 서버가 없어 정해진 시각에 알림을 발송할 방법이 없다. 대신 관리자가 화면을 열
 * 때마다 마지막 백업일을 확인해, 7일이 지났으면(또는 아직 한 번도 안 했으면)
 * 눈에 띄는 배너로 "백업하세요"를 안내한다. dkj-pwa.js 의 알림 띠와 같은 방식
 * (자체 CSS 주입 + 고정 배너)을 쓰되, 겹치지 않게 화면 위쪽에 띄운다.
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var KEY = 'dkj:backup:lastBackupAt:v1';
  var WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  var BAR_ID = 'dkjBackupReminder';

  function injectStyle() {
    if (doc.querySelector('style[data-dkj="backup-reminder"]')) return;
    var css =
      '.dkj-backup-bar{position:fixed;left:0;right:0;top:0;z-index:9998;' +
      'display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;' +
      'padding:10px 16px;font-size:13.5px;font-weight:700;color:#fff;background:#9b5c00;' +
      "font-family:'Noto Sans KR','Malgun Gothic',sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.15)}" +
      '.dkj-backup-bar button{border:0;border-radius:999px;padding:6px 14px;' +
      'font-size:13px;font-weight:700;cursor:pointer;background:#fff;color:#7a4700}' +
      '@media print{.dkj-backup-bar{display:none}}';
    var s = doc.createElement('style');
    s.setAttribute('data-dkj', 'backup-reminder');
    s.appendChild(doc.createTextNode(css));
    (doc.head || doc.documentElement).appendChild(s);
  }

  function removeBar() {
    var el = doc.getElementById(BAR_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function daysSince(iso) {
    return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  }

  function goBackup() {
    if (global.location.pathname.indexOf('system-settings.html') !== -1) {
      var btn = doc.getElementById('btnFullBackup');
      if (btn) { btn.click(); return; }
    }
    global.location.href = 'system-settings.html';
  }

  function render() {
    var auth = global.DkjAuth;
    var me = auth && auth.user && auth.user();
    // 백업·복원은 시스템 관리자(4343) 전용 기능이라, 배너도 그 사람에게만 띄운다.
    if (!me || String(me.empId) !== '4343') { removeBar(); return; }

    var last = null;
    try { last = localStorage.getItem(KEY); } catch (e) {}
    var overdue = !last || (Date.now() - new Date(last).getTime()) > WEEK_MS;
    if (!overdue) { removeBar(); return; }

    injectStyle();
    var el = doc.getElementById(BAR_ID);
    if (!el) {
      el = doc.createElement('div');
      el.id = BAR_ID;
      doc.body.appendChild(el);
    }
    el.className = 'dkj-backup-bar';
    el.textContent = last
      ? '⚠ 마지막 전체 백업이 ' + daysSince(last) + '일 전입니다. 이번 주 백업을 잊지 마세요.'
      : '⚠ 아직 전체 백업을 한 번도 받지 않았습니다.';
    var b = doc.createElement('button');
    b.type = 'button';
    b.textContent = '지금 백업하러 가기';
    b.addEventListener('click', goBackup);
    el.appendChild(b);
  }

  doc.addEventListener('dkj:auth-ready', render);
  if (global.DkjAuth && global.DkjAuth.user && global.DkjAuth.user()) render();
})(window);
