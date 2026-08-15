/**
 * 동김제 정본형 인쇄 레이아웃 (HWP 점검표 구조 복제)
 * CCP: ccp2p / ccp1bc · PRP: prpOx / prpMonTh
 */
(function (global) {
  'use strict';

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
        '<td class="c">' + esc(r.adjust || (r.time ? state.adjust : '') || '') + '</td>' +
        '<td class="c">' + esc(r.stable || (r.time ? state.stable : '') || '') + '</td>' +
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

      '<div class="off-foot">동김제농협 산지유통센터 · FSSC22000 · DKJ-H-01-02</div>' +
      '</div>'
    );
  }

  function ccp1bc(state) {
    state = state || {};
    var dt = ymdParts(state.workDate);
    var writer = state.monitorName || '';
    var prod = state.productName || '';
    var rows = (state.rows || []).slice();
    while (rows.length < 6) {
      rows.push({ time: '', ppm: '', soak: '', rinse: '', judge: '' });
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
        '<td class="c">' + esc(r.ppm || '') + '</td>' +
        '<td class="c">' + esc(r.soak || '') + '</td>' +
        '<td class="c">' + ox(r.rinse) + '</td>' +
        '<td class="c">' + (r.judge ? ox(r.judge) : '') + '</td>' +
        '<td class="c">' + esc(r.sign || (r.time ? writer : '')) + '</td></tr>'
      );
    }).join('');

    var lotRows = (state.lotLog || [{
      productName: prod,
      lot: state.lot || '',
      start: (state.rows && state.rows[0] && state.rows[0].time) || '',
      end: (state.rows && state.rows[state.rows.length - 1] && state.rows[state.rows.length - 1].time) || '',
      ok: state.hasDeviation ? '×' : '',
      qty: state.processQty || '',
      note: state.remark || ''
    }]).map(function (p) {
      return '<tr>' +
        '<td class="l">' + esc(p.productName) + '</td>' +
        '<td class="c">' + esc(p.lot) + '</td>' +
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

    var limitTable =
      '<table class="off-nest">' +
      '<tr class="off-nest-hd"><th>구분</th><th>항목</th><th>한계기준</th><th>측정방법</th></tr>' +
      '<tr><td class="c" rowspan="2">소독</td><td class="l">유효염소농도</td>' +
      '<td class="c">' + esc(state.clMin || 50) + ' ~ ' + esc(state.clMax || 200) + ' ppm</td>' +
      '<td class="c">시험지 측정</td></tr>' +
      '<tr><td class="l">침지시간</td><td class="c">≥ ' + esc(state.timeMin || 60) + ' 초</td>' +
      '<td class="c">타이머·관찰</td></tr>' +
      '<tr><td class="c">헹굼</td><td class="l">헹굼완료</td><td class="c">잔류 소독제 없음</td>' +
      '<td class="c">육안·촉각 확인</td></tr>' +
      '</table>';

    var methodHtml =
      '* 작업시작 전 소독액 유효염소농도(시험지) 측정 및 침지시간·헹굼상태 확인<br>' +
      '* 작업 중 LOT별(또는 2시간 이내) 유효염소농도, 침지시간, 헹굼 상태 확인<br>' +
      '* 소독액 교체 시 농도 재측정 후 기록<br>' +
      '* 품목 변경·작업종료 시 재측정·기록<br>' +
      '* 판정 : 적합 - ○ , 부적합 - × , 해당 없음 -';

    var correctiveHtml =
      '<strong>1. 유효염소농도 한계기준 이탈 시</strong><br>' +
      '- 즉시 작업을 중단하고 해당 LOT(제품)을 부적합품 보관장소에 격리·식별한다. ' +
      '소독액을 교체하거나 농도를 재조정한 후 시험지로 재측정하여 한계기준 이내임을 확인한다. ' +
      '이탈 발생 전 정상 확인 시점 이후 처리된 제품에 대해 재평가 후 필요시 재소독·재헹굼한다.<br>' +
      '<strong>2. 침지시간 미달 시</strong><br>' +
      '- 즉시 작업 중단, 해당 제품 격리, 침지시간 확보 후 재소독·재헹굼 처리한다.<br>' +
      '<strong>3. 헹굼 미완료 시</strong><br>' +
      '- 즉시 작업 중단, 해당 제품 격리, 충분한 헹굼 후 재평가한다.<br>' +
      '<strong>※ 공통 :</strong> 소독·헹굼공정담당자는 한계기준 이탈 시 이탈내용과 개선조치내용을 CCP점검표에 기록하여 ' +
      '생산팀장의 검토 후 HACCP팀장의 승인을 얻은 후 기록 관리한다.';

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
      '<tr><th class="lab">위해요소</th>' +
      '<td class="l" colspan="3">병원성미생물 (교차오염·잔류 소독제·미생물 증식 등)</td></tr>' +
      '<tr><th class="lab">한계기준</th>' +
      '<td class="pad0" colspan="3">' + limitTable + '</td></tr>' +
      '<tr><th class="lab">모니터링<br>주기</th>' +
      '<td class="l" colspan="3">작업시작 전, 작업 중 LOT별(또는 2시간), 품목 변경시, 작업종료 시, 소독액 교체 시</td></tr>' +
      '<tr><th class="lab">모니터링<br>방법</th>' +
      '<td class="l tiny" colspan="3">' + methodHtml + '</td></tr>' +
      '<tr><th class="lab">품명/LOT</th>' +
      '<td class="l" colspan="3">' + esc(prod) + ' / ' + esc(state.lot || '') +
      ' · 소독제: ' + esc(state.disinfectant || 'NaOCl') + '</td></tr>' +
      '</table>' +

      '<div class="off-sec">● 소독·헹굼공정(CCP-1BC) 모니터링 결과 ●</div>' +
      '<table class="off-grid off-mon">' +
      '<thead><tr>' +
      '<th style="width:14%">품명</th><th style="width:10%">점검시간</th>' +
      '<th style="width:12%">유효염소<br>(ppm)</th><th style="width:12%">침지시간<br>(초)</th>' +
      '<th style="width:8%">헹굼</th><th style="width:10%">판정<br>(○/×)</th><th style="width:10%">서명</th>' +
      '</tr></thead><tbody>' + monBody + '</tbody></table>' +

      '<table class="off-grid off-correct">' +
      '<tr><th class="lab vert">이탈시<br>개선조치<br>방법</th>' +
      '<td class="l tiny">' + correctiveHtml + '</td></tr></table>' +

      '<div class="off-sec">소독·헹굼 처리 LOT별 이탈 여부</div>' +
      '<table class="off-grid">' +
      '<thead><tr>' +
      '<th>품명</th><th>LOT번호</th><th>최초 처리시간</th><th>종료시간</th>' +
      '<th>이탈여부(○/×)</th><th>처리량</th><th>특이사항</th>' +
      '</tr></thead><tbody>' + lotRows + '</tbody></table>' +

      '<div class="off-sec">한계기준 이탈 발생 내역 및 개선 조치 사항</div>' +
      '<table class="off-grid">' +
      '<thead><tr>' +
      '<th style="width:10%">발생시간</th><th style="width:22%">한계기준 이탈사항</th>' +
      '<th style="width:28%">개선조치 및 결과</th><th style="width:12%">개선조치시간</th>' +
      '<th style="width:12%">조치자</th><th style="width:12%">확인자</th>' +
      '</tr></thead><tbody>' + devBody + '</tbody></table>' +

      '<div class="off-foot">동김제농협 산지유통센터 · FSSC22000 · DKJ-H-01-01</div>' +
      '</div>'
    );
  }

  function areaLabel(code, labels) {
    var map = {
      '전처리': '전처리실',
      '소독헹굼': '소독·헹굼실',
      '포장': '포장실',
      '냉장': '냉장창고',
      '전체': '작업장 전체'
    };
    if (labels && labels[code]) return labels[code];
    return map[code] || code || '';
  }

  function dateCell(dt) {
    return (dt.y || '　　') + ' 년 &nbsp;&nbsp;' + (dt.m || '　') + ' 월 &nbsp;&nbsp;' + (dt.d || '　') +
      ' 일 &nbsp;(&nbsp;' + (dt.w || '　') + '&nbsp;)요일';
  }

  function resolveDate(state, tmpl) {
    var key = tmpl.dateKey || 'checkDate';
    return state[key] || state.checkDate || state.storeDate || state.receiveDate || state.processDate || '';
  }

  function metaValue(state, tmpl, key) {
    if (key === 'area') return areaLabel(state.area, tmpl.areaLabels);
    var v = state[key];
    if (v == null || v === '') return '';
    return String(v);
  }

  /** PRP O/X 일지 정본 (result / ampm) */
  function prpOx(state, tmpl) {
    state = state || {};
    tmpl = tmpl || {};
    var dt = ymdParts(resolveDate(state, tmpl));
    var writer = state.inspector || state.handler || '';
    var rows = tmpl.rows || [];
    var checks = state.checks || {};
    var checksPm = state.checksPm || {};
    var ampm = tmpl.columnMode === 'ampm';
    var dateLabel = tmpl.dateLabel || '점검일자';
    var section = tmpl.sectionTitle || '● 점검 결과 ●';
    var note = tmpl.note ||
      '※ 평가 — 양호: ○ , 부적합(시정조치 필요): × , 해당없음: —    ※ 주기 — D:매일 W:주간 M:월간';

    var metaFields = tmpl.metaFields;
    if (!metaFields) {
      metaFields = [];
      [
        ['shift', '근무조'], ['area', '점검구역'], ['team', '작업팀'], ['headcount', '인원'],
        ['vehicleNo', '차량번호'], ['driver', '운전자'], ['destination', '행선'],
        ['pestVendor', '방제업체'], ['itemName', '품명'], ['lot', 'LOT'],
        ['supplier', '공급처'], ['location', '보관장소'], ['qty', '수량'],
        ['weather', '날씨·특이'], ['instrument', '측정기']
      ].forEach(function (pair) {
        if (metaValue(state, tmpl, pair[0]) || (tmpl.showMeta && tmpl.showMeta.indexOf(pair[0]) !== -1)) {
          metaFields.push({ key: pair[0], label: pair[1] });
        }
      });
      if (!metaFields.length && state.area != null) metaFields.push({ key: 'area', label: '점검구역' });
      if (!metaFields.length && state.weather != null) metaFields.push({ key: 'weather', label: '날씨·특이' });
    }

    var body = rows.map(function (r, i) {
      if (ampm) {
        var am = r.ampm === false ? '' : ox(checks[r.key]);
        var pm = r.ampm === false ? '' : ox(checksPm[r.key] || '');
        return '<tr>' +
          '<td class="c">' + (i + 1) + '</td>' +
          '<td class="c">' + esc(r.group || '') + '</td>' +
          '<td class="l">' + esc(r.label) + '</td>' +
          '<td class="c">' + esc(r.freq || 'D') + '</td>' +
          '<td class="c">' + am + '</td>' +
          '<td class="c">' + pm + '</td>' +
          '<td class="l">' + esc(r.hint || '') + '</td></tr>';
      }
      return '<tr>' +
        '<td class="c">' + (i + 1) + '</td>' +
        '<td class="c">' + esc(r.group || '') + '</td>' +
        '<td class="l">' + esc(r.label) + '</td>' +
        '<td class="c">' + esc(r.freq || 'D') + '</td>' +
        '<td class="c">' + ox(checks[r.key]) + '</td>' +
        '<td class="l">' + esc(r.hint || '') + '</td></tr>';
    }).join('');

    var metaHtml =
      '<table class="off-grid off-topmeta">' +
      '<tr>' +
      '<th class="lab" style="width:12%">' + esc(dateLabel) + '</th>' +
      '<td class="l" style="width:38%">' + dateCell(dt) + '</td>' +
      '<th class="lab" style="width:10%">점 검 자</th>' +
      '<td class="c" style="width:18%">' + esc(writer) + '</td>' +
      '<th class="lab" style="width:10%">확 인</th>' +
      '<td class="c" style="width:12%">' + esc(state.confirmer || '') + '</td>' +
      '</tr>';

    if (metaFields.length) {
      for (var mi = 0; mi < metaFields.length; mi += 2) {
        var a = metaFields[mi];
        var b = metaFields[mi + 1];
        metaHtml += '<tr><th class="lab">' + esc(a.label) + '</th><td class="l">' +
          esc(metaValue(state, tmpl, a.key)) + '</td>';
        if (b) {
          metaHtml += '<th class="lab">' + esc(b.label) + '</th><td class="l" colspan="3">' +
            esc(metaValue(state, tmpl, b.key)) + '</td></tr>';
        } else {
          metaHtml += '<th class="lab"></th><td class="l" colspan="3"></td></tr>';
        }
      }
    }
    metaHtml += '</table>';

    var head = ampm
      ? '<th style="width:5%">No</th><th style="width:10%">구분</th><th>점검항목</th>' +
        '<th style="width:7%">주기</th><th style="width:9%">오전</th><th style="width:9%">오후</th>' +
        '<th style="width:18%">비고·기준</th>'
      : '<th style="width:5%">No</th><th style="width:10%">구분</th><th>점검항목</th>' +
        '<th style="width:7%">주기</th><th style="width:10%">결과<br>(○/×)</th><th style="width:22%">비고·기준</th>';

    return (
      '<div class="ps-page off-ccp">' +
      officialHeader({
        docNo: tmpl.docNo || '',
        enactDate: tmpl.enactDate || '2024. 02. 13',
        rev: tmpl.rev || '0',
        reviseDate: tmpl.reviseDate || '-',
        title: tmpl.title || '',
        subtitle: tmpl.subtitle || '선행요건 · PRP',
        writer: writer,
        reviewer: state.confirmer || '',
        approver: state.approver || ''
      }) +
      metaHtml +
      '<div class="off-sec">' + esc(section) + '</div>' +
      '<table class="off-grid off-mon">' +
      '<thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>' +
      '<table class="off-grid">' +
      '<tr><th class="lab" style="width:14%">종합판정</th>' +
      '<td class="c" style="width:20%">' + esc(state.judge || '') + '</td>' +
      '<th class="lab" style="width:14%">확 인 자</th>' +
      '<td class="c">' + esc(state.confirmer || '') + '</td></tr>' +
      '<tr><th class="lab">부적합 시<br>즉시조치</th>' +
      '<td class="l tiny" colspan="3">' + esc(state.corrective || state.action || '') + '</td></tr>' +
      '<tr><th class="lab">비고</th>' +
      '<td class="l" colspan="3">' + esc(state.remark || '') + '</td></tr></table>' +
      '<div class="off-note tiny">' + esc(note) + '</div>' +
      '<div class="off-foot">동김제농협 산지유통센터 · FSSC22000 · ' + esc(tmpl.docNo || '') + '</div>' +
      '</div>'
    );
  }

  /** PRP 온습도 일지 정본 (DKJ-S-02-05) */
  function prpMonTh(state, tmpl) {
    state = state || {};
    tmpl = tmpl || {};
    var dt = ymdParts(state.checkDate);
    var writer = state.inspector || '';
    var zones = state.zones || [];
    var judge = state.judge || (state.hasDeviation ? '이탈' : '적합');

    var body = zones.map(function (z) {
      var hCrit = z.hMin == null ? '—' : (z.hMin + '~' + z.hMax);
      return '<tr>' +
        '<td class="l">' + esc(z.name) + '</td>' +
        '<td class="c">' + esc(z.tMin) + '~' + esc(z.tMax) + '</td>' +
        '<td class="c">' + esc(hCrit) + '</td>' +
        '<td class="c">' + esc(z.amT) + '</td>' +
        '<td class="c">' + esc(z.amH != null && z.amH !== '' ? z.amH : (z.hMin == null ? '—' : '')) + '</td>' +
        '<td class="c">' + esc(z.pmT) + '</td>' +
        '<td class="c">' + esc(z.pmH != null && z.pmH !== '' ? z.pmH : (z.hMin == null ? '—' : '')) + '</td>' +
        '<td class="c">' + ox(z.judge) + '</td></tr>';
    }).join('');

    var stdNote = tmpl.stdNote ||
      '※ 관리기준 — 작업실 온도 15~25℃ · 습도 40~70% · 냉장창고 0~5℃ (현장 확정 CL 적용)';
    var note = tmpl.note || '※ 관리기준 이탈 시 즉시조치란에 기재한다.';

    return (
      '<div class="ps-page off-ccp">' +
      officialHeader({
        docNo: tmpl.docNo || 'DKJ-S-02-05',
        enactDate: tmpl.enactDate || '2024. 02. 13',
        rev: tmpl.rev || '0',
        reviseDate: tmpl.reviseDate || '-',
        title: tmpl.title || '온습도점검일지',
        subtitle: tmpl.subtitle || '작업장·냉장 · 매일',
        writer: writer,
        reviewer: state.confirmer || '',
        approver: state.approver || ''
      }) +

      '<table class="off-grid off-topmeta">' +
      '<tr>' +
      '<th class="lab" style="width:12%">점검일자</th>' +
      '<td class="l" style="width:45%">' +
      (dt.y || '　　') + ' 년 &nbsp;&nbsp;' + (dt.m || '　') + ' 월 &nbsp;&nbsp;' + (dt.d || '　') +
      ' 일 &nbsp;(&nbsp;' + (dt.w || '　') + '&nbsp;)요일' +
      '</td>' +
      '<th class="lab" style="width:12%">점 검 자</th>' +
      '<td class="c" style="width:18%">' + esc(writer) + '</td>' +
      '<th class="lab" style="width:10%">계절</th>' +
      '<td class="c" style="width:12%">' + esc(state.season || '') + '</td>' +
      '</tr>' +
      '<tr><th class="lab">관리기준</th>' +
      '<td class="l tiny" colspan="5">' + esc(stdNote) + '</td></tr></table>' +

      '<div class="off-sec">● 구역별 온·습도 점검 결과 ●</div>' +
      '<table class="off-grid off-mon">' +
      '<thead>' +
      '<tr>' +
      '<th rowspan="2" style="width:14%">구역</th>' +
      '<th colspan="2">관리기준</th>' +
      '<th colspan="2">오전</th>' +
      '<th colspan="2">오후</th>' +
      '<th rowspan="2" style="width:8%">판정<br>(○/×)</th>' +
      '</tr>' +
      '<tr><th>온도(℃)</th><th>습도(%)</th><th>℃</th><th>%</th><th>℃</th><th>%</th></tr>' +
      '</thead><tbody>' + body + '</tbody></table>' +

      '<table class="off-grid">' +
      '<tr><th class="lab" style="width:14%">종합판정</th>' +
      '<td class="c" style="width:20%">' + esc(judge) + '</td>' +
      '<th class="lab" style="width:14%">확 인 자</th>' +
      '<td class="c">' + esc(state.confirmer || '') + '</td></tr>' +
      '<tr><th class="lab">이탈 시<br>즉시조치</th>' +
      '<td class="l tiny" colspan="3">' + esc(state.corrective || '') + '</td></tr>' +
      '<tr><th class="lab">비고</th>' +
      '<td class="l" colspan="3">' + esc(state.remark || '') + '</td></tr></table>' +

      '<div class="off-note tiny">' + esc(note) + '</div>' +
      '<div class="off-foot">동김제농협 산지유통센터 · FSSC22000 · ' + esc(tmpl.docNo || 'DKJ-S-02-05') + '</div>' +
      '</div>'
    );
  }

  /** PRP 조도 일지 정본 (DKJ-S-02-02) */
  function prpMonLux(state, tmpl) {
    state = state || {};
    tmpl = tmpl || {};
    var dt = ymdParts(state.checkDate);
    var writer = state.inspector || '';
    var zones = state.zones || [];
    var judge = state.judge || (state.hasDeviation ? '이탈' : '적합');
    var stdNote = tmpl.stdNote ||
      '※ 관리기준 — 일반작업 ≥200 lx · 검사·정밀작업 ≥500 lx (현장 확정 CL 적용)';
    var note = tmpl.note || '※ 관리기준 이탈 시 즉시조치란에 기재한다.';

    var body = zones.map(function (z) {
      return '<tr>' +
        '<td class="l">' + esc(z.name) + '</td>' +
        '<td class="c">' + esc(z.luxMin) + '~' + esc(z.luxMax) + '</td>' +
        '<td class="c">' + esc(z.amLux) + '</td>' +
        '<td class="c">' + esc(z.pmLux) + '</td>' +
        '<td class="c">' + ox(z.judge) + '</td></tr>';
    }).join('');

    return (
      '<div class="ps-page off-ccp">' +
      officialHeader({
        docNo: tmpl.docNo || 'DKJ-S-02-02',
        enactDate: tmpl.enactDate || '2024. 02. 13',
        rev: tmpl.rev || '0',
        reviseDate: tmpl.reviseDate || '-',
        title: tmpl.title || '조도점검일지',
        subtitle: tmpl.subtitle || '선행요건 · 월간',
        writer: writer,
        reviewer: state.confirmer || '',
        approver: state.approver || ''
      }) +
      '<table class="off-grid off-topmeta">' +
      '<tr>' +
      '<th class="lab" style="width:12%">점검일자</th>' +
      '<td class="l" style="width:40%">' + dateCell(dt) + '</td>' +
      '<th class="lab" style="width:12%">점 검 자</th>' +
      '<td class="c" style="width:16%">' + esc(writer) + '</td>' +
      '<th class="lab" style="width:10%">조도계</th>' +
      '<td class="c" style="width:10%">' + esc(state.instrument || '') + '</td>' +
      '</tr>' +
      '<tr><th class="lab">관리기준</th>' +
      '<td class="l tiny" colspan="5">' + esc(stdNote) + '</td></tr></table>' +
      '<div class="off-sec">● 구역별 조도 점검 결과 ●</div>' +
      '<table class="off-grid off-mon">' +
      '<thead><tr>' +
      '<th style="width:22%">구역</th><th style="width:18%">기준(lx)</th>' +
      '<th style="width:16%">오전(lx)</th><th style="width:16%">오후(lx)</th>' +
      '<th style="width:12%">판정(○/×)</th>' +
      '</tr></thead><tbody>' + body + '</tbody></table>' +
      '<table class="off-grid">' +
      '<tr><th class="lab" style="width:14%">종합판정</th>' +
      '<td class="c" style="width:20%">' + esc(judge) + '</td>' +
      '<th class="lab" style="width:14%">확 인 자</th>' +
      '<td class="c">' + esc(state.confirmer || '') + '</td></tr>' +
      '<tr><th class="lab">이탈 시<br>즉시조치</th>' +
      '<td class="l tiny" colspan="3">' + esc(state.corrective || '') + '</td></tr>' +
      '<tr><th class="lab">비고</th>' +
      '<td class="l" colspan="3">' + esc(state.remark || '') + '</td></tr></table>' +
      '<div class="off-note tiny">' + esc(note) + '</div>' +
      '<div class="off-foot">동김제농협 산지유통센터 · FSSC22000 · ' + esc(tmpl.docNo || 'DKJ-S-02-02') + '</div>' +
      '</div>'
    );
  }

  /** FR-014 입고검사 정본 */
  function fr014(state, tmpl) {
    state = state || {};
    tmpl = tmpl || {};
    var rows = tmpl.rows || [];
    var checks = state.checks || {};
    if (!rows.length) {
      rows = Object.keys(checks).map(function (k) {
        return { key: k, group: '검사', label: k, freq: 'D', hint: '' };
      });
    }
    var body = rows.map(function (r, i) {
      return '<tr>' +
        '<td class="c">' + (i + 1) + '</td>' +
        '<td class="l">' + esc(r.label) + '</td>' +
        '<td class="l">' + esc(r.hint || '') + '</td>' +
        '<td class="c">' + ox(checks[r.key]) + '</td></tr>';
    }).join('');
    var dt = ymdParts(state.receiveDate || state.checkDate);

    return (
      '<div class="ps-page off-ccp">' +
      officialHeader({
        docNo: 'FR-014',
        enactDate: tmpl.enactDate || '2024. 02. 13',
        rev: tmpl.rev || '0',
        reviseDate: tmpl.reviseDate || '-',
        title: '원부자재 입고검사 기록',
        subtitle: '입고 · 매일',
        writer: state.inspector || '',
        reviewer: state.confirmer || '',
        approver: state.approver || ''
      }) +
      '<table class="off-grid off-topmeta">' +
      '<tr><th class="lab" style="width:12%">입고일자</th><td class="l" style="width:38%">' + dateCell(dt) + '</td>' +
      '<th class="lab" style="width:12%">구 분</th><td class="c">' + esc(state.materialType || '') + '</td></tr>' +
      '<tr><th class="lab">공급업체</th><td class="l">' + esc(state.supplier || '') + '</td>' +
      '<th class="lab">품 명</th><td class="l">' + esc(state.itemName || '') + '</td></tr>' +
      '<tr><th class="lab">LOT</th><td class="c">' + esc(state.lot || '') + '</td>' +
      '<th class="lab">수량</th><td class="c">' + esc(state.qty || '') + ' ' + esc(state.unit || '') + '</td></tr>' +
      '<tr><th class="lab">입고온도</th><td class="c">' + esc(state.temp || '') + ' ℃</td>' +
      '<th class="lab">연계제품</th><td class="l">' + esc(state.linkedProduct || '') + '</td></tr>' +
      '</table>' +
      '<div class="off-sec">● 입고검사 결과 ●</div>' +
      '<table class="off-grid off-mon">' +
      '<thead><tr><th style="width:6%">No</th><th style="width:28%">검사항목</th>' +
      '<th>확인기준</th><th style="width:12%">결과(○/×)</th></tr></thead>' +
      '<tbody>' + body + '</tbody></table>' +
      '<table class="off-grid">' +
      '<tr><th class="lab" style="width:14%">종합판정</th><td class="c" style="width:20%">' + esc(state.judge || '') + '</td>' +
      '<th class="lab" style="width:14%">처리조치</th><td class="c">' + esc(state.action || '') + '</td></tr>' +
      '<tr><th class="lab">점검자</th><td class="c">' + esc(state.inspector || '') + '</td>' +
      '<th class="lab">확인자</th><td class="c">' + esc(state.confirmer || '') + '</td></tr>' +
      '<tr><th class="lab">비고</th><td class="l" colspan="3">' + esc(state.remark || '') + '</td></tr></table>' +
      '<div class="off-note tiny">※ 평가 — 양호: ○ , 부적합: × , 해당없음: — · 부적합 시 FR-015 연계</div>' +
      '<div class="off-foot">동김제농협 산지유통센터 · FSSC22000 · FR-014</div></div>'
    );
  }

  /** FR-015 부적합 처리 정본 */
  function fr015(state, tmpl) {
    state = state || {};
    tmpl = tmpl || {};
    var reasons = state.reasons || {};
    var reasonLabels = tmpl.reasonLabels || [
      { key: 'r01', label: '표시사항 불량' },
      { key: 'r02', label: '유통기한·제조일 이상' },
      { key: 'r03', label: '온도 이탈' },
      { key: 'r04', label: '외관·이물' },
      { key: 'r05', label: '냄새·부패' },
      { key: 'r06', label: '성적서 미비' },
      { key: 'r07', label: '수량 불일치' },
      { key: 'r08', label: '미승인 공급업체' },
      { key: 'r09', label: '차량·운송 위생' },
      { key: 'r10', label: '기타' }
    ];
    var reasonBody = reasonLabels.map(function (r, i) {
      return '<tr><td class="c">' + (i + 1) + '</td><td class="l">' + esc(r.label) +
        '</td><td class="c">' + (reasons[r.key] ? '○' : '') + '</td></tr>';
    }).join('');
    var dt = ymdParts(state.processDate || state.checkDate);
    var stepMap = { recv: '입고', store: '보관', process: '가공', pack: '포장', ship: '출하' };

    return (
      '<div class="ps-page off-ccp">' +
      officialHeader({
        docNo: 'FR-015',
        enactDate: tmpl.enactDate || '2024. 02. 13',
        rev: tmpl.rev || '0',
        reviseDate: tmpl.reviseDate || '-',
        title: '부적합 원부자재 처리기록',
        subtitle: '입고 부적합 · 격리·처리',
        writer: state.handler || '',
        reviewer: state.approver || '',
        approver: state.approver || ''
      }) +
      '<table class="off-grid off-topmeta">' +
      '<tr><th class="lab" style="width:12%">처리일자</th><td class="l" style="width:38%">' + dateCell(dt) + '</td>' +
      '<th class="lab" style="width:14%">발견단계</th><td class="c">' +
      esc(stepMap[state.discoverStep] || state.discoverStep || '') + '</td></tr>' +
      '<tr><th class="lab">공급업체</th><td class="l">' + esc(state.supplier || '') + '</td>' +
      '<th class="lab">품 명</th><td class="l">' + esc(state.itemName || '') + '</td></tr>' +
      '<tr><th class="lab">LOT</th><td class="c">' + esc(state.lot || '') + '</td>' +
      '<th class="lab">수량</th><td class="c">' + esc(state.qty || '') + ' ' + esc(state.unit || '') + '</td></tr>' +
      '<tr><th class="lab">FR-014연계</th><td class="c">' + esc(state.linkedFr014 || '') + '</td>' +
      '<th class="lab">연계제품</th><td class="l">' + esc(state.linkedProduct || '') + '</td></tr>' +
      '</table>' +
      '<div class="off-sec">● 부적합 사유 ●</div>' +
      '<table class="off-grid off-mon">' +
      '<thead><tr><th style="width:8%">No</th><th>사유</th><th style="width:14%">해당(○)</th></tr></thead>' +
      '<tbody>' + reasonBody + '</tbody></table>' +
      '<table class="off-grid">' +
      '<tr><th class="lab" style="width:16%">상세사유</th><td class="l tiny" colspan="3">' + esc(state.reasonText || '') + '</td></tr>' +
      '<tr><th class="lab">격리장소</th><td class="l">' + esc(state.isolateLocation || '') + '</td>' +
      '<th class="lab">처리판정</th><td class="c">' + esc(state.disposition || '') + '</td></tr>' +
      '<tr><th class="lab">공급업체통지</th><td class="c">' + esc(state.notifySupplier || '') + '</td>' +
      '<th class="lab">시정조치(CAR)</th><td class="c">' + esc(state.carRequired || '') + '</td></tr>' +
      '<tr><th class="lab">처리자</th><td class="c">' + esc(state.handler || '') + '</td>' +
      '<th class="lab">승인자</th><td class="c">' + esc(state.approver || '') + '</td></tr>' +
      '<tr><th class="lab">비고</th><td class="l" colspan="3">' + esc(state.remark || '') + '</td></tr></table>' +
      '<div class="off-note tiny">※ 부적합품은 식별·격리 후 처리판정·재검사·시정조치를 기록한다.</div>' +
      '<div class="off-foot">동김제농협 산지유통센터 · FSSC22000 · FR-015</div></div>'
    );
  }

  /** FR 범용 정본 (필드·섹션·O/X) */
  function frGeneric(state, tmpl) {
    state = state || {};
    tmpl = tmpl || {};
    var dt = ymdParts(state.docDate || state.checkDate || state.receiveDate || '');
    var writer = state.writer || state.inspector || '';
    var fields = tmpl.metaFields || [];
    var rows = tmpl.rows || [];
    var sections = tmpl.sections || [];
    var checks = state.checks || {};

    var metaHtml =
      '<table class="off-grid off-topmeta">' +
      '<tr><th class="lab" style="width:12%">작성일자</th><td class="l" style="width:38%">' + dateCell(dt) + '</td>' +
      '<th class="lab" style="width:12%">작 성 자</th><td class="c">' + esc(writer) + '</td></tr>';
    if (fields.length) {
      for (var i = 0; i < fields.length; i += 2) {
        var a = fields[i];
        var b = fields[i + 1];
        metaHtml += '<tr><th class="lab">' + esc(a.label) + '</th><td class="l">' +
          esc(state[a.key] != null ? state[a.key] : '') + '</td>';
        if (b) {
          metaHtml += '<th class="lab">' + esc(b.label) + '</th><td class="l">' +
            esc(state[b.key] != null ? state[b.key] : '') + '</td></tr>';
        } else {
          metaHtml += '<td class="l" colspan="2"></td></tr>';
        }
      }
    }
    metaHtml += '</table>';

    var oxHtml = '';
    if (rows.length) {
      oxHtml = '<div class="off-sec">● 점검·평가 항목 ●</div><table class="off-grid off-mon"><thead><tr>' +
        '<th style="width:6%">No</th><th style="width:14%">구분</th><th>항목</th>' +
        '<th style="width:12%">결과(○/×)</th><th style="width:20%">비고</th></tr></thead><tbody>' +
        rows.map(function (r, idx) {
          return '<tr><td class="c">' + (idx + 1) + '</td><td class="c">' + esc(r.group || '') +
            '</td><td class="l">' + esc(r.label) + '</td><td class="c">' + ox(checks[r.key]) +
            '</td><td class="l">' + esc(r.hint || '') + '</td></tr>';
        }).join('') + '</tbody></table>';
    }

    var secHtml = '';
    if (sections.length) {
      secHtml = sections.map(function (s) {
        return '<div class="off-sec">' + esc(s.label) + '</div>' +
          '<div class="off-box tiny">' + esc(state[s.id] || '') + '</div>';
      }).join('');
    }

    return (
      '<div class="ps-page off-ccp">' +
      officialHeader({
        docNo: tmpl.docNo || '',
        enactDate: tmpl.enactDate || '2024. 02. 13',
        rev: tmpl.rev || '0',
        reviseDate: tmpl.reviseDate || '-',
        title: tmpl.title || '',
        subtitle: tmpl.subtitle || 'FSSC22000 기록양식',
        writer: writer,
        reviewer: state.reviewer || state.confirmer || '',
        approver: state.approver || ''
      }) +
      metaHtml + oxHtml + secHtml +
      '<table class="off-grid">' +
      '<tr><th class="lab" style="width:14%">종합판정</th><td class="c" style="width:20%">' +
      esc(state.judge || '') + '</td>' +
      '<th class="lab" style="width:14%">검토/승인</th><td class="c">' +
      esc(state.reviewer || '') + ' / ' + esc(state.approver || '') + '</td></tr>' +
      '<tr><th class="lab">조치·비고</th><td class="l tiny" colspan="3">' +
      esc(state.corrective || '') + (state.remark ? ' · ' + esc(state.remark) : '') + '</td></tr></table>' +
      '<div class="off-foot">동김제농협 산지유통센터 · FSSC22000 · ' + esc(tmpl.docNo || '') + '</div></div>'
    );
  }

  global.DkjPrintOfficial = {
    ccp2p: ccp2p,
    ccp1bc: ccp1bc,
    prpOx: prpOx,
    prpMonTh: prpMonTh,
    prpMonLux: prpMonLux,
    fr014: fr014,
    fr015: fr015,
    frGeneric: frGeneric
  };
})(window);
