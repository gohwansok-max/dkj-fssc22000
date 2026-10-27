/* 동김제농협 공통 사이드 메뉴. 기록 작성 화면은 compact drawer로 두어 작업 폭을 유지한다. */
(function (global) {
  'use strict';
  var GROUPS = [
    { title: '현장 업무', links: [
      ['오늘 할 일', 'index.html#todayTasks'], ['기록센터 · 서식 작성', 'records-center.html'],
      ['기록보관함', 'records-archive.html'], ['QC 공정검사일보', 'records/DKJ-QC-001.html'],
      ['생산일지', 'records/DKJ-F-053.html'], ['생산분석', 'production-dashboard.html'],
      ['품질 경보', 'quality-dashboard.html']
    ] },
    { title: '문서 · 인증', links: [
      ['문서센터', 'docs-center.html'], ['정본 열람실', 'official-documents.html'],
      ['문서관리대장', 'mdr-register.html'], ['CAPA 관리', 'capa-management.html'],
      ['추적성·모의회수', 'traceability.html'], ['FSSC 심사준비', 'fssc-audit-readiness.html'],
      ['경영검토·식품안전문화', 'management-culture.html'], ['비상·식품방어 훈련', 'emergency-drills.html']
    ] },
    { title: '운영 · 관리', links: [
      ['정기 알림', 'periodic-alerts.html'], ['자가품질검사·보건증', 'quality-scheduler.html'], ['HACCP팀 설정', 'haccp-team-settings.html'],
      ['임원 통합 현황', 'executive-dashboard.html'], ['전자결재·감사이력', 'audit-trail.html'],
      ['회사소개서', 'company-profile.html']
    ] }
  ];
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]; }); }
  function activePath(href) {
    var path = href.split('#')[0].split('?')[0];
    var current = location.pathname.replace(/^.*\//, '') || 'index.html';
    return current === (path.replace(/^.*\//, '') || 'index.html');
  }
  function loadCss(base) {
    if (document.getElementById('dkjSidebarCss')) return;
    var link = document.createElement('link'); link.id = 'dkjSidebarCss'; link.rel = 'stylesheet';
    link.href = base + 'css/dkj-sidebar.css?v=174'; document.head.appendChild(link);
  }
  function mount(options) {
    options = options || {};
    var base = options.base || '';
    var root = options.compact
      ? document.querySelector('#gnb')
      : document.querySelector('[data-dkj-nav], #gnb, #dkjNav');
    if (!root) {
      root = document.createElement('nav');
      root.id = 'gnb'; root.setAttribute('aria-label', '주요 메뉴');
      document.body.insertBefore(root, document.body.firstChild);
    }
    loadCss(base);
    if (root._dkjSidebarMounted) {
      var isAdmin = !!(global.DkjAuth && global.DkjAuth.isSystemAdmin && global.DkjAuth.isSystemAdmin());
      root.querySelectorAll('[data-system-admin]').forEach(function (a) { a.hidden = !isAdmin; });
      return;
    }
    root._dkjSidebarMounted = true;
    root.id = 'gnb'; root.classList.add('dkj-nav', 'dkj-sidebar');
    root.setAttribute('aria-label', '주요 메뉴');
    root.innerHTML = '<div class="dkj-sidebar-head"><a class="dkj-sidebar-brand" href="' + esc(base + 'index.html') + '">동김제농협<span>산지유통센터</span></a>' +
      '<button type="button" class="dkj-sidebar-close" aria-label="메뉴 닫기">×</button></div>' +
      '<a class="dkj-sidebar-home" href="' + esc(base + 'index.html') + '">업무 콘솔</a>' +
      GROUPS.map(function (group) {
        return '<section class="dkj-sidebar-group"><h2>' + esc(group.title) + '</h2><div>' + group.links.map(function (item) {
          var href = base + item[1];
          return '<a class="dkj-sidebar-link' + (activePath(item[1]) ? ' is-active' : '') + '" href="' + esc(href) + '">' + esc(item[0]) + '</a>';
        }).join('') + '</div></section>';
      }).join('') +
      '<a class="dkj-sidebar-link dkj-sidebar-admin" data-system-admin href="' + esc(base + 'system-settings.html') + '">시스템 설정</a>';
    var backdrop = document.getElementById('dkjSidebarBackdrop');
    if (!backdrop) { backdrop = document.createElement('button'); backdrop.type = 'button'; backdrop.id = 'dkjSidebarBackdrop'; backdrop.className = 'dkj-sidebar-backdrop'; backdrop.setAttribute('aria-label', '메뉴 닫기'); document.body.appendChild(backdrop); }
    document.body.classList.add('dkj-has-sidebar');
    if (options.compact) document.body.classList.add('dkj-sidebar-compact');
    var triggers = Array.prototype.slice.call(document.querySelectorAll('#menuToggle, #ckMenuToggle, #nvSideToggle'));
    if (!triggers.length) {
      var fallbackTrigger = document.createElement('button');
      fallbackTrigger.type = 'button'; fallbackTrigger.id = 'dkjSidebarTrigger';
      fallbackTrigger.className = 'dkj-sidebar-trigger'; fallbackTrigger.textContent = '☰ 메뉴';
      fallbackTrigger.setAttribute('aria-label', '왼쪽 메뉴 열기');
      fallbackTrigger.setAttribute('aria-expanded', 'false'); fallbackTrigger.setAttribute('aria-controls', 'gnb');
      document.body.appendChild(fallbackTrigger); triggers.push(fallbackTrigger);
    }
    function close() {
      root.classList.remove('open'); backdrop.classList.remove('show');
      document.body.classList.remove('dkj-sidebar-open');
      triggers.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    }
    function toggle(button) {
      var opening = !root.classList.contains('open');
      root.classList.toggle('open', opening); backdrop.classList.toggle('show', opening);
      document.body.classList.toggle('dkj-sidebar-open', opening);
      triggers.forEach(function (b) { b.setAttribute('aria-expanded', opening ? 'true' : 'false'); });
      if (opening) { var first = root.querySelector('a'); if (first) first.focus(); }
    }
    triggers.forEach(function (button) {
      if (button._dkjSidebarBound) return;
      button._dkjSidebarBound = true;
      button.setAttribute('aria-controls', 'gnb');
      button.addEventListener('click', function (e) { e.preventDefault(); toggle(button); });
    });
    root.querySelector('.dkj-sidebar-close').addEventListener('click', close);
    backdrop.onclick = close;
    root.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    function updateAdmin() {
      var ok = !!(global.DkjAuth && global.DkjAuth.isSystemAdmin && global.DkjAuth.isSystemAdmin());
      root.querySelectorAll('[data-system-admin]').forEach(function (a) { a.hidden = !ok; });
    }
    updateAdmin(); global.addEventListener('dkj:auth-ready', updateAdmin);
  }
  global.DkjSidebar = { mount: mount };
})(window);
