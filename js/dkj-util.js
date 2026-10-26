/**
 * DkjUtil — 공용 유틸리티 및 작성 편의 도구 (Phase 1)
 */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /** 토스트 알림 메시지 (화면 상단 중앙 플로팅) */
  function toast(message, type) {
    if (!document.body) return;
    var prev = document.getElementById('dkjToast');
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);

    var el = document.createElement('div');
    el.id = 'dkjToast';
    el.className = 'dkj-toast' + (type ? ' ' + type : '');
    el.setAttribute('role', 'alert');
    el.innerHTML = '<span class="dkj-toast__icon">' + (type === 'warn' ? '⚠️' : (type === 'err' ? '❌' : '✨')) + '</span><span class="dkj-toast__text">' + esc(message) + '</span>';
    document.body.appendChild(el);

    setTimeout(function () {
      el.classList.add('show');
    }, 10);

    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 300);
    }, 2600);
  }

  /** 작성자/검토자/승인자 기본값 주입 및 로그인 사용자 연동 */
  function autoFillUser(state, writerKeys, onApplied) {
    var keys = Array.isArray(writerKeys) ? writerKeys : ['writer', 'inspector', 'monitorName', 'author', 'reviewer', 'confirmer', 'approver'];
    function apply() {
      var u = global.DkjAuth && typeof global.DkjAuth.user === 'function' ? global.DkjAuth.user() : null;
      var changed = false;
      keys.forEach(function (k) {
        // 작성자류(writer/inspector/monitorName/author)만 로그인한 사람 이름으로
        // 채운다. 검토·승인자는 강제 기본값을 두지 않는다 — 예전엔 서식과 무관하게
        // 고정된 이름(이다은/권화선/최민재)을 기본값으로 뒀는데, 실제로 그 사람이
        // 아닌데도 미리 채워져 있으면 확인 없이 그대로 저장될 위험이 있었다.
        if (state && (state[k] === '' || state[k] == null) &&
            u && (u.name || u.empId) && (k === 'writer' || k === 'inspector' || k === 'monitorName' || k === 'author' || k === 'handler')) {
          state[k] = u.name || ('사번 ' + u.empId);
          changed = true;
        }
      });
      // 점검자 칸이 있는 일보(O/X·모니터링·FR 등)는 작성자와 같은 사람으로 맞춘다.
      // 작성자가 이미 있으면 그 이름을, 없으면 로그인한 사람 이름을 넣는다. 이미 값이 있으면 건드리지 않는다.
      if (state && Object.prototype.hasOwnProperty.call(state, 'inspector') && (state.inspector === '' || state.inspector == null) &&
          u && (u.name || u.empId)) {
        state.inspector = state.writer || (u.name || ('사번 ' + u.empId));
        changed = true;
      }
      if (state && state.approvals) {
        if (!state.approvals.writer && (state.writer || state.inspector || state.monitorName || state.handler)) {
          state.approvals.writer = state.writer || state.inspector || state.monitorName || state.handler;
        }
        if (!state.approvals.reviewer && (state.reviewer || state.confirmer)) state.approvals.reviewer = state.reviewer || state.confirmer;
        if (!state.approvals.approver && state.approver) state.approvals.approver = state.approver;
      }
      if (changed && typeof onApplied === 'function') onApplied(state);
      return changed;
    }

    apply();
    global.addEventListener('dkj:auth-ready', function () {
      apply();
    });
  }

  /** 상용구 프리셋 칩 자동 부착 (전문 텍스트 입력창 전용) */
  var DEFAULT_PRESETS = {
    changeSummary: [
      '정기 기준 최신화',
      '설비 변경 절차 수정',
      '법적 기준 개정 반영',
      '오탈자 양식 수정'
    ],
    impact: [
      '작업자 교육 실시',
      '모니터링 기준 적용',
      '문서 현장 비치 완료'
    ],
    corrective: [
      '이상 없음 (정상 유지)',
      '현장 즉시 청소·소독 완료',
      '설비 점검 후 정상 가동 확인',
      '작업자 현장 재교육 실시',
      '담당자 확인 및 조치 완료'
    ],
    deviation: [
      '특이사항 없음',
      '기준 편차 복구 완료',
      '자재 외관 이상 발견',
      '설비 알람 점검 완료'
    ],
    remark: [
      '특이사항 없음 (정상 가동)',
      '공정 모니터링 기준 준수 확인',
      '작업 전·후 청소 소독 양호',
      '입고 검사 적합 판정',
      '정기 관리 완료'
    ],
    rootCause: [
      '작업자 부주의',
      '설비 노후화 및 부품 마모',
      '원료 품질 편차',
      '환경 온습도 변화'
    ],
    actionPlan: [
      '현장 즉시 조치 및 재검사',
      '설비 부품 교체 및 점검',
      '작업 표준서 개정 및 교육',
      '모니터링 주기 강화'
    ]
  };

  function attachChips(container, customMap) {
    var root = container || document;
    var map = Object.assign({}, DEFAULT_PRESETS, customMap || {});
    Object.keys(map).forEach(function (id) {
      var textarea = root.querySelector('textarea#' + id);
      if (!textarea || textarea.getAttribute('data-chips-bound') === 'true') return;
      textarea.setAttribute('data-chips-bound', 'true');

      var chipsWrap = document.createElement('div');
      chipsWrap.className = 'dkj-preset-chips';
      chipsWrap.innerHTML = '<span class="dkj-chips-label">빠른입력:</span>' +
        map[id].map(function (txt) {
          return '<button type="button" class="dkj-chip" data-text="' + esc(txt) + '">' + esc(txt) + '</button>';
        }).join('');

      chipsWrap.querySelectorAll('.dkj-chip').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var txt = btn.getAttribute('data-text') || '';
          if (!txt) return;
          var cur = textarea.value.trim();
          if (!cur) {
            textarea.value = txt;
          } else if (cur.indexOf(txt) === -1) {
            textarea.value = cur + '\n' + txt;
          }
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
          toast('선택한 상용구가 입력되었습니다.');
        });
      });

      if (textarea.parentNode) {
        if (textarea.nextSibling) {
          textarea.parentNode.insertBefore(chipsWrap, textarea.nextSibling);
        } else {
          textarea.parentNode.appendChild(chipsWrap);
        }
      }
    });
  }

  /** 측정행에 값은 있는데 시간이 비어 있으면 저장 전에 알린다. labels: 시간이 빈 행 이름 목록.
   *  [확인]=이대로 저장, [취소]=돌아가서 채움. 막지는 않는다(현장 작업을 세우지 않는다).
   *  배경: 2026-10-16 금속검출·소독헹굼 일지에서 중간부터 시간·사진이 비어 저장돼 있었다 —
   *  시간 누락을 저장 단계에서 바로 보이게 한다. */
  function confirmMissingTime(labels, lock) {
    if (!labels || !labels.length) return true;
    var shown = labels.slice(0, 6).join(', ') + (labels.length > 6 ? ' 외 ' + (labels.length - 6) + '개' : '');
    return global.confirm('⚠ 시간이 비어 있는 측정행이 ' + labels.length + '개 있습니다.\n(' + shown + ')\n\n' +
      (lock ? '작성완료하면 잠겨서 이후 수정할 수 없습니다.\n' : '') +
      '[취소]를 누르면 돌아가서 시간을 채울 수 있습니다.\n[확인]을 누르면 시간 없이 그대로 저장합니다.');
  }

  /** 작성완료(잠금)는 시간이 빈 측정행이 남아 있으면 진행시키지 않는다 — 잠그면 이후 수정이 막혀
   *  빠진 시간을 채울 수 없기 때문이다. 알림을 띄우고 항상 true(=중단)를 돌려준다. */
  function blockMissingTime(labels) {
    var shown = labels.slice(0, 6).join(', ') + (labels.length > 6 ? ' 외 ' + (labels.length - 6) + '개' : '');
    global.alert('⛔ 시간이 비어 있는 측정행이 ' + labels.length + '개 있어 작성완료할 수 없습니다.\n(' + shown + ')\n\n' +
      '작성완료하면 잠겨서 이후 수정할 수 없으니, 시간을 모두 입력한 뒤 다시 눌러 주세요.\n' +
      '(시간을 아직 모르면 [저장]으로 임시 보관할 수 있습니다.)');
    return true;
  }

  /** 서식 툴바에 빠른 작성 도구 (전체 적합 / 최근기록 복사) 자동 주입 */
  async function attachQuickToolbar(toolbarEl, options) {
    if (!toolbarEl) toolbarEl = document.querySelector('.dkj-form-toolbar');
    if (!toolbarEl || toolbarEl.getAttribute('data-quick-bound') === 'true') return;
    toolbarEl.setAttribute('data-quick-bound', 'true');

    var opts = options || {};
    var formId = opts.formId;

    // 1. 전체 적합 버튼 (점검항목 있는 서식만)
    if (opts.hasChecks && typeof opts.onAllPass === 'function') {
      var btnAll = document.createElement('button');
      btnAll.type = 'button';
      btnAll.className = 'pill-btn green dkj-btn-all-pass';
      btnAll.id = 'btnAllPass';
      btnAll.title = '모든 점검 항목을 한 번에 "O"(적합)으로 채웁니다';
      btnAll.innerHTML = '✨ 전체 적합';
      btnAll.addEventListener('click', async function () {
        await opts.onAllPass();
        toast('✨ 모든 항목이 "O"(적합)으로 입력되었습니다.');
      });
      // 저장 버튼 앞에 삽입
      var saveBtn = toolbarEl.querySelector('#btnSave');
      if (saveBtn) toolbarEl.insertBefore(btnAll, saveBtn);
      else toolbarEl.appendChild(btnAll);
    }

    // 2. 최근기록 복사 버튼
    if (formId && typeof opts.onClonePrev === 'function') {
      var btnClone = document.createElement('button');
      btnClone.type = 'button';
      btnClone.className = 'pill-btn ghost dkj-btn-clone-prev';
      btnClone.id = 'btnClonePrev';
      btnClone.title = '가장 최근 저장된 기록의 내용(설비/품목/점검값)을 복사하고 일자만 오늘로 설정합니다';
      btnClone.innerHTML = '📋 최근기록 복사';
      btnClone.addEventListener('click', async function () {
        if (!global.DkjRecordStore) return;
        var list = (await global.DkjRecordStore.list(formId));
        if (!list || !list.length) {
          alert('복사할 이전 저장 기록이 없습니다.');
          return;
        }
        var latest = list[0];
        // 복사본 생성: ID 제거, 날짜는 오늘로, 서명/잠금 초기화
        var clone = Object.assign({}, latest);
        clone.id = null;
        clone.locked = false;
        clone.signoff = {};
        clone.audit = [];
        // 직전 기록의 결재 이름이 남으면 새 기록이 이미 서명된 것처럼 보인다 — 결재 지정은
        // 새 기록 기준으로 bindFlat 이 다시 채운다.
        if (clone.approvals) clone.approvals = { writer: '', reviewer: '', approver: '' };
        // 일자 필드 오늘로 자동 갱신
        ['docDate', 'checkDate', 'workDate', 'inspectDate', 'date'].forEach(function (dk) {
          if (clone[dk]) clone[dk] = today();
        });
        // 사진(시험지·날인 등)은 그날의 증거라 복사하지 않는다 — 어제 사진이 오늘 기록에
        // 남는 것도 문제고, 같은 사진이 기록마다 복제돼 저장 공간을 먹었다.
        // 단, 시험지·날인 사진을 매번 다시 찍기 번거로운 서식은 opts.keepPhotos 로 복사한다.
        if (!opts.keepPhotos) clone = stripPhotos(clone);
        await opts.onClonePrev(clone);
        toast(opts.keepPhotos
          ? '📋 최근 기록을 불러왔습니다 (일자: 오늘로 자동 설정, 증빙사진 포함 — 오늘 촬영본으로 바꿀 칸은 사진을 지우고 다시 찍으세요).'
          : '📋 최근 기록을 불러왔습니다 (일자: 오늘로 자동 설정, 사진은 복사되지 않음).');
      });
      var newBtn = toolbarEl.querySelector('#btnNew');
      if (newBtn && newBtn.nextSibling) toolbarEl.insertBefore(btnClone, newBtn.nextSibling);
      else toolbarEl.appendChild(btnClone);

      // 이 버튼이 있는지 모르는 신규 사용자가 매번 처음부터 다시 입력하지 않도록,
      // 불러올 이전 기록이 있을 때 기기당 한 번만 살짝 안내한다. 서식마다 다시
      // 뜨면 오히려 성가시므로 플래그는 서식 구분 없이 전역 하나만 쓴다.
      try {
        var seenKey = 'dkj:hint:clonePrev:v1';
        var hasPrev = global.DkjRecordStore && (await global.DkjRecordStore.list(formId)).length > 0;
        if (hasPrev && !localStorage.getItem(seenKey)) {
          var hint = document.createElement('div');
          hint.className = 'dkj-quick-hint';
          hint.innerHTML = '<span>📋 이전에 쓴 기록을 그대로 불러오려면 왼쪽 버튼을 눌러보세요.</span>' +
            '<button type="button" class="dkj-quick-hint-close" aria-label="안내 닫기">✕</button>';
          toolbarEl.appendChild(hint);
          var dismissHint = function () {
            try { localStorage.setItem(seenKey, '1'); } catch (e) {}
            if (hint.parentNode) hint.parentNode.removeChild(hint);
          };
          hint.querySelector('.dkj-quick-hint-close').addEventListener('click', dismissHint);
          btnClone.addEventListener('click', dismissHint, { once: true });
          setTimeout(dismissHint, 9000);
        }
      } catch (e) {}
    }
  }

  /** 등록된 계정으로 직원 목록을 채운다.
   *  정본은 system-settings.html(시스템 관리자 4343)에서 등록·수정하는 계정
   *  디렉터리이고, RTDB system/users 로 기기 간에 맞춰진다.
   *
   *  예전에는 실명 7명을 이 파일에 박아 뒀다. 공개 배포되는 파일에 실명이 남는
   *  것도 문제지만(GitHub Pages 는 저장소가 비공개여도 누구나 열람 가능),
   *  실제와 어긋나는 것이 더 문제였다 — 등록에 없는 사람이 목록에 뜨고,
   *  나중에 등록한 직원은 아무리 등록해도 이 목록에 나타나지 않았다. */
  function fillStaffDatalist(dl) {
    var staff = {};
    try {
      staff = (global.DkjAuth && global.DkjAuth.staff && global.DkjAuth.staff()) || {};
    } catch (e) { staff = {}; }
    var label = function (role) { return role || ''; };
    try {
      if (global.DkjAuth && global.DkjAuth.roleLabel) label = global.DkjAuth.roleLabel;
    } catch (e) {}
    dl.innerHTML = Object.keys(staff).sort().map(function (id) {
      var s = staff[id] || {};
      var name = String(s.name || '').trim() || ('사번 ' + id);
      return '<option value="' + esc(name) + '">' + esc(name) +
        ' (' + esc(id) + ' · ' + esc(label(s.role)) + ')</option>';
    }).join('');
  }

  /** 직원 목록 datalist 주입 (드롭다운 선택 + 직접입력 동시 지원) */
  function ensureStaffDatalist() {
    var dl = document.getElementById('dkjStaffList');
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = 'dkjStaffList';
      if (document.body) document.body.appendChild(dl);
    }
    fillStaffDatalist(dl);
    return dl;
  }

  // 계정 디렉터리는 로그인·RTDB 동기화 뒤에 채워지므로 그때 목록을 다시 만든다.
  // (예전 하드코딩 목록은 갱신할 것이 없어 이 배선이 아예 없었다.)
  ['dkj:staff-loaded', 'dkj:auth-ready'].forEach(function (ev) {
    document.addEventListener(ev, function () { ensureStaffDatalist(); });
  });

  /** 저장(계속 수정 가능)과 작성완료(잠금·이후 새 이력으로만 수정) 버튼이
      나란히 있으면 처음 쓰는 사람은 뭘 눌러야 할지 헷갈릴 수 있다. title
      툴팁은 태블릿(터치)에서 hover가 없어 안 보이므로, 항상 보이는 짧은
      문구를 버튼 바로 아래 붙인다. */
  function explainSaveButtons() {
    var save = document.getElementById('btnSave');
    var lock = document.getElementById('btnLock');
    if (!save || !lock) return;
    var toolbar = save.closest('.dkj-form-toolbar');
    if (!toolbar || toolbar.querySelector('.dkj-save-hint')) return;
    var hint = document.createElement('div');
    hint.className = 'dkj-save-hint';
    hint.textContent = '저장 = 계속 수정 가능 · 작성완료 = 잠금(이후 수정은 새 이력으로만 가능)';
    toolbar.appendChild(hint);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      ensureStaffDatalist();
      explainSaveButtons();
    });
  } else {
    ensureStaffDatalist();
    explainSaveButtons();
  }

  /** 카메라/갤러리로 고른 이미지 파일을 캔버스로 축소·압축해 dataURL 로 돌려준다.
   *  localStorage 용량과 정본 인쇄 크기를 감안해 기본 900px·JPEG 80% 로 줄인다
   *  (DKJ-QC-001 의 증빙사진 처리 방식을 그대로 가져옴). 여러 서식(CCP-1BC 시험지
   *  사진, CCP-2P 날인 사진 등)이 같은 로직을 쓰므로 여기 하나로 모은다. */
  /** data:image 문자열을 깊이 훑어 비운다(배열은 같은 길이 유지 — 슬롯 구조가 깨지지 않게). */
  function stripPhotos(v) {
    if (typeof v === 'string') return v.indexOf('data:image/') === 0 ? null : v;
    if (Array.isArray(v)) return v.map(stripPhotos);
    if (v && typeof v === 'object') {
      var out = {};
      Object.keys(v).forEach(function (k) { out[k] = stripPhotos(v[k]); });
      return out;
    }
    return v;
  }

  function compressImageToDataUrl(file, callback, opts) {
    if (!file || typeof callback !== 'function') return;
    var maxDim = (opts && opts.maxDim) || 800;
    var quality = (opts && opts.quality) || 0.65;

    function drawAndCallback(img) {
      var canvas = document.createElement('canvas');
      var width = img.width, height = img.height;
      if (width > height) {
        if (width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
      } else {
        if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL('image/jpeg', quality));
    }

    try {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); drawAndCallback(img); };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        var reader = new FileReader();
        reader.onload = function (e) {
          var fbImg = new Image();
          fbImg.onload = function () { drawAndCallback(fbImg); };
          fbImg.src = e.target.result;
        };
        reader.readAsDataURL(file);
      };
      img.src = url;
    } catch (err) {
      console.error('이미지 처리 실패', err);
    }
  }

  /**
   * 일보(records/*.html)의 날짜·시각 칸 옆에 '오늘날짜'·'지금시각' 버튼을 붙인다(2026-10-22 현장 요청).
   * 엔진마다 칸을 다시 그리므로 DOM 변화를 지켜보며 새로 생긴 칸에만 붙인다. 값은 input·change 이벤트와
   * 함께 넣어 각 엔진의 상태·일자별 자동 불러오기가 손으로 고른 것과 똑같이 반응한다.
   * 읽기전용·비활성(작성완료 잠금) 칸에서는 아무것도 하지 않는다. 인쇄에는 나오지 않는다.
   */
  var UTIL_SRC = (document.currentScript && document.currentScript.src) || '';
  function installNowButtons() {
    if (!/\/records\//.test(global.location.pathname) || !global.MutationObserver) return;
    // 사람·제품·업체·연도·문서 칸을 고르게 하는 공통 목록 (정본: 계정 디렉터리·products·incoming-catalog·mdr-catalog)
    if (UTIL_SRC && !global.DkjFieldLists) {
      var fl = document.createElement('script');
      fl.src = UTIL_SRC.replace(/dkj-util\.js/, 'dkj-field-lists.js');
      document.head.appendChild(fl);
    }
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function nowValue(type) {
      var d = new Date();
      return type === 'time'
        ? pad(d.getHours()) + ':' + pad(d.getMinutes())
        : d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }
    var st = document.createElement('style');
    st.textContent = '.dkj-now-btn{display:block;margin:2px 0 0;padding:2px 6px;font:inherit;font-size:11px;' +
      'line-height:1.3;color:#1d6b3f;background:#eef7f1;border:1px solid #b9dcc6;border-radius:6px;cursor:pointer;' +
      'white-space:nowrap}.dkj-now-btn:hover{background:#dff0e5}@media print{.dkj-now-btn{display:none!important}}';
    document.head.appendChild(st);
    function attach(root) {
      var list = (root || document).querySelectorAll('input[type="date"]:not([data-now-done]),input[type="time"]:not([data-now-done]),input[type="text"][placeholder="08:00 ~ 08:30"]:not([data-now-done])');
      Array.prototype.forEach.call(list, function (inp) {
        inp.setAttribute('data-now-done', '1');
        // 서식이 이미 '지금시각' 버튼을 가진 칸(CCP 행, QC 순회 회차)은 중복으로 붙이지 않는다
        if (inp.parentNode.querySelector('[data-now-row],[data-set-now],.mon-now-row-btn')) return;
        var range = inp.type === 'text'; // 교육시간처럼 '시작 ~ 종료' 로 적는 글자 칸
        var isTime = inp.type === 'time' || range;
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'dkj-now-btn';
        b.textContent = isTime ? '지금시각' : '오늘날짜';
        b.addEventListener('click', function () {
          if (inp.disabled || inp.readOnly) return;
          if (range) {
            // 첫 클릭은 시작시각, 시작만 적힌 상태의 다음 클릭은 종료시각을 채운다
            var cur = String(inp.value || '').trim();
            inp.value = /~\s*$/.test(cur) ? cur.replace(/\s*~\s*$/, '') + ' ~ ' + nowValue('time')
              : nowValue('time') + ' ~ ';
          } else inp.value = nowValue(inp.type);
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        });
        inp.parentNode.insertBefore(b, inp.nextSibling);
      });
    }
    // 서술 칸(이탈 내용·시정조치·비고)은 자주 쓰는 문구를 칩으로 한 번에 넣는다. 칩이 비어 있는 칸에는 그대로
    // 넣고, 이미 글이 있으면 '; ' 로 이어 붙인다. 문구에 없는 내용만 직접 입력하면 된다.
    var CHIPS = {
      dev: ['이탈 없음', '해당없음', '-'],
      fix: ['해당없음', '재측정 후 적합 확인', '재세척 후 재검사', '재작업(재포장)', '선별 후 사용', '반품 처리', '폐기 처리', '교육 실시'],
      rem: ['이상 없음', '특이사항 없음', '-']
    };
    function chipKind(el) {
      var t = [el.id, el.name, el.getAttribute('data-f'), el.getAttribute('data-c'), el.placeholder, el.getAttribute('aria-label')].join(' ');
      if (/시정|조치|corrective/i.test(t)) return 'fix';
      if (/이탈|deviation/i.test(t)) return 'dev';
      if (/비고|remark|특이|notes?\b/i.test(t)) return 'rem';
      return '';
    }
    function attachPhraseChips(root) {
      Array.prototype.forEach.call((root || document).querySelectorAll('textarea:not([data-phrase-done])'), function (ta) {
        ta.setAttribute('data-phrase-done', '1');
        // 이미 상용구(DEFAULT_PRESETS)가 붙는 칸은 그쪽을 쓴다
        if (DEFAULT_PRESETS[ta.id] || ta.getAttribute('data-chips-bound')) return;
        var kind = chipKind(ta);
        if (!kind) return;
        var bar = document.createElement('div');
        bar.className = 'dkj-phrase-bar';
        CHIPS[kind].forEach(function (text) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'dkj-phrase';
          b.textContent = text;
          b.addEventListener('click', function () {
            if (ta.disabled || ta.readOnly) return;
            var cur = String(ta.value || '').trim();
            ta.value = cur && cur !== '-' ? cur + '; ' + text : text;
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.dispatchEvent(new Event('change', { bubbles: true }));
          });
          bar.appendChild(b);
        });
        ta.parentNode.insertBefore(bar, ta.nextSibling);
      });
    }
    st.textContent += '.dkj-phrase-bar{display:flex;flex-wrap:wrap;gap:4px;margin:3px 0 0}' +
      '.dkj-phrase{padding:3px 9px;font:inherit;font-size:12px;color:#334;background:#f3f5f4;border:1px solid #cfd8d3;' +
      'border-radius:999px;cursor:pointer}.dkj-phrase:hover{background:#e4ece7}@media print{.dkj-phrase-bar{display:none!important}}';

    /* ---------- 터치 기기 입력 팝업 (2026-10-22: '글로 타자 치는 것 0' 목표) ----------
     * 태블릿·스마트폰(pointer: coarse)에서만 동작한다. 칸을 누르면 화상 키보드 대신 팝업이 뜬다.
     *  - 사람 칸(직원 목록 칸·점검자): 이름 버튼 + '나'(로그인한 사람)
     *  - 숫자 칸: 숫자패드(+ '다음 칸'으로 연속 입력)
     *  - 비고 칸: 자주 쓰는 문구
     * 모두 '⌨ 직접 입력'으로 일반 키보드를 쓸 수 있다. PC(마우스)는 종전 그대로다. */
    var touch = !!(global.matchMedia && global.matchMedia('(pointer: coarse)').matches);
    var pop = null, popFor = null;
    /* 숫자패드 팝업을 쓰지 않는 서식 — 칸을 누르면 기기 기본 키보드로 바로 입력한다.
     * 작업장 온도(DKJ-S-02-05)는 한 달 시트에서 칸이 많아 팝업이 오히려 불편하다는 현장 요청(2026-10-26). */
    var NO_NUM_POPUP = /\/DKJ-S-02-05\.html(?:$|[?#])/.test((global.location && (global.location.pathname + global.location.search)) || '');
    /* 제조시설·설비점검표(DKJ-S-02-12)는 칸마다 직원 선택 팝업이 떠 불편하다는 현장 요청(2026-10-26)으로 팝업을 전부 끈다. */
    var NO_ANY_POPUP = /\/DKJ-S-02-12\.html(?:$|[?#])/.test((global.location && (global.location.pathname + global.location.search)) || '');
    function popKind(el) {
      if (NO_ANY_POPUP) return '';
      if (!el || el.tagName !== 'INPUT' || el.disabled || el.readOnly) return '';
      if (/^dkj/.test(el.id || '') || el.closest('[id^="dkj"],.dkj-login,#dkjChatbot')) return '';
      var t = el.type;
      if (t === 'number') return NO_NUM_POPUP ? '' : 'num';
      if (t !== 'text') return '';
      if (el.getAttribute('list') === 'dkjStaffList' || el.id === 'inspector' || el.getAttribute('data-info') === 'inspector') return 'staff';
      if (el.getAttribute('list')) return 'combo'; // 업체·품목처럼 목록에서 고르는 칸
      var h = [el.id, el.name, el.getAttribute('data-f'), el.getAttribute('data-c'), el.getAttribute('data-note'), el.placeholder].join(' ');
      if (/remark|비고|특이|mxf-note/i.test(h) || /mxf-note-in/.test(el.className)) return 'rem';
      return '';
    }
    function fire(el) {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function closePop() { if (pop) { pop.remove(); pop = null; popFor = null; } }
    function staffNames() {
      var dl = document.getElementById('dkjStaffList'), out = [];
      if (dl) Array.prototype.forEach.call(dl.options, function (o) { if (o.value) out.push(o.value); });
      return out;
    }
    function comboOptions(el) {
      var dl = document.getElementById(el.getAttribute('list')), out = [];
      if (dl) Array.prototype.forEach.call(dl.options, function (o) { if (o.value) out.push(o.value); });
      return out;
    }
    function meName() {
      try { var u = global.DkjAuth && global.DkjAuth.user(); return (u && (u.name || u.empId)) || ''; } catch (e) { return ''; }
    }
    function nextField(el, kind) {
      var all = Array.prototype.filter.call(document.querySelectorAll('input'), function (x) {
        return popKind(x) === kind && x.offsetParent !== null;
      });
      return all[all.indexOf(el) + 1] || null;
    }
    function place(el) {
      var r = el.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
      var top = r.bottom + 6;
      if (top + ph > global.innerHeight - 4) top = Math.max(4, r.top - ph - 6);
      var left = Math.min(Math.max(4, r.left), Math.max(4, global.innerWidth - pw - 4));
      pop.style.top = top + 'px';
      pop.style.left = left + 'px';
    }
    function openPop(el) {
      var kind = popKind(el);
      if (!kind || el.getAttribute('data-pk-manual') === '1') return;
      if (popFor === el) return;
      closePop();
      popFor = el;
      pop = document.createElement('div');
      pop.className = 'dkj-pop';
      pop.addEventListener('pointerdown', function (e) { e.preventDefault(); }); // 칸의 포커스를 지키지 않는다
      function btn(label, cls, fn) {
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = label; b.className = cls || '';
        b.addEventListener('click', function (e) { e.preventDefault(); fn(b); });
        return b;
      }
      function manual() {
        closePop();
        el.setAttribute('data-pk-manual', '1');
        el.removeAttribute('inputmode');
        el.focus();
        el.addEventListener('blur', function () { el.removeAttribute('data-pk-manual'); markTouch(el); }, { once: true });
      }
      if (kind === 'num') {
        var buf = String(el.value || '');
        var disp = document.createElement('div');
        disp.className = 'dkj-pop-disp';
        pop.appendChild(disp);
        var apply = function () {
          disp.textContent = buf === '' ? '값 입력' : buf;
          var n = parseFloat(buf);
          el.value = isNaN(n) || buf === '-' ? '' : (/\.$/.test(buf) ? String(n) : buf);
          fire(el);
        };
        apply();
        var grid = document.createElement('div');
        grid.className = 'dkj-pop-grid';
        ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '-'].forEach(function (k) {
          grid.appendChild(btn(k, 'k', function () {
            if (k === '.' && buf.indexOf('.') !== -1) return;
            if (k === '-' && buf !== '') { buf = buf.charAt(0) === '-' ? buf.slice(1) : '-' + buf; apply(); return; }
            buf += k; apply();
          }));
        });
        pop.appendChild(grid);
        var row = document.createElement('div');
        row.className = 'dkj-pop-row';
        row.appendChild(btn('⌫', '', function () { buf = buf.slice(0, -1); apply(); }));
        row.appendChild(btn('지움', '', function () { buf = ''; apply(); }));
        row.appendChild(btn('다음 칸 ▶', 'go', function () {
          var nx = nextField(el, 'num'); closePop();
          if (nx) nx.focus(); else el.blur();
        }));
        row.appendChild(btn('확인', 'ok', function () { closePop(); el.blur(); }));
        pop.appendChild(row);
        var k0 = btn('⌨', 'kb', manual); k0.title = '직접 입력'; row.appendChild(k0);
      } else {
        var list = kind === 'staff' ? staffNames()
          : kind === 'combo' ? comboOptions(el)
          : CHIPS.rem.concat(['정상 가동', '점검 완료']);
        var wrap = document.createElement('div');
        wrap.className = 'dkj-pop-list';
        if (kind === 'staff' && meName()) {
          wrap.appendChild(btn('나 (' + meName() + ')', 'me', function () { el.value = meName(); fire(el); closePop(); el.blur(); }));
        }
        list.forEach(function (name) {
          wrap.appendChild(btn(name, '', function () {
            var cur = String(el.value || '').trim();
            el.value = kind === 'rem' && cur && cur !== '-' ? cur + '; ' + name : name;
            fire(el); closePop(); el.blur();
          }));
        });
        wrap.appendChild(btn('⌨ 직접 입력', 'kb', manual));
        pop.appendChild(wrap);
      }
      document.body.appendChild(pop);
      place(el);
    }
    function markTouch(el) { if (touch && popKind(el) && el.getAttribute('data-pk-manual') !== '1') el.setAttribute('inputmode', 'none'); }
    function markAll() {
      if (!touch) return;
      Array.prototype.forEach.call(document.querySelectorAll('input[type="number"],input[type="text"]'), markTouch);
    }
    if (touch) {
      document.addEventListener('focusin', function (e) { markTouch(e.target); openPop(e.target); });
      document.addEventListener('pointerdown', function (e) {
        if (pop && !pop.contains(e.target) && e.target !== popFor) closePop();
      }, true);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePop(); });
      global.addEventListener('resize', closePop);
    }
    st.textContent += '.dkj-pop{position:fixed;z-index:99999;background:#fff;border:1px solid #b9c9bf;border-radius:12px;' +
      'box-shadow:0 8px 28px rgba(0,0,0,.22);padding:8px;max-width:min(92vw,360px)}' +
      '.dkj-pop button{font:inherit;font-size:16px;min-height:46px;min-width:46px;padding:6px 12px;border:1px solid #cfd8d3;' +
      'border-radius:10px;background:#f6f8f7;color:#223;cursor:pointer}.dkj-pop button:active{background:#dfeee5}' +
      '.dkj-pop-disp{font-size:22px;font-weight:700;text-align:right;padding:4px 8px 8px;min-height:34px;color:#1d6b3f}' +
      '.dkj-pop-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.dkj-pop-row{display:flex;gap:6px;margin-top:6px}' +
      '.dkj-pop-row .go{flex:1;background:#e8f1fb}.dkj-pop-row .ok{background:#1d6b3f;color:#fff;border-color:#1d6b3f}' +
      '.dkj-pop-list{display:flex;flex-wrap:wrap;gap:6px;max-height:55vh;overflow-y:auto}.dkj-pop-list .me{background:#e3f3ea;border-color:#9fd0b2;font-weight:700}' +
      '.dkj-pop .kb{color:#667;font-size:14px}@media print{.dkj-pop{display:none!important}}';
    var queued = false;
    new MutationObserver(function () {
      if (queued) return;
      queued = true;
      (global.requestAnimationFrame || setTimeout)(function () { queued = false; attach(); attachPhraseChips(); markAll(); });
    }).observe(document.body, { childList: true, subtree: true });
    attach();
    attachPhraseChips();
    markAll();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installNowButtons);
  else installNowButtons();

  global.esc = esc;
  global.today = today;
  global.DkjUtil = {
    esc: esc,
    today: today,
    toast: toast,
    autoFillUser: autoFillUser,
    attachChips: attachChips,
    attachQuickToolbar: attachQuickToolbar,
    confirmMissingTime: confirmMissingTime,
    blockMissingTime: blockMissingTime,
    ensureStaffDatalist: ensureStaffDatalist,
    compressImageToDataUrl: compressImageToDataUrl,
    DEFAULT_PRESETS: DEFAULT_PRESETS
  };
})(window);
