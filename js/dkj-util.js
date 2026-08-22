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

  /** 로그인 사용자 작성자/점검자 자동 주입 */
  function autoFillUser(state, writerKeys, onApplied) {
    var keys = Array.isArray(writerKeys) ? writerKeys : ['writer', 'inspector', 'monitorName', 'author'];
    function apply() {
      var u = global.DkjAuth && typeof global.DkjAuth.user === 'function' ? global.DkjAuth.user() : null;
      if (!u || (!u.name && !u.empId)) return false;
      var name = u.name || ('사번 ' + u.empId);
      var changed = false;
      keys.forEach(function (k) {
        if (state && (state[k] === '' || state[k] == null)) {
          state[k] = name;
          changed = true;
        }
      });
      if (changed && typeof onApplied === 'function') onApplied(state);
      return changed;
    }

    apply();
    global.addEventListener('dkj:auth-ready', function () {
      apply();
    });
  }

  /** 상용구 프리셋 칩 자동 부착 */
  var DEFAULT_PRESETS = {
    corrective: [
      '이상 없음 (정상 유지)',
      '현장 즉시 청소·소독 완료',
      '설비 점검 후 정상 가동 확인',
      '작업자 현장 재교육 실시',
      '담당자 확인 및 조치 완료'
    ],
    deviation: [
      '특이사항 없음',
      '일시적 기준 편차 (즉시 복구)',
      '자재 외관 이상 발견 (격리 조치)',
      '설비 이상 알람 (점검 완료)'
    ],
    remark: [
      '특이사항 없음 (정상 가동)',
      '공정 모니터링 기준 준수 확인',
      '작업 전·후 청소 소독 양호',
      '입고 검사 적합 판정',
      '정기 점검 및 관리 완료'
    ],
    changeSummary: [
      '정기 개정 및 기준 최신화',
      '설비 변경에 따른 절차 수정',
      '법적 기준 개정 사항 반영',
      '오탈자 및 표기 양식 수정'
    ],
    impact: [
      '관련 작업자 사내 교육 실시',
      '해당 공정 모니터링 기준 적용',
      '문서 배포 및 현장 비치 완료'
    ],
    reason: [
      '문서 최신화 및 현행화',
      'FSSC22000 심사 대응 보완',
      '업무 프로세스 개선 반영'
    ]
  };

  function attachChips(container, customMap) {
    var root = container || document;
    var map = Object.assign({}, DEFAULT_PRESETS, customMap || {});
    Object.keys(map).forEach(function (id) {
      var textarea = root.querySelector('textarea#' + id + ', input#' + id);
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
        textarea.parentNode.insertBefore(chipsWrap, textarea);
      }
    });
  }

  /** 서식 툴바에 빠른 작성 도구 (전체 적합 / 최근기록 복사) 자동 주입 */
  function attachQuickToolbar(toolbarEl, options) {
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
      btnAll.addEventListener('click', function () {
        opts.onAllPass();
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
      btnClone.addEventListener('click', function () {
        if (!global.DkjRecordStore) return;
        var list = global.DkjRecordStore.list(formId);
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
        // 일자 필드 오늘로 자동 갱신
        ['docDate', 'checkDate', 'workDate', 'inspectDate', 'date'].forEach(function (dk) {
          if (clone[dk]) clone[dk] = today();
        });
        opts.onClonePrev(clone);
        toast('📋 최근 기록을 불러왔습니다 (일자: 오늘로 자동 설정).');
      });
      var newBtn = toolbarEl.querySelector('#btnNew');
      if (newBtn && newBtn.nextSibling) toolbarEl.insertBefore(btnClone, newBtn.nextSibling);
      else toolbarEl.appendChild(btnClone);
    }
  }

  global.esc = esc;
  global.today = today;
  global.DkjUtil = {
    esc: esc,
    today: today,
    toast: toast,
    autoFillUser: autoFillUser,
    attachChips: attachChips,
    attachQuickToolbar: attachQuickToolbar,
    DEFAULT_PRESETS: DEFAULT_PRESETS
  };
})(window);
