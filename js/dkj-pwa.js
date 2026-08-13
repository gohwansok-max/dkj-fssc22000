/**
 * DkjPwa — 서비스워커 등록 + 오프라인 표시
 *
 * 하는 일 세 가지.
 *   1) sw.js 등록 — 저장소를 하위 경로(/dkj-fssc22000/)에 올려도 되도록
 *      이 파일 자신의 경로에서 루트를 계산한다.
 *   2) 오프라인이 되면 화면 아래에 띠를 띄운다. "저장은 태블릿에 된다"를
 *      알려줘야 작업자가 기록을 멈추지 않는다.
 *   3) 새 버전이 깔리면 알림 띠를 띄운다. 자동으로 새로고침하지 않는다 —
 *      작성 중인 일지가 날아가면 안 된다. 새로고침은 작업자가 누른다.
 */
(function (global) {
  'use strict';

  var doc = global.document;

  /** 이 스크립트(js/dkj-pwa.js)의 위치에서 사이트 루트를 되짚는다 */
  function siteRoot() {
    var el = doc.currentScript;
    if (!el) {
      var all = doc.getElementsByTagName('script');
      for (var i = all.length - 1; i >= 0; i--) {
        if ((all[i].src || '').indexOf('dkj-pwa.js') !== -1) { el = all[i]; break; }
      }
    }
    if (!el || !el.src) return null;
    return el.src.split('?')[0].replace(/js\/dkj-pwa\.js$/, '');
  }

  /* ---------- 알림 띠 ---------- */

  var styleInjected = false;

  function injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    var css =
      '.dkj-pwa-bar{position:fixed;left:0;right:0;bottom:0;z-index:9999;' +
      'display:flex;align-items:center;justify-content:center;gap:12px;' +
      'padding:10px 16px;font-size:14px;font-weight:600;color:#fff;' +
      "font-family:'Noto Sans KR','Malgun Gothic',sans-serif;" +
      'box-shadow:0 -2px 10px rgba(0,0,0,.15)}' +
      '.dkj-pwa-bar.offline{background:#7a5c00}' +
      '.dkj-pwa-bar.update{background:#009a44}' +
      '.dkj-pwa-bar button{border:0;border-radius:999px;padding:6px 14px;' +
      'font-size:13px;font-weight:700;cursor:pointer;background:#fff;color:#222}' +
      '@media print{.dkj-pwa-bar{display:none}}';
    var s = doc.createElement('style');
    s.setAttribute('data-dkj', 'pwa');
    s.appendChild(doc.createTextNode(css));
    (doc.head || doc.documentElement).appendChild(s);
  }

  function bar(id, cls, text, btnLabel, onClick) {
    injectStyle();
    var el = doc.getElementById(id);
    if (!el) {
      el = doc.createElement('div');
      el.id = id;
      doc.body.appendChild(el);
    }
    el.className = 'dkj-pwa-bar ' + cls;
    el.textContent = text;
    if (btnLabel) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.textContent = btnLabel;
      b.addEventListener('click', onClick);
      el.appendChild(b);
    }
    return el;
  }

  function removeBar(id) {
    var el = doc.getElementById(id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  /* ---------- 오프라인 표시 ---------- */

  function renderNetworkState() {
    if (global.navigator.onLine) {
      removeBar('dkjPwaOffline');
    } else {
      bar('dkjPwaOffline', 'offline',
          '오프라인 — 기록은 태블릿에 저장되고, 연결되면 자동으로 동기화됩니다.');
    }
  }

  /* ---------- 등록 ---------- */

  /**
   * 태블릿은 며칠씩 켜둔 채 쓰인다. 페이지를 새로 여는 일이 드물어
   * 그대로 두면 새 버전을 영영 못 받는다. 와이파이가 돌아왔을 때와
   * 화면을 다시 켰을 때 확인한다(10분에 한 번까지).
   */
  function watchForUpdates(reg) {
    var last = Date.now();
    function check() {
      if (Date.now() - last < 600000) return;
      if (!global.navigator.onLine) return;
      last = Date.now();
      reg.update()['catch'](function () { /* 오프라인이면 조용히 넘어간다 */ });
    }
    global.addEventListener('online', check);
    doc.addEventListener('visibilitychange', function () {
      if (doc.visibilityState === 'visible') check();
    });
  }

  function register() {
    if (!('serviceWorker' in global.navigator)) return;
    // file:// 로 열면 서비스워커를 못 쓴다. 경고 없이 그냥 넘어간다.
    if (global.location.protocol !== 'https:' && global.location.hostname !== 'localhost'
        && global.location.hostname !== '127.0.0.1') {
      return;
    }
    var root = siteRoot();
    if (!root) return;

    var hadController = !!global.navigator.serviceWorker.controller;

    global.navigator.serviceWorker.register(root + 'sw.js', {
      scope: root,
      // GitHub Pages 는 정적 파일에 10분짜리 캐시 헤더를 붙인다. 기본값이면
      // sw.js 가 importScripts 하는 sw-precache.js 를 그 캐시에서 받아
      // 배포가 최대 10분 늦게 반영된다. 갱신 확인은 항상 서버에 묻는다.
      updateViaCache: 'none'
    }).then(function (reg) {
      watchForUpdates(reg);
    })['catch'](function (err) {
      console.warn('[dkj-pwa] 서비스워커 등록 실패:', err && err.message);
    });

    // 새 서비스워커가 제어권을 넘겨받으면 = 새 버전이 깔린 것
    global.navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) return;   // 첫 설치는 알릴 것이 없다
      bar('dkjPwaUpdate', 'update', '새 버전이 준비됐습니다.', '새로고침', function () {
        global.location.reload();
      });
    });
  }

  function init() {
    renderNetworkState();
    global.addEventListener('online', renderNetworkState);
    global.addEventListener('offline', renderNetworkState);
    register();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();

  global.DkjPwa = { siteRoot: siteRoot };
})(window);
