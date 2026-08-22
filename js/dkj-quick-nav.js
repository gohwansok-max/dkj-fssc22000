/*
 * 동김제농협 스마트 HACCP — 전 화면 공통 빠른 이동 플로팅 버튼 (이전 / 홈)
 */
(function (global) {
  'use strict';

  function isConsoleHomePage() {
    var p = (global.location && global.location.pathname) || '';
    // index.html 또는 루트 폴더 접근 시
    return (/(?:^|\/)index\.html$/i.test(p) || /\/dkj-fssc22000\/?$/i.test(p) || p === '/') && p.indexOf('/records/') === -1;
  }

  function getBaseHref() {
    var p = (global.location && global.location.pathname) || '';
    if (/\/records\/[^\/]+$/i.test(p) || p.indexOf('/records/') !== -1) {
      return '../';
    }
    return './';
  }

  function hasInternalPreviousPage() {
    if (!document.referrer) return false;
    try {
      var prev = new URL(document.referrer);
      return prev.origin === global.location.origin && prev.pathname !== global.location.pathname;
    } catch (e) {
      return false;
    }
  }

  function hardReload() {
    // 서비스워커 등록 해제 + 모든 캐시 삭제 후 새로고침
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (registrations) {
        var unregisterPromises = registrations.map(function (reg) { return reg.unregister(); });
        return Promise.all(unregisterPromises);
      }).then(function () {
        if ('caches' in global) {
          return caches.keys().then(function (names) {
            return Promise.all(names.map(function (name) { return caches.delete(name); }));
          });
        }
      }).then(function () {
        global.location.reload();
      }).catch(function () {
        global.location.reload();
      });
    } else {
      global.location.reload();
    }
  }

  function render() {
    if (document.getElementById('dkjQuickNav')) return;

    var base = getBaseHref();
    var homeHref = base + 'index.html';
    var isHome = isConsoleHomePage();

    var nav = document.createElement('nav');
    nav.id = 'dkjQuickNav';
    nav.className = 'dkj-quick-nav';
    nav.setAttribute('aria-label', '빠른 이동');

    // 홈 화면에서는 이전/홈 버튼 숨기고 새로고침만 표시
    if (isHome) {
      nav.innerHTML =
        '<button type="button" class="dkj-quick-nav__button dkj-quick-nav__reload" title="캐시 제거 후 강력 새로고침합니다." aria-label="강력 새로고침">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>' +
        '</button>';
    } else {
      nav.innerHTML =
        '<button type="button" class="dkj-quick-nav__button dkj-quick-nav__back" title="이전 화면으로 이동합니다. 이전 화면이 없으면 홈으로 이동합니다." aria-label="이전 화면으로 이동">' +
          '<span class="dkj-quick-nav__icon" aria-hidden="true">‹</span><span>이전</span>' +
        '</button>' +
        '<a class="dkj-quick-nav__button dkj-quick-nav__home" href="' + homeHref + '" title="업무 콘솔 홈으로 이동합니다." aria-label="홈으로 이동">' +
          '<span class="dkj-quick-nav__icon" aria-hidden="true">⌂</span><span>홈</span>' +
        '</a>' +
        '<button type="button" class="dkj-quick-nav__button dkj-quick-nav__reload" title="캐시 제거 후 강력 새로고침합니다." aria-label="강력 새로고침">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>' +
        '</button>';
    }

    if (!isHome) {
      var btnBack = nav.querySelector('.dkj-quick-nav__back');
      if (btnBack) {
        btnBack.addEventListener('click', function () {
          if (hasInternalPreviousPage() && global.history && global.history.length > 1) {
            global.history.back();
          } else {
            global.location.href = homeHref;
          }
        });
      }
    }

    var btnReload = nav.querySelector('.dkj-quick-nav__reload');
    if (btnReload) {
      btnReload.addEventListener('click', function () {
        btnReload.classList.add('is-spinning');
        hardReload();
      });
    }

    document.body.appendChild(nav);
  }

  global.DkjQuickNav = { render: render };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})(window);

