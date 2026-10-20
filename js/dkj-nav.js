/* 동김제농협 전역 메뉴 로더. 실제 메뉴 UI는 공통 dkj-sidebar 컴포넌트가 담당한다. */
(function (global) {
  'use strict';
  var loading = false;
  function baseOf(root) {
    var base = (root && root.getAttribute('data-base')) || '';
    if (base && base.slice(-1) !== '/') base += '/';
    return base;
  }
  function init() {
    var root = document.querySelector('[data-dkj-nav], #gnb, #dkjNav');
    if (!root) return;
    var base = baseOf(root);
    if (global.DkjSidebar) { global.DkjSidebar.mount({ base: base, compact: false }); return; }
    if (loading) return;
    loading = true;
    var script = document.createElement('script');
    script.src = base + 'js/dkj-sidebar.js?v=167';
    script.onload = function () {
      loading = false;
      if (global.DkjSidebar) global.DkjSidebar.mount({ base: base, compact: false });
    };
    script.onerror = function () { loading = false; console.warn('[DkjNav] sidebar failed to load'); };
    document.head.appendChild(script);
  }
  global.DkjNav = { init: init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
