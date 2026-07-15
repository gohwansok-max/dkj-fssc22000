/**
 * 동김제 정본형 CCP 인쇄 레이아웃 (HWP 점검표 구조 복제)
 * DkjPrintOfficial.ccp2p(state) / .ccp1bc(state)
 */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function ox(v) {
    if (v === 'O' || v === '○') return '○';
    if (v === 'X' || v === '×') return '×';
    return v ? esc(v) : '';
  }

  function ymdParts(iso) {
    if (!iso || iso.length < 10) return { y: '', m: '', d: '', w: '' };
    var d = new Date(iso + 'T12:00:00');
    var week = ['일', '월', '화', '수', '목', '금', '토'];
    return {
      y: iso.slice(0, 4),
      m: iso.slice(5, 7),
      d: iso.slice(8, 10),
      w: isNaN(d.getTime()) ? '' : week[d.getDay()]
    };
  }

  function signBox(writer, reviewer, approver) {
    return (
      '<table class="off-apv">' +
      '<tr><th class="off-apv-lab" rowspan="2">결<br>재</th>' +
      '<th>작성</th><th>검토</th><th>승인</th></tr>' +
      '<tr><td class="off-sign">' + esc(writer || '') + '</td>' +
      '<td class="off-sign">' + esc(reviewer || '') + '</td>' +
      '<td class="off-sign">' + esc(approver || '') + '</td></tr>' +
      '</table>'
    );
  }

  /** 정본 헤더: 양식번호|제정|개정 / 제목 / 결재 */
  function officialHeader(opt) {
    var revDate = opt.reviseDate && opt.reviseDate !== '-' ? opt.reviseDate : '-';
    return (
      '<table class="off-head">' +
      '<tr>' +
      '<td class="off-meta">' +
      '<table class="off-meta-in">' +
      '<tr><th>양식번호</th><td>' + esc(opt.docNo) + '</td></tr>' +
      '<tr><th>제정일자</th><td>' + esc(opt.enactDate) + '</td></tr>' +
      '<tr><th>개정번호</th><td>' + esc(opt.rev) + '</td></tr>' +
      '<tr><th>개정일자</th><td>' + esc(revDate) + '</td></tr>' +
      '</table></td>' +
      '<td class="off-title-cell">' +
      '<div class="off-title">' + esc(opt.title) + '</div>' +
      '<div class="off-sub">' + esc(opt.subtitle) + '</div>' +
      '</td>' +
      '<td class="off-apv-wrap">' + signBox(opt.writer, opt.reviewer, opt.approver) + '</td>' +
      '</tr></table>'
    );
  }

  function ccp2p(state) {
    state = state || {};
    var dt = ymdParts(state.workDate);
    var writer = state.monitorName || '';
    var prod = state.productName || '';
    var rows = (state.rows || []).slice();
    while (rows.length < 6) {
      rows.push({
        time: '', fe: '', sus: '', prodOnly: '', prodFe: '', prodSus: '',
        adjust: '', stable: '', judge: '', sign: ''
      });
    }

    var monBody = rows.map(function (r, i) {
      var label = '';
      if (i === 0) label = '작업시작 전';
      else if (i === rows.length - 1) label = '작업종료 시';
      var nameCell = label
        ? '<td class="c strong">' + label + '</td>'
        : '<td class="l">' + esc(i === 1 ? prod : (r.productName || '')) + '</td>';
      return (
        '<tr>' + nameCell +
        '<td class="c">' + esc(r.time || '') + '</td>' +
        '<td class="c">' + ox(r.fe) + '</td>' +
        '<td class="c">' + ox(r.sus) + '</td>' +
        '<td class="c">' + ox(r.prodOnly || '') + '</td>' +
        '<td class="c">' + ox(r.prodFe) + '</td>' +
        '<td class="c">' + ox(r.prodSus) + '</td>' +
        '<td class="c">' + esc(r.adjust || '') + '</td>' +
        '<td class="c">' + esc(r.stable || '') + '</td>' +
        '<td class="c">' + (r.judge ? ox(r.judge) : '') + '</td>' +
        '<td class="c">' + esc(r.sign || (r.time ? writer : '')) + '</td></tr>'
      );
    }).join('');

    var passRows = (state.passLog || [
      {
        productName: prod,
        start: (state.rows && state.rows[0] && state.rows[0].time) || '',
        end: (state.rows && state.rows[state.rows.length - 1] && state.rows[state.rows.length - 1].time) || '',
        ok: state.hasDeviation ? '×' : '',
        qty: state.passQty || '',
        note: state.remark || ''
      }
    ]).map(function (p) {
      return '<tr>' +
        '<td class="l">' + esc(p.productName) + '</td>' +
        '<td class="c">' + esc(p.start) + '</td>' +
        '<td class="c">' + esc(p.end) + '</td>' +
        '<td class="c">' + ox(p.ok) + '</td>' +
        '<td class="c">' + esc(p.qty) + '</td>' +
        '<td class="l">' + esc(p.note) + '</td></tr>';
    }).join('');

    var hasDev = !!(state.deviation || state.corrective || state.hasDeviation);
    var devBody = hasDev
      ? '<tr>' +
        '<td class="c">' + esc((state.rows && state.rows.find(function (r) { return r.judge === 'X'; }) || {}).time || '') + '</td>' +
        '<td class="l">' + esc(state.deviation || '한계기준 이탈') + '</td>' +
        '<td class="l">' + esc(state.corrective || '') + '</td>' +
        '<td class="c"></td>' +
        '<td class="c">' + esc(writer) + '</td>' +
        '<td class="c">' + esc(state.confirmer || '') + '</td></tr>'
      : '<tr><td style="height:16pt"></td><td></td><td></td><td></td><td></td><td></td></tr>' +
        '<tr><td style="height:16pt"></td><td></td><td></td><td></td><td></td><td></td></tr>';

    /* 정본 HWP 문구 — 한계기준·모니터링·이탈조치 */
    var limitTable =
      '<table class="off-nest">' +
      '<tr class="off-nest-hd">' +
      '<th colspan="2">구분</th><th>Fe (철)</th><th>SUS (비철)</th><th>물성보정</th><th>안정도</th></tr>' +
      '<tr><td class="c" rowspan="3">신선편의식품</td><td class="l">중량 500g 이하</td>' +
      '<td class="c">2.0mm이상 불검출</td><td class="c">3.0mm이상 불검출</td><td class="c">70</td><td class="c">450</td></tr>' +
      '<tr><td class="l">중량 500g 이상</td>' +
      '<td class="c">2.5mm이상 불검출</td><td class="c">3.5mm이상 불검출</td><td class="c">70</td><td class="c">954</td></tr>' +
      '<tr><td class="l">중량 1kg 이상</td>' +
      '<td class="c">3.0mm이상 불검출</td><td class="c">3.5mm이상 불검출</td><td class="c">70</td><td class="c">252</td></tr>' +
      '<tr><td class="l" colspan="2">부재료(기타가공품)</td>' +
      '<td class="c">1.5mm이상 불검출</td><td class="c">2.5mm이상 불검출</td><td class="c">70</td><td class="c">70</td></tr>' +
      '</table>';

    var methodHtml =
      '*작업시작 전에 금속검출기 감도 및 정상 작동여부 확인 ※ 반드시 표준시편(Fe, Sus) 알코올 소독 후 실시<br>' +
      '*표준시편(Fe 1.5/2.0/2.5/3.0mm, Sus 2.5/3.0/3.5mm) 만 통과시켜 검출 여부 확인, 기록<br>' +
      '*금속이물이 없는 것으로 확인된 공정품을 통과시켜 검출 여부 확인<br>' +
      '*표준시편(Fe 1.5/2.0/2.5/3.0mm, Sus 2.5/3.0/3.5mm)와 제품을 함께 통과시켜 검출 여부 확인, 기록<br>' +
      '* 검출 확인 : 검출 - O , 불검출 - X 해당 없음 -';

    var correctiveHtml =
      '<strong>1. 제품에서 금속성 이물질 혼입시</strong><br>' +
      '- 즉시 작업 중단 후 해당 제품을 부적합품 보관장소에 식별 보관, 제품에 혼입된 금속성 이물의 혼입 경로를 파악한다. ' +
      '금속검출공정담당자는 금속검출기 정상 작동 여부, 감도 확인 후 이상 없을 시 작업을 재개한다.<br>' +
      '<strong>2. 금속검출기 감도 이상 발생시</strong><br>' +
      '- 즉시 작업 중단 후 해당 제품을 부적합품 보관장소에 식별 보관, 금속검출기 감도 조정, 표준시편으로 정상 작동 여부를 확인한 후 ' +
      '이상 발생 전 정상 작동 확인 시점 이후 제품을 전량 회수하여 재통과시킨다.<br>' +
      '<strong>3. 금속검출공정 관련 시설, 설비류 고장시</strong><br>' +
      '- 즉시 작업 중단 후 해당 제품을 부적합품 보관장소에 식별 보관, 즉시 수리가 완료될 경우 표준시편으로 정상 작동 여부를 확인한 후 ' +
      '작업을 재개하고 이상 발생 전 정상 작동 확인 시점 이후 제품을 전량 회수하여 재통과시킨다. ' +
      '즉시 수리가 불가능할 경우 해당 제품은 별도 식별 보관(냉장보관)하여 수리 완료 후 정상 작동 여부를 확인하고 전량 재통과시킨다.<br>' +
      '<strong>※ 공통 :</strong> 금속검출공정담당자는 한계기준 이탈 시 이탈내용과 개선조치내용을 CCP점검표에 기록하여 ' +
      '생산팀장의 검토 후 HACCP팀장의 승인을 얻은 후 기록 관리한다.';

    return (
      '<div class="ps-page off-ccp">' +
      officialHeader({
        docNo: 'DKJ-H-01-02',
        enactDate: '2024. 02. 13',
        rev: '0',
        reviseDate: '-',
        title: '중요관리점(CCP-2P) 점검표',
        subtitle: '금속검출 공정',
        writer: writer,
        reviewer: state.confirmer || '',
        approver: state.approver || ''
      }) +

      '<table class="off-grid off-topmeta">' +
      '<tr>' +
      '<th class="lab" style="width:12%">작성일자</th>' +
      '<td class="l" style="width:55%">' +
      (dt.y || '　　') + ' 년 &nbsp;&nbsp;' + (dt.m || '　') + ' 월 &nbsp;&nbsp;' + (dt.d || '　') +
      ' 일 &nbsp;(&nbsp;' + (dt.w || '　') + '&nbsp;)요일' +
      '</td>' +
      '<th class="lab" style="width:12%">작 성 자</th>' +
      '<td class="c" style="width:21%">' + esc(writer) + '</td>' +
      '</tr>' +
      '<tr>' +
      '<th class="lab">위해요소</th>' +
      '<td class="l" colspan="3">Fe, Sus 등 금속성 이물 (금속조각, 볼트, 너트 등)</td>' +
      '</tr>' +
      '<tr>' +
      '<th class="lab">한계기준</th>' +
      '<td class="pad0" colspan="3">' + limitTable + '</td>' +
      '</tr>' +
      '<tr>' +
      '<th class="lab">모니터링<br>주기</th>' +
      '<td class="l" colspan="3">작업시작 전, 작업 중 매 2시간 마다, 품목 변경시, 작업종료 시</td>' +
      '</tr>' +
      '<tr>' +
      '<th class="lab">모니터링<br>방법</th>' +
      '<td class="l tiny" colspan="3">' + methodHtml + '</td>' +
      '</tr>' +
      '</table>' +

      '<div class="off-sec">● 금속검출공정(CCP-2P) 모니터링 결과 ●</div>' +
      '<table class="off-grid off-mon">' +
      '<thead>' +
      '<tr>' +
      '<th rowspan="2" style="width:11%">품명</th>' +
      '<th rowspan="2" style="width:8%">점검시간</th>' +
      '<th colspan="2">표준시편만 통과 시<br>(기기 중간)</th>' +
      '<th rowspan="2" style="width:8%">제품만<br>통과 시</th>' +
      '<th colspan="2">제품과 표준시편 함께 통과<br>(기기 중간, 제품 밑/위)</th>' +
      '<th rowspan="2" style="width:7%">물성<br>보정</th>' +

      '<th rowspan="2" style="width:7%">안정도</th>' +
      '<th rowspan="2" style="width:8%">판정<br>(○/×)</th>' +
      '<th rowspan="2" style="width:7%">서명</th>' +
      '</tr>' +
      '<tr><th>Fe</th><th>Sus</th><th>제품+Fe</th><th>제품+Sus</th></tr>' +
      '</thead><tbody>' + monBody + '</tbody></table>' +

      '<table class="off-grid off-correct">' +
      '<tr>' +
      '<th class="lab vert">이탈시<br>개선조치<br>방법</th>' +
      '<td class="l tiny">' + correctiveHtml + '</td>' +
      '</tr></table>' +

      '<div class="off-sec">금속검출기 제품 통과 시 이탈 여부</div>' +
      '<table class="off-grid">' +
      '<thead><tr>' +
      '<th>제품명</th><th>최초 통과시간</th><th>통과 종료시간</th><th>이탈여부(○/×)</th><th>통과량</th><th>특이사항</th>' +
      '</tr></thead><tbody>' + passRows + '</tbody></table>' +

      '<div class="off-sec">한계기준 이탈 발생 내역 및 개선 조치 사항</div>' +
      '<table class="off-grid">' +
      '<thead><tr>' +
      '<th style="width:10%">발생시간</th><th style="width:22%">한계기준 이탈사항</th>' +
      '<th style="width:28%">개선조치 및 결과</th><th style="width:12%">개선조치시간</th>' +
      '<th style="width:12%">조치자</th><th style="width:12%">확인자</th>' +
      '</tr></thead><tbody>' + devBody + '</tbody></table>' +

      '<div class="off-foot">동김제농협 가공센터 · FSSC22000 · DKJ-H-01-02</div>' +
      '</div>'
    );
  }

  function ccp1bc(state) {
    state = state || {};
    var dt = ymdParts(state.workDate);
    var writer = state.monitorName || '';
    var rows = (state.rows || []).slice();
    while (rows.length < 5) rows.push({ time: '', ppm: '', soak: '', rinse: '', judge: '' });

    var body = rows.map(function (r, i) {
      var tag = i === 0 ? '작업시작 전' : (i === rows.length - 1 ? '작업 종료 시' : '');
      return '<tr>' +
        '<td class="c">' + (tag || esc(state.productName || '')) + '</td>' +
        '<td class="c">' + esc(r.time || '') + '</td>' +
        '<td class="c">' + esc(r.ppm || '') + '</td>' +
        '<td class="c">' + esc(r.soak || '') + '</td>' +
        '<td class="c">' + ox(r.rinse) + '</td>' +
        '<td class="c">' + (r.judge ? ox(r.judge) : '○ / ×') + '</td>' +
        '<td class="c">' + esc(r.time ? writer : '') + '</td></tr>';
    }).join('');

    var hasDev = !!(state.deviation || state.corrective || state.hasDeviation);
    var devBody = hasDev
      ? '<tr><td class="c"></td><td class="l">' + esc(state.deviation || '') + '</td>' +
        '<td class="l">' + esc(state.corrective || '') + '</td><td class="c"></td>' +
        '<td class="c">' + esc(writer) + '</td><td class="c">' + esc(state.confirmer || '') + '</td></tr>'
      : '<tr><td style="height:18pt"></td><td></td><td></td><td></td><td></td><td></td></tr>';

    return (
      '<div class="ps-page off-ccp">' +
      officialHeader({
        docNo: 'DKJ-H-01-01',
        enactDate: '2024. 02. 13',
        rev: '0',
        reviseDate: '-',
        title: '중요관리점(CCP-1BC) 점검표',
        subtitle: '소독·헹굼 공정',
        writer: writer,
        reviewer: state.confirmer || '',
        approver: state.approver || ''
      }) +
      '<table class="off-date"><tr><td class="l">' +
      esc(dt.y) + ' 년 &nbsp;' + esc(dt.m) + ' 월 &nbsp;' + esc(dt.d) + ' 일 &nbsp;(&nbsp;' + esc(dt.w) + '&nbsp;요일)' +
      '</td><td class="r">작성자: ' + esc(writer) + '</td></tr></table>' +

      '<table class="off-grid">' +
      '<tr><th class="lab" style="width:14%">위해요소</th>' +
      '<td class="l" colspan="4">병원성미생물 (교차오염·잔류 소독제 등)</td></tr>' +
      '<tr><th class="lab">관리기준<br>(한계기준)</th>' +
      '<td class="l" colspan="4">유효염소농도 ' + esc(state.clMin || 50) + ' ~ ' + esc(state.clMax || 200) +
      ' ppm · 침지시간 ≥ ' + esc(state.timeMin || 60) + ' 초 · 헹굼 완료</td></tr>' +
      '<tr><th class="lab">모니터링<br>주기</th>' +
      '<td class="l" colspan="4">작업 시작 전 · 작업 중 LOT별(또는 2시간) · 작업 종료 시 · 소독액 교체 시</td></tr>' +
      '<tr><th class="lab">모니터링<br>방법</th>' +
      '<td class="l tiny" colspan="4">' +
      '1. 소독액 유효염소농도를 시험지로 측정한다.<br>' +
      '2. 침지시간을 확인하고 헹굼 완료 여부를 확인한다.<br>' +
      '3. 한계기준 이탈 시 즉시 생산중지·격리 후 개선조치한다.' +
      '</td></tr>' +
      '<tr><th class="lab">품명/LOT</th>' +
      '<td class="l" colspan="4">' + esc(state.productName || '') + ' / ' + esc(state.lot || '') +
      ' · 소독제: ' + esc(state.disinfectant || '') + '</td></tr></table>' +

      '<div class="off-sec">● 소독·헹굼공정(CCP-1BC) 모니터링 결과 ●</div>' +
      '<table class="off-grid off-mon">' +
      '<thead><tr>' +
      '<th>품명</th><th>점검시간</th><th>유효염소(ppm)</th><th>침지시간(초)</th><th>헹굼</th><th>판정(○/×)</th><th>서명</th>' +
      '</tr></thead><tbody>' + body + '</tbody></table>' +

      '<div class="off-sec">이탈 시 개선조치 방법</div>' +
      '<div class="off-box tiny">' +
      '1. 즉시 해당 LOT를 격리하고 소독액 농도·침지시간을 재설정한다.<br>' +
      '2. 재측정 적합 확인 후 생산을 재개하고 이탈·조치 내용을 기록한다.' +
      '</div>' +

      '<div class="off-sec">한계기준 이탈 발생 내역 및 개선 조치 사항</div>' +
      '<table class="off-grid">' +
      '<thead><tr>' +
      '<th>발생시간</th><th>한계기준 이탈사항</th><th>개선조치 및 결과</th>' +
      '<th>개선조치시간</th><th>조치자</th><th>확인자</th>' +
      '</tr></thead><tbody>' + devBody + '</tbody></table>' +

      '<div class="off-foot">동김제농협 가공센터 · FSSC22000 · DKJ-H-01-01</div>' +
      '</div>'
    );
  }

  global.DkjPrintOfficial = { ccp2p: ccp2p, ccp1bc: ccp1bc };
})(window);
