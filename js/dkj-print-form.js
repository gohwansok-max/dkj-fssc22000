/**
 * DkjPrint — 화면 UX와 분리된 정본형 인쇄 시트
 * print(template, state, formSpec?)
 */
(function (global) {
  'use strict';

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function mark(v) {
    if (v === 'O' || v === '○' || v === '적합') return '○';
    if (v === 'X' || v === '×' || v === '부적합' || v === '이탈') return '×';
    if (v === '-' || v === '해당없음') return '—';
    return v ? esc(v) : '';
  }

  function ensureSheet() {
    var el = $('printSheet');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'printSheet';
    el.className = 'print-sheet';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    return el;
  }

  function headerHtml(t, state) {
    var org = t.orgName || '동김제농협 가공센터';
    var docNo = t.docNo || '';
    var title = t.title || '';
    var rev = t.rev != null ? String(t.rev) : '0';
    var enact = t.enactDate || '';
    var revise = t.reviseDate || '';
    var writer = state.inspector || state.monitorName || state.confirmer || '';
    var reviewer = state.confirmer || '';
    var approver = state.approver || '';
    // CCP 작업일을 결재란 보조 정보로 쓰지 않음 — 작성란에 모니터링 담당 표시
    if (!state.inspector && state.monitorName) writer = state.monitorName;
    return (
      '<div class="ps-org">' + esc(org) + '</div>' +
      '<table class="ps-meta">' +
      '<tr>' +
      '<td class="ps-title-cell" rowspan="2">' +
      '<div class="ps-docno">문서번호: ' + esc(docNo) + ' | REV.' + esc(rev) + '</div>' +
      '<div class="ps-title">' + esc(title) + '</div>' +
      '</td>' +
      '<th class="ps-apv-lab" rowspan="2">결재</th>' +
      '<th class="ps-apv">작성</th><th class="ps-apv">검토</th><th class="ps-apv">승인</th>' +
      '</tr>' +
      '<tr>' +
      '<td class="ps-sign">' + esc(writer) + '</td>' +
      '<td class="ps-sign">' + esc(reviewer) + '</td>' +
      '<td class="ps-sign">' + esc(approver) + '</td>' +
      '</tr>' +
      '</table>' +
      '<table class="ps-rev">' +
      '<tr><th>제정일자</th><td>' + esc(enact) + '</td><th>개정일자</th><td>' + esc(revise) + '</td><th>개정번호</th><td>' + esc(rev) + '</td></tr>' +
      '</table>'
    );
  }

  function infoRow(t, state) {
    var dateVal = state.checkDate || state.storeDate || '';
    var extra = '';
    if (state.area) extra += '<th>점검구역</th><td>' + esc(state.area) + '</td>';
    if (state.team) extra += '<th>작업팀</th><td>' + esc(state.team) + '</td>';
    if (state.shift) extra += '<th>근무조</th><td>' + esc(state.shift) + '</td>';
    if (state.vehicleNo) extra += '<th>차량번호</th><td>' + esc(state.vehicleNo) + '</td>';
    if (state.itemName) extra += '<th>품명</th><td>' + esc(state.itemName) + '</td>';
    if (state.lot) extra += '<th>LOT</th><td>' + esc(state.lot) + '</td>';
    return (
      '<table class="ps-info">' +
      '<tr><th>점검일자</th><td>' + esc(dateVal) + '</td>' +
      '<th>점검자</th><td>' + esc(state.inspector || '') + '</td>' +
      extra + '</tr></table>'
    );
  }

  function renderOx(t, state) {
    var rows = t.rows || [];
    var checks = state.checks || {};
    var mode = t.columnMode || 'result'; // result | ampm
    var head;
    var body;
    if (mode === 'ampm') {
      head = '<tr><th style="width:14%">구분</th><th>점검 사항</th><th style="width:7%">주기</th>' +
        '<th style="width:9%">오전</th><th style="width:9%">오후</th><th style="width:20%">비고</th></tr>';
      body = rows.map(function (r) {
        var v = checks[r.key] || '';
        var am = r.ampm === false ? '' : mark(v);
        var pm = r.ampm === false ? '' : (state.checksPm && state.checksPm[r.key] ? mark(state.checksPm[r.key]) : '');
        return '<tr><td class="c">' + esc(r.group || '') + '</td><td class="l">' + esc(r.label) + '</td>' +
          '<td class="c">' + esc(r.freq || 'D') + '</td><td class="c">' + am + '</td><td class="c">' + pm + '</td>' +
          '<td class="l">' + esc(r.hint || '') + '</td></tr>';
      }).join('');
    } else {
      head = '<tr><th style="width:6%">No</th><th style="width:14%">구분</th><th>점검항목</th>' +
        '<th style="width:12%">결과(O/X)</th><th style="width:22%">비고·조치</th></tr>';
      body = rows.map(function (r, i) {
        var v = checks[r.key] || '';
        return '<tr><td class="c">' + (i + 1) + '</td><td class="c">' + esc(r.group || '') + '</td>' +
          '<td class="l">' + esc(r.label) + '</td><td class="c">' + mark(v) + '</td>' +
          '<td class="l"></td></tr>';
      }).join('');
    }
    var footer =
      '<div class="ps-foot">' +
      '<div><strong>종합판정:</strong> ' + esc(state.judge || '') + '</div>' +
      '<div><strong>즉시조치:</strong> ' + esc(state.corrective || '') + '</div>' +
      '<div><strong>비고:</strong> ' + esc(state.remark || '') + '</div>' +
      (t.note ? '<div class="ps-note">' + esc(t.note) + '</div>' : '') +
      '</div>';
    return infoRow(t, state) + '<table class="ps-grid"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>' + footer;
  }

  function renderMon(t, state) {
    var zones = state.zones || [];
    var mode = t.monMode || 'th';
    var head;
    var body;
    if (mode === 'lux') {
      head = '<tr><th>구역</th><th>기준(lx)</th><th>오전</th><th>오후</th><th>판정</th></tr>';
      body = zones.map(function (z) {
        return '<tr><td class="l">' + esc(z.name) + '</td><td class="c">' +
          esc(z.luxMin) + '~' + esc(z.luxMax) + '</td><td class="c">' + esc(z.amLux) +
          '</td><td class="c">' + esc(z.pmLux) + '</td><td class="c">' + mark(z.judge) + '</td></tr>';
      }).join('');
    } else {
      head = '<tr><th>구역</th><th>기준℃</th><th>기준%</th><th>오전℃</th><th>오전%</th><th>오후℃</th><th>오후%</th><th>판정</th></tr>';
      body = zones.map(function (z) {
        var h = z.hMin == null ? '—' : (z.hMin + '~' + z.hMax);
        return '<tr><td class="l">' + esc(z.name) + '</td><td class="c">' + esc(z.tMin) + '~' + esc(z.tMax) +
          '</td><td class="c">' + esc(h) + '</td><td class="c">' + esc(z.amT) + '</td><td class="c">' + esc(z.amH) +
          '</td><td class="c">' + esc(z.pmT) + '</td><td class="c">' + esc(z.pmH) + '</td><td class="c">' +
          mark(z.judge) + '</td></tr>';
      }).join('');
    }
    var footer =
      '<div class="ps-foot">' +
      '<div><strong>종합판정:</strong> ' + esc(state.judge || (state.hasDeviation ? '이탈' : '적합')) + '</div>' +
      '<div><strong>즉시조치:</strong> ' + esc(state.corrective || '') + '</div>' +
      '<div><strong>비고:</strong> ' + esc(state.remark || '') + '</div>' +
      (t.note ? '<div class="ps-note">' + esc(t.note) + '</div>' : '') +
      '</div>';
    return infoRow(t, state) + '<table class="ps-grid"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>' + footer;
  }

  function renderCcpRows(t, state) {
    var rows = state.rows || [];
    var cols = t.columns || [
      { key: 'time', label: '시각' },
      { key: 'ppm', label: '측정값' },
      { key: 'soak', label: '시간(초)' },
      { key: 'rinse', label: '헹굼' },
      { key: 'judge', label: '판정' }
    ];
    var head = '<tr>' + cols.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('') + '</tr>';
    var body = rows.map(function (r) {
      return '<tr>' + cols.map(function (c) {
        var v = r[c.key];
        if (c.key === 'judge' || c.key === 'rinse') v = mark(v);
        return '<td class="c">' + esc(v == null ? '' : v) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    var meta =
      '<table class="ps-info"><tr>' +
      '<th>작업일</th><td>' + esc(state.workDate || state.checkDate || '') + '</td>' +
      '<th>품명/LOT</th><td>' + esc((state.productName || state.itemName || '') + ' / ' + (state.lot || '')) + '</td>' +
      '<th>모니터링</th><td>' + esc(state.monitorName || state.inspector || '') + '</td>' +
      '</tr></table>';
    var footer =
      '<div class="ps-foot">' +
      '<div><strong>이탈내용:</strong> ' + esc(state.deviation || '') + '</div>' +
      '<div><strong>즉시조치:</strong> ' + esc(state.corrective || '') + '</div>' +
      '<div><strong>확인자:</strong> ' + esc(state.confirmer || '') + ' · <strong>비고:</strong> ' + esc(state.remark || '') + '</div>' +
      (t.note ? '<div class="ps-note">' + esc(t.note) + '</div>' : '') +
      '</div>';
    return meta + '<table class="ps-grid"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>' + footer;
  }

  function render(template, state) {
    var t = template || {};
    var sheet = ensureSheet();
    if (t.layout === 'official-ccp2p' && global.DkjPrintOfficial) {
      sheet.innerHTML = global.DkjPrintOfficial.ccp2p(state || {});
      return sheet;
    }
    if (t.layout === 'official-ccp1bc' && global.DkjPrintOfficial) {
      sheet.innerHTML = global.DkjPrintOfficial.ccp1bc(state || {});
      return sheet;
    }
    var body;
    if (t.layout === 'ccp-rows') {
      body = renderCcpRows(t, state || {});
    } else if (t.layout === 'mon' || t.layout === 'mon-th' || t.layout === 'mon-lux') {
      body = renderMon(Object.assign({}, t, { monMode: t.monMode || (t.layout === 'mon-lux' ? 'lux' : 'th') }), state || {});
    } else {
      body = renderOx(t, state || {});
    }
    sheet.innerHTML =
      '<div class="ps-page">' +
      headerHtml(t, state || {}) +
      body +
      '<div class="ps-brand">' + esc(t.orgName || '동김제농협 가공센터') + ' · FSSC22000</div>' +
      '</div>';
    return sheet;
  }

  function print(template, state) {
    render(template, state);
    setTimeout(function () { window.print(); }, 120);
  }

  /** Build default print template from ox/mon form spec.items */
  function fromFormSpec(formSpec) {
    if (!formSpec) return null;
    if (formSpec.print) return formSpec.print;
    var rows = (formSpec.items || []).map(function (it) {
      return {
        key: it.key,
        group: it.group,
        label: it.label,
        hint: it.hint || '',
        freq: 'D',
        ampm: true
      };
    });
    if (formSpec.pattern === 'mon') {
      return {
        layout: formSpec.monMode === 'lux' ? 'mon-lux' : 'mon-th',
        monMode: formSpec.monMode || 'th',
        orgName: '동김제농협 가공센터',
        docNo: formSpec.code,
        title: formSpec.title,
        rev: '0',
        enactDate: '2026.07.10',
        reviseDate: '2026.07.10',
        note: '※ 관리기준 이탈 시 즉시조치란에 기재한다.'
      };
    }
    return {
      layout: 'ox',
      columnMode: formSpec.code === 'DKJ-S-02-03' || formSpec.code === 'DKJ-S-02-29' ? 'ampm' : 'result',
      orgName: '동김제농협 가공센터',
      docNo: formSpec.code,
      title: formSpec.title,
      rev: '0',
      enactDate: '2026.07.10',
      reviseDate: '2026.07.10',
      rows: rows,
      note: '※ 평가 — 양호: ○ , 부적합(시정조치 필요): × , 해당없음: —    ※ 주기 — D:매일 W:주간 M:월간'
    };
  }

  global.DkjPrint = {
    render: render,
    print: print,
    fromFormSpec: fromFormSpec,
    ensureSheet: ensureSheet
  };
})(window);
