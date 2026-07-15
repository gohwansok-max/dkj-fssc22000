/**
 * 동김제 포털 — 코엔에프형 메가메뉴 GNB
 * menu-catalog.json 기반. 모든 페이지에서 동일 메뉴 노출.
 *
 * 사용:
 *   <nav class="gnb" id="gnb" data-dkj-nav data-active="docs" data-base=""></nav>
 *   <script src="js/dkj-nav.js"></script>
 */
(function (global) {
  'use strict';

  var CACHE = null;

  function baseOf(el) {
    var b = (el && el.getAttribute('data-base')) || '';
    if (b && b.slice(-1) !== '/' && b !== '') b += '/';
    return b;
  }

  function href(base, path) {
    if (!path) return '#';
    if (/^(https?:|mailto:|#)/i.test(path)) return path;
    return base + path;
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function loadMenu(base) {
    if (CACHE) return Promise.resolve(CACHE);
    if (global.DKJ_MENU_CATALOG) {
      CACHE = global.DKJ_MENU_CATALOG;
      return Promise.resolve(CACHE);
    }
    return fetch(base + 'data/menu-catalog.json')
      .then(function (r) {
        if (!r.ok) throw new Error('menu-catalog');
        return r.json();
      })
      .then(function (d) {
        CACHE = d;
        return d;
      })
      .catch(function () {
        return new Promise(function (resolve) {
          var s = document.createElement('script');
          s.src = base + 'js/menu-catalog.bundle.js';
          s.onload = function () {
            CACHE = global.DKJ_MENU_CATALOG || { gnb: [], quickLinks: [] };
            resolve(CACHE);
          };
          s.onerror = function () {
            CACHE = { gnb: [], quickLinks: [] };
            resolve(CACHE);
          };
          document.head.appendChild(s);
        });
      });
  }

  function renderMega(item, base) {
    var cols = (item.columns || []).map(function (col) {
      var links = (col.links || []).map(function (lnk) {
        return '<a href="' + esc(href(base, lnk.href)) + '">' + esc(lnk.label) + '</a>';
      }).join('');
      return '<div class="mega-col"><div class="mega-title">' + esc(col.title) + '</div>' + links + '</div>';
    }).join('');
    return (
      '<div class="gnb-item" data-nav="' + esc(item.id) + '">' +
        '<button type="button" class="gnb-trigger" aria-expanded="false">' + esc(item.label) + '</button>' +
        '<div class="mega-menu" role="menu">' +
          '<div class="mega-grid">' + cols + '</div>' +
          '<div class="mega-foot">' +
            '<a href="' + esc(href(base, 'docs-center.html')) + '">문서센터 전체 →</a>' +
            '<a href="' + esc(href(base, 'records-center.html')) + '">기록양식 전체 →</a>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function bindInteractions(root) {
    var items = root.querySelectorAll('.gnb-item');
    var backdrop = document.getElementById('megaBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'megaBackdrop';
      backdrop.className = 'mega-backdrop';
      document.body.appendChild(backdrop);
    }

    function closeAll() {
      items.forEach(function (it) {
        it.classList.remove('open');
        var btn = it.querySelector('.gnb-trigger');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      });
      backdrop.classList.remove('show');
      root.classList.remove('mega-open');
    }

    items.forEach(function (it) {
      var btn = it.querySelector('.gnb-trigger');
      if (!btn) return;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var willOpen = !it.classList.contains('open');
        closeAll();
        if (willOpen) {
          it.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
          backdrop.classList.add('show');
          root.classList.add('mega-open');
        }
      });
    });

    backdrop.addEventListener('click', closeAll);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll();
    });

    // desktop hover open
    var mq = window.matchMedia('(min-width: 1025px)');
    items.forEach(function (it) {
      it.addEventListener('mouseenter', function () {
        if (!mq.matches) return;
        closeAll();
        it.classList.add('open');
        root.classList.add('mega-open');
      });
      it.addEventListener('mouseleave', function () {
        if (!mq.matches) return;
        it.classList.remove('open');
        if (!root.querySelector('.gnb-item.open')) {
          root.classList.remove('mega-open');
        }
      });
    });
  }

  function markActive(root, activeId) {
    if (!activeId) return;
    root.querySelectorAll('.gnb-item').forEach(function (it) {
      if (it.getAttribute('data-nav') === activeId) {
        it.classList.add('active');
      }
    });
    root.querySelectorAll('.gnb-static').forEach(function (a) {
      if (a.getAttribute('data-nav') === activeId) a.classList.add('active');
    });
  }

  function render(root, menu) {
    var base = baseOf(root);
    var active = root.getAttribute('data-active') || '';
    var parts = [];

    parts.push('<a class="gnb-static" data-nav="home" href="' + esc(href(base, 'index.html')) + '">홈</a>');

    (menu.gnb || []).forEach(function (item) {
      parts.push(renderMega(item, base));
    });

    parts.push('<a class="gnb-static" data-nav="records" href="' + esc(href(base, 'records-center.html')) + '">기록센터</a>');
    parts.push('<a class="gnb-static" data-nav="mdr" href="' + esc(href(base, 'mdr-register.html')) + '">MDR</a>');

    root.innerHTML = parts.join('');
    root.classList.add('gnb-mega');
    bindInteractions(root);
    markActive(root, active);

    // mobile hamburger already exists — keep open class toggle
    var toggle = document.getElementById('menuToggle');
    if (toggle && !toggle._dkjBound) {
      toggle._dkjBound = true;
      toggle.addEventListener('click', function () {
        var open = root.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
  }

  function init() {
    var nodes = document.querySelectorAll('[data-dkj-nav], #gnb');
    if (!nodes.length) return;
    var first = nodes[0];
    var base = baseOf(first);
    loadMenu(base)
      .then(function (menu) {
        nodes.forEach(function (el) {
          render(el, menu);
        });
      })
      .catch(function (err) {
        console.warn('[DkjNav] menu load failed', err);
      });
  }

  global.DkjNav = { init: init, loadMenu: loadMenu };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
