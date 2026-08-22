/**
 * DkjMenu — 햄버거 메뉴 제어
 * 모바일/태블릿 환경을 위한 전체 메뉴 오버레이
 */
(function (global) {
  'use strict';

  function init() {
    var toggle = document.getElementById('ckMenuToggle');
    var overlay = document.getElementById('ckMenuOverlay');
    var close = document.getElementById('ckMenuClose');

    if (!toggle || !overlay || !close) return;

    function openMenu() {
      overlay.setAttribute('aria-hidden', 'false');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';

      // 접근성: 첫 번째 링크에 포커스
      var firstLink = overlay.querySelector('a');
      if (firstLink) {
        setTimeout(function () {
          firstLink.focus();
        }, 300);
      }
    }

    function closeMenu() {
      overlay.setAttribute('aria-hidden', 'true');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      toggle.focus();
    }

    toggle.addEventListener('click', function () {
      if (overlay.getAttribute('aria-hidden') === 'true') {
        openMenu();
      } else {
        closeMenu();
      }
    });

    close.addEventListener('click', closeMenu);

    // 오버레이 배경 클릭 시 닫기
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        closeMenu();
      }
    });

    // ESC 키로 닫기
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.getAttribute('aria-hidden') === 'false') {
        closeMenu();
      }
    });

    // 메뉴 내 링크 클릭 시 자동 닫기
    overlay.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        closeMenu();
      });
    });

    // 시스템 관리자 전용 메뉴 표시/숨김
    global.addEventListener('dkj:auth-ready', function () {
      var auth = global.DkjAuth;
      var isAdmin = auth && auth.isSystemAdmin && auth.isSystemAdmin();
      overlay.querySelectorAll('[data-system-admin]').forEach(function (el) {
        if (isAdmin) {
          el.style.display = '';
        } else {
          el.style.display = 'none';
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.DkjMenu = { init: init };
})(window);
