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

  function render() {
    if (document.getElementById('dkjQuickNav')) return;
    if (isConsoleHomePage()) return; // 메인 콘솔 홈 자체에는 이전/홈 플로팅 버튼 불필요

    var base = getBaseHref();
    var homeHref = base + 'index.html';

    var nav = document.createElement('nav');
    nav.id = 'dkjQuickNav';
    nav.className = 'dkj-quick-nav';
    nav.setAttribute('aria-label', '빠른 이동');
    nav.innerHTML =
      '<button type="button" class="dkj-quick-nav__button dkj-quick-nav__back" title="이전 화면으로 이동합니다. 이전 화면이 없으면 홈으로 이동합니다." aria-label="이전 화면으로 이동">' +
        '<span class="dkj-quick-nav__icon" aria-hidden="true">‹</span><span>이전</span>' +
      '</button>' +
      '<a class="dkj-quick-nav__button dkj-quick-nav__home" href="' + homeHref + '" title="업무 콘솔 홈으로 이동합니다." aria-label="홈으로 이동">' +
        '<span class="dkj-quick-nav__icon" aria-hidden="true">⌂</span><span>홈</span>' +
      '</a>';

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

    document.body.appendChild(nav);
  }

  global.DkjQuickNav = { render: render };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})(window);

