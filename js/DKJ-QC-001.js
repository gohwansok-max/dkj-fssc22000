/**
 * DKJ-QC-001 — 일일 공정검사일지 (QC 순회)
 * 입출고/폐기량 무제한 자유 입력 · 실시간 포커스 유지 수율 계산 · 다품종 생산 지원
 */
(async function (global) {
  'use strict';
  function recordStorage() { return window.DkjStorage || window.localStorage; }


  var FORM_ID = 'DKJ-QC-001';
  var draftTimer = null;
  var editingId = null;

  // Master Products & BOM Presets (DKJ-H-01-01과 일원화된 5개 완제품)
  var PRODUCTS = [
    {
      code: 'DKJ-FG-01', name: '양상추 샐러드', spec: '500g',
      bom: [
        { name: '양상추(선별/절단)', ratio: '100.0%', supplier: '수입/국내산' },
        { name: '포장용기(트레이/필름)', ratio: '1 set', supplier: '포장재공급사' },
        { name: '소독제(NaOCl)', ratio: '적량', supplier: '식품첨가물' },
        { name: '외포장 박스', ratio: '적량', supplier: '포장재공급사' }
      ]
    },
    {
      code: 'DKJ-FG-02', name: '농협 샐러드 채소믹스', spec: '500g',
      bom: [
        { name: '상추(카이피라)', ratio: '28.33%', supplier: '동김제 계약농가' },
        { name: '상추(프릴아이스)', ratio: '28.33%', supplier: '동김제 계약농가' },
        { name: '상추(로메인)', ratio: '28.34%', supplier: '동김제 계약농가' },
        { name: '라디치오잎', ratio: '15.0%', supplier: '국내산 협력사' }
      ]
    },
    {
      code: 'DKJ-FG-03', name: '샐러디아 샐러드 채소믹스', spec: '500g',
      bom: [
        { name: '상추(카이피라)', ratio: '28.33%', supplier: '동김제 계약농가' },
        { name: '상추(프릴아이스)', ratio: '28.33%', supplier: '동김제 계약농가' },
        { name: '상추(로메인)', ratio: '28.34%', supplier: '동김제 계약농가' },
        { name: '라디치오잎', ratio: '15.0%', supplier: '국내산 협력사' }
      ]
    },
    {
      code: 'DKJ-FG-04', name: '슬로우캘리 샐러드믹스', spec: '500g',
      bom: [
        { name: '양상추', ratio: '40.0%', supplier: '수입/국내산' },
        { name: '상추(프릴아이스)', ratio: '25.0%', supplier: '동김제 계약농가' },
        { name: '상추(로메인)', ratio: '20.0%', supplier: '동김제 계약농가' },
        { name: '케일잎', ratio: '15.0%', supplier: '동김제 계약농가' }
      ]
    },
    {
      code: 'DKJ-FG-05', name: '급식(바로먹는 유러피언 샐러드 채소믹스)', spec: '1kg',
      bom: [
        { name: '상추(카이피라)', ratio: '30.0%', supplier: '동김제 계약농가' },
        { name: '상추(버터헤드)', ratio: '25.0%', supplier: '동김제 계약농가' },
        { name: '상추(이자벨)', ratio: '25.0%', supplier: '동김제 계약농가' },
        { name: '상추(로메인)', ratio: '20.0%', supplier: '동김제 계약농가' }
      ]
    }
  ];

  // 28 Inspection Check Items (Exact Match to Excel)
  var CHECK_ITEMS = [
    // 선행 (4)
    { key: 'c01', group: '선행', proc: '위생관리', label: '개인위생 점검', std: '위생복·모·마스크·손소독 준수, 장신구 제거 (양호:○, 불량:×)', type: 'ox', defaultVal: '○', act: '재소독 및 환복' },
    { key: 'c02', group: '선행', proc: '환경관리', label: '작업장 청결·밀폐', std: '바닥 고임물 없음, 에어커튼·출입문 밀폐 (양호:○, 불량:×)', type: 'ox', defaultVal: '○', act: '즉시 바닥 청소/문 닫힘' },
    { key: 'c03', group: '선행', proc: '온도관리', label: '작업장 온도 (전처리/가공실)', std: '10 ~ 20 ℃ (측정 온도 기록)', type: 'num', unit: '℃', min: 10, max: 20, defaultVal: '15.0', act: '공조 냉방기 가동 점검' },
    { key: 'c04', group: '선행', proc: '온도관리', label: '냉장창고 온도 (원료/완제품)', std: '0 ~ 5 ℃ (측정 온도 기록)', type: 'num', unit: '℃', min: 0, max: 5, defaultVal: '3.0', act: '유니트쿨러 온도 재조정' },
    
    // 원료 (2)
    { key: 'c05', group: '원료', proc: '보관·선별', label: '원료 보관 & 선입선출', std: '바닥·벽 이격 적재, 선입선출(FIFO) 위치 준수 (○/×)', type: 'ox', defaultVal: '○', act: '정위치 재적재 및 표시' },
    { key: 'c06', group: '원료', proc: '보관·선별', label: '원료 외관 및 신선도', std: '부패, 갈변, 짓무름, 병충해, 이물 혼입 없음 (○/×)', type: 'ox', defaultVal: '○', act: '불량 원료 즉시 선별 격리' },
    
    // 전처리 (2)
    { key: 'c07', group: '전처리', proc: '절단·선별', label: '품목별 절단 규격', std: '밑동·외엽 제거, 규격 크기 절단 준수 (○/×)', type: 'ox', defaultVal: '○', act: '절단기 칼날 조정/재선별' },
    { key: 'c08', group: '전처리', proc: '절단·선별', label: '이물 1차 선별 상태', std: '달팽이, 벌레, 비닐 등 협잡물 100% 제거 (○/×)', type: 'ox', defaultVal: '○', act: '선별 속도 감속 및 재선별' },
    
    // CCP-1BC (4)
    { key: 'c09', group: 'CCP-1BC', proc: '소독공정', label: '소독수 유효염소농도 (ppm)', std: '한계기준: 200 ~ 300 ppm (관리목표: 220~280 ppm)', type: 'num', unit: 'ppm', min: 200, max: 300, defaultVal: '250', isCcp: true, act: '소독원액 보충 및 재조제', photoKey: 'chlorinePaper', photoTitle: '소독수 시험지' },
    { key: 'c10', group: 'CCP-1BC', proc: '소독공정', label: '소독 침지 시간 (초)', std: '한계기준: 20 ~ 30초 침지 (측정 초 기록)', type: 'num', unit: '초', min: 20, max: 30, defaultVal: '25', isCcp: true, act: '컨베이어 이송속도 조정' },
    { key: 'c11', group: 'CCP-1BC', proc: '헹굼공정', label: '세척 헹굼 및 잔류염소', std: '음용수 50~60초 헹굼 실시, 잔류염소 4 ppm 미만 확인 (○/×)', type: 'ox', defaultVal: '○', isCcp: true, act: '헹굼 수량/수압 증대 및 헹굼시간 연장' },
    { key: 'c12', group: 'CCP-1BC', proc: '세척수관리', label: '소독액·헹굼수 교체', std: '3시간 주기 전량 교체 확인 (교체 시각 기록)', type: 'ox', defaultVal: '○', isCcp: true, act: '세척수 즉시 전량 교체' },
    
    // 가공 (2)
    { key: 'c13', group: '가공', proc: '탈수공정', label: '탈수 상태 (수분제거)', std: '품목별 RPM/시간 준수, 과탈수/물기 없음 (○/×)', type: 'ox', defaultVal: '○', act: '탈수 시간/회전수 재조정' },
    { key: 'c14', group: '가공', proc: '배합공정', label: '채소 배합 비율 & 혼합', std: '표준 BOM 배합비(%) 준수 및 균일 혼합 상태 (○/×)', type: 'ox', defaultVal: '○', act: '부족 원료 보충 계량' },
    
    // 포장 (3)
    { key: 'c15', group: '포장', proc: '계량충진', label: '포장 충진 중량 (g)', std: '품목별 표시중량 이상 (±허용공차 준수)', type: 'num', unit: 'g', min: 100, max: 2000, defaultVal: '505', act: '저울 영점 및 충진량 조정' },
    { key: 'c16', group: '포장', proc: '용기실링', label: '트레이/필름 실링 밀봉', std: '열접착 실링 양호, 틈새/누기/씹힘 없음 (○/×)', type: 'ox', defaultVal: '○', act: '실러 온도/압력 재설정' },
    { key: 'c17', group: '포장', proc: '표시사항', label: '소비기한 / LOT 날인', std: '날인 위치 적정, 번짐 없이 선명, 일자 일치 (○/×)', type: 'ox', defaultVal: '○', act: '날인기 활자/리본 교체', photoKey: 'lotPrint', photoTitle: '소비기한/LOT 날인' },
    
    // CCP-2P (4) - Fe (2.0/2.5/3.0), SUS (3.0/3.5)
    { key: 'c18', group: 'CCP-2P', proc: '금속검출', label: 'Test Piece (Fe 시편)', std: 'Fe 2.0 / 2.5 / 3.0㎜ 통과 시 100% 검출 및 리젝트', type: 'spec', options: ['2.0', '2.5', '3.0'], unit: '㎜', defaultVal: '2.0', isCcp: true, act: '검출기 감도 조정/라인정지' },
    { key: 'c19', group: 'CCP-2P', proc: '금속검출', label: 'Test Piece (SUS 시편)', std: 'SUS 3.0 / 3.5㎜ 통과 시 100% 검출 및 리젝트', type: 'spec', options: ['3.0', '3.5'], unit: '㎜', defaultVal: '3.0', isCcp: true, act: '검출기 감도 조정/라인정지' },
    { key: 'c20', group: 'CCP-2P', proc: '금속검출', label: '제품 + 시편 (복합 검출)', std: '제품+Fe, 제품+SUS 통과 시 정상 검출·배출 (○/×)', type: 'ox', defaultVal: '○', isCcp: true, act: '설비 점검 및 제품 격리' },
    { key: 'c21', group: 'CCP-2P', proc: '금속검출', label: '제품 단독 통과 (정상)', std: '제품만 통과 시 오작동 없이 통과 (○/×)', type: 'ox', defaultVal: '○', isCcp: true, act: '감도 재보정' },
    
    // 완제품 (5)
    { key: 'c22', group: '완제품', proc: '품질관능', label: '외관 및 색택', std: '신선한 고유 색택 유지, 갈변/탈색 없음 (○/×)', type: 'ox', defaultVal: '○', act: '원인 분석 및 선별 재작업' },
    { key: 'c23', group: '완제품', proc: '품질관능', label: '조직감 및 식감', std: '아삭한 식감 유지, 짓무름/무름 없음 (○/×)', type: 'ox', defaultVal: '○', act: '원료/탈수 상태 점검' },
    { key: 'c24', group: '완제품', proc: '품질관능', label: '풍미 및 이취', std: '채소 고유의 풍미, 이상 냄새/부패취 없음 (○/×)', type: 'ox', defaultVal: '○', act: '해당 LOT 전량 폐기/격리' },
    { key: 'c25', group: '완제품', proc: '품질관능', label: '포장 내부 이물 검사', std: '포장지 내부 모발, 비닐, 곤충 등 이물 전무 (○/×)', type: 'ox', defaultVal: '○', act: '해당 배치 전량 전수 재검' },
    { key: 'c26', group: '완제품', proc: '보관출하', label: '완제품 보관온도', std: '완제품 냉장창고 0 ~ 5 ℃ 유지 (측정 ℃)', type: 'num', unit: '℃', min: 0, max: 5, defaultVal: '3.0', act: '창고 냉각기 점검 및 출하' },
    
    // 확인 (2)
    { key: 'c27', group: '확인', proc: '순회확인', label: 'QC 순회 검사자 서명', std: '품질관리 담당자 (정·부) 서명', type: 'ox', defaultVal: '○', act: '—' },
    { key: 'c28', group: '확인', proc: '순회확인', label: '관리책임자 확인 서명', std: 'HACCP 팀장 / 공장장 확인 서명', type: 'ox', defaultVal: '○', act: '—' }
  ];

  var state = emptyState();
  var apvUi = null;

  function todayStr() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function nowTimeStr() {
    var d = new Date();
    var h = String(d.getHours()).padStart(2, '0');
    var m = String(d.getMinutes()).padStart(2, '0');
    return h + ':' + m;
  }

  function makeLot(dateVal) {
    var raw = (dateVal || todayStr()).replace(/-/g, '');
    return raw + '-01';
  }

  /* ── 작업장 온도 일보(DKJ-S-02-05) 연동 ────────────────────────────────────
     같은 온도를 두 서식에 두 번 적으면 값이 어긋나고, 어긋난 순간 어느 쪽이
     맞는지 알 수 없어 심사에서 그대로 지적된다. 온도 기록의 정본은 온도 일보로
     두고, 이 순회일지는 그 값을 읽어와 보여주기만 한다(쓰지 않는다 — 다른 서식의
     저장 기록을 프로그램이 고치면 기록 변조가 된다).

     회차·구역이 1:1 로 맞지 않아 아래 규칙으로 정했다(2026-09-09 협의).
       작업장 온도(c03)  1차 ← 전처리실 오전, 2차 ← 전처리실 오후,
                        3차 ← 연동 없음(온도 일보에 3회차 칸이 없다. 직접 적는다)
       냉장창고 온도(c04) 회차별로 원재료·완제품 중 관리기준(0~5℃)에서 더 벗어난
                        값을 보여준다 — 이탈을 놓치지 않는 쪽으로 고른다
       완제품 보관온도(c26) 는 원재료를 섞으면 안 된다 — 완제품 냉장창고(z7) 값만
                        1차/2차/3차 그대로 가져온다(2026-09-11 요청). */
  var TEMP_FORM_ID = 'DKJ-S-02-05';
  var TEMP_LINK = {
    c03: { r1: ['z1_am'], r2: ['z1_pm'], r3: [] },
    c04: { r1: ['z6_am', 'z7_am'], r2: ['z6_pm', 'z7_pm'], r3: ['z6_3', 'z7_3'] },
    c26: { r1: ['z7_am'], r2: ['z7_pm'], r3: ['z7_3'] }
  };
  var TEMP_RANGE = { c04: { min: 0, max: 5 }, c26: { min: 0, max: 5 } };

  function tempNum(v) {
    var t = String(v == null ? '' : v).trim();
    if (!t) return null;
    var n = Number(t);
    return isFinite(n) ? n : null;
  }

  /** 관리기준에서 벗어난 정도 — 기준 안이면 0 */
  function tempOutBy(n, range) {
    if (!range) return 0;
    return Math.max(0, n - range.max) + Math.max(0, range.min - n);
  }

  /** 여러 구역 값 중 하나를 고른다.
   *  기준을 벗어난 것이 있으면 가장 많이 벗어난 값, 모두 기준 안이면 가장 높은 값
   *  (냉장은 올라가는 쪽이 위험하다). */
  function pickTempValue(row, keys, range) {
    var best = null;
    (keys || []).forEach(function (k) {
      var n = tempNum(row[k]);
      if (n === null) return;
      if (best === null) { best = n; return; }
      var a = tempOutBy(n, range), b = tempOutBy(best, range);
      if (a > b || (a === b && n > best)) best = n;
    });
    return best === null ? '' : String(best);
  }

  /** 그 날짜의 온도 일보 행을 찾는다.
   *  같은 달 시트가 여러 건이면 가장 최근에 저장된 것을 쓴다. */
  async function findTempRow(dateStr) {
    var d = String(dateStr || '').trim();
    var m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m || !global.DkjRecordStore) return null;
    var ym = m[1] + '-' + m[2];
    var day = String(Number(m[3]));
    var list = [];
    try { list = (await global.DkjRecordStore.list(TEMP_FORM_ID)) || []; } catch (e) { return null; }
    var hit = list.filter(function (r) {
      var raw = String((r.info && r.info.month) || '').trim();
      // 예전 기록은 '2026 . 08' 처럼 손으로 적힌 값이라 숫자만 뽑아 견준다
      var mm = raw.match(/(\d{4})\D+(\d{1,2})/);
      var norm = /^\d{4}-\d{2}$/.test(raw) ? raw
        : (mm ? mm[1] + '-' + ('0' + Number(mm[2])).slice(-2) : '');
      return norm === ym;
    }).sort(function (a, b) {
      return (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0);
    })[0];
    if (!hit) return null;
    var rows = hit.rows || [];
    for (var i = 0; i < rows.length; i++) {
      if (String((rows[i] || {}).day || '').replace(/\D/g, '') === day) {
        return { row: rows[i], record: hit };
      }
    }
    return null;
  }

  /** 연동 대상 칸을 모두 비운다 — 날짜를 바꿨는데 앞 날짜 값이 남으면
   *  그 날 재지 않은 온도가 기록으로 남는다. */
  function clearLinkedCells() {
    var n = 0;
    Object.keys(TEMP_LINK).forEach(function (ck) {
      ['r1', 'r2', 'r3'].forEach(function (rk) {
        if (!(TEMP_LINK[ck][rk] || []).length) return;
        if (String(state.checks[rk][ck] || '') !== '') n++;
        state.checks[rk][ck] = '';
      });
    });
    return n;
  }

  /** 온도 일보 값을 순회일지 칸에 채운다.
   *  @param {boolean} clearMissing 온도 일보에 값이 없는 칸을 비울지.
   *    날짜를 바꿨거나 사용자가 다시 불러오기를 누른 경우 true — 앞 날짜 값이
   *    남으면 안 된다. 작성 중이던 임시본을 복원할 때는 false — 그 날짜 기준으로
   *    이미 적어 둔 값을 지우면 안 된다.
   *  @returns {{filled:number, blanked:number, missing:boolean}} */
  async function applyTempLink(clearMissing) {
    state.tempLink = { source: '', filled: 0, at: '' };
    var found = (await findTempRow(state.workDate));
    if (!found) {
      return { filled: 0, blanked: clearMissing ? clearLinkedCells() : 0, missing: true };
    }
    var filled = 0, blanked = 0;
    Object.keys(TEMP_LINK).forEach(function (ck) {
      ['r1', 'r2', 'r3'].forEach(function (rk) {
        var keys = TEMP_LINK[ck][rk] || [];
        if (!keys.length) return;   // 연동 대상이 아닌 회차(작업장 3차)는 건드리지 않는다
        var v = pickTempValue(found.row, keys, TEMP_RANGE[ck]);
        if (v === '') {
          // 온도 일보에 그 회차 값이 없으면 비운다. 안 비우면 앞서 보던 날짜의
          // 값이 남아 '토요일 작업장 온도' 자리에 수요일 값이 들어가 버린다.
          if (!clearMissing) return;
          if (String(state.checks[rk][ck] || '') !== '') blanked++;
          state.checks[rk][ck] = '';
          return;
        }
        state.checks[rk][ck] = v;
        filled++;
      });
    });
    if (filled) {
      state.tempLink = {
        source: TEMP_FORM_ID,
        recordId: found.record.id || '',
        filled: filled,
        at: state.workDate
      };
    }
    return { filled: filled, blanked: blanked, missing: false };
  }


  /* ── CCP-1BC 소독·헹굼 일지(DKJ-H-01-01) / CCP-2P 금속검출 일지(DKJ-H-01-02) 연동 ──
     온도 일보와 같은 이유·같은 원칙(읽기 전용, 저장된 기록은 안 건드림)이다.
     차이는 온도 일보가 '월 시트 안의 날짜 행'인 반면 이 둘은 '하루 1건' 기록이고,
     회차가 고정 시각(작업장 3회)이 아니라 그날그날 실제로 점검한 시각을
     자유 입력하므로(행을 더 추가할 수도 있다), 회차 매칭을 QC 순회의 각 회차
     목표시각(roundTimes)에 가장 가까운 시각의 행으로 한다 — 같은 날 두 서식을
     보는 사람이 "3번째 순회 = 그쪽 3번째 점검"이라고 당연히 여기기 쉬운데, 그
     서식은 하루 2번만 점검했을 수도 있어 순서(인덱스)로 맞추면 어긋난다. */
  var CCP1_FORM_ID = 'DKJ-H-01-01';
  var CCP2_FORM_ID = 'DKJ-H-01-02';
  // 항목명 옆 연동 배지(화면 전용)에 쓴다 — 어느 항목이 어느 서식에서 오는지.
  var LINKED_KEYS_CCP1 = { c09: 1, c10: 1, c11: 1 };
  var LINKED_KEYS_CCP2 = { c18: 1, c19: 1, c20: 1, c21: 1 };
  var LINK_TAG_SHORT = { 'DKJ-S-02-05': '온도일보', 'DKJ-H-01-01': 'CCP-1BC', 'DKJ-H-01-02': 'CCP-2P' };
  var LINK_TAG_LABEL = {
    'DKJ-S-02-05': '작업장 온도 일보', 'DKJ-H-01-01': 'CCP-1BC 소독·헹굼 일지', 'DKJ-H-01-02': 'CCP-2P 금속검출 일지'
  };

  function timeToMinutes(hhmm) {
    var m = String(hhmm == null ? '' : hhmm).match(/^(\d{1,2}):(\d{2})$/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  }

  /** 그 날짜의 perDay 기록(작업일자 = 오늘)을 찾는다. 같은 날짜로 여러 건
   *  저장돼 있으면(재작성 등) 가장 최근 저장분을 쓴다. */
  async function findDayRecord(formId, dateStr) {
    if (!global.DkjRecordStore || !dateStr) return null;
    var list;
    try { list = (await global.DkjRecordStore.list(formId)) || []; } catch (e) { return null; }
    var hits = list.filter(function (r) {
      return (r.workDate || (r.info && r.info.workDate)) === dateStr;
    });
    if (!hits.length) return null;
    hits.sort(function (a, b) { return (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0); });
    return hits[0];
  }

  /** rows 중 목표 시각(HH:MM)에 가장 가까운 시각이 적힌 행을 고른다.
   *  시각이 적힌 행이 하나도 없으면(전부 빈 시각) null. */
  function nearestRowByTime(rows, targetHHMM) {
    var target = timeToMinutes(targetHHMM);
    if (target === null || !Array.isArray(rows)) return null;
    var best = null, bestDiff = Infinity;
    rows.forEach(function (r) {
      var t = timeToMinutes(r && r.time);
      if (t === null) return;
      var diff = Math.abs(t - target);
      if (diff < bestDiff) { bestDiff = diff; best = r; }
    });
    return best;
  }

  /** CCP-1BC 자체 판정 기준(js/DKJ-H-01-01.js 의 rinseSecOk/residualClOk)을 그대로
   *  옮긴다 — 헹굼 50~60초, 잔류염소 4ppm 미만. 그 서식의 정본 기준과 이 순회일지의
   *  판정이 어긋나면 안 된다. */
  function ccp1RinseOk(row) {
    var rs = parseFloat(row && row.rinseSec);
    var rc = parseFloat(row && row.residualCl);
    if (isNaN(rs) || isNaN(rc)) return '';
    return (rs >= 50 && rs <= 60 && rc < 4) ? 'O' : 'X';
  }

  /** 이 회차 칸에 값을 채우거나(있으면), clearMissing 이면 비운다(없으면).
   *  counts 는 호출부가 filled/blanked 를 누적하는 공유 카운터. */
  function setLinkedCell(counts, rk, key, val, clearMissing) {
    if (val) {
      state.checks[rk][key] = val;
      counts.filled++;
      return;
    }
    if (!clearMissing) return;
    if (String(state.checks[rk][key] || '') !== '') counts.blanked++;
    state.checks[rk][key] = '';
  }

  async function applyCcp1Link(clearMissing) {
    var counts = { filled: 0, blanked: 0 };
    var rec = (await findDayRecord(CCP1_FORM_ID, state.workDate));
    ['r1', 'r2', 'r3'].forEach(function (rk) {
      var target = (state.roundTimes && state.roundTimes[rk]) || '';
      var row = rec ? nearestRowByTime(rec.rows, target) : null;
      setLinkedCell(counts, rk, 'c09', row ? row.ppm : '', clearMissing);
      setLinkedCell(counts, rk, 'c10', row ? row.soak : '', clearMissing);
      setLinkedCell(counts, rk, 'c11', row ? ccp1RinseOk(row) : '', clearMissing);
    });
    return { source: CCP1_FORM_ID, recordId: rec ? rec.id || '' : '', missing: !rec,
      filled: counts.filled, blanked: counts.blanked };
  }

  async function applyCcp2Link(clearMissing) {
    var counts = { filled: 0, blanked: 0 };
    var rec = (await findDayRecord(CCP2_FORM_ID, state.workDate));
    ['r1', 'r2', 'r3'].forEach(function (rk) {
      var target = (state.roundTimes && state.roundTimes[rk]) || '';
      var row = rec ? nearestRowByTime(rec.rows, target) : null;
      // Fe/SUS 시편 크기는 그날 하루 고정값(state.feSize/susSize)이라 회차마다 같다 —
      // 행별 값이 아니라 기록 자체에서 가져온다.
      setLinkedCell(counts, rk, 'c18', rec ? rec.feSize : '', clearMissing);
      setLinkedCell(counts, rk, 'c19', rec ? rec.susSize : '', clearMissing);
      // c20 '제품+시편(복합검출)' = 그 서식의 제품+Fe, 제품+SUS 두 항목을 합친 것 —
      // 둘 중 하나라도 X 면 이탈, 둘 다 O 여야 적합.
      var combo = '';
      if (row) {
        if (row.prodFe === 'X' || row.prodSus === 'X') combo = 'X';
        else if (row.prodFe === 'O' && row.prodSus === 'O') combo = 'O';
      }
      setLinkedCell(counts, rk, 'c20', combo, clearMissing);
      setLinkedCell(counts, rk, 'c21', row ? row.prodOnly : '', clearMissing);
    });
    return { source: CCP2_FORM_ID, recordId: rec ? rec.id || '' : '', missing: !rec,
      filled: counts.filled, blanked: counts.blanked };
  }

  /** 온도 일보 + CCP-1BC + CCP-2P 를 한 번에 채운다(또는 비운다). 세 곳 다
   *  같은 원칙 — 저장된 기록을 불러올 때는 절대 안 부르고, 작성 중인 시트에서
   *  날짜를 바꾸거나 '연동 다시 불러오기'를 눌렀을 때만 clearMissing=true 로 부른다. */
  async function applyAllLinks(clearMissing) {
    var temp = (await applyTempLink(clearMissing));
    var ccp1 = (await applyCcp1Link(clearMissing));
    var ccp2 = (await applyCcp2Link(clearMissing));
    state.ccpLink = {
      ccp1: ccp1.filled ? { source: ccp1.source, recordId: ccp1.recordId, filled: ccp1.filled } : null,
      ccp2: ccp2.filled ? { source: ccp2.source, recordId: ccp2.recordId, filled: ccp2.filled } : null
    };
    return { temp: temp, ccp1: ccp1, ccp2: ccp2 };
  }

  /** 세 연동 결과를 한 배너에 모아 알린다 — 어디서 가져왔고 뭐가 비었는지
   *  안 보이면 확인할 수가 없다. */
  function renderLinkNotice(res) {
    var el = $('qcTempLink');
    if (!el) return;
    if (!res) { el.hidden = true; return; }
    el.hidden = false;
    var lines = [];
    var anyBad = false;

    if (res.temp.missing) {
      anyBad = true;
      lines.push('작업장 온도 일보(DKJ-S-02-05)에 ' + (state.workDate || '') + ' 기록 없음 — 온도는 직접 적어 주세요.');
    } else if (!res.temp.filled) {
      anyBad = true;
      lines.push('작업장 온도 일보에 ' + (state.workDate || '') + ' 행은 있으나 값이 비어 있습니다.');
    } else {
      lines.push('작업장 온도 일보에서 ' + res.temp.filled + '칸' + (res.temp.blanked ? '(비운 ' + res.temp.blanked + '칸 포함)' : '') + ' 가져옴 — 작업장 3차는 직접 적습니다.');
    }

    if (res.ccp1.missing) {
      anyBad = true;
      lines.push('CCP-1BC 소독·헹굼 일지(DKJ-H-01-01)에 ' + (state.workDate || '') + ' 기록 없음 — 직접 적어 주세요.');
    } else if (res.ccp1.filled) {
      lines.push('CCP-1BC 소독·헹굼 일지에서 ' + res.ccp1.filled + '칸 가져옴(소독액·헹굼수 교체 확인은 직접 적습니다).');
    }

    if (res.ccp2.missing) {
      anyBad = true;
      lines.push('CCP-2P 금속검출 일지(DKJ-H-01-02)에 ' + (state.workDate || '') + ' 기록 없음 — 직접 적어 주세요.');
    } else if (res.ccp2.filled) {
      lines.push('CCP-2P 금속검출 일지에서 ' + res.ccp2.filled + '칸 가져옴(시편 단독 검출 여부는 연동 대상이 아닙니다).');
    }

    el.className = 'qc-templink ' + (anyBad ? 'warn' : 'ok');
    el.textContent = lines.join(' ');
  }

  function emptyState() {
    var defProd = PRODUCTS[0];
    var curDate = todayStr();
    var curLot = makeLot(curDate);

    var checks = { r1: {}, r2: {}, r3: {} };
    CHECK_ITEMS.forEach(function (it) {
      checks.r1[it.key] = '';
      checks.r2[it.key] = '';
      checks.r3[it.key] = '';
    });

    var materials = defProd.bom.map(function (b) {
      return { name: b.name, ratio: b.ratio, supplier: b.supplier, inKg: '', usedKg: '', wasteKg: '', yieldRate: '' };
    });

    var finishedItems = [
      { code: defProd.code, name: defProd.name, spec: defProd.spec, madeKg: '', madeBag: '', shippedKg: '', stockKg: '', first20: '' }
    ];

    return {
      workDate: curDate,
      lot: curLot,
      inspector: '',
      roundTimes: { r1: '09:00', r2: '13:30', r3: '16:30' },
      selectedCodes: [defProd.code],
      checks: checks,
      materials: materials,
      finishedItems: finishedItems,
      photos: {
        chlorinePaper: null,
        lotPrint: null
      },
      // 최근기록 복사로 따라온 사진이면 true — 화면에 '전일' 배지(화면 전용). 사진을 바꾸거나 지우면 해제.
      photosCarried: {},
      remarkPreset: '',
      deviationNotes: '',
      confirmer: '',
      approver: '',
      approvals: { writer: '', reviewer: '', approver: '' },
      signoff: {},
      audit: [],
      locked: false,
      hasDeviation: false
    };
  }

  function $(id) { return document.getElementById(id); }

  function setStatus(msg, saved) {
    var el = $('saveStatus');
    if (!el) return;
    el.innerHTML = '<span class="dot"></span> ' + msg;
    el.className = 'dkj-status' + (saved ? ' saved' : '');
  }

  // Handle and compress camera/uploaded image for localStorage & high quality print
  function handleImageUpload(file, callback) {
    if (!file) return;
    try {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var canvas = document.createElement('canvas');
        var MAX_DIM = 900;
        var width = img.width;
        var height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.80);
        callback(dataUrl);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        var reader = new FileReader();
        reader.onload = function (e) {
          var fbImg = new Image();
          fbImg.onload = function () {
            var canvas = document.createElement('canvas');
            var MAX_DIM = 900;
            var w = fbImg.width;
            var h = fbImg.height;
            if (w > h) {
              if (w > MAX_DIM) { h = Math.round((h * MAX_DIM) / w); w = MAX_DIM; }
            } else {
              if (h > MAX_DIM) { w = Math.round((w * MAX_DIM) / h); h = MAX_DIM; }
            }
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(fbImg, 0, 0, w, h);
            callback(canvas.toDataURL('image/jpeg', 0.80));
          };
          fbImg.src = e.target.result;
        };
        reader.readAsDataURL(file);
      };
      img.src = url;
    } catch (err) {
      console.error('Image handling failed', err);
    }
  }

  // Re-sync raw materials BOM whenever products list changes
  function syncMaterialsFromProducts() {
    var matMap = {};
    (state.materials || []).forEach(function (m) {
      if (m.name) matMap[m.name] = m;
    });

    var newMats = [];
    (state.finishedItems || []).forEach(function (fItem) {
      var prod = PRODUCTS.find(function (p) { return p.code === fItem.code || p.name === fItem.name; });
      if (prod && prod.bom) {
        prod.bom.forEach(function (b) {
          if (!newMats.find(function (x) { return x.name === b.name; })) {
            var existing = matMap[b.name];
            newMats.push({
              name: b.name,
              ratio: b.ratio,
              supplier: b.supplier,
              inKg: existing ? existing.inKg : '',
              usedKg: existing ? existing.usedKg : '',
              wasteKg: existing ? existing.wasteKg : '',
              yieldRate: existing ? existing.yieldRate : ''
            });
          }
        });
      }
    });

    if (newMats.length) {
      state.materials = newMats;
    }
  }

  function renderProductChips() {
    var host = $('productChips');
    if (!host) return;

    var curCodes = (state.finishedItems || []).map(function (f) { return f.code; });

    host.innerHTML = PRODUCTS.map(function (p) {
      var active = curCodes.includes(p.code) ? ' active' : '';
      return '<button type="button" class="qc-chip' + active + '" data-code="' + p.code + '">' + (active ? '✓ ' : '＋ ') + p.name + '</button>';
    }).join('');

    host.querySelectorAll('.qc-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var code = btn.getAttribute('data-code');
        var sel = PRODUCTS.find(function (x) { return x.code === code; });
        if (!sel) return;

        var existsIdx = state.finishedItems.findIndex(function (x) { return x.code === code; });
        if (existsIdx >= 0) {
          if (state.finishedItems.length > 1) {
            state.finishedItems.splice(existsIdx, 1);
          } else {
            alert('최소 1개 이상의 생산 제품이 필요합니다.');
            return;
          }
        } else {
          state.finishedItems.push({
            code: sel.code,
            name: sel.name,
            spec: sel.spec,
            madeKg: '',
            madeBag: '',
            shippedKg: '',
            stockKg: '',
            first20: ''
          });
        }

        syncMaterialsFromProducts();
        renderProductChips();
        renderFinishedGoodsTable();
        renderMaterialsTable();
        scheduleDraft();
      });
    });
  }

  function updateRoundTimeLabels() {
    var t1 = (state.roundTimes && state.roundTimes.r1) || '09:00';
    var t2 = (state.roundTimes && state.roundTimes.r2) || '13:30';
    var t3 = (state.roundTimes && state.roundTimes.r3) || '16:30';

    if ($('roundTime1')) $('roundTime1').value = t1;
    if ($('roundTime2')) $('roundTime2').value = t2;
    if ($('roundTime3')) $('roundTime3').value = t3;

    if ($('lblTime1')) $('lblTime1').innerText = t1;
    if ($('lblTime2')) $('lblTime2').innerText = t2;
    if ($('lblTime3')) $('lblTime3').innerText = t3;
  }

  function isBad(item, val) {
    if (val === '' || val === null || val === undefined) return false;
    if (item.type === 'ox') return val === '×' || val === 'X';
    if (item.type === 'num') {
      var n = parseFloat(val);
      if (isNaN(n)) return false;
      return n < item.min || n > item.max;
    }
    return false;
  }

  function first20Judge(items) {
    if ((items || []).some(function (f) { return f.first20 === 'X' || f.first20 === '×'; })) return '부적합(×)';
    if (!items || !items.length || items.some(function (f) { return f.first20 !== 'O' && f.first20 !== '○'; })) return '미점검';
    return '적합(○)';
  }

  function inspectionResult(record) {
    record = record || state;
    var missing = 0;
    var deviations = [];
    ['r1', 'r2', 'r3'].forEach(function (rk, ri) {
      CHECK_ITEMS.forEach(function (it) {
        var val = ((record.checks || {})[rk] || {})[it.key];
        var absent = val === null || val === undefined || String(val).trim() === '' ||
          (it.type === 'num' && !Number.isFinite(Number(val))) ||
          (it.type === 'ox' && ['O', '○', 'X', '×'].indexOf(val) < 0) ||
          (it.type === 'spec' && !(it.options || []).some(function (opt) { return val === opt || val === opt + '㎜' || val === opt + 'mm'; }));
        if (absent) missing++;
        else if (isBad(it, val)) deviations.push((ri + 1) + '차 ' + it.label + ': ' + val + (it.unit || '') + ' / ' + it.std);
      });
    });
    var first = first20Judge(record.finishedItems);
    if (first === '부적합(×)') deviations.push('완제품 첫 20팩 전수점검 부적합');
    if (first === '미점검') missing++;
    return { missing: missing, deviations: deviations,
      judge: deviations.length ? '이탈발생' : (missing ? '미점검' : '적합') };
  }

  function validationMessage(record, complete) {
    if (!record.workDate) return '작업일자를 입력하세요.';
    if (!String(record.lot || '').trim()) return '생산 LOT를 입력하세요.';
    if (!String(record.inspector || '').trim()) return 'QC 검사자를 입력하세요.';
    var result = inspectionResult(record);
    var notes = String(record.deviationNotes || '').trim();
    if (result.deviations.length && (!notes || /^(정상|없음|이상 없음|특이사항 없음)[.!\s]*$/.test(notes))) {
      return '이탈 항목이 있습니다. 이탈 및 긴급조치 내역에 발생 상황과 실제 조치 결과를 기록한 뒤 저장하세요. 입력 중 내용은 임시 보관됩니다.';
    }
    if (complete && result.missing) return '미점검 ' + result.missing + '칸이 남아 있습니다. 첫 20팩을 포함한 모든 점검 후 작성완료·결재를 진행하세요.';
    return '';
  }

  function showValidationError(message) {
    var el = $('qcValidationStatus');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message;
    if (message) { el.focus(); el.scrollIntoView({block: 'center'}); }
  }

  function allowComplete() {
    readForm();
    checkDeviations();
    var message = validationMessage(state, true);
    if (message) { showValidationError(message); setStatus('확정 불가 — 입력 내용을 확인하세요.', false); return false; }
    // 저장 전이면 결재 패널이 확정 직전에 먼저 저장한다(ensureSaved) — 여기서 따로 막지 않는다.
    showValidationError('');
    return true;
  }

  // 저장 API에서도 검사한다. 자동 임시 보관(saveDraft)은 검사하지 않아 작성 중 내용을 보존한다.
  global.DkjRecordValidators = global.DkjRecordValidators || {};
  global.DkjRecordValidators[FORM_ID] = function (record) {
    var signing = Object.keys(record.signoff || {}).some(function (key) { return record.signoff[key] && record.signoff[key].at; });
    var message = validationMessage(record, !!record.locked || signing);
    if (message) throw new Error(message);
  };

  function checkDeviations() {
    var result = inspectionResult();
    var dev = result.deviations.length > 0;
    state.hasDeviation = dev;
    var ban = $('deviationBanner');
    if (ban) {
      ban.hidden = !dev;
      ban.textContent = '한계기준/규격 이탈 감지 — ' + result.deviations.join(' · ') + ' — 하단 이탈 및 긴급조치 내역에 조치 결과를 기록하세요.';
    }
    var status = $('qcJudgeStatus');
    if (status) status.textContent = dev ? '판정: 이탈발생 · 조치 필요 (미점검 ' + result.missing + '칸)' :
      (result.missing ? '판정: 미점검 ' + result.missing + '칸 — 모든 점검 후 적합 여부를 확인합니다.' : '판정: 적합');
    var preset = $('remarkPreset');
    if (preset) {
      var normal = preset.querySelector('option[value="특이사항 없음 / 정상 가동"]');
      if (normal) {
        normal.disabled = dev;
        normal.textContent = dev ? '이탈 발생 — 정상 판정 적용 안 됨' : '정상 — 특이사항 없음';
      }
    }
  }

  function renderMainCheckTable() {
    var tbody = $('mainCheckBody');
    if (!tbody) return;

    var groupCounts = {};
    CHECK_ITEMS.forEach(function (it) {
      groupCounts[it.group] = (groupCounts[it.group] || 0) + 1;
    });

    var renderedGroups = {};
    var rowsHtml = '';

    CHECK_ITEMS.forEach(function (it) {
      var isFirstOfGroup = !renderedGroups[it.group];
      renderedGroups[it.group] = true;

      var ccpRowCls = it.isCcp ? ' class="ccp-row"' : '';
      var grpCellCls = it.isCcp ? 'ccp-grp-cell' : 'grp-cell';

      var r1Val = state.checks.r1[it.key] || '';
      var r2Val = state.checks.r2[it.key] || '';
      var r3Val = state.checks.r3[it.key] || '';

      var r1Bad = isBad(it, r1Val);
      var r2Bad = isBad(it, r2Val);
      var r3Bad = isBad(it, r3Val);

      function renderCell(rk, val, bad) {
        if (it.type === 'ox') {
          var isOk = (val === '○' || val === 'O') ? ' active' : '';
          var isNg = (val === '×' || val === 'X') ? ' active' : '';
          return '<div class="qc-seg-control" data-k="' + it.key + '" data-r="' + rk + '">' +
            '<button type="button" class="qc-seg-btn ok' + isOk + '" data-val="○">○</button>' +
            '<button type="button" class="qc-seg-btn ng' + isNg + '" data-val="×">×</button>' +
            '</div>';
        } else if (it.type === 'spec') {
          var btns = (it.options || []).map(function (opt) {
            var isSel = (val === opt || val === (opt + '㎜') || val === (opt + 'mm')) ? ' active' : '';
            return '<button type="button" class="qc-spec-btn' + isSel + '" data-val="' + opt + '">' + opt + '</button>';
          }).join('');
          return '<div class="qc-spec-control" data-k="' + it.key + '" data-r="' + rk + '">' + btns + '</div>';
        } else {
          return '<input type="number" step="any" class="qc-val-box' + (bad ? ' bad' : '') + '" data-k="' + it.key + '" data-r="' + rk + '" value="' + val + '" placeholder="' + it.defaultVal + '">';
        }
      }

      var photoColHtml = '';
      if (it.photoKey) {
        var curPhoto = (state.photos && state.photos[it.photoKey]) || null;
        if (curPhoto) {
          photoColHtml = '<div class="qc-photo-box">' +
            '<div class="qc-photo-preview-wrap">' +
              '<img src="' + curPhoto + '" class="qc-photo-thumb" alt="미리보기" onclick="window.open(this.src)" title="클릭하여 원본보기">' +
              (state.photosCarried && state.photosCarried[it.photoKey] ? '<span class="dkj-photo-carried" title="최근기록 복사로 가져온 이전 사진입니다. 오늘 촬영본으로 바꾸세요.">전일</span>' : '') +
              '<button type="button" class="qc-photo-del" data-del-photo="' + it.photoKey + '" title="사진 삭제">✕</button>' +
            '</div>' +
          '</div>';
        } else {
          photoColHtml = '<div class="qc-photo-box">' +
            '<label class="qc-camera-btn" style="position:relative;cursor:pointer;">📷 ' + it.photoTitle +
              '<input type="file" accept="image/*" capture="environment" class="qc-photo-file-inp" data-photo-inp="' + it.photoKey + '" style="position:absolute;left:0;top:0;width:100%;height:100%;opacity:0;cursor:pointer;">' +
            '</label>' +
          '</div>';
        }
      }

      rowsHtml += '<tr' + ccpRowCls + '>';
      if (isFirstOfGroup) {
        rowsHtml += '<td rowspan="' + groupCounts[it.group] + '" class="' + grpCellCls + '">' + it.group + '</td>';
      }
      rowsHtml += '<td style="font-weight:600;">' + it.proc + '</td>';
      // 다른 서식에서 값을 가져오는 항목임을 화면에서 알린다 (정본 인쇄에는 붙이지 않는다)
      var linkSrc = TEMP_LINK[it.key] ? 'DKJ-S-02-05' :
        LINKED_KEYS_CCP1[it.key] ? 'DKJ-H-01-01' :
        LINKED_KEYS_CCP2[it.key] ? 'DKJ-H-01-02' : '';
      var linkTag = linkSrc
        ? ' <span class="qc-link-tag" title="' + esc(LINK_TAG_LABEL[linkSrc]) + '(' + linkSrc + ')에서 가져옵니다">' + esc(LINK_TAG_SHORT[linkSrc]) + ' 연동</span>'
        : '';
      rowsHtml += '<td class="left-txt" style="font-weight:700;">' + (it.isCcp ? '<span style="color:#b71c1c;">[CCP] </span>' : '') + it.label + linkTag + '</td>';
      rowsHtml += '<td class="left-txt" style="font-size:12px;color:#475467;">' + it.std + '</td>';
      rowsHtml += '<td>' + renderCell('r1', r1Val, r1Bad) + '</td>';
      rowsHtml += '<td>' + renderCell('r2', r2Val, r2Bad) + '</td>';
      rowsHtml += '<td>' + renderCell('r3', r3Val, r3Bad) + '</td>';
      rowsHtml += '<td class="left-txt" style="font-size:11.5px;color:#555;">' +
        '<div>' + it.act + '</div>' + photoColHtml +
        '</td>';
      rowsHtml += '</tr>';
    });

    tbody.innerHTML = rowsHtml;

    // OX Buttons
    tbody.querySelectorAll('.qc-seg-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var par = btn.closest('.qc-seg-control');
        var k = par.getAttribute('data-k');
        var rk = par.getAttribute('data-r');
        var v = btn.getAttribute('data-val');
        state.checks[rk][k] = v;
        
        par.querySelectorAll('.qc-seg-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');

        checkDeviations();
        scheduleDraft();
      });
    });

    // Spec Buttons (Fe / SUS)
    tbody.querySelectorAll('.qc-spec-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var par = btn.closest('.qc-spec-control');
        var k = par.getAttribute('data-k');
        var rk = par.getAttribute('data-r');
        var v = btn.getAttribute('data-val');
        state.checks[rk][k] = v;
        
        par.querySelectorAll('.qc-spec-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');

        checkDeviations();
        scheduleDraft();
      });
    });

    // Numeric Inputs
    tbody.querySelectorAll('.qc-val-box').forEach(function (inp) {
      inp.addEventListener('input', function () {
        if (state.locked) return;
        var k = inp.getAttribute('data-k');
        var rk = inp.getAttribute('data-r');
        state.checks[rk][k] = inp.value;

        var it = CHECK_ITEMS.find(function (x) { return x.key === k; });
        if (it) {
          var bad = isBad(it, inp.value);
          if (bad) inp.classList.add('bad');
          else inp.classList.remove('bad');
        }

        checkDeviations();
        scheduleDraft();
      });
    });

    // Camera File Inputs in Table
    tbody.querySelectorAll('[data-photo-inp]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        if (state.locked) return;
        var pKey = inp.getAttribute('data-photo-inp');
        var file = inp.files && inp.files[0];
        if (file) {
          handleImageUpload(file, function (dataUrl) {
            state.photos = state.photos || {};
            state.photos[pKey] = dataUrl;
            if (state.photosCarried) state.photosCarried[pKey] = false;
            renderMainCheckTable();
            renderPhotoSection();
            scheduleDraft();
            if (window.DkjUtil && window.DkjUtil.toast) {
              window.DkjUtil.toast('📷 ' + (pKey === 'chlorinePaper' ? '소독수 시험지' : '소비기한/LOT 날인') + ' 사진이 첨부되었습니다.');
            }
          });
        }
      });
    });

    // Photo Delete Buttons in Table
    tbody.querySelectorAll('[data-del-photo]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var pKey = btn.getAttribute('data-del-photo');
        if (state.photos && state.photos[pKey]) {
          state.photos[pKey] = null;
          if (state.photosCarried) state.photosCarried[pKey] = false;
          renderMainCheckTable();
          renderPhotoSection();
          scheduleDraft();
          if (window.DkjUtil && window.DkjUtil.toast) {
            window.DkjUtil.toast('사진이 삭제되었습니다.');
          }
        }
      });
    });
  }

  // Render Bottom Photo Cards Section (⑤ 현장 실물 증빙 사진 첨부)
  function renderPhotoSection() {
    var sec = $('qcPhotoSection');
    if (!sec) return;

    var configs = [
      { key: 'chlorinePaper', cardBody: 'previewBoxChlorinePaper', badge: 'badgeChlorinePaper', title: '소독수 유효염소 시험지' },
      { key: 'lotPrint', cardBody: 'previewBoxLotPrint', badge: 'badgeLotPrint', title: '소비기한/LOT 날인' }
    ];

    configs.forEach(function (cfg) {
      var photo = (state.photos && state.photos[cfg.key]) || null;
      var bodyEl = $(cfg.cardBody);
      var badgeEl = $(cfg.badge);

      if (badgeEl) {
        if (photo) {
          badgeEl.textContent = '✓ 첨부완료 (저장됨)';
          badgeEl.className = 'qc-photo-badge saved';
        } else {
          badgeEl.textContent = '미첨부';
          badgeEl.className = 'qc-photo-badge';
        }
      }

      if (bodyEl) {
        if (photo) {
          bodyEl.innerHTML = '<div class="qc-photo-preview-box">' +
            '<img src="' + photo + '" class="qc-photo-img-large" alt="' + cfg.title + ' 실물" onclick="window.open(this.src)" title="클릭하여 원본보기">' +
            (state.photosCarried && state.photosCarried[cfg.key] ? '<div><span class="dkj-photo-carried">전일 사진 — 오늘 촬영본으로 바꾸세요</span></div>' : '') +
            '<div class="qc-photo-actions">' +
              '<label class="pill-btn ghost sm" style="position:relative;cursor:pointer;">📷 사진 변경' +
                '<input type="file" accept="image/*" capture="environment" data-sec-photo="' + cfg.key + '" style="position:absolute;left:0;top:0;width:100%;height:100%;opacity:0;cursor:pointer;">' +
              '</label>' +
              '<button type="button" class="pill-btn ghost sm" data-sec-del="' + cfg.key + '" style="color:#d92d20;border-color:#fca5a5;">🗑️ 사진 삭제</button>' +
            '</div>' +
          '</div>';
        } else {
          bodyEl.innerHTML = '<label class="qc-photo-dropzone">' +
            '<input type="file" accept="image/*" capture="environment" data-sec-photo="' + cfg.key + '">' +
            '<span class="qc-drop-icon">📷</span>' +
            '<span class="qc-drop-text">' + cfg.title + ' 촬영 / 사진 선택</span>' +
            '<span class="qc-drop-sub">터치하여 스마트폰 카메라 촬영 또는 갤러리 선택</span>' +
          '</label>';
        }
      }
    });

    // Bind inputs inside photo section
    sec.querySelectorAll('[data-sec-photo]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        if (state.locked) return;
        var pKey = inp.getAttribute('data-sec-photo');
        var file = inp.files && inp.files[0];
        if (file) {
          handleImageUpload(file, function (dataUrl) {
            state.photos = state.photos || {};
            state.photos[pKey] = dataUrl;
            if (state.photosCarried) state.photosCarried[pKey] = false;
            renderMainCheckTable();
            renderPhotoSection();
            scheduleDraft();
            if (window.DkjUtil && window.DkjUtil.toast) {
              window.DkjUtil.toast('📷 ' + (pKey === 'chlorinePaper' ? '소독수 시험지' : '소비기한/LOT 날인') + ' 사진이 첨부되었습니다.');
            }
          });
        }
      });
    });

    sec.querySelectorAll('[data-sec-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var pKey = btn.getAttribute('data-sec-del');
        if (state.photos && state.photos[pKey]) {
          state.photos[pKey] = null;
          if (state.photosCarried) state.photosCarried[pKey] = false;
          renderMainCheckTable();
          renderPhotoSection();
          scheduleDraft();
          if (window.DkjUtil && window.DkjUtil.toast) {
            window.DkjUtil.toast('사진이 삭제되었습니다.');
          }
        }
      });
    });
  }

  // Calculate Yield Helper
  function calcMaterialYield(m) {
    var inN = parseFloat(m.inKg) || 0;
    var usedN = parseFloat(m.usedKg) || 0;
    var wasteN = parseFloat(m.wasteKg) || 0;

    if (inN > 0) {
      if (usedN > 0) {
        return String(Math.round((usedN / inN) * 1000) / 10);
      } else if (wasteN > 0 && inN >= wasteN) {
        return String(Math.round(((inN - wasteN) / inN) * 1000) / 10);
      }
    }
    return '';
  }

  function renderMaterialsTable() {
    var tbody = $('matTableBody');
    if (!tbody) return;

    tbody.innerHTML = (state.materials || []).map(function (m, idx) {
      var matType = (idx < 6) ? '주원료 ' + (idx + 1) : '부재료';
      var yRate = m.yieldRate || calcMaterialYield(m);
      return '<tr data-idx="' + idx + '">' +
        '<td style="font-weight:700;color:#1b5e20;">' + matType + '</td>' +
        '<td style="text-align:left;"><input type="text" class="qc-mat-name-box" data-f="name" value="' + (m.name || '') + '"></td>' +
        '<td><input type="text" class="qc-in-box" data-f="ratio" value="' + (m.ratio || '') + '" style="text-align:center;"></td>' +
        '<td><input type="number" step="any" min="0" class="qc-in-box qc-mat-in" data-f="inKg" value="' + (m.inKg || '') + '" placeholder="kg"></td>' +
        '<td><input type="number" step="any" min="0" class="qc-in-box qc-mat-used" data-f="usedKg" value="' + (m.usedKg || '') + '" placeholder="kg"></td>' +
        '<td><input type="number" step="any" min="0" class="qc-in-box qc-mat-waste" data-f="wasteKg" value="' + (m.wasteKg || '') + '" placeholder="kg"></td>' +
        '<td class="qc-yield-val" style="font-weight:800;color:#009a44;font-size:13px;">' + (yRate ? yRate + '%' : '—') + '</td>' +
        '<td>별도 성상 판정 없음</td>' +
        '<td><button type="button" class="pill-btn ghost sm qc-del-mat" data-idx="' + idx + '" style="padding:2px 6px;color:#d92d20;">✕</button></td>' +
        '</tr>';
    }).join('');

    // Smooth real-time update WITHOUT destroying input focus
    tbody.querySelectorAll('.qc-in-box, .qc-mat-name-box').forEach(function (inp) {
      inp.addEventListener('input', function () {
        if (state.locked) return;
        var tr = inp.closest('tr');
        var idx = Number(tr.getAttribute('data-idx'));
        var f = inp.getAttribute('data-f');
        state.materials[idx][f] = inp.value;

        var y = calcMaterialYield(state.materials[idx]);
        state.materials[idx].yieldRate = y;

        var yCell = tr.querySelector('.qc-yield-val');
        if (yCell) {
          yCell.innerText = y ? (y + '%') : '—';
        }

        scheduleDraft();
      });
    });

    tbody.querySelectorAll('.qc-del-mat').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var idx = Number(btn.getAttribute('data-idx'));
        state.materials.splice(idx, 1);
        renderMaterialsTable();
        scheduleDraft();
      });
    });
  }

  // Update Finished Goods Totals Row
  function updateFinishedTotals() {
    checkDeviations();
    var tfoot = $('finishedGoodsFoot');
    if (!tfoot) return;

    var sumMadeKg = 0;
    var sumMadeBag = 0;
    var sumShippedKg = 0;
    var sumStockKg = 0;

    (state.finishedItems || []).forEach(function (item) {
      sumMadeKg += parseFloat(item.madeKg) || 0;
      sumMadeBag += parseInt(item.madeBag, 10) || 0;
      sumShippedKg += parseFloat(item.shippedKg) || 0;
      sumStockKg += parseFloat(item.stockKg) || 0;
    });

    tfoot.innerHTML = '<tr>' +
      '<td colspan="2" style="text-align:center;font-weight:800;color:#003311;">당일 완제품 총 생산 합계</td>' +
      '<td style="text-align:right;padding-right:8px;color:#009a44;font-size:13.5px;">' + (Math.round(sumMadeKg * 10) / 10) + ' kg</td>' +
      '<td style="text-align:right;padding-right:8px;color:#009a44;font-size:13.5px;">' + sumMadeBag + ' 봉</td>' +
      '<td style="text-align:right;padding-right:8px;">' + (Math.round(sumShippedKg * 10) / 10) + ' kg</td>' +
      '<td style="text-align:right;padding-right:8px;">' + (Math.round(sumStockKg * 10) / 10) + ' kg</td>' +
      '<td colspan="2" style="text-align:center;">전수점검 ' + first20Judge(state.finishedItems) + '</td>' +
      '</tr>';
  }

  // Render Multi-Product Finished Goods Table
  function renderFinishedGoodsTable() {
    var tbody = $('finishedGoodsBody');
    if (!tbody) return;

    tbody.innerHTML = (state.finishedItems || []).map(function (item, idx) {
      var prodOptions = PRODUCTS.map(function (p) {
        var sel = (p.code === item.code || p.name === item.name) ? ' selected' : '';
        return '<option value="' + p.code + '"' + sel + '>' + p.name + '</option>';
      }).join('');

      var isOk = item.first20 === 'O' ? ' active' : '';
      var isNg = item.first20 === 'X' ? ' active' : '';

      return '<tr data-idx="' + idx + '">' +
        '<td><select class="qc-select-box qc-prod-select" data-f="code">' + prodOptions + '</select></td>' +
        '<td><input type="text" class="qc-in-box" data-f="spec" value="' + (item.spec || '500g') + '" style="text-align:center;"></td>' +
        '<td><input type="number" step="any" min="0" class="qc-in-box qc-fn-kg" data-f="madeKg" value="' + (item.madeKg || '') + '" placeholder="kg" style="color:#009a44;font-weight:800;"></td>' +
        '<td><input type="number" step="1" min="0" class="qc-in-box qc-fn-bag" data-f="madeBag" value="' + (item.madeBag || '') + '" placeholder="봉"></td>' +
        '<td><input type="number" step="any" min="0" class="qc-in-box" data-f="shippedKg" value="' + (item.shippedKg || '') + '" placeholder="kg"></td>' +
        '<td><input type="number" step="any" min="0" class="qc-in-box" data-f="stockKg" value="' + (item.stockKg || '') + '" placeholder="kg"></td>' +
        '<td>' +
          '<div class="qc-seg-control" data-idx="' + idx + '">' +
            '<button type="button" class="qc-seg-btn ok' + isOk + '" data-val="O">○</button>' +
            '<button type="button" class="qc-seg-btn ng' + isNg + '" data-val="X">×</button>' +
          '</div>' +
        '</td>' +
        '<td><button type="button" class="pill-btn ghost sm qc-del-prod" data-idx="' + idx + '" style="padding:2px 6px;color:#d92d20;">✕</button></td>' +
        '</tr>';
    }).join('');

    updateFinishedTotals();

    // Product Select Changes
    tbody.querySelectorAll('.qc-prod-select').forEach(function (sel) {
      sel.addEventListener('change', function () {
        if (state.locked) return;
        var tr = sel.closest('tr');
        var idx = Number(tr.getAttribute('data-idx'));
        var code = sel.value;
        var p = PRODUCTS.find(function (x) { return x.code === code; });
        if (p) {
          state.finishedItems[idx].code = p.code;
          state.finishedItems[idx].name = p.name;
          state.finishedItems[idx].spec = p.spec;
          syncMaterialsFromProducts();
          renderProductChips();
          renderFinishedGoodsTable();
          renderMaterialsTable();
          scheduleDraft();
        }
      });
    });

    // Inputs inside finished goods (Focus-safe updates)
    tbody.querySelectorAll('.qc-in-box, .qc-mat-name-box').forEach(function (inp) {
      inp.addEventListener('input', function () {
        if (state.locked) return;
        var tr = inp.closest('tr');
        var idx = Number(tr.getAttribute('data-idx'));
        var f = inp.getAttribute('data-f');
        state.finishedItems[idx][f] = inp.value;

        // Auto bag helper if madeKg entered
        if (f === 'madeKg') {
          var kg = parseFloat(inp.value) || 0;
          var specStr = state.finishedItems[idx].spec || '500g';
          var unitKg = 0.5;
          if (specStr.indexOf('1kg') >= 0 || specStr.indexOf('1000g') >= 0) unitKg = 1.0;
          else if (specStr.indexOf('250g') >= 0) unitKg = 0.25;
          else if (specStr.indexOf('300g') >= 0) unitKg = 0.3;
          else if (specStr.indexOf('350g') >= 0) unitKg = 0.35;
          else if (specStr.indexOf('500g') >= 0) unitKg = 0.5;

          if (kg > 0 && unitKg > 0 && !state.finishedItems[idx].madeBag) {
            state.finishedItems[idx].madeBag = String(Math.round(kg / unitKg));
            var bagInp = tr.querySelector('.qc-fn-bag');
            if (bagInp) bagInp.value = state.finishedItems[idx].madeBag;
          }
        }

        updateFinishedTotals();
        scheduleDraft();
      });
    });

    // First 20 Segmented Button
    tbody.querySelectorAll('.qc-seg-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var par = btn.closest('.qc-seg-control');
        var idx = Number(par.getAttribute('data-idx'));
        state.finishedItems[idx].first20 = btn.getAttribute('data-val');
        updateFinishedTotals();
        checkDeviations();
        par.querySelectorAll('.qc-seg-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        scheduleDraft();
      });
    });

    // Delete Product Row
    tbody.querySelectorAll('.qc-del-prod').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        if (state.finishedItems.length <= 1) {
          alert('최소 1개 이상의 생산 제품이 필요합니다.');
          return;
        }
        var idx = Number(btn.getAttribute('data-idx'));
        state.finishedItems.splice(idx, 1);
        syncMaterialsFromProducts();
        renderProductChips();
        renderFinishedGoodsTable();
        renderMaterialsTable();
        scheduleDraft();
      });
    });
  }

  function readForm() {
    if ($('workDate')) state.workDate = $('workDate').value;
    if ($('lot')) state.lot = $('lot').value;
    if ($('inspector')) state.inspector = $('inspector').value;
    if ($('roundTime1')) state.roundTimes.r1 = $('roundTime1').value || '09:00';
    if ($('roundTime2')) state.roundTimes.r2 = $('roundTime2').value || '13:30';
    if ($('roundTime3')) state.roundTimes.r3 = $('roundTime3').value || '16:30';
    if ($('remarkPreset')) state.remarkPreset = $('remarkPreset').value;
    if ($('deviationNotes')) state.deviationNotes = $('deviationNotes').value;
    if ($('confirmer')) state.confirmer = $('confirmer').value;
    if ($('approver')) state.approver = $('approver').value;
    if (window.DkjApproval) {
      DkjApproval.bindFlat(state, { writer: 'inspector', reviewer: 'confirmer', approver: 'approver' });
    }
  }

  function writeForm() {
    var curDate = state.workDate || todayStr();
    if ($('workDate')) $('workDate').value = curDate;
    if ($('lot')) $('lot').value = state.lot || makeLot(curDate);
    if ($('inspector')) $('inspector').value = state.inspector || '';
    if ($('remarkPreset')) $('remarkPreset').value = state.remarkPreset || '';
    if ($('deviationNotes')) $('deviationNotes').value = state.deviationNotes || '';
    if ($('confirmer')) $('confirmer').value = state.confirmer || '';
    if ($('approver')) $('approver').value = state.approver || '';

    state.photos = state.photos || { chlorinePaper: null, lotPrint: null };

    updateRoundTimeLabels();
    renderProductChips();
    renderMainCheckTable();
    renderFinishedGoodsTable();
    renderMaterialsTable();
    renderPhotoSection();
    checkDeviations();
    if (apvUi) apvUi.render();
  }

  function scheduleDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(async function () {
      readForm();
      (await DkjRecordStore.saveDraft(FORM_ID, state));
      setStatus('임시저장 ' + new Date().toLocaleTimeString(), false);
    }, 400);
  }

  var saveInFlight = false;
  async function save(lock) {
    if (saveInFlight) return;
    saveInFlight = true;
    try {
      readForm();
      if (!state.workDate) { alert('작업일자를 입력하세요.'); return; }
      if (!state.lot) { alert('생산 LOT를 입력하세요.'); return; }
      if (!state.inspector) { alert('QC 검사자를 입력하세요.'); return; }
      checkDeviations();
      var message = validationMessage(state, !!lock);
      if (message) { showValidationError(message); setStatus('저장·확정 불가 — 입력 내용을 확인하세요.', false); return; }
      showValidationError('');

      // 대기 중인 임시저장 타이머를 지운다 — 안 지우면 저장 직후 "저장됨"이 잠깐
      // 떴다가 그 타이머가 뒤늦게 "임시저장"으로 덮어써 버린다.
      clearTimeout(draftTimer);

      var prodNames = (state.finishedItems || []).map(function (f) { return f.name; }).join(', ');
      var rec = (await DkjRecordStore.save(FORM_ID, Object.assign({}, state, {
        id: editingId || undefined,
        locked: !!lock,
        title: 'QC 순회 ' + prodNames + ' (' + state.lot + ')',
        judge: inspectionResult().judge,
        workDate: state.workDate
      })));
      editingId = rec.id;
      state.locked = !!rec.locked;
      setStatus(lock ? '✓ 작성완료 확정됨' : '저장됨 ' + new Date().toLocaleTimeString(), true);
      if (apvUi) apvUi.render();
      (await renderHistory());
    } finally { saveInFlight = false; }
  }

  async function renderHistory() {
    var list = (await DkjRecordStore.list(FORM_ID)).slice(0, 10);
    var el = $('historyList');
    if (!el) return;
    if (!list.length) {
      el.innerHTML = '<p style="color:#888;font-size:13px;">저장된 기록이 없습니다.</p>';
      return;
    }
    el.innerHTML = list.map(function (r) {
      var badgeCls = r.hasDeviation ? 'wip' : 'done';
      var pName = (r.finishedItems && r.finishedItems.length) ? r.finishedItems.map(function(f){return f.name;}).join(', ') : (r.productName || '가공채소');
      return '<div class="dkj-history-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eaecf0;">' +
        '<div><strong>' + (r.workDate || '') + '</strong> · ' + pName + ' / LOT ' + (r.lot || '') +
        ' <span class="badge ' + badgeCls + '">' + (r.judge || '미판정') + '</span></div>' +
        '<div style="display:flex;gap:6px;">' +
        '<button type="button" class="pill-btn ghost sm" data-load="' + r.id + '">불러오기</button>' +
        '<button type="button" class="pill-btn ghost sm" data-del="' + r.id + '">삭제</button>' +
        '</div></div>';
    }).join('');

    el.querySelectorAll('[data-load]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var r = (await DkjRecordStore.get(FORM_ID, btn.getAttribute('data-load')));
        if (!r) return;
        editingId = r.id;
        state = Object.assign(emptyState(), r);
        writeForm();
        // 저장된 기록은 그 자체가 그날의 증거다. 지금 온도 일보 값으로 덮으면
        // 기록 변조가 되므로 연동을 적용하지 않는다(필요하면 '온도 다시 불러오기').
        renderLinkNotice(null);
        setStatus('기록 불러옴', true);
      });
    });

    el.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('삭제하시겠습니까?')) return;
        (await DkjRecordStore.remove(FORM_ID, btn.getAttribute('data-del')));
        (await renderHistory());
      });
    });
  }

  // Exact 1-Page A4 Print Template (100% Matching Excel Layout + Photo Attachments)
  function buildPrintSheet() {
    var p = $('printSheet');
    if (!p) return;
    readForm();

    var t1 = (state.roundTimes && state.roundTimes.r1) || '09:00';
    var t2 = (state.roundTimes && state.roundTimes.r2) || '13:30';
    var t3 = (state.roundTimes && state.roundTimes.r3) || '16:30';

    var groupCounts = {};
    CHECK_ITEMS.forEach(function (it) {
      groupCounts[it.group] = (groupCounts[it.group] || 0) + 1;
    });

    var renderedGroups = {};
    var checkRowsHtml = '';

    CHECK_ITEMS.forEach(function (it) {
      var isFirstOfGroup = !renderedGroups[it.group];
      renderedGroups[it.group] = true;

      var r1Val = state.checks.r1[it.key] || '';
      var r2Val = state.checks.r2[it.key] || '';
      var r3Val = state.checks.r3[it.key] || '';

      if (it.type === 'spec') {
        if (r1Val && r1Val.indexOf('㎜') === -1) r1Val = r1Val + '㎜';
        if (r2Val && r2Val.indexOf('㎜') === -1) r2Val = r2Val + '㎜';
        if (r3Val && r3Val.indexOf('㎜') === -1) r3Val = r3Val + '㎜';
      }

      var isCcp = it.isCcp;
      var fontColor = isCcp ? '#b71c1c' : '#000';
      var fontBold = isCcp ? 'font-weight:bold;' : '';

      checkRowsHtml += '<tr style="height:14pt;">';
      if (isFirstOfGroup) {
        checkRowsHtml += '<td rowspan="' + groupCounts[it.group] + '" style="border:1px solid #000;background:' + (isCcp ? '#ffebee' : '#eef2f6') + ';font-weight:bold;color:' + (isCcp ? '#b71c1c' : '#000') + ';text-align:center;">' + it.group + '</td>';
      }
      checkRowsHtml += '<td style="border:1px solid #000;text-align:center;font-size:7.5pt;color:' + fontColor + ';' + fontBold + '">' + it.proc + '</td>';
      checkRowsHtml += '<td style="border:1px solid #000;text-align:left;padding-left:4px;font-size:7.5pt;font-weight:bold;color:' + fontColor + ';">' + it.label + '</td>';
      checkRowsHtml += '<td style="border:1px solid #000;text-align:left;padding-left:4px;font-size:7.0pt;color:' + fontColor + ';">' + it.std + '</td>';
      checkRowsHtml += '<td style="border:1px solid #000;text-align:center;font-size:8.0pt;font-weight:bold;">' + r1Val + '</td>';
      checkRowsHtml += '<td style="border:1px solid #000;text-align:center;font-size:8.0pt;font-weight:bold;">' + r2Val + '</td>';
      checkRowsHtml += '<td style="border:1px solid #000;text-align:center;font-size:8.0pt;font-weight:bold;">' + r3Val + '</td>';
      checkRowsHtml += '<td style="border:1px solid #000;text-align:left;padding-left:4px;font-size:7.0pt;color:#333;">' + it.act + '</td>';
      checkRowsHtml += '</tr>';
    });

    var matRowsHtml = (state.materials || []).map(function (m, idx) {
      return '<tr style="height:14pt;">' +
        '<td style="border:1px solid #000;text-align:center;font-weight:bold;">주원료 ' + (idx + 1) + '</td>' +
        '<td style="border:1px solid #000;text-align:left;padding-left:4px;">' + (m.name || '') + '</td>' +
        '<td style="border:1px solid #000;text-align:center;">' + (m.ratio || '') + '</td>' +
        '<td style="border:1px solid #000;text-align:right;padding-right:4px;">' + (m.inKg || '') + '</td>' +
        '<td style="border:1px solid #000;text-align:right;padding-right:4px;">' + (m.usedKg || '') + '</td>' +
        '<td style="border:1px solid #000;text-align:right;padding-right:4px;">' + (m.wasteKg || '') + '</td>' +
        '<td style="border:1px solid #000;text-align:center;font-weight:bold;">' + (m.yieldRate ? m.yieldRate + '%' : '') + '</td>' +
        '<td style="border:1px solid #000;text-align:center;">별도 성상 판정 없음</td>' +
        '</tr>';
    }).join('');

    var prodRowsHtml = (state.finishedItems || []).map(function (f) {
      return '<tr style="height:14pt;">' +
        '<td colspan="2" style="border:1px solid #000;font-weight:bold;text-align:left;padding-left:4px;">' + f.name + '</td>' +
        '<td style="border:1px solid #000;text-align:center;">' + f.spec + '</td>' +
        '<td style="border:1px solid #000;font-weight:bold;text-align:right;padding-right:4px;">' + (f.madeKg || '0') + ' kg</td>' +
        '<td style="border:1px solid #000;font-weight:bold;text-align:right;padding-right:4px;">' + (f.madeBag || '0') + ' 봉</td>' +
        '<td style="border:1px solid #000;text-align:right;padding-right:4px;">' + (f.shippedKg || '0') + ' kg</td>' +
        '<td style="border:1px solid #000;text-align:right;padding-right:4px;">' + (f.stockKg || '0') + ' kg</td>' +
        '<td style="border:1px solid #000;font-weight:bold;color:#009a44;text-align:center;">' + (f.first20 || '○') + ' (적합)</td>' +
        '</tr>';
    }).join('');

    var prodTitle = (state.finishedItems && state.finishedItems.length) ? state.finishedItems.map(function(f){return f.name;}).join(', ') : '신선편의 가공채소';

    var photoAttachmentHtml = '<div style="margin-top:6px;border-top:1.5px solid #000;padding-top:4px;page-break-inside:avoid;">' +
      '<div style="font-weight:bold;font-size:8.5pt;margin-bottom:3px;color:#003311;">■ [현장 실물 증빙 첨부] 소독수 유효염소 시험지 및 소비기한/LOT 날인 사진</div>' +
      '<table style="width:100%;border-collapse:collapse;border:1.5px solid #000;text-align:center;">' +
        '<thead>' +
          '<tr style="background:#eef2f6;font-size:8pt;font-weight:bold;">' +
            '<th style="border:1px solid #000;width:50%;padding:3px;">1. [CCP-1BC] 소독수 유효염소 시험지 확인 (200~300 ppm)</th>' +
            '<th style="border:1px solid #000;width:50%;padding:3px;">2. [포장/표시사항] 소비기한 / LOT 날인 상태 확인</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' +
          '<tr>' +
            '<td style="border:1px solid #000;height:60mm;padding:4px;vertical-align:middle;background:#fff;">' +
              (state.photos && state.photos.chlorinePaper ? '<img src="' + state.photos.chlorinePaper + '" style="max-width:100%;max-height:56mm;object-fit:contain;border:1px solid #94a3b8;">' : '<div style="height:50px;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:8pt;">(소독수 시험지 사진 미첨부 / 현장 부착란)</div>') +
            '</td>' +
            '<td style="border:1px solid #000;height:60mm;padding:4px;vertical-align:middle;background:#fff;">' +
              (state.photos && state.photos.lotPrint ? '<img src="' + state.photos.lotPrint + '" style="max-width:100%;max-height:56mm;object-fit:contain;border:1px solid #94a3b8;">' : '<div style="height:50px;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:8pt;">(소비기한/LOT 날인 사진 미첨부 / 현장 부착란)</div>') +
            '</td>' +
          '</tr>' +
        '</tbody>' +
      '</table>' +
    '</div>';

    // 결재칸 — 손서명이 확정된 단계는 서명 그림(+이름), 아니면 이름만(종전 그대로).
    function apvCell(stage, name) {
      var rec = (state.signoff || {})[stage];
      // 그 단계를 확정(서명)한 칸에만 이름/서명 그림을 찍는다 — 결재 전 이름이 미리 찍히지 않게.
      if (!(rec && rec.at)) return '';
      if (global.DkjSignature && global.DkjSignature.isValid(rec.signature)) {
        return global.DkjSignature.cellHtml(rec, rec.name || name || '');
      }
      return String(rec.name || name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    p.innerHTML = '<div style="width:200mm;margin:0 auto;padding:4mm 2mm;font-family:sans-serif;font-size:8.0pt;color:#000;line-height:1.2;">' +
      // 1. Header & Approval Box
      '<div style="display:flex;justify-content:space-between;align-items:stretch;margin-bottom:4px;">' +
        '<div style="flex:1;display:flex;align-items:center;justify-content:center;background:#e8f5e9;border:1.5px solid #000;margin-right:6px;">' +
          '<h1 style="font-size:15pt;font-weight:bold;margin:0;color:#003311;">동김제농협 일일 공정검사일지 (QC 순회·수율)</h1>' +
        '</div>' +
        '<table style="border-collapse:collapse;width:170px;text-align:center;font-size:8pt;border:1.5px solid #000;">' +
          '<tr><th style="border:1px solid #000;background:#eef2f6;width:33%;height:14pt;">작 성</th><th style="border:1px solid #000;background:#eef2f6;width:33%;">검 토</th><th style="border:1px solid #000;background:#eef2f6;width:34%;">승 인</th></tr>' +
          '<tr><td class="qc-sign" style="border:1px solid #000;height:30pt;font-weight:bold;">' + apvCell('writer', state.inspector) + '</td><td class="qc-sign" style="border:1px solid #000;font-weight:bold;">' + apvCell('reviewer', state.confirmer) + '</td><td class="qc-sign" style="border:1px solid #000;font-weight:bold;">' + apvCell('approver', state.approver) + '</td></tr>' +
        '</table>' +
      '</div>' +

      // 2. Meta Info Box
      '<table style="width:100%;border-collapse:collapse;margin-bottom:4px;font-size:8pt;border:1px solid #000;">' +
        '<tr>' +
          '<td style="border:1px solid #000;background:#eef2f6;font-weight:bold;width:12%;text-align:center;height:14pt;">생산 제품</td><td colspan="2" style="border:1px solid #000;text-align:left;padding-left:4px;font-weight:bold;width:38%;">' + prodTitle + '</td>' +
          '<td style="border:1px solid #000;background:#eef2f6;font-weight:bold;width:14%;text-align:center;">문서번호/코드</td><td style="border:1px solid #000;text-align:center;width:14%;">DKJ-QC-001</td>' +
          '<td style="border:1px solid #000;background:#eef2f6;font-weight:bold;width:11%;text-align:center;">생산일자</td><td style="border:1px solid #000;text-align:center;width:11%;">' + state.workDate + '</td>' +
        '</tr>' +
        '<tr>' +
          '<td style="border:1px solid #000;background:#eef2f6;font-weight:bold;text-align:center;height:14pt;">생산 LOT</td><td colspan="2" style="border:1px solid #000;text-align:center;font-weight:bold;color:#009a44;">' + state.lot + '</td>' +
          '<td style="border:1px solid #000;background:#eef2f6;font-weight:bold;text-align:center;">작업 라인</td><td style="border:1px solid #000;text-align:center;">신선편의 가공라인</td>' +
          '<td style="border:1px solid #000;background:#eef2f6;font-weight:bold;text-align:center;">순회 횟수</td><td style="border:1px solid #000;text-align:center;">1일 3회 크로스체크</td>' +
        '</tr>' +
      '</table>' +

      // 3. 28 Check Items Table (With dynamic round times)
      '<table style="width:100%;border-collapse:collapse;border:1.5px solid #000;margin-bottom:4px;">' +
        '<thead style="background:#009a44;color:#fff;font-size:7.5pt;">' +
          '<tr>' +
            '<th rowspan="2" style="border:1px solid #000;width:7%;">구분</th>' +
            '<th rowspan="2" style="border:1px solid #000;width:10%;">세부공정</th>' +
            '<th rowspan="2" style="border:1px solid #000;width:20%;">관리 점검 항목</th>' +
            '<th rowspan="2" style="border:1px solid #000;width:26%;">관리기준 및 판정규격</th>' +
            '<th colspan="3" style="border:1px solid #000;width:21%;">QC 순회 점검 결과 (일일 3회)</th>' +
            '<th rowspan="2" style="border:1px solid #000;width:16%;">이탈 시 조치사항 / 비고</th>' +
          '</tr>' +
          '<tr>' +
            '<th style="border:1px solid #000;width:7%;background:#007a34;">1차(' + t1 + ')</th>' +
            '<th style="border:1px solid #000;width:7%;background:#007a34;">2차(' + t2 + ')</th>' +
            '<th style="border:1px solid #000;width:7%;background:#007a34;">3차(' + t3 + ')</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + checkRowsHtml + '</tbody>' +
      '</table>' +

      // 4. Raw Material In/Out/Waste/Yield Table
      '<div style="background:#eef2f6;border:1px solid #000;border-bottom:none;padding:2px 6px;font-weight:bold;font-size:7.5pt;color:#003311;">■ [생산일지 연계] 원료별 입고량 · 출고(사용)량 · 폐기량 · 실적수율 및 추적성 관리</div>' +
      '<table style="width:100%;border-collapse:collapse;border:1.5px solid #000;margin-bottom:4px;font-size:7.5pt;">' +
        '<thead style="background:#009a44;color:#fff;">' +
          '<tr>' +
            '<th style="border:1px solid #000;width:10%;">원료구분</th><th style="border:1px solid #000;width:20%;">원재료명</th><th style="border:1px solid #000;width:12%;">배합비(BOM)</th>' +
            '<th style="border:1px solid #000;width:13%;">입고량 (kg)</th><th style="border:1px solid #000;width:13%;">출고·사용량(kg)</th><th style="border:1px solid #000;width:13%;">폐기량 (kg)</th>' +
            '<th style="border:1px solid #000;width:11%;">실적수율(%)</th><th style="border:1px solid #000;width:8%;">성상</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + matRowsHtml + '</tbody>' +
      '</table>' +

      // 5. Finished Goods Output Table (Multi-Products)
      '<div style="background:#eef2f6;border:1px solid #000;border-bottom:none;padding:2px 6px;font-weight:bold;font-size:7.5pt;color:#003311;">■ [완제품 생산실적] 당일 제품 생산량 · 완제품 출고량 · 재고 및 관능/첫20팩 점검</div>' +
      '<table style="width:100%;border-collapse:collapse;border:1.5px solid #000;margin-bottom:4px;font-size:7.5pt;text-align:center;">' +
        '<thead style="background:#009a44;color:#fff;">' +
          '<tr><th colspan="2" style="border:1px solid #000;width:24%;">생산 완제품명</th><th style="border:1px solid #000;width:12%;">포장 규격</th><th style="border:1px solid #000;width:14%;">제품 생산량(kg)</th><th style="border:1px solid #000;width:14%;">생산수량(봉/EA)</th><th style="border:1px solid #000;width:14%;">당일 출고량(kg)</th><th style="border:1px solid #000;width:11%;">현재고(kg)</th><th style="border:1px solid #000;width:11%;">첫 20팩 검사</th></tr>' +
        '</thead>' +
        '<tbody>' + prodRowsHtml + '</tbody>' +
      '</table>' +

      // 6. Bottom Notice & Deviations Record
      '<div style="border:1.5px solid #000;padding:4px 6px;font-size:7.5pt;background:#fffee6;line-height:1.3;">' +
        '<div><strong>★ [QC 중점관리]</strong> 가공 시작 시 첫 20팩은 외관·이물·실링·날인 100% 전수 확인 완료 (○)</div>' +
        '<div style="margin-top:2px;"><strong>특이사항 / 이탈 및 조치기록:</strong> ' + (state.deviationNotes || (state.hasDeviation ? '이탈발생 — 조치 내역 미입력' : (inspectionResult().missing ? '미점검 항목 있음' : (state.remarkPreset || '특이사항 미입력')))) + '</div>' +
      '</div>' +
      photoAttachmentHtml +
      '</div>';
  }

  /** 연동으로 채워지는 칸 — 최근기록 복사에서는 가져오지 않고 오늘 값으로 다시 채운다. */
  function linkedCheckKeys() {
    return Object.keys(TEMP_LINK).concat(['c09', 'c10', 'c11', 'c18', 'c19', 'c20', 'c21']);
  }

  /** 가장 최근 저장된 일보에서 '직접 입력하는 점검 내용'만 오늘 새 일보로 복사한다.
   *  - 일자·LOT 는 오늘, 작성자·검토·승인은 지금 화면 값 유지, 결재·서명·감사이력은 초기화
   *  - 연동 칸(온도·CCP-1BC·CCP-2P)은 어제 값이 오늘 값처럼 남으면 안 되므로 비우고 오늘 연동 값으로 채움
   *  - 수량(투입·사용·생산·출고)과 이탈 내용은 그날의 사실이라 비움
   *  - 사진은 복사하되 '전일' 배지를 붙임(오늘 촬영본으로 교체 유도) */
  // 사용자가 직접 손댄 적이 있는지 — 화면을 처음 연 상태(기본값)에서는 복사 확인창을 띄우지 않는다.
  var userTouched = false;
  document.addEventListener('input', function () { userTouched = true; }, true);
  document.addEventListener('change', function () { userTouched = true; }, true);

  async function clonePrev() {
    var list = ((await DkjRecordStore.list(FORM_ID)) || []).filter(function (r) { return r && !r.deleted; });
    if (!list.length) { alert('복사할 이전 저장 기록이 없습니다.'); return; }
    readForm();
    // 저장하지 않은 새 입력이 있으면 덮어쓰기 전에 확인한다.
    if (!editingId && userTouched &&
        !confirm('최근 기록을 복사하면 지금 입력 중인 내용은 사라집니다. 계속할까요?')) return;
    var latest = list[0];
    var fresh = emptyState();
    var linked = linkedCheckKeys();
    if (latest.roundTimes) fresh.roundTimes = Object.assign({}, fresh.roundTimes, latest.roundTimes);
    if (Array.isArray(latest.selectedCodes) && latest.selectedCodes.length) fresh.selectedCodes = latest.selectedCodes.slice();
    if (Array.isArray(latest.materials) && latest.materials.length) {
      fresh.materials = latest.materials.map(function (m) {
        return { name: m.name, ratio: m.ratio, supplier: m.supplier, inKg: '', usedKg: '', wasteKg: '', yieldRate: '' };
      });
    }
    if (Array.isArray(latest.finishedItems) && latest.finishedItems.length) {
      fresh.finishedItems = latest.finishedItems.map(function (f) {
        return { code: f.code, name: f.name, spec: f.spec, madeKg: '', madeBag: '', shippedKg: '', stockKg: '', first20: '' };
      });
    }
    ['r1', 'r2', 'r3'].forEach(function (rk) {
      Object.keys(fresh.checks[rk]).forEach(function (ck) {
        if (linked.indexOf(ck) !== -1) { fresh.checks[rk][ck] = ''; return; }
        var v = latest.checks && latest.checks[rk] && latest.checks[rk][ck];
        if (v !== undefined && v !== null) fresh.checks[rk][ck] = v;
      });
    });
    if (latest.remarkPreset) fresh.remarkPreset = latest.remarkPreset;
    ['chlorinePaper', 'lotPrint'].forEach(function (pk) {
      var p = latest.photos && latest.photos[pk];
      if (typeof p === 'string' && p.indexOf('data:image/') === 0) {
        fresh.photos[pk] = p;
        fresh.photosCarried[pk] = true;
      }
    });
    fresh.inspector = state.inspector || '';
    fresh.confirmer = state.confirmer || '';
    fresh.approver = state.approver || '';
    fresh.approvals = { writer: fresh.inspector, reviewer: fresh.confirmer, approver: fresh.approver };
    editingId = null;
    state = fresh;
    userTouched = false;
    writeForm();
    renderLinkNotice((await applyAllLinks(true)));   // 연동 칸은 오늘 값으로
    renderMainCheckTable();
    checkDeviations();
    scheduleDraft();
    setStatus('최근 기록 복사 — 연동 칸은 오늘 값, 수량 칸은 비움', false);
    if (window.DkjUtil && window.DkjUtil.toast) {
      window.DkjUtil.toast('📋 최근 기록을 불러왔습니다 (일자: 오늘, 연동 칸은 오늘 값으로, 수량 칸은 비움' +
        (fresh.photosCarried.chlorinePaper || fresh.photosCarried.lotPrint ? ', 사진은 \'전일\' 표시 — 오늘 촬영본으로 교체' : '') + ').');
    }
  }

  function bind() {
    if ($('workDate')) {
      $('workDate').addEventListener('change', async function () {
        var d = $('workDate').value || todayStr();
        if ($('lot')) $('lot').value = makeLot(d);
        state.workDate = d;
        // 날짜가 바뀌면 그 날의 온도 일보를 다시 읽는다
        renderLinkNotice((await applyAllLinks(true)));
        renderMainCheckTable();
        checkDeviations();
        scheduleDraft();
      });
    }

    if ($('btnTempSync')) {
      $('btnTempSync').addEventListener('click', async function () {
        if (state.locked) { setStatus('작성완료된 기록은 고칠 수 없습니다.', false); return; }
        readForm();
        var res = (await applyAllLinks(true));
        renderLinkNotice(res);
        renderMainCheckTable();
        checkDeviations();
        scheduleDraft();
        var total = res.temp.filled + res.ccp1.filled + res.ccp2.filled;
        setStatus(total ? ('연동 서식에서 ' + total + '칸을 가져왔습니다.')
          : '가져올 연동 기록이 없습니다.', !!total);
      });
    }

    // Round Time Pickers (1차, 2차, 3차)
    ['1', '2', '3'].forEach(function (num) {
      var inp = $('roundTime' + num);
      if (inp) {
        inp.addEventListener('change', function () {
          state.roundTimes['r' + num] = inp.value || '09:00';
          updateRoundTimeLabels();
          scheduleDraft();
        });
      }
    });

    // Set Now Quick Buttons (🕒 지금시각)
    document.querySelectorAll('[data-set-now]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.locked) return;
        var num = btn.getAttribute('data-set-now');
        var cur = nowTimeStr();
        state.roundTimes['r' + num] = cur;
        updateRoundTimeLabels();
        scheduleDraft();
      });
    });

    // Add Product Row Button
    if ($('btnAddProductRow')) {
      $('btnAddProductRow').addEventListener('click', function () {
        if (state.locked) return;
        var unselected = PRODUCTS.find(function (p) {
          return !(state.finishedItems || []).some(function (f) { return f.code === p.code || f.name === p.name; });
        }) || PRODUCTS[0];

        state.finishedItems.push({
          code: unselected.code,
          name: unselected.name,
          spec: unselected.spec,
          madeKg: '',
          madeBag: '',
          shippedKg: '',
          stockKg: '',
          first20: ''
        });

        syncMaterialsFromProducts();
        renderProductChips();
        renderFinishedGoodsTable();
        renderMaterialsTable();
        scheduleDraft();
      });
    }

    // Add Raw Material Row Button
    if ($('btnAddMatRow')) {
      $('btnAddMatRow').addEventListener('click', function () {
        if (state.locked) return;
        state.materials.push({
          name: '추가 원자재',
          ratio: '—',
          supplier: '협력사',
          inKg: '',
          usedKg: '',
          wasteKg: '',
          yieldRate: ''
        });
        renderMaterialsTable();
        scheduleDraft();
      });
    }

    if ($('btnBulkR1')) {
      $('btnBulkR1').addEventListener('click', function () {
        if (state.locked) return;
        CHECK_ITEMS.forEach(function (it) {
          state.checks.r1[it.key] = it.defaultVal;
        });
        renderMainCheckTable();
        checkDeviations();
        scheduleDraft();
        setStatus('1차 전체 채움 완료', true);
      });
    }

    if ($('btnBulkR2')) {
      $('btnBulkR2').addEventListener('click', function () {
        if (state.locked) return;
        CHECK_ITEMS.forEach(function (it) {
          state.checks.r2[it.key] = it.defaultVal;
        });
        renderMainCheckTable();
        checkDeviations();
        scheduleDraft();
        setStatus('2차 전체 채움 완료', true);
      });
    }

    if ($('btnBulkR3')) {
      $('btnBulkR3').addEventListener('click', function () {
        if (state.locked) return;
        CHECK_ITEMS.forEach(function (it) {
          state.checks.r3[it.key] = it.defaultVal;
        });
        renderMainCheckTable();
        checkDeviations();
        scheduleDraft();
        setStatus('3차 전체 채움 완료', true);
      });
    }

    if ($('btnSave')) $('btnSave').addEventListener('click', async function () { (await save(false)); });
    if ($('btnLock')) $('btnLock').addEventListener('click', async function () { (await save(true)); });
    if ($('btnNew')) {
      $('btnNew').addEventListener('click', function () {
        editingId = null;
        state = emptyState();
        writeForm();
        setStatus('새 일보', false);
      });
    }

    if ($('btnClonePrev')) {
      $('btnClonePrev').addEventListener('click', async function () {
        if (state.locked) { setStatus('작성완료된 기록은 고칠 수 없습니다. [새 일보]를 누른 뒤 복사하세요.', false); return; }
        (await clonePrev());
      });
    }

    if ($('btnPrint')) {
      $('btnPrint').addEventListener('click', function () {
        buildPrintSheet();
        window.print();
      });
    }

    ['workDate', 'lot', 'inspector', 'remarkPreset', 'deviationNotes', 'confirmer', 'approver'].forEach(function (id) {
      var el = $(id);
      if (el) {
        el.addEventListener('input', scheduleDraft);
        el.addEventListener('change', scheduleDraft);
      }
    });

    if (window.DkjApproval) {
      apvUi = DkjApproval.mount({
        // 한 번도 저장 안 한 새 시트에서 결재를 누르면 먼저 저장한다(검증 포함) — 안 그러면 서명이
        // 이 기기 임시본에만 남아 다른 기기의 검토·승인자에게 보이지 않았다(2026-10-23 점검).
        ensureSaved: async function () { if (!editingId) (await save(false)); return !!editingId; },
        stages: ['writer', 'reviewer', 'approver'],
        beforeSign: allowComplete,
        getState: function () { readForm(); return state; },
        // 결재 서명은 임시저장(이 기기에만 남고 클라우드 동기화 안 됨)이 아니라
        // 실제 저장 레코드에 바로 반영해야 다른 기기·다른 사람에게도 보인다.
        onChange: async function () {
          if (editingId) {
            // title/judge/workDate 는 save() 안에서만 계산되고 state 에는 남지 않으므로,
            // 이전에 저장된 기록을 바탕으로 덮어써야 결재만 눌러도 제목이 비지 않는다.
            var prev = (await DkjRecordStore.get(FORM_ID, editingId)) || {};
            (await DkjRecordStore.save(FORM_ID, Object.assign({}, prev, state, { id: editingId, judge: inspectionResult().judge })));
            setStatus('결재 저장됨 · ' + new Date().toLocaleTimeString('ko-KR'), true);
            (await renderHistory());
          } else {
            scheduleDraft();
          }
        }
      });
    }
  }

  async function init() {
    var draft = (await DkjRecordStore.loadDraft(FORM_ID));
    if (draft) {
      state = Object.assign(emptyState(), draft);
    } else {
      state.workDate = todayStr();
      state.lot = makeLot(state.workDate);
    }
    // 달력·콘솔에서 ?date= 로 들어오면 그 날짜의 최종 저장 기록을 자동으로 연다(js/dkj-date-autoload.js).
    // 저장된 기록은 그날의 증거라 연동 값으로 덮지 않는다. 기록이 없으면 그 날짜의 새 시트(연동 적용).
    var dateMatch = global.DkjDateLoad ? DkjDateLoad.match.byField('workDate') : null;
    var openedByDate = false;
    var qd = dateMatch ? DkjDateLoad.queryDate() : '';
    if (qd) {
      var firstHit = (await DkjDateLoad.resolve(FORM_ID, qd, dateMatch));
      if (firstHit.kind === 'record') {
        editingId = firstHit.data.id || null;
        state = Object.assign(emptyState(), firstHit.data);
        openedByDate = true;
      } else if (firstHit.kind === 'draft') {
        state = Object.assign(emptyState(), firstHit.data);
        draft = firstHit.data;
      } else {
        draft = null;
        state = emptyState();
        state.workDate = qd;
        state.lot = makeLot(qd);
      }
    }
    
    // 검사자(작성)는 로그인한 사람 이름으로 채운다(추적성) — 다른 사람이 로그인해도
    // 늘 같은 이름이 미리 채워져 있으면 확인 없이 그대로 저장될 위험이 있어, 이전엔
    // 고정된 이름(최민재/권화선/최재원)을 기본값으로 뒀었지만 없앴다. 검토·승인자는
    // 강제 기본값을 두지 않고 화면에서 드롭다운으로 바로 고르게 한다.
    var qcMe = global.DkjAuth && typeof global.DkjAuth.user === 'function' ? global.DkjAuth.user() : null;
    if (!state.inspector && qcMe && qcMe.name) state.inspector = qcMe.name;
    state.approvals = {
      writer: state.inspector,
      reviewer: state.confirmer,
      approver: state.approver
    };

    // 작성 중인 시트는 열 때마다 온도 일보 값으로 맞춘다 — 온도 기록의 정본은
    // 온도 일보이고, 두 서식에 서로 다른 값이 남는 것을 막는 것이 연동의 목적이다.
    // 저장된 기록을 불러올 때는 덮지 않는다(아래 renderHistory 의 불러오기).
    // 임시본을 복원한 경우에는 이미 적어 둔 값을 지우지 않는다(clearMissing=false).
    var initLink = openedByDate ? null : (await applyAllLinks(!draft));

    writeForm();
    renderLinkNotice(initLink);
    bind();
    (await renderHistory());
    if (dateMatch) {
      DkjDateLoad.watch(function (el) { return el.id === 'workDate'; }, async function (date) {
        var hit = (await DkjDateLoad.resolve(FORM_ID, date, dateMatch));
        if (hit.kind === 'none') return;
        if (hit.kind === 'record' && hit.data.id && hit.data.id === editingId) return;
        // 아직 저장하지 않은 새 입력이 있으면 덮어쓰기 전에 확인한다.
        if (!editingId && !confirm(date + ' 저장 기록을 불러오면 지금 입력 중인 내용은 사라집니다. 불러올까요?')) return;
        editingId = hit.data.id || null;
        state = Object.assign(emptyState(), hit.data);
        writeForm();
        renderLinkNotice(null);   // 불러온 기록은 연동으로 덮지 않는다
        setStatus(hit.kind === 'record' ? date + ' 저장 기록 불러옴' : date + ' 임시저장 불러옴', true);
      });
    }

    // staff picker 변환 후에도 DKJ-QC-001 전용 값 강제 동기화
    setTimeout(function () {
      if ($('inspector')) $('inspector').value = state.inspector;
      if ($('confirmer')) $('confirmer').value = state.confirmer;
      if ($('approver')) $('approver').value = state.approver;
      if (apvUi) apvUi.render();
    }, 50);

    setStatus('준비 완료', false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else (await init());

})(window);
