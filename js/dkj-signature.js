/**
 * 손서명 — 작성·검토·승인 결재를 손으로 서명해 남기고, 정본 인쇄의 결재칸에 그 그림을 찍는다.
 *
 *  - capture(opts)  : 서명 창. 손으로 쓰거나, 저장해 둔 '내 서명'을 버튼 한 번으로 쓴다.
 *  - getSaved/setSaved/clearSaved(empId) : 내 서명 보관. **이 기기 localStorage 에만** 둔다.
 *      (RTDB 규칙이 열려 있어 서명 원본을 클라우드에 따로 올리지 않는다. 서명을 한 기록은
 *       signoff 안에 그림이 들어가 기록과 함께 동기화된다 — 그건 그 기록의 증빙이다.)
 *  - cellHtml(record, fallbackName) : 인쇄 결재칸 HTML. 서명 그림이 있으면 그림만, 없으면 이름만.
 *
 *  저장된 서명은 '로그인한 사번' 기준으로만 꺼낸다. 다른 사람 서명을 불러오는 경로는 없다.
 *  단, 비밀번호가 사번과 같은 계정은 누구나 그 사람으로 로그인할 수 있어 서명 재사용도 같은
 *  한계를 갖는다 — 서명 그림은 본인 확인 수단이 아니라 기록의 모양(종이 결재와 같은 표시)이다.
 */
