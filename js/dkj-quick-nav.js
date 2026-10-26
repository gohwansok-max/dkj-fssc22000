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

  /* ---------- 작업 일자 상단 고정 (2026-10-26, 현장 요청) ----------
   * 일보를 아래로 스크롤하면 맨 위 '작업 일자' 칸이 화면 밖으로 나가 오늘 날짜가 안 보였다.
   * 이미 상단에 고정된 툴바(.dkj-form-toolbar)에 일자 표시를 같이 띄운다. 값은 화면에 보이는 일자 칸을
   * 그대로 읽기만 하므로 저장 데이터·입력 경로에는 손대지 않는다. 대장 서식처럼 칸이 통째로 다시
   * 그려져도 따라가도록 관찰자로 다시 찾는다. 인쇄에서는 툴바째 숨겨진다. */
  var WEEK = ['일', '월', '화', '수', '목', '금', '토'];

  function isFormPage() {
    return !!(document.body && document.body.classList.contains('dkj-form-page'));
  }

  /** 표에 들어 있지 않은 첫 번째 날짜·월 입력칸 = 그 서식의 작업(점검) 일자 */
  function findDateInput() {
    var list = document.querySelectorAll('main input[type="date"], main input[type="month"]');
    for (var i = 0; i < list.length; i++) {
      if (!list[i].closest('table') && !list[i].closest('.dkj-form-toolbar')) return list[i];
    }
    return null;
  }

  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function describeDate(input) {
    var v = (input && input.value) || '';
    var m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      var wd = WEEK[new Date(+m[1], +m[2] - 1, +m[3]).getDay()];
      return { text: m[1] + '. ' + m[2] + '. ' + m[3] + '. (' + wd + ')', isToday: v === todayIso(), empty: false };
    }
    m = v.match(/^(\d{4})-(\d{2})$/);
    if (m) return { text: m[1] + '. ' + m[2] + '월', isToday: v === todayIso().slice(0, 7), empty: false };
    return { text: '일자 미입력', isToday: false, empty: true };
  }

  function labelOf(input) {
    var lab = input.id ? document.querySelector('label[for="' + input.id + '"]') : null;
    var t = lab ? lab.textContent.replace(/[*\s]+$/g, '').trim() : '';
    return t || '작업 일자';
  }

  function syncDatePin() {
    var bar = document.querySelector('.dkj-form-toolbar');
    if (!bar) return;
    var input = findDateInput();
    var pin = document.getElementById('dkjDatePin');
    if (!input) { if (pin) pin.hidden = true; return; }
    if (!pin) {
      pin = document.createElement('button');
      pin.type = 'button';
      pin.id = 'dkjDatePin';
      pin.className = 'dkj-date-pin';
      pin.title = '누르면 일자 입력칸으로 이동합니다.';
      pin.addEventListener('click', function () {
        var el = findDateInput();
        if (!el) return;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        try { el.focus({ preventScroll: true }); } catch (e) { /* 포커스 불가 환경 */ }
      });
      bar.insertBefore(pin, bar.firstChild);
    }
    var info = describeDate(input);
    var html = '<span class="dkj-date-pin__label"></span><strong class="dkj-date-pin__value"></strong>' +
      '<span class="dkj-date-pin__tag"></span>';
    if (!pin.firstChild) pin.innerHTML = html;
    pin.hidden = false;
    pin.querySelector('.dkj-date-pin__label').textContent = labelOf(input);
    pin.querySelector('.dkj-date-pin__value').textContent = info.text;
    pin.querySelector('.dkj-date-pin__tag').textContent = info.empty ? '' : (info.isToday ? '오늘' : '오늘 아님');
    pin.classList.toggle('is-today', info.isToday);
    pin.classList.toggle('is-other', !info.isToday);
  }

  function initDatePin() {
    if (!isFormPage()) return;
    var queued = false;
    function schedule() {
      if (queued) return;
      queued = true;
      (global.requestAnimationFrame || global.setTimeout)(function () { queued = false; syncDatePin(); });
    }
    document.addEventListener('input', schedule, true);
    document.addEventListener('change', schedule, true);
    if (global.MutationObserver) {
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    }
    schedule();
  }

  global.DkjQuickNav = { render: render };

  function boot() { render(); initDatePin(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);

