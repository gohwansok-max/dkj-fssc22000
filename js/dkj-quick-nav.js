/*
 * 모든 업무 화면용 공통 빠른 이동 버튼.
 * 같은 사이트 내부에서 온 경우 이전 화면으로, 그렇지 않으면 홈으로 이동한다.
 */
(function () {
  'use strict';

  function rootFromScript() {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src || '';
      var marker = '/js/dkj-quick-nav.js';
      var idx = src.indexOf(marker);
      if (idx !== -1) return src.slice(0, idx + 1);
    }
    return '';
  }

  function hasInternalPreviousPage() {
    if (!document.referrer) return false;
    try {
      var previous = new URL(document.referrer);
      return previous.origin === window.location.origin && previous.pathname !== window.location.pathname;
    } catch (e) {
      return false;
    }
  }

  function render() {
    if (document.getElementById('dkjQuickNav')) return;

    var root = rootFromScript();
    var homeHref = root + 'index.html';
    var nav = document.createElement('nav');
    nav.id = 'dkjQuickNav';
    nav.className = 'dkj-quick-nav';
    nav.setAttribute('aria-label', '빠른 이동');
    nav.innerHTML =
      '<button type="button" class="dkj-quick-nav__button dkj-quick-nav__back" title="이전 화면으로 이동합니다. 이전 화면이 없으면 홈으로 이동합니다." aria-label="이전 화면으로 이동">' +
        '<span class="dkj-quick-nav__icon" aria-hidden="true">‹</span><span>이전</span>' +
      '</button>' +
      '<a class="dkj-quick-nav__button dkj-quick-nav__home" href="' + homeHref + '" title="홈으로 이동합니다." aria-label="홈으로 이동">' +
        '<span class="dkj-quick-nav__icon" aria-hidden="true">⌂</span><span>홈</span>' +
      '</a>';

    nav.querySelector('.dkj-quick-nav__back').addEventListener('click', function () {
      if (hasInternalPreviousPage() && window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = homeHref;
      }
    });

    document.body.appendChild(nav);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