(function (global) {
  'use strict';

  var PNG_RE = /^data:image\/png;base64,[A-Za-z0-9+\/=]+$/;
  var MAX_LEN = 80000;          // 서명 PNG 한 장의 상한(문자 수) — 기록·동기화 용량 보호
  var OUT_W = 280, OUT_H = 100; // 저장·인쇄용 서명 그림의 최대 크기(px)

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** 우리가 만든 PNG data URL 만 받는다 — 기록에 섞여 들어온 임의 문자열이 <img src> 로 나가지 않게. */
  function isValid(data) {
    return typeof data === 'string' && data.length <= MAX_LEN && PNG_RE.test(data);
  }

  function savedKey(empId) { return 'dkj:signature:' + String(empId) + ':v1'; }

  function getSaved(empId) {
    if (!empId) return null;
    try {
      var raw = global.localStorage.getItem(savedKey(empId));
      var rec = raw ? JSON.parse(raw) : null;
      return rec && isValid(rec.data) ? rec : null;
    } catch (e) { return null; }
  }
  function setSaved(empId, data) {
    if (!empId || !isValid(data)) return false;
    try {
      global.localStorage.setItem(savedKey(empId), JSON.stringify({ data: data, savedAt: new Date().toISOString() }));
      return true;
    } catch (e) { return false; }
  }
  function clearSaved(empId) {
    try { global.localStorage.removeItem(savedKey(empId)); } catch (e) {}
  }

  /** 결재칸에 들어갈 HTML. 서명 그림이 있으면 그림만, 없으면 이름만(종전 그대로). */
  function cellHtml(record, fallbackName) {
    var name = (record && record.name) || fallbackName || '';
    if (record && isValid(record.signature)) {
      // 서명 그림이 있으면 이름은 따로 찍지 않는다 — 손서명이 곧 결재 표시이고, 아래 이름이
      // 겹쳐 보이면 칸이 지저분해진다(2026-10-21 현장 요청). 이름은 alt 로만 남긴다.
      return '<img class="sig-img" src="' + record.signature + '" alt="' + esc(name || '서명') + '">';
    }
    return esc(name);
  }

  /** 캔버스의 잉크 부분만 잘라 OUT_W×OUT_H 안으로 줄인 투명 배경 PNG. 비었으면 null. */
  function exportInk(canvas, box) {
    if (!box) return null;
    var pad = 6;
    var sx = Math.max(0, Math.floor(box.minX - pad)), sy = Math.max(0, Math.floor(box.minY - pad));
    var sw = Math.min(canvas.width - sx, Math.ceil(box.maxX - box.minX + pad * 2));
    var sh = Math.min(canvas.height - sy, Math.ceil(box.maxY - box.minY + pad * 2));
    if (sw < 4 || sh < 4) return null;
    var scale = Math.min(1, OUT_W / sw, OUT_H / sh);
    var out = global.document.createElement('canvas');
    out.width = Math.max(1, Math.round(sw * scale));
    out.height = Math.max(1, Math.round(sh * scale));
    out.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
    var data = out.toDataURL('image/png');
    return isValid(data) ? data : null;
  }

  var open = false;

  /**
   * @param {{stageLabel:string, name:string, empId?:string, message?:string}} opts
   * @returns {Promise<{data:string, reused:boolean}|null>} 취소하면 null
   */
  function capture(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      if (open) { resolve(null); return; }
      open = true;
      var doc = global.document;
      var saved = getSaved(opts.empId);
      var canSave = !!opts.empId;

      var ov = doc.createElement('div');
      ov.className = 'dkj-sig-overlay';
      ov.setAttribute('role', 'dialog');
      ov.setAttribute('aria-modal', 'true');
      ov.innerHTML =
        '<div class="dkj-sig-sheet">' +
        '<h3 class="dkj-sig-title">' + esc(opts.stageLabel || '결재') + ' 서명</h3>' +
        '<p class="dkj-sig-msg">' + esc(opts.message || ((opts.name || '') + ' 님으로 서명합니다.')).replace(/\n/g, '<br>') + '</p>' +
        (saved
          ? '<div class="dkj-sig-saved"><img src="' + saved.data + '" alt="저장된 내 서명">' +
            '<div class="dkj-sig-saved-actions">' +
            '<button type="button" class="pill-btn green" data-act="reuse">저장된 서명으로 서명</button>' +
            '<button type="button" class="dkj-sig-link" data-act="forget">저장된 서명 삭제</button>' +
            '</div></div>' +
            '<div class="dkj-sig-or">또는 새로 쓰기</div>'
          : '') +
        '<canvas class="dkj-sig-canvas" aria-label="손서명 영역"></canvas>' +
        '<div class="dkj-sig-err" aria-live="polite"></div>' +
        (canSave
          ? '<label class="dkj-sig-keep"><input type="checkbox" data-keep ' + (saved ? '' : 'checked') + '> 이 서명을 내 서명으로 저장 (다음부터 버튼 한 번으로 서명)</label>'
          : '') +
        '<div class="dkj-sig-actions">' +
        '<button type="button" class="pill-btn ghost" data-act="cancel">취소</button>' +
        '<button type="button" class="pill-btn ghost" data-act="clear">다시 쓰기</button>' +
        '<button type="button" class="pill-btn green" data-act="done">서명 완료</button>' +
        '</div></div>';
      doc.body.appendChild(ov);

      var canvas = ov.querySelector('canvas');
      var errEl = ov.querySelector('.dkj-sig-err');
      var ctx = canvas.getContext('2d');
      var ratio = Math.min(3, global.devicePixelRatio || 1);
      var rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(200, Math.round(rect.width * ratio));
      canvas.height = Math.max(100, Math.round(rect.height * ratio));
      ctx.lineWidth = 3 * ratio;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111';

      var drawing = false, last = null, strokes = 0, box = null;
      function pos(e) {
        var r = canvas.getBoundingClientRect();
        return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
      }
      function grow(p) {
        if (!box) box = { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y };
        box.minX = Math.min(box.minX, p.x); box.minY = Math.min(box.minY, p.y);
        box.maxX = Math.max(box.maxX, p.x); box.maxY = Math.max(box.maxY, p.y);
      }
      canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        drawing = true;
        last = pos(e);
        grow(last);
        strokes++;
        try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
        ctx.beginPath();
        ctx.arc(last.x, last.y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#111';
        ctx.fill();
        errEl.textContent = '';
      });
      canvas.addEventListener('pointermove', function (e) {
        if (!drawing) return;
        e.preventDefault();
        var p = pos(e);
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        grow(p);
        last = p;
      });
      function stop() { drawing = false; }
      canvas.addEventListener('pointerup', stop);
      canvas.addEventListener('pointercancel', stop);
      canvas.addEventListener('pointerleave', stop);

      function close(result) {
        open = false;
        doc.removeEventListener('keydown', onKey);
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        resolve(result);
      }
      function onKey(e) { if (e.key === 'Escape') close(null); }
      doc.addEventListener('keydown', onKey);

      ov.addEventListener('click', function (e) {
        var act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
        if (!act) return;
        if (act === 'cancel') close(null);
        else if (act === 'clear') {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          strokes = 0; box = null; errEl.textContent = '';
        } else if (act === 'reuse') {
          if (saved) close({ data: saved.data, reused: true });
        } else if (act === 'forget') {
          if (global.confirm('저장된 내 서명을 이 기기에서 삭제할까요?\n(이미 서명한 기록의 서명은 그대로 남습니다.)')) {
            clearSaved(opts.empId);
            close(null);
          }
        } else if (act === 'done') {
          var data = strokes >= 1 ? exportInk(canvas, box) : null;
          if (!data) { errEl.textContent = '서명을 써 주세요. (손가락·펜·마우스)'; return; }
          var keep = ov.querySelector('[data-keep]');
          if (canSave && keep && keep.checked) setSaved(opts.empId, data);
          close({ data: data, reused: false });
        }
      });
    });
  }

  global.DkjSignature = {
    capture: capture,
    getSaved: getSaved,
    setSaved: setSaved,
    clearSaved: clearSaved,
    cellHtml: cellHtml,
    isValid: isValid
  };
})(window);
