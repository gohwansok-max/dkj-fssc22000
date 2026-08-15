/**
 * DkjNavBar — 서식 화면 공통 네비게이션
 *
 * 지금까지 서식 안에서 다른 서식으로 가려면 '기록목록'을 거쳐야 했다.
 * 상단에 주기별 탭을 두어 현장에서 한 번에 이동할 수 있게 한다.
 * 목록은 data/console-forms.json 을 그대로 재사용한다(중복 정의 금지).
 */
(function (global) {
  'use strict';

  /** records/ 하위에서 열리므로 상위로 한 단계 올라간다 */
  function base() {
    return location.pathname.indexOf('/records/') !== -1 ? '../' : '';
  }

  function currentCode() {
    var m = location.pathname.match(/([A-Z]{3}-[A-Z]-\d{2}-[A-Z0-9-]+)\.html/);
    return m ? m[1] : '';
  }

  function render(cfg) {
    var host = document.getElementById('dkjNav');
    if (!host) return;
    var b = base();
    var code = currentCode();
    var groups = (cfg && cfg.groups) || [];

    var tabs = groups.map(function (g) {
      var has = (g.forms || []).some(function (f) { return f.code === code; });
      return '<button type="button" class="nv-tab' + (has ? ' on' : '') +
        '" data-g="' + esc(g.id) + '">' + esc(g.label) + '</button>';
    }).join('');

    var panels = groups.map(function (g) {
      var has = (g.forms || []).some(function (f) { return f.code === code; });
      return '<div class="nv-panel' + (has ? ' on' : '') + '" data-p="' + esc(g.id) + '">' +
        (g.forms || []).map(function (f) {
          var here = f.code === code;
          return '<a class="nv-link' + (here ? ' here' : '') + '" href="' +
            b + esc(f.href) + '">' + esc(f.title) +
            (f.ccp ? '<span class="nv-ccp">CCP</span>' : '') + '</a>';
        }).join('') + '</div>';
    }).join('');

    host.innerHTML =
      '<div class="nv-bar">' +
      '<a class="nv-home" href="' + b + 'index.html">홈</a>' +
      '<div class="nv-tabs">' + tabs + '</div>' +
      '<button type="button" class="nv-toggle" id="nvToggle" aria-expanded="false">서식 이동 ▾</button>' +
      '</div><div class="nv-drop" id="nvDrop">' + panels + '</div>';

    var drop = document.getElementById('nvDrop');
    var toggle = document.getElementById('nvToggle');

    function open(v) {
      drop.classList.toggle('open', v);
      toggle.setAttribute('aria-expanded', v ? 'true' : 'false');
      toggle.textContent = v ? '닫기 ▴' : '서식 이동 ▾';
    }

    toggle.addEventListener('click', function () {
      open(!drop.classList.contains('open'));
    });

    host.querySelectorAll('.nv-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        var id = t.getAttribute('data-g');
        host.querySelectorAll('.nv-tab').forEach(function (x) {
          x.classList.toggle('on', x === t);
        });
        host.querySelectorAll('.nv-panel').forEach(function (p) {
          p.classList.toggle('on', p.getAttribute('data-p') === id);
        });
        open(true);
      });
    });

    document.addEventListener('click', function (e) {
      if (!host.contains(e.target)) open(false);
    });
  }

  function init() {
    if (!document.getElementById('dkjNav')) return;
    if (global.DKJ_CONSOLE_FORMS) { render(global.DKJ_CONSOLE_FORMS); return; }
    fetch(base() + 'data/console-forms.json')
      .then(function (r) {
        if (!r.ok) throw new Error('console-forms');
        return r.json();
      })
      .then(render)
      .catch(function () {
        // file:// 에서는 fetch 가 막힌다 — 번들로 떨어진다(dkj-console.js 와 같은 규약).
        var s = document.createElement('script');
        s.src = base() + 'js/console-forms.bundle.js';
        s.onload = function () {
          if (global.DKJ_CONSOLE_FORMS) render(global.DKJ_CONSOLE_FORMS);
        };
        // 네비게이션은 보조 기능이므로 끝내 실패해도 서식 자체는 동작한다
        document.head.appendChild(s);
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  global.DkjNavBar = { render: render };
})(window);
