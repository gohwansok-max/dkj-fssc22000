/**
 * 동김제농협 스마트 HACCP — 서비스워커
 *
 * 작업장 와이파이가 끊기면 페이지 자체가 안 열리던 문제를 없앤다.
 * 기록 저장은 원래 localStorage 라 오프라인에서도 되지만, 페이지를 못 열면
 * 소용이 없었다.
 *
 * 캐시 전략
 *   화면 이동(navigate) : 네트워크 먼저, 3.5초 안에 응답이 없거나 실패하면 캐시.
 *                         현장 와이파이는 "끊김"보다 "느림"이 잦아 타임아웃을 둔다.
 *   같은 출처 정적파일  : 캐시 먼저(즉시 표시) + 뒤에서 조용히 갱신
 *   구글 폰트           : 캐시 먼저 — 오프라인에서 글꼴이 깨지지 않게
 *   그 외 외부 요청     : 손대지 않는다. Firebase 동기화·로그인이 여기 해당한다.
 *
 * 프리캐시 목록과 버전은 sw-precache.js 에 있다(scripts/build-sw-precache.py 생성).
 */
/* global DKJ_PRECACHE, DKJ_SW_VERSION */
'use strict';

// 배포 식별자: 정적 자산 UI 수정도 기존 현장 기기의 서비스워커 갱신을 즉시 유도한다.
var DKJ_DEPLOY_MARKER = '20260818-excel-validation-v54';
importScripts('sw-precache.js');

var VERSION = self.DKJ_SW_VERSION || 'v1-dev';
var SHELL_CACHE = 'dkj-shell-' + VERSION;
var RUNTIME_CACHE = 'dkj-runtime-' + VERSION;
var NAV_TIMEOUT_MS = 3500;

var FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

/* ---------- 설치 ---------- */

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      // addAll 은 하나만 실패해도 전체가 실패한다. 파일 한 개 때문에
      // 오프라인 지원 전체가 날아가지 않도록 개별로 담는다.
      return Promise.all((self.DKJ_PRECACHE || []).map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' }))['catch'](function (err) {
          console.warn('[dkj-sw] 프리캐시 실패:', url, err && err.message);
        });
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

/* ---------- 활성화 — 옛 버전 캐시 정리 ---------- */

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k === SHELL_CACHE || k === RUNTIME_CACHE) return null;
        if (k.indexOf('dkj-shell-') !== 0 && k.indexOf('dkj-runtime-') !== 0) return null;
        return caches['delete'](k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* ---------- 도우미 ---------- */

function isCacheable(res) {
  // opaque(type:'opaque') 는 폰트처럼 CORS 없이 받은 것 — 그대로 담아도 재생된다.
  return res && (res.status === 200 || res.type === 'opaque');
}

/** 같은 출처 캐시 조회. ?record=<id> 같은 쿼리는 무시하고 경로로 찾는다. */
function matchShell(request) {
  return caches.match(request, { ignoreSearch: true }).then(function (hit) {
    if (hit) return hit;
    // '/dkj-fssc22000/' 처럼 디렉터리로 들어온 경우 index.html 로 되짚는다
    var url = new URL(request.url);
    if (url.pathname.charAt(url.pathname.length - 1) === '/') {
      return caches.match(new Request(url.pathname + 'index.html'), { ignoreSearch: true });
    }
    return undefined;
  });
}

function networkFirst(request) {
  return new Promise(function (resolve) {
    var settled = false;
    var timer = setTimeout(function () {
      if (settled) return;
      // 네트워크가 느릴 뿐일 수 있으니 요청은 살려둔 채 캐시를 먼저 보여준다
      matchShell(request).then(function (hit) {
        if (hit && !settled) { settled = true; resolve(hit); }
      });
    }, NAV_TIMEOUT_MS);

    fetch(request).then(function (res) {
      clearTimeout(timer);
      if (isCacheable(res) && res.type === 'basic') {
        // 셸 캐시는 생성 목록 그대로 두고, 실제로 다녀온 주소는 런타임 캐시에 담는다.
        // ?record=<id> 딥링크가 셸에 계속 쌓이는 것을 막는다.
        var copy = res.clone();
        caches.open(RUNTIME_CACHE).then(function (c) { c.put(request, copy); });
      }
      if (!settled) { settled = true; resolve(res); }
    })['catch'](function () {
      clearTimeout(timer);
      if (settled) return;
      matchShell(request).then(function (hit) {
        if (settled) return;
        settled = true;
        resolve(hit || caches.match('./offline.html', { ignoreSearch: true }).then(function (o) {
          return o || new Response('오프라인입니다.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        }));
      });
    });
  });
}

function networkFirstStatic(request) {
  return fetch(request).then(function (res) {
    if (isCacheable(res)) {
      var copy = res.clone();
      caches.open(RUNTIME_CACHE).then(function (c) { c.put(request, copy); });
    }
    return res;
  })['catch'](function () {
    return matchShell(request).then(function (hit) {
      return hit || Response.error();
    });
  });
}

function cacheFirst(request, cacheName) {
  return caches.match(request, { ignoreSearch: true }).then(function (hit) {
    var fetching = fetch(request).then(function (res) {
      if (isCacheable(res)) {
        var copy = res.clone();
        caches.open(cacheName).then(function (c) { c.put(request, copy); });
      }
      return res;
    })['catch'](function () {
      return hit || Response.error();
    });
    // 캐시에 있으면 즉시 보여주고 갱신은 뒤에서 — 태블릿 체감이 확 달라진다
    return hit || fetching;
  });
}

/* ---------- 요청 가로채기 ---------- */

self.addEventListener('fetch', function (e) {
  var request = e.request;
  if (request.method !== 'GET') return;

  var url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // 외부 요청: 글꼴만 캐시하고 나머지(Firebase 동기화·로그인)는 건드리지 않는다
  if (url.origin !== self.location.origin) {
    if (FONT_HOSTS.indexOf(url.hostname) !== -1) {
      e.respondWith(cacheFirst(request, RUNTIME_CACHE));
    }
    return;
  }

  if (request.mode === 'navigate') {
    e.respondWith(networkFirst(request));
    return;
  }

  // 메뉴 카탈로그는 신규 메뉴가 즉시 보이도록 온라인에서는 항상 최신본을 쓴다.
  // 네트워크가 끊긴 경우에만 기존 프리캐시·런타임 캐시로 대체한다.
  if (url.pathname.endsWith('/data/menu-catalog.json') ||
      url.pathname.endsWith('/js/menu-catalog.bundle.js')) {
    e.respondWith(networkFirstStatic(request));
    return;
  }

  // 업무 화면의 검증·저장 로직은 최신본을 우선 적용한다. 오프라인일 때만 캐시로 대체해
  // 캐시된 이전 스크립트가 새 화면 HTML과 엇갈리는 문제를 예방한다.
  if (/\.(?:js|css)$/i.test(url.pathname)) {
    e.respondWith(networkFirstStatic(request));
    return;
  }

  e.respondWith(cacheFirst(request, RUNTIME_CACHE));
});

/* ---------- 페이지에서 오는 메시지 ---------- */

self.addEventListener('message', function (e) {
  var data = e.data || {};
  if (data.type === 'DKJ_SW_VERSION') {
    if (e.source) e.source.postMessage({ type: 'DKJ_SW_VERSION', version: VERSION });
  }
});
