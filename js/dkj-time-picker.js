/**
 * 시간 선택 팝업 — 오전/오후·시·분을 모두 고른 뒤 [설정]을 눌러야 입력칸에 반영된다.
 *
 * 배경: 브라우저 기본 time 입력은 오전/오후만 바꿔도 input 이벤트가 떠서, 화면이 다시 그려지며
 *       팝업이 닫혀 버렸다(DKJ-H-01-01 현장 제보). 그래서 읽기전용 글자 칸(data-time-pick)을
 *       탭하면 이 팝업을 열고, [설정]에서만 값을 넣고 input·change 이벤트를 한 번씩 낸다.
 *
 * 사용: <input type="text" readonly inputmode="none" data-time-pick value="14:30">
 *       값 형식은 기존 type=time 과 같은 24시간 'HH:MM' 이므로 저장 데이터·정본 인쇄는 그대로다.
 */
(function (global) {
  'use strict';
  if (global.DkjTimePicker) return;

  var doc = global.document;
  var overlay = null;
  var target = null;
  var sel = { ap: 'AM', h: 12, m: 0 };

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function parse(v) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(v || ''));
    if (!m) return null;
    var h = Number(m[1]), mi = Number(m[2]);
    if (h > 23 || mi > 59) return null;
    return { h24: h, m: mi };
  }

  function to24() {
    var h = sel.h % 12;
    if (sel.ap === 'PM') h += 12;
    return pad(h) + ':' + pad(sel.m);
  }

  function injectStyle() {
    if (doc.getElementById('dkjTimePickerStyle')) return;
    var st = doc.createElement('style');
    st.id = 'dkjTimePickerStyle';
    st.textContent =
      '.dtp-ov{position:fixed;inset:0;z-index:100000;background:rgba(20,30,25,.45);display:flex;align-items:center;justify-content:center;padding:12px}' +
      '.dtp-box{width:min(360px,100%);max-height:100%;overflow:auto;background:#fff;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.3);padding:16px;box-sizing:border-box;font-family:inherit}' +
      '.dtp-title{font-size:13px;font-weight:700;color:#52655a;margin:0 0 6px}' +
      '.dtp-now{font-size:30px;font-weight:800;text-align:center;color:#12663e;margin:2px 0 10px;letter-spacing:1px}' +
      '.dtp-sec{font-size:12px;font-weight:700;color:#52655a;margin:10px 0 5px}' +
      '.dtp-grid{display:grid;gap:6px}' +
      '.dtp-ap{grid-template-columns:1fr 1fr}.dtp-h{grid-template-columns:repeat(6,1fr)}.dtp-m{grid-template-columns:repeat(6,1fr)}' +
      '.dtp-b{min-height:44px;border:1px solid #cbdad1;border-radius:9px;background:#fff;font:inherit;font-size:16px;font-weight:600;color:#26382e;cursor:pointer;padding:0}' +
      '.dtp-b.on{background:#12663e;border-color:#12663e;color:#fff}' +
      '.dtp-min-in{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:13px;color:#52655a}' +
      '.dtp-min-in input{width:72px;min-height:40px;border:1px solid #cbdad1;border-radius:9px;font:inherit;font-size:16px;text-align:center;box-sizing:border-box}' +
      '.dtp-act{display:flex;gap:10px;margin-top:16px}' +
      '.dtp-act button{flex:1;min-height:48px;border-radius:10px;font:inherit;font-size:16px;font-weight:700;cursor:pointer}' +
      '.dtp-cancel{background:#fff;border:1px solid #b8c7be;color:#405a4b}' +
      '.dtp-ok{background:#12663e;border:1px solid #12663e;color:#fff}' +
      '.dtp-clear{background:none;border:0;color:#a33;font:inherit;font-size:12px;text-decoration:underline;cursor:pointer;margin-left:auto}' +
      '@media print{.dtp-ov{display:none!important}}';
    doc.head.appendChild(st);
  }

  function paint() {
    if (!overlay) return;
    overlay.querySelector('.dtp-now').textContent = (sel.ap === 'AM' ? '오전 ' : '오후 ') + sel.h + '시 ' + pad(sel.m) + '분';
    Array.prototype.forEach.call(overlay.querySelectorAll('[data-ap]'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-ap') === sel.ap);
    });
    Array.prototype.forEach.call(overlay.querySelectorAll('[data-h]'), function (b) {
      b.classList.toggle('on', Number(b.getAttribute('data-h')) === sel.h);
    });
    Array.prototype.forEach.call(overlay.querySelectorAll('[data-m]'), function (b) {
      b.classList.toggle('on', Number(b.getAttribute('data-m')) === sel.m);
    });
    var mi = overlay.querySelector('.dtp-min-in input');
    if (mi && doc.activeElement !== mi) mi.value = pad(sel.m);
  }

  function close() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
    doc.removeEventListener('keydown', onKey, true);
    var t = target;
    target = null;
    if (t) { try { t.focus({ preventScroll: true }); } catch (e) {} }
  }

  function commit(value) {
    var t = target;
    if (!t) return close();
    t.value = value;
    close();
    // 기존 type=time 과 같은 이벤트 순서를 유지한다(서식 코드가 input·change 어느 쪽을 들어도 동작).
    t.dispatchEvent(new Event('input', { bubbles: true }));
    t.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
  }

  function open(input) {
    if (!input || input.disabled || input.getAttribute('data-locked') === '1') return;
    if (overlay) close();
    injectStyle();
    target = input;
    var p = parse(input.value);
    if (!p) { var d = new Date(); p = { h24: d.getHours(), m: d.getMinutes() }; }
    sel.ap = p.h24 >= 12 ? 'PM' : 'AM';
    sel.h = p.h24 % 12 === 0 ? 12 : p.h24 % 12;
    sel.m = p.m;

    var hours = '', mins = '';
    for (var h = 1; h <= 12; h++) hours += '<button type="button" class="dtp-b" data-h="' + h + '">' + h + '</button>';
    for (var m = 0; m < 60; m += 5) mins += '<button type="button" class="dtp-b" data-m="' + m + '">' + pad(m) + '</button>';

    overlay = doc.createElement('div');
    overlay.className = 'dtp-ov';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '시간 선택');
    overlay.innerHTML =
      '<div class="dtp-box">' +
        '<p class="dtp-title">시간 선택 <button type="button" class="dtp-clear" data-clear="1" style="float:right">지우기</button></p>' +
        '<div class="dtp-now"></div>' +
        '<div class="dtp-grid dtp-ap"><button type="button" class="dtp-b" data-ap="AM">오전</button><button type="button" class="dtp-b" data-ap="PM">오후</button></div>' +
        '<div class="dtp-sec">시</div><div class="dtp-grid dtp-h">' + hours + '</div>' +
        '<div class="dtp-sec">분</div><div class="dtp-grid dtp-m">' + mins + '</div>' +
        '<label class="dtp-min-in">분 직접 입력 <input type="number" inputmode="numeric" min="0" max="59" aria-label="분 직접 입력"> 분</label>' +
        '<div class="dtp-act"><button type="button" class="dtp-cancel" data-cancel="1">취소</button><button type="button" class="dtp-ok" data-ok="1">설정</button></div>' +
      '</div>';

    overlay.addEventListener('click', function (e) {
      var el = e.target;
      if (el === overlay) return close(); // 바깥을 탭하면 취소
      var b = el.closest ? el.closest('button') : null;
      if (!b) return;
      if (b.hasAttribute('data-ap')) { sel.ap = b.getAttribute('data-ap'); paint(); }
      else if (b.hasAttribute('data-h')) { sel.h = Number(b.getAttribute('data-h')); paint(); }
      else if (b.hasAttribute('data-m')) { sel.m = Number(b.getAttribute('data-m')); paint(); }
      else if (b.hasAttribute('data-cancel')) close();
      else if (b.hasAttribute('data-clear')) commit('');
      else if (b.hasAttribute('data-ok')) commit(to24());
    });
    overlay.querySelector('.dtp-min-in input').addEventListener('input', function (e) {
      var v = parseInt(e.target.value, 10);
      if (!isNaN(v) && v >= 0 && v <= 59) { sel.m = v; paint(); }
    });
    overlay.querySelector('.dtp-min-in input').addEventListener('blur', paint);

    doc.body.appendChild(overlay);
    doc.addEventListener('keydown', onKey, true);
    paint();
    var ok = overlay.querySelector('[data-ok]');
    if (ok) { try { ok.focus({ preventScroll: true }); } catch (e) {} }
  }

  // 문서 전체 위임 — 표가 다시 그려져도 칸마다 리스너를 다시 달 필요가 없다.
  doc.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('input[data-time-pick]') : null;
    if (!t) return;
    e.preventDefault();
    if (t.readOnly && t.getAttribute('data-locked') === '1') return;
    open(t);
  });
  doc.addEventListener('keydown', function (e) {
    if (overlay) return;
    var t = e.target;
    if (!t || !t.matches || !t.matches('input[data-time-pick]')) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(t); }
    else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      t.value = '';
      t.dispatchEvent(new Event('input', { bubbles: true }));
      t.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  global.DkjTimePicker = { open: open, close: close };
})(window);
