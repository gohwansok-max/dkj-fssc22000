/**
 * DkjLedgerForm — 유형 E(대장/검사일지) 입력 엔진
 * 1 레코드 = 1장(대장 시트). 행은 건별로 추가·삭제한다.
 */
(function (global) {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function thisMonth() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function emptyRow(spec) {
    var r = {};
    (spec.columns || []).forEach(function (c) { r[c.key] = c.default || ''; });
    return r;
  }

  function emptyState(spec) {
    var rows = [];
    if (spec.defaultRows && spec.defaultRows.length) {
      // 측정위치·설비명·일자처럼 서식에 인쇄되어 있는 행을 그대로 채운다
      spec.defaultRows.forEach(function (d) {
        rows.push(Object.assign(emptyRow(spec), d));
      });
    } else {
      for (var i = 0; i < (spec.rows || 12); i++) rows.push(emptyRow(spec));
    }
    var info = {};
    (spec.infoFields || []).forEach(function (f) {
      info[f.id] = f.type === 'date' ? today() : f.type === 'month' ? thisMonth() : (f.default || '');
    });
    var incidents = [];
    if (spec.incident) {
      for (var k = 0; k < (spec.incident.rows || 4); k++) {
        var ir = {};
        (spec.incident.columns || []).forEach(function (c) { ir[c.key] = ''; });
        incidents.push(ir);
      }
    }
    var extraRows = [];
    if (spec.extraTable) {
      for (var e = 0; e < (spec.extraTable.rows || 4); e++) {
        var er = {};
        (spec.extraTable.columns || []).forEach(function (c) { er[c.key] = ''; });
        extraRows.push(er);
      }
    }
    return {
      info: info,
      rows: rows,
      incidents: incidents,
      extraRows: extraRows,
      approvals: { writer: '', reviewer: '', approver: '' },
      signoff: {},
      // audit 를 여기서 만들어 둬야 저장 훅이 같은 배열에 이어 붙인다.
      // 없으면 저장할 때마다 새 배열이 생겨 감사이력이 1건으로 초기화된다.
      audit: [],
      remark: '',
      photos: [],
      locked: false
    };
  }

  async function mount(spec) {
    if (!spec || !spec.code) throw new Error('DkjLedgerForm: spec.code required');
    var FORM_ID = spec.code;
    var COLS = spec.columns || [];
    // 행이 서식에 고정된 대장(defaultRows)이거나 noAddRow 인 서식은 행 추가·삭제 열이 없다
    var FIXED_ROWS = !!(spec.defaultRows || spec.noAddRow);
    var state = emptyState(spec);
    var editingId = null;
    var draftTimer = null;

    /* 칸 단위 병합(DkjCloudSync.sheet) — 행 고정 대장만. base 는 이 화면이 불러오거나 마지막으로
       저장한 시점의 rows 사본이다. 저장할 때 base 와 달라진 칸만 이 화면의 입력으로 보고, 나머지
       칸은 저장소의 최신 값(다른 기기·다른 탭이 먼저 저장한 입력)을 받는다. */
    var baseRows = null;
    function sheetApi() {
      return FIXED_ROWS && global.DkjCloudSync && global.DkjCloudSync.sheet ? global.DkjCloudSync.sheet : null;
    }
    function setBase() { baseRows = JSON.parse(JSON.stringify(state.rows || [])); }
    function gridFocused() {
      var host = $('ledgerGrid'), a = document.activeElement;
      return !!(host && a && host.contains(a) && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName));
    }
    /** 저장 직전: 이 화면에서 바꾼 칸에 시각을 찍고, 안 바꾼 칸은 저장소의 최신 값을 받는다. */
    async function mergeFromStored(stampNow) {
      var api = sheetApi();
      if (!api || !editingId || !baseRows) return 0;
      var stored = (await DkjRecordStore.get(FORM_ID, editingId));
      if (!stored) return 0;
      var before = JSON.stringify(state.rows);
      api.rebase(baseRows, state, stored, stampNow);
      if (JSON.stringify(state.rows) !== before) renderGrid();
      return 1;
    }
    /** 다른 기기·탭이 저장한 칸을 화면에 반영한다(이 화면에서 바꾼 칸은 건드리지 않는다). */
    async function absorbFromStored() {
      var api = sheetApi();
      if (!api || !editingId || !baseRows || state.locked) return false;
      var stored = (await DkjRecordStore.get(FORM_ID, editingId));
      var hits = api.absorb(baseRows, state, stored);
      if (!hits.length) return false;
      if (!gridFocused()) renderGrid();
      else {
        // 입력 중인 칸의 포커스를 지키려고 전체를 다시 그리지 않고 입력칸 값만 바꾼다.
        hits.forEach(function (h) {
          var el = document.querySelector('#ledgerGrid [data-r="' + h[0] + '"][data-c="' + h[1] + '"]');
          if (el && el !== document.activeElement) el.value = state.rows[h[0]][h[1]];
        });
      }
      setStatus('다른 기기에서 입력한 ' + hits.length + '칸을 반영했습니다', true);
      return true;
    }

    /* 전자결재 패널 — 모듈이 없으면 그냥 건너뛴다 */
    var apvUi = null;

    function mountApproval() {
      if (!global.DkjApproval || apvUi) return;
      apvUi = global.DkjApproval.mount({
        // 한 번도 저장 안 한 새 시트에서 결재를 누르면 먼저 저장한다(검증 포함) — 안 그러면 서명이
        // 이 기기 임시본에만 남아 다른 기기의 검토·승인자에게 보이지 않았다(2026-10-23 점검).
        ensureSaved: async function () { if (!editingId) (await save(false)); return !!editingId; },
        getState: function () { return state; },
        // 결재 서명은 임시저장(이 기기에만 남고 클라우드 동기화 안 됨)이 아니라
        // 실제 저장 레코드에 바로 반영해야 다른 기기·다른 사람에게도 보인다.
        onChange: async function () {
          // 결재 저장은 DkjApproval.persistSign 한 곳에서 한다 — 잠긴 기록은 서명·이력만 덧붙이고,
          // 잠기지 않은 기록은 이 서식의 저장(검증·제목·판정 계산 포함)을 그대로 거친다.
          if (await global.DkjApproval.persistSign(FORM_ID, editingId, state, function () { return save(false); })) {
            setStatus('결재 저장됨 · ' + new Date().toLocaleTimeString('ko-KR'), true);
            (await renderHistory());
          } else {
            scheduleDraft();
          }
        }
      });
    }

    function refreshApproval() {
      if (apvUi) apvUi.render();
    }

    function setStatus(msg, saved) {
      var el = $('saveStatus');
      if (!el) return;
      el.innerHTML = '<span class="dot"></span> ' + msg;
      el.className = 'dkj-status' + (saved ? ' saved' : '');
    }

    function scheduleDraft() {
      clearTimeout(draftTimer);
      draftTimer = setTimeout(async function () {
        (await DkjRecordStore.saveDraft(FORM_ID, state));
        setStatus('임시저장 ' + new Date().toLocaleTimeString(), false);
      }, 400);
    }

    /** 월 단위로 여러 날에 걸쳐 누적 입력하는 서식(autoWeekday 보유)에서, 지금 화면의
     *  점검 월과 같은 달의 기존 기록을 찾는다. 없으면 null.
     *  같은 달 기록이 이미 여러 건(과거 중복 저장 버그)이면 가장 최근 것을 고른다. */
    async function findCurrentPeriodRecord() {
      var cfg = spec.autoWeekday;
      if (!cfg) return null;
      var raw = String((state.info && state.info[cfg.monthField]) || '');
      var m = raw.match(/(\d{4})\D+(\d{1,2})/);
      if (!m) return null;
      var targetYm = Number(m[1]) * 100 + Number(m[2]);
      var best = null;
      (await DkjRecordStore.list(FORM_ID)).forEach(function (r) {
        // 잠긴 기록은 건너뛴다 — 잠긴 기록을 이어서 열면 셀에 이전 값은 보이지만
        // applyLock()이 입력칸을 전부 disabled 로 막아 아무것도 쓸 수 없다. 이번 달
        // 기록이 도중에 잠겼다면(예: '작성완료'를 실수로 눌러 월 시트 전체가 잠김)
        // 이어서 열 대상이 없는 것으로 보고 새 시트로 시작해야 오늘 것을 쓸 수 있다.
        if (r.locked) return;
        var rRaw = String((r.info && r.info[cfg.monthField]) || '');
        var rm = rRaw.match(/(\d{4})\D+(\d{1,2})/);
        if (!rm || (Number(rm[1]) * 100 + Number(rm[2])) !== targetYm) return;
        if (!best || (Date.parse(r.updatedAt || 0) || 0) > (Date.parse(best.updatedAt || 0) || 0)) best = r;
      });
      return best;
    }

    /** findCurrentPeriodRecord() 가 null 을 돌려줬을 때, 그게 '이번 달 기록이 아예 없어서'인지
     *  '있긴 한데 잠겨서 건너뛴 것'인지 구분한다. 후자면 새 시트로 시작하되 그 사실을
     *  화면에 알려야, 이전에 적은 값이 사라진 게 아니라 잠긴 기록으로 남아 있다는 걸 안다. */
    async function hasLockedRecordForMonth() {
      var cfg = spec.autoWeekday;
      if (!cfg) return false;
      var raw = String((state.info && state.info[cfg.monthField]) || '');
      var m = raw.match(/(\d{4})\D+(\d{1,2})/);
      if (!m) return false;
      var targetYm = Number(m[1]) * 100 + Number(m[2]);
      return (await DkjRecordStore.list(FORM_ID)).some(function (r) {
        if (!r.locked) return false;
        var rRaw = String((r.info && r.info[cfg.monthField]) || '');
        var rm = rRaw.match(/(\d{4})\D+(\d{1,2})/);
        return rm && (Number(rm[1]) * 100 + Number(rm[2])) === targetYm;
      });
    }

    /** 점검 월(YYYY-MM 또는 '2026 . 08')이 바뀌면 요일 열을 다시 계산한다.
     *  monthChanged=true 는 사용자가 점검 월을 직접 바꾼 경우다 — 그때만 휴무행을 비운다. */
    function applyAutoWeekday(monthChanged) {
      var cfg = spec.autoWeekday;
      if (!cfg) return;
      var raw = String(state.info[cfg.monthField] || '');
      var m = raw.match(/(\d{4})\D+(\d{1,2})/);
      if (!m) return;
      var y = Number(m[1]), mo = Number(m[2]);
      var names = ['일', '월', '화', '수', '목', '금', '토'];
      state.rows.forEach(function (r, i) {
        var dnum = Number(String(r[cfg.dayKey] || '').replace(/\D/g, '')) || (i + 1);
        var d = new Date(y, mo - 1, dnum);
        r[cfg.weekdayKey] = (d.getMonth() === mo - 1) ? names[d.getDay()] : '';
      });
      if (monthChanged) clearDisabledRows();
    }

    /** 날짜 열(spec.autoDateRange.dateKey)에 적힌 값들의 최솟값·최댓값으로
     *  '점검 일시' 같은 infoField(spec.autoDateRange.infoId) 를 채운다.
     *  손으로 옮겨 적다 실제 기재 범위(첫 날짜~끝 날짜)와 어긋나는 것을 막는다. */
    function fmtKDate(iso) {
      if (!iso || iso.length < 10) return '';
      return iso.slice(0, 4) + ' 년 ' + iso.slice(5, 7) + ' 월 ' + iso.slice(8, 10) + ' 일';
    }
    function applyAutoDateRange() {
      var cfg = spec.autoDateRange;
      if (!cfg) return;
      var dates = state.rows
        .map(function (r) { return r[cfg.dateKey]; })
        .filter(function (v) { return v && /^\d{4}-\d{2}-\d{2}$/.test(v); })
        .sort();
      if (!dates.length) return;
      var min = dates[0], max = dates[dates.length - 1];
      state.info[cfg.infoId] = (min === max) ? fmtKDate(min) : (fmtKDate(min) + ' ~ ' + fmtKDate(max));
    }

    /** 점검 월을 바꿨을 때 휴무일로 바뀐 행의 이전 달 값을 비운다.
     *  기록을 불러올 때는 절대 부르지 않는다 — 이미 저장된 값을 지우면 기록 변조다.
     *  그래서 값이 남아 있는 휴무행은 아래 offRowCells() 가 '휴무'로 가리지 않고
     *  그 값을 그대로 보여준다(인쇄 정본도 같다). */
    function clearDisabledRows() {
      if (!spec.disableRowIf) return;
      state.rows.forEach(function (r) {
        if (!isRowDisabled(r)) return;
        (spec.columns || []).forEach(function (c) {
          if (isColOff(c) && r[c.key]) r[c.key] = '';
        });
      });
    }

    /** 휴무행인데 잠긴 칸에 값이 남아 있는가 — 예전에 저장된 기록이거나 휴무일에
     *  실제로 작업한 경우. 계속 기재하는 열(냉장창고 등)은 원래 값이 들어오는 칸이라
     *  여기서 세지 않는다 — 세면 냉장창고 온도를 적는 순간 행 전체가 읽기전용이 된다. */
    function offRowHasValues(row) {
      return (spec.columns || []).some(function (c) {
        return isColOff(c) && String(row[c.key] || '').trim();
      });
    }

    /* dkj-approval.js 의 attachStaffPickers() 는 라벨에 '점검'·'작성' 같은 말이 들어가면
       그 입력칸을 직원 이름 <select> 로 바꿔 버린다. '점검 일시'·'점검 월' 처럼 사람이
       아닌 칸까지 잡혀 필수 항목을 아예 못 쓰는 서식이 있었다. 사양에서 staff:false 로
       지정하면 이 표시를 달아 치환에서 제외한다(선택자가
       input:not([data-dkj-staff-picker]) 이라 표시만 있으면 건너뛴다). */
    /** '2026 . 08' 처럼 손으로 적어 저장된 점검 월을 <input type="month"> 가 받는
     *  YYYY-MM 으로 맞춘다. 예전 기록을 열었을 때 월 칸이 빈칸으로 보이는 것을 막는다.
     *  화면 표기만 맞추는 것이고 저장은 하지 않는다 — 사용자가 저장할 때 정리된 값이
     *  들어간다(기록을 여는 것만으로 저장 데이터를 바꾸지 않는다). */
    function normMonth(v) {
      var raw = String(v == null ? '' : v).trim();
      if (/^\d{4}-\d{2}$/.test(raw)) return raw;
      var m = raw.match(/(\d{4})\D+(\d{1,2})/);
      return m ? m[1] + '-' + String(Number(m[2])).padStart(2, '0') : '';
    }

    function noStaff(f) {
      return f.staff === false ? ' data-dkj-staff-picker="skip"' : '';
    }

    function renderInfo() {
      var host = $('infoFields');
      if (!host) return;
      host.innerHTML = (spec.infoFields || []).map(function (f) {
        var v = state.info[f.id] || '';
        if (f.type === 'month') {
          v = normMonth(v);
          // autoWeekday·검증이 같은 값을 보도록 state 도 맞춘다(저장 아님).
          state.info[f.id] = v;
        }
        // readonly 는 서식에서 값이 고정된 칸(예: 자체 처리하는 폐기물 수거업체)이다.
        // disabled 대신 readonly 를 쓰면 값이 그대로 state 에 남아 정본에도 인쇄된다.
        // id 도 같이 달아야 dkj-approval.js 의 attachStaffPickers() 가 '점검자' 같은
        // 인원 칸(명시적 id 목록: inspector/writer/confirmer 등)을 직원 <select> 로
        // 바꿔치기할 수 있다. data-info 만으로는 라벨 텍스트 휴리스틱에 의존하게 되는데
        // '점 검 자'처럼 글자 사이에 공백을 넣은 라벨은 personWords 매칭에 걸리지 않는다.
        var input = f.readonly
          ? '<input type="text" id="' + esc(f.id) + '" data-info="' + f.id + '" data-fixed="1" value="' + esc(v) +
            '" readonly disabled>'
          : f.type === 'date'
            ? '<input type="date" id="' + esc(f.id) + '" data-info="' + f.id + '" value="' + esc(v) + '">'
            : f.type === 'month'
              ? '<input type="month" id="' + esc(f.id) + '" data-info="' + f.id + '" value="' + esc(v) + '">'
              : '<input type="text" id="' + esc(f.id) + '" data-info="' + f.id + '"' + noStaff(f) + ' value="' + esc(v) +
                '" placeholder="' + esc(f.placeholder || '') + '">';
        return '<div class="dkj-field"><label>' + esc(f.label) + '</label>' + input + '</div>';
      }).join('');
      // dkj-approval.js 의 직원 자동선택 기능(attachStaffPickers)이 '점검자' 같은 인원 칸을
      // <select>로 통째로 바꿔치기한다. 개별 요소에 리스너를 걸면 그 바꿔치기 때마다
      // 리스너가 원래 요소와 함께 사라져서, 드롭다운에서 이름을 골라도 state.info 에는
      // 절대 반영되지 않는(=검증에서 계속 "입력하세요"로 막히는) 버그가 있었다. 부모
      // 컨테이너(host)에 위임 리스너를 하나만 걸어 두면, 자식이 어떤 요소로 바뀌든
      // 이벤트 버블링만으로 계속 잡힌다.
      if (!host._dkjInfoDelegated) {
        host._dkjInfoDelegated = true;
        ['input', 'change'].forEach(function (evt) {
          host.addEventListener(evt, function (e) {
            var el = e.target.closest ? e.target.closest('[data-info]') : null;
            if (!el || !host.contains(el)) return;
            state.info[el.getAttribute('data-info')] = el.value;
            // 맨 위에서 고른 점검자가 아래 결재 '작성' 칸의 작성자가 된다(따로 또 고르지 않는다).
            if (el.getAttribute('data-info') === 'inspector' && el.value) {
              state.approvals.writer = el.value;
              if ($('writer')) $('writer').value = el.value;
              global.dispatchEvent(new CustomEvent('dkj:approval-changed'));
            }
            if (spec.autoWeekday && el.getAttribute('data-info') === spec.autoWeekday.monthField) {
              applyAutoWeekday(true);
              renderGrid();
            }
            scheduleDraft();
          });
        });
      }
    }

    /** disableRowIf.key(대개 dow) 로 계산한 행의 실제 날짜 — applyAutoWeekday() 와
     *  같은 방식으로 spec.autoWeekday 의 월 필드·일자 열에서 되짚어 구한다. */
    function rowDate(row) {
      var cfg = spec.autoWeekday;
      if (!cfg || !row) return null;
      var raw = String(state.info[cfg.monthField] || '');
      var m = raw.match(/(\d{4})\D+(\d{1,2})/);
      if (!m) return null;
      var y = Number(m[1]), mo = Number(m[2]);
      var dnum = Number(String(row[cfg.dayKey] || '').replace(/\D/g, ''));
      if (!dnum) return null;
      return new Date(y, mo - 1, dnum);
    }

    /** 휴무일처럼 아예 기재하지 않는 행인지 — spec.disableRowIf 로 지정한다.
     *  서식에 인쇄된 요일 규칙(예: 토요일)은 그대로 두고, 여기에 더해 달력에서
     *  비생산일로 지정한 날짜(예: 추석 연휴)도 같이 휴무로 잡는다 — 달력 예외가
     *  요일 규칙에 없는 평일에 걸려도 이 행이 잠기도록 하기 위함이다. */
    function isRowDisabled(row) {
      var cfg = spec.disableRowIf;
      if (!cfg || !row) return false;
      if ((cfg.values || []).indexOf(String(row[cfg.key] || '').trim()) !== -1) return true;
      // 업무 콘솔(dkj-console.js)이 이 페이지에 없으면 js/dkj-operation-calendar.js 가
      // 같은 캘린더를 읽어 대신 판정한다 — 둘 다 없으면 요일 규칙만 적용된다.
      var checkDay = (global.DkjConsole && global.DkjConsole.isProductionDay) ||
        (global.DkjOperationCalendar && global.DkjOperationCalendar.isProductionDay);
      if (checkDay) {
        var d = rowDate(row);
        if (d && !checkDay(d)) return true;
      }
      return false;
    }

    /** 휴무행에서도 계속 기재하는 열인가 — disableRowIf.keepGroups / keepColumns.
     *  휴무라고 해서 설비가 멈추는 것은 아니다. 냉장창고는 휴무일에도 제품이 들어
     *  있어 온도가 이탈할 수 있으므로 모니터링을 이어가야 한다. 그 칸까지 잠그면
     *  '휴무일 보관온도 기록 없음'이 되어 심사에서 그대로 지적된다. */
    function isColKept(c) {
      var cfg = spec.disableRowIf;
      if (!cfg || !c) return false;
      if ((cfg.keepColumns || []).indexOf(c.key) !== -1) return true;
      return !!c.group && (cfg.keepGroups || []).indexOf(c.group) !== -1;
    }

    /** 휴무행에서 잠기는 입력열인가 (미리 인쇄된 칸과 계속 기재하는 칸은 제외) */
    function isColOff(c) {
      return !c.readonly && !isColKept(c);
    }

    /* ── 이어지는 재고 자동계산 (spec.runningStock) ────────────────────────────
       세척 소독제 관리대장처럼 [전일재고 · 금일 입고 · 금일사용 · 현재 재고] 가
       한 묶음인 대장은, 사람이 금일 입고·금일사용만 적으면 나머지는 산술로 정해진다.
         전일재고 = 직전에 기재한 날의 현재 재고
         현재 재고 = 전일재고 + 금일 입고 - 금일 사용
       손으로 옮겨 적다 어긋나는 것이 이 대장의 가장 흔한 지적 사항이라 계산으로
       고정한다. 1일 전일재고만 전월 이월값이어서 사람이 적는다(openingRow). */

    var STOCK = spec.runningStock || null;
    /** 열 key → 'prev' | 'now' (자동계산 대상 열) */
    var STOCK_CALC = {};
    /** 열 key → true (계산을 다시 돌려야 하는 입력 열) */
    var STOCK_INPUT = {};
    if (STOCK) {
      (STOCK.chains || []).forEach(function (ch) {
        if (ch.prev) { STOCK_CALC[ch.prev] = 'prev'; STOCK_INPUT[ch.prev] = true; }
        if (ch.now) STOCK_CALC[ch.now] = 'now';
        if (ch['in']) STOCK_INPUT[ch['in']] = true;
        if (ch.use) STOCK_INPUT[ch.use] = true;
      });
    }
    function stockOpeningRow() {
      return STOCK && STOCK.openingRow != null ? Number(STOCK.openingRow) : 0;
    }
    /** 이 칸이 자동계산 칸인가 — 첫 행의 전일재고(전월 이월)만 사람이 적는다 */
    function isCalcCell(c, ri) {
      var kind = STOCK_CALC[c.key];
      if (!kind) return false;
      return !(kind === 'prev' && ri === stockOpeningRow());
    }
    /** 계산열인가 (행과 무관) — 기재 건수·필수 검증에서 빼야 한다 */
    function isCalcCol(c) { return !!STOCK_CALC[c.key]; }

    function stockNum(v) {
      var t = String(v == null ? '' : v).trim();
      if (!t) return null;
      var n = Number(t);
      return isFinite(n) ? n : null;
    }
    /** 0.1 씩 더하고 빼면 131.60000000000002 가 나온다 — 자리수를 고정한다 */
    function stockFix(n, dec) {
      var r = Number(n.toFixed(dec));
      return String(r);
    }

    /** 전일재고·현재 재고를 처음부터 다시 계산한다.
     *  - 휴무행은 건너뛴다. 그 날 재고는 움직이지 않으니 다음 기재일이 직전 기재일의
     *    현재 재고를 그대로 이어받는다(금요일 → 일요일).
     *  - 금일 입고·금일사용이 둘 다 빈 행은 채우지 않는다. 채우면 아직 아무것도
     *    적지 않은 날까지 기재된 것처럼 보인다. */
    function recalcStock() {
      if (!STOCK) return;
      var dec = STOCK.decimals == null ? 1 : Number(STOCK.decimals);
      var open = stockOpeningRow();
      (STOCK.chains || []).forEach(function (ch) {
        var carry = null;
        state.rows.forEach(function (r, i) {
          if (isRowDisabled(r)) return;
          if (i === open) {
            var o = stockNum(r[ch.prev]);
            if (o !== null) carry = o;
          } else {
            r[ch.prev] = carry === null ? '' : stockFix(carry, dec);
          }
          var got = stockNum(r[ch['in']]);
          var used = stockNum(r[ch.use]);
          if (got === null && used === null) {
            // 미기재 행 — 이어지는 재고(carry)는 그대로 두고 칸만 비운다
            if (i !== open) r[ch.prev] = '';
            r[ch.now] = '';
            return;
          }
          if (carry === null) { r[ch.now] = ''; return; }
          carry = Number((carry + (got || 0) - (used || 0)).toFixed(dec));
          r[ch.now] = stockFix(carry, dec);
        });
      });
    }

    /** 계산 결과를 표 전체를 다시 그리지 않고 그 칸에만 반영한다
     *  (다시 그리면 지금 치고 있던 칸에서 포커스가 튄다) */
    function syncCalcCells() {
      var host = $('ledgerGrid');
      if (!host || !STOCK) return;
      host.querySelectorAll('[data-calc]').forEach(function (el) {
        var r = state.rows[Number(el.getAttribute('data-r'))];
        el.value = r ? (r[el.getAttribute('data-c')] || '') : '';
      });
    }

    /** 터치 O/X 버튼 묶음 — 태블릿에서 드롭다운을 여닫지 않고 한 번에 찍는다 */
    function toggleInput(c, ri, v) {
      var choices = (c.choices || []).slice();
      // 예전 기록(적/부 등 지금 선택지에 없는 값)이 조용히 사라지지 않도록 그대로 보여준다
      if (v && choices.indexOf(v) === -1) choices.push(v);
      return '<div class="lgf-tg" role="group">' + choices.map(function (o) {
        return '<button type="button" class="lgf-tg-btn' + (v === o ? ' on' : '') +
          '" data-r="' + ri + '" data-tg="' + c.key + '" data-v="' + esc(o) + '"' +
          (c.toggleTone && c.toggleTone[o] ? ' data-tone="' + esc(c.toggleTone[o]) + '"' : '') + '>' + esc(o) + '</button>';
      }).join('') + '</div>';
    }

    function cellInput(c, ri, v, row) {
      if (c.readonly) {
        return '<span class="lgf-fixed">' + esc(v) + '</span>';
      }
      // 자동계산 칸(전일재고·현재 재고) — 값은 보이되 손으로 고칠 수 없다.
      // 계산으로 정해지는 값을 덧쓰게 두면 표 안에서 앞뒤가 안 맞는 기록이 남는다.
      if (isCalcCell(c, ri)) {
        return '<input type="text" class="lgf-calc" data-r="' + ri + '" data-c="' + c.key +
          '" data-calc="1" value="' + esc(v) + '" readonly tabindex="-1"' +
          ' aria-readonly="true" title="자동 계산 칸입니다 — 금일 입고·금일사용을 적으면 채워집니다">';
      }
      // 설비 종류에 따라 해당 없는 항목 칸을 회색 처리하고 입력을 막는다
      // (예: 포충등 행에서는 보행해충·설치류 칸이 해당 없음).
      if (c.enableIf && row && String(row[c.enableIf.field] || '').indexOf(c.enableIf.includes) === -1) {
        return '<input type="text" class="lgf-disabled" data-r="' + ri + '" data-c="' + c.key +
          '" value="" disabled aria-hidden="true">';
      }
      if (c.ui === 'toggle' && c.type === 'choice') {
        return toggleInput(c, ri, v);
      }
      if (c.type === 'choice') {
        return '<select data-r="' + ri + '" data-c="' + c.key + '">' +
          '<option value=""></option>' +
          (c.choices || []).map(function (o) {
            return '<option value="' + esc(o) + '"' + (v === o ? ' selected' : '') + '>' + esc(o) + '</option>';
          }).join('') + '</select>';
      }
      // combo — 자주 쓰는 품목을 목록에서 고르되 목록에 없는 것도 직접 칠 수 있다
      if (c.type === 'combo') {
        return '<input type="text" list="' + comboListId(c, row) + '" data-r="' + ri + '" data-c="' + c.key +
          '" value="' + esc(v) + '" placeholder="' + esc(c.placeholder || '선택/입력') + '">';
      }
      // allowDash — '-'(해당없음)도 적어야 하는 숫자 칸(예: 냉장차량 온도). number 칸은 글자를
      // 받지 못하므로 글자 칸으로 그리고, min~max 를 벗어난 숫자만 이탈 색(lgf-oor)을 입힌다.
      if (c.type === 'num' && c.allowDash) {
        return '<input type="text" inputmode="decimal" class="lgf-dashnum' + (isOutOfRange(c, v) ? ' lgf-oor' : '') +
          '" data-r="' + ri + '" data-c="' + c.key + '" value="' + esc(v) + '" placeholder="' + esc(c.unit || '') + '">';
      }
      var t = c.type === 'num' ? 'number' : (c.type === 'date' ? 'date' : 'text');
      // min/max 를 주면 브라우저가 :out-of-range 로 자동 강조한다(css/dkj-form.css) —
      // 관리기준이 확인된 숫자 칸에만 준다, 없는 칸은 그대로 자유 범위다.
      var range = (c.type === 'num' && (c.min != null || c.max != null))
        ? (c.min != null ? ' min="' + esc(c.min) + '"' : '') + (c.max != null ? ' max="' + esc(c.max) + '"' : '')
        : '';
      // staff — 등록된 사용자 목록(dkjStaffList)에서 고르되 직접 입력도 된다
      if (c.staff === true && t === 'text') {
        return '<input type="text" list="dkjStaffList" data-r="' + ri + '" data-c="' + c.key +
          '" value="' + esc(v) + '" placeholder="선택/입력">';
      }
      return '<input type="' + t + '" data-r="' + ri + '" data-c="' + c.key + '" value="' +
        esc(v) + '"' + range + ' placeholder="' + esc(c.unit || '') + '">';
    }

    /** 휴무일 행 — 잠기는 기재란은 하나로 합쳐 '휴무'만 표시한다. 칸마다 '휴무'를
        반복해 찍으면 가로로 긴 온도표에서 읽기가 더 나빠진다. 계속 기재하는 열
        (disableRowIf.keepGroups / keepColumns)은 평일과 똑같이 입력칸으로 남긴다. */
    function offRowCells(row, ri) {
      var label = esc(spec.disableRowIf.label || '휴무');
      // 잠긴 칸에 값이 있는 휴무행은 숨기지 않는다. 저장된 기록을 화면에서 지워
      // 보이게 하면 데이터는 남았는데 아무도 못 보는 상태가 된다.
      if (offRowHasValues(row)) {
        return COLS.map(function (c) {
          return '<td>' + (c.readonly || isColKept(c)
            ? cellInput(c, ri, row[c.key] || '', row)
            : '<span class="lgf-fixed">' + esc(row[c.key] || '') + '</span>') + '</td>';
        }).join('');
      }
      var out = '';
      var i = 0;
      while (i < COLS.length) {
        if (!isColOff(COLS[i])) {
          out += '<td' + (isColKept(COLS[i]) ? ' class="lgf-keep-cell"' : '') + '>' +
            cellInput(COLS[i], ri, row[COLS[i].key] || '', row) + '</td>';
          i++;
        } else {
          var j = i;
          while (j + 1 < COLS.length && isColOff(COLS[j + 1])) j++;
          out += '<td class="lgf-off-cell" colspan="' + (j - i + 1) + '">' +
            '<span class="lgf-off">' + label + '</span></td>';
          i = j + 1;
        }
      }
      return out;
    }

    /** combo 열이 참조하는 datalist id — choicesBy 가 있으면 다른 열의 값(예: 구분)에 따라 목록이 갈린다 */
    function comboListId(c, row) {
      if (c.choicesBy && row) {
        var sel = String(row[c.choicesBy.field] || '');
        if (c.choicesBy.map && c.choicesBy.map[sel] && c.choicesBy.map[sel].length) {
          return 'lgfList_' + c.key + '_' + Object.keys(c.choicesBy.map).indexOf(sel);
        }
      }
      return 'lgfList_' + c.key;
    }

    /** combo 열이 참조하는 <datalist> 를 표 앞에 한 번만 깐다 */
    function datalistHtml() {
      var out = '';
      function one(id, list) {
        if (!list || !list.length) return;
        out += '<datalist id="' + id + '">' + list.map(function (o) {
          return '<option value="' + esc(o) + '"></option>';
        }).join('') + '</datalist>';
      }
      COLS.filter(function (c) { return c.type === 'combo'; }).forEach(function (c) {
        // customLabel — 목록 끝에 '직접 입력' 항목을 붙인다(고르면 칸이 비워져 바로 칠 수 있다)
        one('lgfList_' + c.key, c.customLabel ? (c.choices || []).concat([c.customLabel]) : c.choices);
        if (c.choicesBy && c.choicesBy.map) {
          Object.keys(c.choicesBy.map).forEach(function (k, i) {
            one('lgfList_' + c.key + '_' + i, c.choicesBy.map[k]);
          });
        }
      });
      return out;
    }

    /** autoFillByChoice — 값을 고르면 정해진 점검 칸을 한 번에 채운다('*' 는 어떤 값이든).
        고른 직후에만 적용하므로 저장된 기록을 열 때는 값이 바뀌지 않고, 이후 손으로 고칠 수 있다. */
    function applyAutoFill(key, ri, value) {
      var done = false;
      if (state.locked || !String(value || '').trim()) return false;
      (spec.autoFillByChoice || []).forEach(function (af) {
        if (af.on !== key) return;
        var vals = af.values && (af.values[value] || af.values['*']);
        if (!vals) return;
        Object.keys(vals).forEach(function (fk) {
          // keepIfSet — 사람이 이미 적은 칸(예: 측정한 차량 온도)은 덮어쓰지 않는다
          if ((af.keepIfSet || []).indexOf(fk) !== -1 && String(state.rows[ri][fk] || '').trim()) return;
          state.rows[ri][fk] = vals[fk];
        });
        done = true;
      });
      return done;
    }

    /** autoSetByValue — 값을 고르면 다른 선택 칸을 정해진 값으로 바꾼다(예: 업체명 → 구분).
        바뀐 구분에 autoFillByChoice 가 있으면 구분을 직접 고른 것과 같이 점검 칸도 채운다.
        고른 직후에만 적용하고, 이미 같은 값이면 아무것도 건드리지 않는다. */
    function applyAutoSet(key, ri, value) {
      var changed = false;
      if (state.locked || !String(value || '').trim()) return false;
      (spec.autoSetByValue || []).forEach(function (as) {
        if (as.on !== key) return;
        var vals = as.values && as.values[value];
        if (!vals) return;
        Object.keys(vals).forEach(function (fk) {
          if (state.rows[ri][fk] === vals[fk]) return;
          state.rows[ri][fk] = vals[fk];
          applyAutoFill(fk, ri, vals[fk]);
          changed = true;
        });
      });
      return changed;
    }

    /** allowDash 숫자 칸의 관리기준 이탈 여부 — '-'·빈칸·숫자가 아닌 글자는 이탈이 아니다 */
    function isOutOfRange(c, v) {
      var n = parseFloat(v);
      if (isNaN(n) || !/^\s*-?\d/.test(String(v))) return false;
      return (c.min != null && n < c.min) || (c.max != null && n > c.max);
    }

    /** scrollToToday — 한 달 시트에서 오늘 일자 행의 위치(없으면 -1). 시트의 점검 월이 이번 달일 때만 찾는다.
     *  지난달 시트를 열었는데 같은 번호의 날을 오늘로 강조하면 틀린 행을 가리키게 된다. */
    function todayRowIndex() {
      var cfg = spec.scrollToToday && spec.autoWeekday;
      if (!cfg || normMonth(state.info[cfg.monthField]) !== thisMonth()) return -1;
      var day = new Date().getDate();
      for (var i = 0; i < state.rows.length; i++) {
        if (Number(String(state.rows[i][cfg.dayKey] || '').replace(/\D/g, '')) === day) return i;
      }
      return -1;
    }
    var todayScrolled = false;
    /** 화면을 연 뒤 한 번만, 오늘 행이 화면 가운데 오도록 스크롤한다. 아래쪽 영역이 늦게 그려져 한 번에
     *  못 닿는 경우가 있어, 행이 실제로 화면에 들어올 때까지 확인하며 재시도한다. 사용자가 직접
     *  스크롤·터치하거나 칸에 입력 중이면 즉시 멈춘다. */
    function scrollToTodayOnce() {
      if (todayScrolled || todayRowIndex() < 0) return;
      todayScrolled = true;
      var tries = 0, stop = false;
      function cancel() { stop = true; }
      ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (ev) {
        global.addEventListener(ev, cancel, { once: true, passive: true });
      });
      (function attempt() {
        if (stop) return;
        var ae = document.activeElement;
        if (ae && ae.closest && ae.closest('#ledgerGrid')) return;
        var tr = document.querySelector('#ledgerGrid tr.lgf-row-today');
        if (tr && tr.offsetParent !== null) {
          var r = tr.getBoundingClientRect();
          if (r.top >= 0 && r.bottom <= global.innerHeight) { if (tries > 0) return; }
          tr.scrollIntoView({ block: 'center' });
        }
        if (++tries < 20) global.setTimeout(attempt, 400);
      })();
    }

    /** mergeKeys 열의 세로 병합 길이 — 묶음의 첫 행이면 길이, 이미 위 행에 합쳐진 행이면 0, 합치지 않으면 1 */
    function mergeSpan(rows, c, i, from, to) {
      if (!c || (spec.mergeKeys || []).indexOf(c.key) === -1) return 1;
      var v = String(rows[i][c.key] || '').trim();
      if (!v) return 1;
      if (i > from && String(rows[i - 1][c.key] || '').trim() === v) return 0;
      var n = 1;
      while (i + n < to && String(rows[i + n][c.key] || '').trim() === v) n++;
      return n;
    }

    function renderGrid() {
      var host = $('ledgerGrid');
      if (!host) return;
      var todayIdx = todayRowIndex();
      var thead = global.DkjLedgerPrint
        ? global.DkjLedgerPrint.theadHtml(
            FIXED_ROWS ? COLS : COLS.concat([{ key: '__act', label: '' }]))
        : '';
      var body = state.rows.map(function (r, ri) {
        var cells = isRowDisabled(r)
          ? offRowCells(r, ri)
          : COLS.map(function (c) {
              // mergeKeys — 같은 값이 이어지는 미리 인쇄된 칸(작업실 등)은 세로로 합쳐 한 번만 보여준다.
              var span = mergeSpan(state.rows, c, ri, 0, state.rows.length);
              if (span === 0) return '';
              return '<td' + (span > 1 ? ' rowspan="' + span + '" class="lgf-merged"' : '') + '>' +
                cellInput(c, ri, r[c.key] || '', r) + '</td>';
            }).join('');
        var trCls = (isRowDisabled(r) ? 'lgf-row-off' : '') + (ri === todayIdx ? ' lgf-row-today' : '');
        return '<tr' + (trCls.trim() ? ' class="' + trCls.trim() + '"' : '') + '>' + cells +
          (FIXED_ROWS ? '' :
            '<td class="lgf-act"><button type="button" class="lgf-del" data-del="' + ri +
            '">삭제</button></td>') + '</tr>';
      }).join('');
      host.innerHTML = datalistHtml() +
        '<table class="lgf-table"><thead>' + thead + '</thead><tbody>' + body + '</tbody></table>';

      // 숫자 칸(온도 등)에 포커스가 있는 상태로 마우스 휠을 굴리면 브라우저가 값을
      // 슬쩍 올리고 내린다 — 표를 스크롤하려던 손짓이 값을 조용히 바꿔 버려서
      // 위험하다(2026-09-11 현장 지적). 스피너 화살표 클릭은 그대로 두고 휠만 막는다.
      host.querySelectorAll('input[type="number"]').forEach(function (el) {
        el.addEventListener('wheel', function (e) {
          if (document.activeElement === el) e.preventDefault();
        }, { passive: false });
      });

      host.querySelectorAll('[data-r]').forEach(function (el) {
        var ev = el.tagName === 'SELECT' ? 'change' : 'input';
        el.addEventListener(ev, function () {
          var key = el.getAttribute('data-c');
          var ri = Number(el.getAttribute('data-r'));
          // '직접 입력'을 고르면 글자를 남기지 않고 비운 채 그 칸에 바로 입력하게 한다
          var keyCol = COLS.filter(function (cc) { return cc.key === key; })[0];
          if (keyCol && keyCol.customLabel && el.value === keyCol.customLabel) {
            el.value = '';
            el.focus();
          }
          var prevVal = state.rows[ri][key];
          state.rows[ri][key] = el.value;
          if (keyCol && keyCol.allowDash) el.classList.toggle('lgf-oor', isOutOfRange(keyCol, el.value));
          // autoStaff 열(반출자명 등)은 비어 있으면 맨 위 점검자로 채운다. 사람이 고른 값은 덮어쓰지 않는다.
          COLS.forEach(function (ac) {
            if (!ac.autoStaff || ac.key === key) return;
            if (String(state.rows[ri][ac.key] || '').trim()) return;
            var who = state.info && state.info.inspector;
            if (!who) return;
            state.rows[ri][ac.key] = who;
            var at = host.querySelector('[data-r="' + ri + '"][data-c="' + ac.key + '"]');
            if (at) at.value = who;
          });
          if (STOCK_INPUT[key]) { recalcStock(); syncCalcCells(); }
          // autoFillByChoice — 구분(박스 등)을 고르면 정해진 점검 칸을 한 번에 채운다.
          // 고른 직후에만 적용하므로 저장된 기록을 열 때는 값이 바뀌지 않고, 이후 손으로 고칠 수 있다.
          // autoSetByValue — 업체명 등을 고르면 구분 같은 다른 선택 칸을 함께 정한다(값이 바뀔 때만).
          var setOther = applyAutoSet(key, ri, el.value);
          var filled = (el.tagName === 'SELECT' && applyAutoFill(key, ri, el.value)) || setOther;
          if (filled || (el.tagName === 'SELECT' && COLS.some(function (cc) {
            return cc.choicesBy && cc.choicesBy.field === key;
          }))) { renderGrid(); scheduleDraft(); return; }
          // autoJudge — 측정값을 적으면 기준치(고시·사내 중 더 높은 값) 이상 여부로 판정 칸을 채운다.
          // 입력 직후에만 계산하므로 저장된 기록을 열어도 값이 바뀌지 않고, 판정은 손으로 고칠 수 있다.
          // autoJudgeRanges — 열마다 허용 범위(min~max 포함)가 정해진 서식(예: 작업장 온도 일보).
          (spec.autoJudgeRanges || []).forEach(function (rg) {
            if (rg.valueKey !== key) return;
            var rv = parseFloat(el.value);
            var rverdict = '';
            if (!isNaN(rv) && String(el.value).trim() !== '') {
              rverdict = (rv >= rg.min && rv <= rg.max) ? (rg.pass || '적') : (rg.fail || '부');
            }
            state.rows[ri][rg.target] = rverdict;
            var rt = host.querySelector('[data-r="' + ri + '"][data-c="' + rg.target + '"]');
            if (rt) rt.value = rverdict;
          });
          var aj = spec.autoJudge;
          if (aj && key === aj.valueKey) {
            var nums = [];
            (aj.stdKeys || []).forEach(function (sk) {
              var m = String(state.rows[ri][sk] || '').match(/\d+(?:\.\d+)?/);
              if (m) nums.push(parseFloat(m[0]));
            });
            var val = parseFloat(el.value);
            var verdict = '';
            if (nums.length && !isNaN(val) && String(el.value).trim() !== '') {
              verdict = val >= Math.max.apply(null, nums) ? aj.pass : aj.fail;
            }
            state.rows[ri][aj.target] = verdict;
            var jt = host.querySelector('[data-r="' + ri + '"][data-c="' + aj.target + '"]');
            if (jt) jt.value = verdict;
          }
          if (spec.autoDateRange && key === spec.autoDateRange.dateKey) {
            applyAutoDateRange();
            renderInfo();
          }
          // 예: 입고일자를 적으면 제조일자(소비기한) 칸·로트번호 칸에 같은 날짜를
          // 한 번 채워 준다(형식은 cfg.format 으로 바꿀 수 있다 — 예: 로트번호는
          // 'yyyymmdd'). 실제로는 다른 값으로 고쳐야 하는 경우가 많아 그대로 두지
          // 않고 손으로 고칠 수 있어야 하므로, 이미 값(자동이든 수동이든)이 있는
          // 칸은 절대 덮어쓰지 않는다. 전체를 다시 그리면(renderGrid) 지금 입력
          // 중이던 칸의 포커스가 날아가므로 그 칸 하나만 DOM 에서 직접 갱신한다.
          (spec.autoCopyColumns || []).forEach(function (cfg) {
            if (cfg.from !== key) return;
            // sync: 대상 칸이 비었거나 아직 이전 원본값 그대로(=자동으로 따라온 값)이면 계속 따라간다.
            // 사람이 따로 고친 값은 덮어쓰지 않는다. (예: 폐기물량 → 반출량)
            var curTo = String(state.rows[ri][cfg.to] || '').trim();
            if (curTo && !(cfg.sync && curTo === String(prevVal || '').trim())) return;
            var v = cfg.format === 'yyyymmdd' ? String(el.value || '').replace(/[^0-9]/g, '') : el.value;
            state.rows[ri][cfg.to] = v;
            var target = host.querySelector('[data-r="' + ri + '"][data-c="' + cfg.to + '"]');
            if (target) target.value = v;
          });
          scheduleDraft();
        });
      });
      // 글자 칸(combo)은 한 글자마다 채우면 입력 중 칸이 다시 그려지므로, 고르거나 입력을 마친 뒤(change)에만 채운다
      host.querySelectorAll('input[data-r][data-c]').forEach(function (el) {
        el.addEventListener('change', function () {
          if (applyAutoFill(el.getAttribute('data-c'), Number(el.getAttribute('data-r')), el.value)) {
            renderGrid();
            scheduleDraft();
          }
        });
      });
      host.querySelectorAll('[data-tg]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (state.locked) return;
          var row = state.rows[Number(b.getAttribute('data-r'))];
          var key = b.getAttribute('data-tg');
          var val = b.getAttribute('data-v');
          // 같은 버튼을 다시 누르면 해제 — 잘못 찍었을 때 지우는 유일한 방법이다
          row[key] = row[key] === val ? '' : val;
          renderGrid();
          scheduleDraft();
        });
      });
      host.querySelectorAll('[data-del]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (state.locked) return;
          state.rows.splice(Number(b.getAttribute('data-del')), 1);
          if (!state.rows.length) state.rows.push(emptyRow(spec));
          renderGrid();
          scheduleDraft();
        });
      });
      applyLock();
      scrollToTodayOnce();
    }

    /** 하단 부가 기재표(spec.extraTable) — 예: 방충방서 카트리지 교체일자·교체 수량·파손 개수 */
    function renderExtra() {
      var host = $('extraGrid');
      if (!host || !spec.extraTable) return;
      var cfg = spec.extraTable;
      var cols = cfg.columns || [];
      if (!Array.isArray(state.extraRows)) state.extraRows = [];
      // 옛 기록(이 표가 생기기 전)이나 행이 모자란 기록도 기본 행 수까지 채워 보여 준다.
      while (state.extraRows.length < (cfg.rows || 4)) state.extraRows.push({});
      var head = '<tr>' + cols.map(function (c) {
        return '<th' + (c.width ? ' style="width:' + c.width + '"' : '') + '>' + esc(c.label) + '</th>';
      }).join('') + '</tr>';
      var body = state.extraRows.map(function (r, i) {
        return '<tr>' + cols.map(function (c) {
          var t = c.type === 'num' ? 'number' : (c.type === 'date' ? 'date' : 'text');
          return '<td><input type="' + t + '"' + (t === 'number' ? ' min="0" step="1" inputmode="numeric"' : '') +
            ' data-ex="' + i + '" data-ck="' + c.key + '" value="' + esc(r[c.key] || '') + '"></td>';
        }).join('') + '</tr>';
      }).join('');
      host.innerHTML = '<h3 style="margin:0 0 6px;font-size:14px;">' + esc(cfg.label || '') + '</h3>' +
        '<table class="mxf-inc"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
      host.querySelectorAll('[data-ex]').forEach(function (el) {
        el.addEventListener('input', function () {
          if (state.locked) return;
          state.extraRows[Number(el.getAttribute('data-ex'))][el.getAttribute('data-ck')] = el.value;
          scheduleDraft();
        });
      });
      applyLock();
    }

    function renderIncidents() {
      var host = $('incidentGrid');
      if (!host || !spec.incident) return;
      var cols = spec.incident.columns || [];
      var head = '<tr>' + cols.map(function (c) {
        return '<th' + (c.width ? ' style="width:' + c.width + '"' : '') + '>' + esc(c.label) + '</th>';
      }).join('') + '</tr>';
      var body = state.incidents.map(function (r, i) {
        return '<tr>' + cols.map(function (c) {
          var isStaff = c.key === 'actor' || c.key === 'confirmer' || c.key === 'writer';
          return '<td><input type="text"' + (isStaff ? ' list="dkjStaffList" placeholder="선택/입력"' : '') +
            ' data-inc="' + i + '" data-ck="' + c.key +
            '" value="' + esc(r[c.key] || '') + '"></td>';
        }).join('') + '</tr>';
      }).join('');
      host.innerHTML = '<table class="mxf-inc"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
      host.querySelectorAll('[data-inc]').forEach(function (el) {
        el.addEventListener('input', function () {
          state.incidents[Number(el.getAttribute('data-inc'))][el.getAttribute('data-ck')] = el.value;
          scheduleDraft();
        });
      });
    }

    function applyLock() {
      var host = document.querySelector('.dkj-form-body');
      if (!host) return;
      host.classList.toggle('is-locked', !!state.locked);
      host.querySelectorAll('#ledgerGrid input, #ledgerGrid select, #ledgerGrid button, '
        + '#infoFields input, #infoFields select, #incidentGrid input, #extraGrid input')
        .forEach(function (el) { el.disabled = !!state.locked; });
      // 잠금 해제 시에도 서식상 읽기전용인 칸은 계속 막아 둔다
      renderPhotos();
      host.querySelectorAll('#infoFields [data-fixed]').forEach(function (el) { el.disabled = true; });
      ['btnBulkOk', 'btnBulkNg'].forEach(function (id) {
        if ($(id)) $(id).disabled = !!state.locked;
      });
    }

    function filledRows() {
      // 서식에 미리 인쇄된 칸(구역·점검항목·고정 수거업체 등)과 휴무일 행은 '기재됨'으로
      // 세지 않는다. 세면 아무것도 안 쓴 시트가 검증을 통과하고 건수도 부풀려진다.
      // 자동계산 칸(전일재고·현재 재고)도 사람이 적은 것이 아니라 세지 않는다
      var inputCols = COLS.filter(function (c) { return !c.readonly && !isCalcCol(c); });
      var cols = inputCols.length ? inputCols : COLS;
      return state.rows.filter(function (r) {
        // 휴무행은 계속 기재하는 열(냉장창고 등)에 값이 있을 때만 센다
        var use = isRowDisabled(r) ? cols.filter(isColKept) : cols;
        return use.some(function (c) { return String(r[c.key] || '').trim(); });
      });
    }

    function applyBulkChoice(value) {
      var keys = spec.bulkChoiceKeys || [];
      if (state.locked || !keys.length) return;
      var byKey = {};
      COLS.forEach(function (c) { byKey[c.key] = c; });
      state.rows.forEach(function (row) {
        var off = isRowDisabled(row);
        keys.forEach(function (key) {
          // 휴무행에서는 계속 기재하는 열에만 넣는다 — 잠긴 칸을 채우면 안 된다
          if (off && !isColKept(byKey[key])) return;
          row[key] = value;
        });
      });
      renderGrid();
      scheduleDraft();
      // bulkChoiceLabel — 서식마다 문구가 다르다(예: DKJ-S-02-05 "냉장창고 적/부 전체",
      // DKJ-S-02-04 "점검결과 전체"). 지정 안 하면 그냥 "전체"로 표시한다.
      setStatus((spec.bulkChoiceLabel || '전체') + ' ' + value + ' 입력됨', false);
    }

    /** quickFillColumns — 비고처럼 자유 서술칸을 "이상없음" 등으로 한 번에 채운다.
     *  applyBulkChoice 와 달리 이미 값이 있는 칸은 건드리지 않고(사람이 적은 개별
     *  메모를 지우면 안 된다), 다른 칸도 전부 빈 완전 공백 행(아직 쓰지 않은 여분
     *  행)도 건너뛴다 — 실제로 점검하지 않은 날짜까지 "이상없음"으로 채우면 기록
     *  조작이 된다. */
    function applyQuickFillColumn(key, value) {
      if (state.locked) return;
      var filled = 0;
      state.rows.forEach(function (row) {
        if (isRowDisabled(row)) return;
        if (String(row[key] || '').trim()) return;
        var hasOther = Object.keys(row).some(function (k) { return k !== key && String(row[k] || '').trim(); });
        if (!hasOther) return;
        row[key] = value;
        filled++;
      });
      renderGrid();
      scheduleDraft();
      setStatus((filled ? filled + '행에 "' + value + '" 채움' : '채울 빈 칸 없음'), false);
    }

    /** 화면의 기본정보 칸 값을 state.info 로 되가져온다.
     *  dkj-approval.js 의 attachStaffPickers() 는 '점검자' 칸을 직원 <select> 로 바꾸면서
     *  로그인한 사람을 select.value 로 미리 선택하는데, 프로그램이 값을 넣은 것이라
     *  change 이벤트가 뜨지 않아 위임 리스너가 state.info 를 갱신하지 못한다. 그러면 화면에는
     *  이름이 보이는데 검증은 '점검자을(를) 입력하세요'로 막힌다(2026-10-01 현장 제보).
     *  비어 있지 않은 칸만 덮는다 — 화면이 아직 안 그려진 상태에서 state 를 지우면 안 된다. */
    function syncInfoFromDom() {
      var host = $('infoFields') || document;
      Array.prototype.forEach.call(host.querySelectorAll('[data-info]'), function (el) {
        var id = el.getAttribute('data-info');
        if (el.value && el.value !== '__custom__' && state.info[id] !== el.value) state.info[id] = el.value;
      });
    }

    function validate() {
      syncInfoFromDom();
      if (!state.approvals.writer) return '작성자를 입력하세요.';
      var req = (spec.infoFields || []).filter(function (f) { return f.required; });
      for (var i = 0; i < req.length; i++) {
        if (!state.info[req[i].id]) return req[i].label + '을(를) 입력하세요.';
      }
      if (!filledRows().length) return '최소 1건 이상 기록하세요.';
      var reqCols = COLS.filter(function (c) { return c.required; });
      var bad = filledRows().find(function (r) {
        // 휴무행은 계속 기재하는 열만 필수로 본다 — 잠근 칸을 채우라고 할 수는 없다
        var use = isRowDisabled(r) ? reqCols.filter(isColKept) : reqCols;
        return use.some(function (c) { return !String(r[c.key] || '').trim(); });
      });
      if (bad) return '기재한 행의 필수 항목(' +
        reqCols.map(function (c) { return c.label; }).join(', ') + ')을 채우세요.';
      return '';
    }

    var saveInFlight = false;
    async function save(lock) {
      if (saveInFlight) return;
      saveInFlight = true;
      try {
        var err = validate();
        if (err) { alert(err); return; }
        // 대기 중인 임시저장 타이머를 지운다 — 안 지우면 저장 직후 "저장됨"이 잠깐
        // 떴다가 그 타이머가 뒤늦게 "임시저장"으로 덮어써 버린다.
        clearTimeout(draftTimer);
        state.locked = !!lock;
        (await mergeFromStored(Date.now()));
        if (sheetApi() && !state.cellStamps) state.cellStamps = {};
        var first = (spec.infoFields || [])[0];
        var rec = (await DkjRecordStore.save(FORM_ID, Object.assign({}, state, {
          id: editingId || undefined,
          title: (first ? (state.info[first.id] || '') : '') + ' · ' + filledRows().length + '건',
          judge: '기록'
        })));
        editingId = rec.id;
        setBase();
        setStatus(lock ? '작성완료 저장됨' : '저장됨', true);
        applyLock();
        refreshApproval();
        (await renderHistory());
      } finally { saveInFlight = false; }
    }

    async function renderHistory() {
      var el = $('historyList');
      if (!el) return;
      var list = (await DkjRecordStore.list(FORM_ID)).slice(0, 12);
      if (!list.length) {
        el.innerHTML = '<p style="color:#888;font-size:13px;">저장 기록 없음</p>';
        return;
      }
      el.innerHTML = list.map(function (r) {
        return '<div class="dkj-history-item"><div><strong>' + esc(r.title || '') + '</strong>' +
          (r.locked ? ' <span class="badge done">잠금</span>' : '') + '</div>' +
          '<div style="display:flex;gap:6px;">' +
          '<button type="button" class="pill-btn ghost" data-load="' + r.id + '">불러오기</button>' +
          '<button type="button" class="pill-btn ghost" data-del2="' + r.id + '">삭제</button></div></div>';
      }).join('');
      el.querySelectorAll('[data-load]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var r = (await DkjRecordStore.get(FORM_ID, b.getAttribute('data-load')));
          if (!r) return;
          editingId = r.id;
          state = Object.assign(emptyState(spec), r);
          setBase();
          writeForm();
          setStatus('기록 불러옴', true);
        });
      });
      el.querySelectorAll('[data-del2]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('삭제할까요?')) return;
          (await DkjRecordStore.remove(FORM_ID, b.getAttribute('data-del2')));
          (await renderHistory());
        });
      });
    }

    function writeForm() {
      ['writer', 'reviewer', 'approver'].forEach(function (k) {
        if ($(k)) $(k).value = state.approvals[k] || '';
      });
      if ($('remark')) $('remark').value = state.remark || '';
      // 점검자가 있는데 작성자가 비어 있으면(옛 기록·새 일보) 점검자로 맞춘다.
      if (!state.approvals.writer && state.info && state.info.inspector) {
        state.approvals.writer = state.info.inspector;
        if ($('writer')) $('writer').value = state.approvals.writer;
      }
      applyAutoDateRange();
      renderInfo();
      applyAutoWeekday();
      renderGrid();
      renderIncidents();
      renderExtra();
      renderPhotos();
      refreshApproval();
    }

    /** spec.photoSection — 촬영본(온도기록지 등)을 state.photos(data URL 배열)에 담는다.
        정본 인쇄(dkj-ledger-print.js)가 별첨 쪽에 크게 싣는다. */
    function renderPhotos() {
      var host = $('photoGrid');
      var cfg = spec.photoSection;
      if (!host || !cfg) return;
      var max = cfg.max || 3;
      if (!Array.isArray(state.photos)) state.photos = [];
      var cards = state.photos.map(function (src, i) {
        return '<div class="lgf-photo-card"><img src="' + esc(src) + '" alt="' + esc(cfg.title) + ' ' + (i + 1) + '">' +
          '<button type="button" class="pill-btn ghost" data-photo-del="' + i + '"' +
          (state.locked ? ' disabled' : '') + '>삭제</button></div>';
      }).join('');
      var add = state.photos.length < max
        ? '<label class="pill-btn green lgf-photo-add">📷 사진 촬영·선택' +
          '<input type="file" accept="image/*" capture="environment" id="photoInput" hidden' +
          (state.locked ? ' disabled' : '') + '></label>'
        : '<span style="color:#888;font-size:12px;">최대 ' + max + '장까지 첨부할 수 있습니다.</span>';
      host.innerHTML = '<div class="lgf-photo-row">' + cards + '</div><div style="margin-top:8px;">' + add + '</div>';
      var inp = $('photoInput');
      if (inp) inp.addEventListener('change', function () {
        var file = inp.files && inp.files[0];
        if (!file || state.locked) return;
        var apply = function (dataUrl) {
          state.photos.push(dataUrl);
          renderPhotos();
          scheduleDraft();
        };
        // 기록지 글씨가 읽혀야 하므로 소독수 시험지(600px)보다 크게 줄인다
        if (global.DkjUtil && global.DkjUtil.compressImageToDataUrl) {
          global.DkjUtil.compressImageToDataUrl(file, apply, { maxDim: 1400, quality: 0.7 });
        } else {
          var reader = new FileReader();
          reader.onload = function (e) { apply(e.target.result); };
          reader.readAsDataURL(file);
        }
      });
      host.querySelectorAll('[data-photo-del]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (state.locked) return;
          state.photos.splice(Number(b.getAttribute('data-photo-del')), 1);
          renderPhotos();
          scheduleDraft();
        });
      });
    }

    function doPrint() {
      var sheet = $('printSheet');
      sheet.innerHTML = global.DkjLedgerPrint.render(spec, state);
      setTimeout(function () { window.print(); }, 120);
    }

    /** autoWeekday 서식(월 단위로 누적 입력하는 대장)에서만 보이는 경고 —
     *  "작성완료"가 오늘 하루가 아니라 그 달 시트 전체를 잠근다는 걸 모르고 매일
     *  누르다가 다음 날 입력이 막히는 문의가 반복됐다(2026-09-23). js/dkj-util.js
     *  의 explainSaveButtons()가 모든 서식에 붙이는 일반 안내(저장/작성완료 차이)
     *  만으로는 "월 전체가 잠긴다"는 이 서식 특유의 위험이 전달되지 않아 별도로
     *  둔다. 태블릿은 hover가 없어 title 툴팁 대신 항상 보이는 문구로 붙인다. */
    function renderMonthlyLockWarning() {
      if (!spec.autoWeekday) return;
      var toolbar = document.querySelector('.dkj-form-toolbar');
      if (!toolbar || toolbar.querySelector('.dkj-lock-warn')) return;
      var el = document.createElement('div');
      el.className = 'dkj-lock-warn';
      el.textContent = '⚠ 작성완료는 오늘 하루가 아니라 이번 달 시트 전체를 잠급니다 — ' +
        '월말 마지막 입력을 마친 뒤에만 눌러주세요. 매일 입력 후에는 "저장"만 누르면 됩니다.';
      toolbar.appendChild(el);
    }

    async function bind() {
      // writer/reviewer/approver 도 dkj-approval.js 의 직원 자동선택이 <select>로
      // 바꿔치기한다 — renderInfo() 와 같은 이유로 개별 요소 리스너 대신 document 위임
      // 리스너를 쓴다(요소가 나중에 통째로 바뀌어도 계속 잡힌다).
      ['writer', 'reviewer', 'approver'].forEach(function (k) {
        document.addEventListener('input', function (e) {
          if (e.target && e.target.id === k) {
            state.approvals[k] = e.target.value;
            scheduleDraft();
            global.dispatchEvent(new CustomEvent('dkj:approval-changed'));
          }
        });
        document.addEventListener('change', function (e) {
          if (e.target && e.target.id === k) {
            state.approvals[k] = e.target.value;
            scheduleDraft();
            global.dispatchEvent(new CustomEvent('dkj:approval-changed'));
          }
        });
      });
      if ($('remark')) $('remark').addEventListener('input', function () {
        state.remark = this.value; scheduleDraft();
      });
      if ($('btnAddRow')) $('btnAddRow').addEventListener('click', function () {
        if (state.locked) return;
        state.rows.push(emptyRow(spec));
        renderGrid();
        scheduleDraft();
      });
      // bulkChoiceValues — 지정 안 하면 기존 냉장창고 온도(DKJ-S-02-05) 그대로 '적'/'부'.
      // O/X 판정 서식(예: DKJ-S-02-04)은 spec에서 ['O'] 처럼 하나만 줄 수 있다(btnBulkNg는
      // 그 서식 HTML에 아예 없으면 자동으로 안 붙는다).
      var bulkValues = spec.bulkChoiceValues || ['적', '부'];
      if ($('btnBulkOk')) $('btnBulkOk').addEventListener('click', function () { applyBulkChoice(bulkValues[0]); });
      if ($('btnBulkNg') && bulkValues[1]) $('btnBulkNg').addEventListener('click', function () { applyBulkChoice(bulkValues[1]); });
      document.querySelectorAll('[data-quickfill]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          applyQuickFillColumn(btn.getAttribute('data-quickfill'), btn.getAttribute('data-quickfill-value'));
        });
      });
      if ($('btnSave')) $('btnSave').addEventListener('click', async function () { (await save(false)); });
      if ($('btnLock')) $('btnLock').addEventListener('click', async function () { (await save(true)); });
      if ($('btnNew')) $('btnNew').addEventListener('click', function () {
        editingId = null; state = emptyState(spec); writeForm(); setStatus('새 시트', false);
      });
      if ($('btnPrint')) $('btnPrint').addEventListener('click', doPrint);
      if (global.DkjUtil) {
        (await global.DkjUtil.attachQuickToolbar($('btnSave') ? $('btnSave').parentNode : null, {
          formId: FORM_ID,
          hasChecks: false,
          onClonePrev: function (cloned) {
            if (state.locked) return;
            state = Object.assign(emptyState(spec), cloned);
            editingId = null;
            writeForm();
            scheduleDraft();
          }
        }));
        global.DkjUtil.attachChips(document);
      }
    }

    /* 일자별 기록 자동 불러오기(js/dkj-date-autoload.js) — 달력·콘솔의 ?date= 링크로 들어오거나
       일자(월) 칸을 바꾸면 그 날짜가 속한 기록을 연다. '같은 날짜'의 뜻은 서식마다 다르다:
         월 단위 시트(autoWeekday)  → 같은 달의 시트
         dateLoad:'month'|'week'    → 같은 달·같은 주에 작성한 기록(주·월 점검)
         그 밖                      → 점검일자가 정확히 같은 기록 */
    var DATE_ID = spec.autoWeekday ? spec.autoWeekday.monthField
      : ((spec.infoFields || []).filter(function (f) { return f.type === 'date'; })[0] || {}).id;
    var DATE_MATCH = null;
    if (global.DkjDateLoad && DATE_ID) {
      DATE_MATCH = spec.autoWeekday ? DkjDateLoad.match.byMonth(DATE_ID)
        : (spec.dateLoad === 'month' || spec.dateLoad === 'week') ? DkjDateLoad.match.byPeriod(DATE_ID, spec.dateLoad)
        : DkjDateLoad.match.byField(DATE_ID);
    }
    function stateForDate(date) {
      var st = emptyState(spec);
      st.info[DATE_ID] = spec.autoWeekday ? date.slice(0, 7) : date;
      return st;
    }
    /** 화면을 건드리지 않고 그 날짜의 상태를 고른다: {state, editingId, kind} 또는 null(해당 기록 없음) */
    async function pickForDate(date) {
      var hit = (await DkjDateLoad.resolve(FORM_ID, date, DATE_MATCH));
      if (hit.kind === 'none') return null;
      return { state: Object.assign(emptyState(spec), hit.data), editingId: hit.data.id || null, kind: hit.kind };
    }
    async function loadForDate(date) {
      if (!DATE_MATCH) return false;
      var picked = (await pickForDate(date));
      if (!picked || (picked.kind === 'record' && picked.editingId && picked.editingId === editingId)) return false;
      // 아직 저장하지 않은 새 입력이 있으면 덮어쓰기 전에 확인한다.
      if (!editingId && JSON.stringify(state.rows) !== JSON.stringify(emptyState(spec).rows) &&
          !confirm(date + ' 저장 기록을 불러오면 지금 입력 중인 내용은 사라집니다. 불러올까요?')) return false;
      editingId = picked.editingId;
      state = picked.state;
      setBase();
      writeForm();
      setStatus(picked.kind === 'record' ? date + ' 저장 기록 불러옴' : date + ' 임시저장 불러옴', true);
      return true;
    }

    async function init() {
      var draft = (await DkjRecordStore.loadDraft(FORM_ID));
      if (draft) state = Object.assign(emptyState(spec), draft);
      // ?date= 진입 — 월 시트는 '이번 달'이면 아래 기존 이어쓰기(잠긴 기록은 새 시트)가 맡는다.
      var dateHandled = false;
      var qd = DATE_MATCH ? DkjDateLoad.queryDate() : '';
      if (qd && !(spec.autoWeekday && qd.slice(0, 7) === thisMonth())) {
        dateHandled = true;
        var first = (await pickForDate(qd));
        if (first) { editingId = first.editingId; state = first.state; setBase(); }
        else { editingId = null; state = stateForDate(qd); }
      }
      writeForm();
      mountApproval();
      (await bind());
      renderMonthlyLockWarning();
      (await renderHistory());
      if (global.DkjUtil) {
        global.DkjUtil.autoFillUser(state.approvals, ['writer', 'reviewer', 'approver'], function () {
          writeForm();
        });
      }
      setStatus('준비', false);
      // 기록보관함에서 ?record=<id> 로 들어온 경우 그 기록을 띄운다(임시저장분보다 우선)
      var opened = null;
      if (global.DkjDeepLink) {
        opened = (await DkjDeepLink.apply(FORM_ID, function (rec) {
          editingId = rec.id;
          state = Object.assign(emptyState(spec), rec);
          setBase();
          writeForm();
        }));
        if (opened) setStatus('기록 불러옴', true);
      }
      // 월 단위로 여러 날에 걸쳐 누적 입력하는 서식은, 임시저장(draft)·딥링크가 없으면
      // 저장할 때마다 draft 가 지워지는 탓에(DkjRecordStore.save) 다시 열 때마다 빈 시트로
      // 시작했다 — 기기를 바꿔 열거나 하루 지나 이어 쓰려면 매번 '불러오기'를 직접 눌러야
      // 했고, 안 누르고 그냥 입력·저장하면 같은 달 기록이 여러 건으로 쪼개져 다른 기기·
      // 다른 날 입력한 내용이 안 보이는 것처럼 보였다(2026-09-22). 이번 달 진행 중인
      // 기록이 있으면 자동으로 이어서 연다.
      if (DATE_MATCH) DkjDateLoad.watch(function (el) { return el.id === DATE_ID; }, function (v) { return loadForDate(v); });
      if (!draft && !opened && !dateHandled) {
        var current = (await findCurrentPeriodRecord());
        if (current) {
          editingId = current.id;
          state = Object.assign(emptyState(spec), current);
          setBase();
          writeForm();
          setStatus('이번 달 기존 시트를 이어서 엽니다', true);
        } else if ((await hasLockedRecordForMonth())) {
          // 이번 달 기록이 이미 잠겨 있어 이어서 열 수 없다 — 새 시트로 시작한다.
          // 잠긴 기록의 내용은 기록보관함/'저장 기록' 목록에서 그대로 조회할 수 있다.
          setStatus('이번 달 잠긴 기록이 있어 새 시트로 시작합니다', false);
        }
      }
      // 달력에서 생산일·비생산일을 지정/변경하면(예: 추석 연휴 등록) 이미 열려 있는
      // 대장의 휴무행 판정도 새로고침 없이 바로 갱신한다.
      global.addEventListener('dkj:operation-calendar-changed', function () {
        applyAutoWeekday();
        renderGrid();
      });
      // 결재자가 작성자와 다른 기기로 들어오면, 이 기기의 로컬 저장소에 그 기록이
      // 아직 없어 findCurrentPeriodRecord() 가 위에서 아무것도 못 찾고 빈 새 시트로
      // 열릴 수 있다 — 클라우드 동기화(dkj-cloud-sync.js)는 페이지가 뜬 뒤 비동기로
      // 도착하기 때문이다. 그 상태를 "일지를 아직 안 썼다"로 오해해 결재를 못 하는
      // 문의가 있었다(2026-09-23, 팀장 계정이 서식으로 직접 진입한 경우). 동기화가
      // 뒤늦게 도착하면(dkj:records-changed) — 아직 아무 기록도 못 찾았고(editingId
      // 없음) 사용자가 뭔가 입력해 초안이 생기지도 않은 경우에 한해 — 한 번 더
      // 이어쓰기를 시도한다. 이미 뭔가 열려 있으면(작성 중이든 결재 중이든) 절대
      // 덮어쓰지 않는다.
      global.addEventListener('dkj:records-changed', async function () {
        // 열려 있는 월 시트에 다른 기기·탭이 저장한 칸이 있으면 먼저 반영한다. 안 하면 이 화면이
        // 오래된 사본을 들고 있다가 다음 저장 때 그 칸들을 비워 버린 것처럼 보였다.
        try { (await absorbFromStored()); } catch (e) { console.error('[DkjLedgerForm] 동기화 반영 실패', e); }
        // 이 기기에서 뭔가 손댔으면(초안 존재) 절대 덮어쓰지 않는다 — 아래 두 갈래 공통.
        if ((await DkjRecordStore.loadDraft(FORM_ID))) return;
        if (!editingId) {
          var current = (await findCurrentPeriodRecord());
          if (!current) return;
          editingId = current.id;
          state = Object.assign(emptyState(spec), current);
          setBase();
          writeForm();
          (await renderHistory());
          setStatus('동기화된 이번 달 시트를 불러왔습니다', true);
          return;
        }
        // 이미 어떤 기록이 열려 있어도, 그게 이 기기에 동기화되기 전(=오래된 사본)
        // 이었을 수 있다 — 예: 작업자가 태블릿에서 방금 "작성완료"(잠금)를 눌렀는데,
        // 결재자 PC 는 아직 그 전 버전(미잠금)을 들고 있어 화면이 "미완료"로 보인다
        // (2026-09-23 현장 보고 — 팀장 계정). 지금 막 동기화된 최신 값이 이 기록의
        // 잠금 상태를 앞서 있으면(=우리가 모르던 잠금) 그 값으로 다시 맞춘다.
        // 반대 방향(잠긴 걸 풀린 것으로 되돌림)은 절대 하지 않는다 — 이 기기에서
        // 방금 잠갔는데 동기화 지연으로 오히려 되돌아가면 그게 더 위험하다.
        if (!state.locked) {
          var fresh = (await DkjRecordStore.get(FORM_ID, editingId));
          if (fresh && fresh.locked) {
            state = Object.assign(emptyState(spec), fresh);
            setBase();
            writeForm();
            (await renderHistory());
            setStatus('다른 기기에서 작성완료(잠금) 처리된 최신 상태로 갱신했습니다', true);
          }
        }
      });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else (await init());

    return { getState: function () { return state; } };
  }

  global.DkjLedgerForm = { mount: mount, emptyState: emptyState };
})(window);
