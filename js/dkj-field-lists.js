/**
 * 서식 공통 선택 목록 — 사람·제품·업체·연도·문서 칸을 '글로 적는' 대신 고르게 한다(2026-10-22).
 * 정본은 각각 계정 디렉터리(직원), data/products.json(제품), data/incoming-catalog.json(입고 업체·품목),
 * data/mdr-catalog.json(문서번호·문서명·개정)이며 여기에는 목록을 적지 않는다.
 * 칸은 라벨 글자로 찾는다(<label for>). 목록에 없는 값은 PC 키보드·팝업의 '⌨ 직접 입력'으로 쓸 수 있다.
 * dkj-util.js 가 기록 화면에서만 불러온다.
 */
(function (global) {
  'use strict';
  if (global.DkjFieldLists) return;

  var BASE = (document.currentScript && document.currentScript.src || '').replace(/[^\/]*$/, '');
  var VER = ((document.currentScript && document.currentScript.src || '').match(/\?.*$/) || [''])[0];

  function loadBundle(name, key) {
    if (global[key]) return Promise.resolve(global[key]);
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = BASE + name + VER;
      s.onload = function () { resolve(global[key] || null); };
      s.onerror = function () { resolve(null); };
      document.head.appendChild(s);
    });
  }

  var PERSON = /(책임자|입회자|팀장|심사원|평가자|주재자|강사|신청자|반출자|점검자|작성자|확인자|검토자|승인자)$|^(작성|확인|성명)$/;
  var PRODUCT = /^(제품명|품명|품목\/공정|원료\/제품명|공급품목|품목|전환 품목)$/;
  var VENDOR = /^(업체명|공급업체|공급처|수거업체)$/;
  var YEAR = /(계획연도|평가연도)$/;
  var DOCCODE = /^문서번호$/;
  var DOCNAME = /^문서명$/;
  var DOCREV = /^개정번호$/;

  var lists = {};
  function setList(id, values) {
    var dl = document.getElementById(id);
    if (!dl) { dl = document.createElement('datalist'); dl.id = id; document.body.appendChild(dl); }
    var seen = {}, html = '';
    values.forEach(function (v) {
      v = String(v || '').trim();
      if (!v || seen[v]) return;
      seen[v] = 1;
      html += '<option value="' + v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '"></option>';
    });
    dl.innerHTML = html;
  }

  function labelOf(el) {
    var lab = el.id && document.querySelector('label[for="' + el.id + '"]');
    if (!lab) { var f = el.closest('.dkj-field,label'); lab = f && (f.tagName === 'LABEL' ? f : f.querySelector('label')); }
    return lab ? lab.textContent.replace(/[*\s]+$/g, '').replace(/^\s+/, '').trim() : '';
  }

  var docs = [];
  function build() {
    var P = global.DKJ_PRODUCTS, I = global.DKJ_INCOMING_CATALOG, M = global.DKJ_MDR_CATALOG;
    var products = [], vendors = [];
    if (P && P.finishedProducts) P.finishedProducts.forEach(function (f) { products.push(f.name); });
    if (I && I.categories) Object.keys(I.categories).forEach(function (k) {
      products = products.concat(I.categories[k].items || []);
      vendors = vendors.concat(I.categories[k].vendors || []);
    });
    var y = new Date().getFullYear();
    docs = (M && M.entries) || [];
    lists.product = 'dkjFL_product'; setList('dkjFL_product', products);
    lists.vendor = 'dkjFL_vendor'; setList('dkjFL_vendor', vendors);
    lists.year = 'dkjFL_year'; setList('dkjFL_year', [String(y - 1), String(y), String(y + 1)]);
    lists.docCode = 'dkjFL_docCode'; setList('dkjFL_docCode', docs.map(function (d) { return d.code; }));
    lists.docName = 'dkjFL_docName'; setList('dkjFL_docName', docs.map(function (d) { return d.title; }));
  }

  function fire(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function sibling(el, rx) {
    var scope = el.closest('form,main,section,.dkj-panel') || document;
    var found = null;
    Array.prototype.forEach.call(scope.querySelectorAll('input[type="text"]'), function (x) { if (!found && rx.test(labelOf(x))) found = x; });
    return found;
  }
  function revNumber(rev) { var m = String(rev || '').match(/^Rev\s*(\d+)$/i); return m ? m[1] : ''; }
  /** 문서번호·문서명 중 하나를 고르면 나머지(와 개정번호)를 문서관리대장 값으로 채운다 */
  function bindDoc(el, byCode) {
    el.addEventListener('change', function () {
      var v = String(el.value || '').trim();
      var d = docs.filter(function (x) { return byCode ? x.code === v : x.title === v; })[0];
      if (!d) return;
      var other = sibling(el, byCode ? DOCNAME : DOCCODE);
      var want = byCode ? d.title : d.code;
      // 서로 채우다 끝없이 되돌아오지 않게, 값이 다를 때만 쓰고 이벤트를 낸다
      if (other && !other.readOnly && other.value !== want) { other.value = want; fire(other); }
      var rev = sibling(el, DOCREV), n = revNumber(d.rev);
      if (rev && n !== '' && !rev.readOnly && !String(rev.value || '').trim()) { rev.value = n; fire(rev); }
    });
  }

  function apply() {
    Array.prototype.forEach.call(document.querySelectorAll('input[type="text"]:not([data-fl-done])'), function (el) {
      el.setAttribute('data-fl-done', '1');
      if (el.getAttribute('list') || el.readOnly || /^dkj/.test(el.id || '') || el.closest('[id^="dkj"]')) return;
      var l = labelOf(el);
      if (!l) return;
      if (PERSON.test(l) && !/연락처/.test(l)) el.setAttribute('list', 'dkjStaffList');
      else if (PRODUCT.test(l)) el.setAttribute('list', lists.product);
      else if (VENDOR.test(l)) el.setAttribute('list', lists.vendor);
      else if (YEAR.test(l)) el.setAttribute('list', lists.year);
      else if (DOCCODE.test(l) && docs.length) { el.setAttribute('list', lists.docCode); bindDoc(el, true); }
      else if (DOCNAME.test(l) && docs.length) { el.setAttribute('list', lists.docName); bindDoc(el, false); }
      else return;
      el.setAttribute('autocomplete', 'off');
    });
  }

  function start() {
    var queued = false;
    build();
    apply();
    new MutationObserver(function () {
      if (queued) return;
      queued = true;
      (global.requestAnimationFrame || setTimeout)(function () { queued = false; apply(); });
    }).observe(document.body, { childList: true, subtree: true });
  }

  global.DkjFieldLists = { apply: apply };
  Promise.all([
    loadBundle('products.bundle.js', 'DKJ_PRODUCTS'),
    loadBundle('incoming-catalog.bundle.js', 'DKJ_INCOMING_CATALOG'),
    loadBundle('mdr-catalog.bundle.js', 'DKJ_MDR_CATALOG')
  ]).then(function () {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  });
})(window);
