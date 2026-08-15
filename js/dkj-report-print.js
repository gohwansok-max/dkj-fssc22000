/**
 * DkjReportPrint — 유형 F(보고서/일지) 정본 인쇄 레이아웃
 *
 * 종이 원본 공통 구조:
 *   헤더(양식번호·제정·개정·개정번호 + 제목 + 결재)
 *   블록 목록 — 아래 4종을 조합해 어떤 보고서든 표현한다.
 *     - pairs : 라벨 | 값 을 좌우로 나열 (2열 x N행)
 *     - check : 체크박스 문항 (□ 정기 검증  □ 일상 검증 …)
 *     - text  : 자유 서술 (제목행 + 본문 박스)
 *     - table : 반복 행 표 (확인내용 | 검증결과 | 비고 …)
 *     - signs : 서명란 (검증팀장 (서명) | 검증원1 (서명) …)
 */
(function (global) {
  'use strict';

  function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }

  function headHtml(spec, state) {
    var apv = state.approvals || {};
    return '' +
      '<table class="off-head mx-head">' +
      '<tr><th class="mx-mlab">양식번호</th><td class="mx-mval">' + esc(spec.docNo || spec.code) + '</td>' +
      '<td class="off-title-cell mx-title-cell" rowspan="4">' +
      '<div class="off-title">' + esc(spec.title) + '</div></td>' +
      '<th class="mx-apv-lab" rowspan="4">결<br>재</th>' +
      '<th class="mx-apv">작 성</th><th class="mx-apv">검 토</th><th class="mx-apv">승 인</th></tr>' +
      '<tr><th class="mx-mlab">제정일자</th><td class="mx-mval">' + esc(spec.enactDate || '') + '</td>' +
      '<td class="mx-sign" rowspan="3">' + esc(apv.writer || '') + '</td>' +
      '<td class="mx-sign" rowspan="3">' + esc(apv.reviewer || '') + '</td>' +
      '<td class="mx-sign" rowspan="3">' + esc(apv.approver || '') + '</td></tr>' +
      '<tr><th class="mx-mlab">개정일자</th><td class="mx-mval">' + esc(spec.reviseDate || '-') + '</td></tr>' +
      '<tr><th class="mx-mlab">개정번호</th><td class="mx-mval">' + esc(spec.rev != null ? spec.rev : '0') + '</td></tr>' +
      '</table>';
  }

  function pairsHtml(b, v) {
    var per = b.perRow || 2;
    var rows = '';
    var fs = b.fields || [];
    for (var i = 0; i < fs.length; i += per) {
      var cells = '';
      for (var j = 0; j < per; j++) {
        var f = fs[i + j];
        if (!f) { cells += '<th class="rp-lab"></th><td class="rp-val"></td>'; continue; }
        cells += '<th class="rp-lab">' + esc(f.label) + '</th>' +
          '<td class="rp-val"' + (f.span ? ' colspan="' + f.span + '"' : '') + '>' +
          esc((v || {})[f.id] || '') + '</td>';
      }
      rows += '<tr>' + cells + '</tr>';
    }
    return '<table class="off-grid rp-pairs">' + rows + '</table>';
  }

  function checkHtml(b, v) {
    var picked = (v || {})[b.id] || '';
    var opts = (b.options || []).map(function (o) {
      return '<span class="rp-opt">' + (picked === o ? '■' : '□') + ' ' + esc(o) + '</span>';
    }).join('');
    return '<table class="off-grid rp-pairs"><tr>' +
      '<th class="rp-lab">' + esc(b.label) + '</th>' +
      '<td class="rp-val rp-checks">' + opts + '</td></tr></table>';
  }

  function textHtml(b, v) {
    return '<table class="off-grid rp-text">' +
      '<tr><th class="rp-tlab">' + esc(b.label) + '</th></tr>' +
      '<tr><td class="rp-tbody" style="height:' + (b.height || 60) + 'pt">' +
      nl2br((v || {})[b.id] || '') + '</td></tr></table>';
  }

  function tableHtml(b, rows) {
    var cols = b.columns || [];
    var list = rows || [];
    var n = Math.max(b.rows || 6, list.length);
    var head = '<tr>' + cols.map(function (c) {
      return '<th' + (c.width ? ' style="width:' + c.width + '"' : '') + '>' + esc(c.label) + '</th>';
    }).join('') + '</tr>';
    var body = '';
    for (var i = 0; i < n; i++) {
      var r = list[i] || {};
      body += '<tr>' + cols.map(function (c) {
        return '<td class="' + (c.align === 'center' ? 'c' : 'l') + ' rp-cell">' +
          esc(r[c.key] || '') + '</td>';
      }).join('') + '</tr>';
    }
    return (b.label ? '<div class="off-sec">' + esc(b.label) + '</div>' : '') +
      '<table class="off-grid rp-table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
  }

  function signsHtml(b, v) {
    var per = b.perRow || 2;
    var fs = b.fields || [];
    var rows = '';
    for (var i = 0; i < fs.length; i += per) {
      var cells = '';
      for (var j = 0; j < per; j++) {
        var f = fs[i + j];
        if (!f) { cells += '<th class="rp-lab"></th><td class="rp-sign"></td>'; continue; }
        cells += '<th class="rp-lab">' + esc(f.label) + '</th>' +
          '<td class="rp-sign">' + esc((v || {})[f.id] || '') + ' <span class="rp-opt">(서명)</span></td>';
      }
      rows += '<tr>' + cells + '</tr>';
    }
    return (b.label ? '<div class="off-sec">' + esc(b.label) + '</div>' : '') +
      '<table class="off-grid rp-pairs">' + rows + '</table>';
  }

  function render(spec, state) {
    var st = state || {};
    var v = st.values || {};
    var body = (spec.blocks || []).map(function (b) {
      if (b.type === 'pairs') return pairsHtml(b, v);
      if (b.type === 'check') return checkHtml(b, v);
      if (b.type === 'text') return textHtml(b, v);
      if (b.type === 'table') return tableHtml(b, (st.tables || {})[b.id]);
      if (b.type === 'signs') return signsHtml(b, v);
      return '';
    }).join('');
    return '<div class="off-ccp off-matrix off-report">' +
      '<section class="mx-page rp-page">' +
      headHtml(spec, st) + body +
      (spec.legend ? '<div class="off-box tiny">' + esc(spec.legend) + '</div>' : '') +
      '<div class="off-foot">' + esc(spec.orgName || '동김제농협 산지유통센터') +
      ' · ' + esc(spec.docNo || '') + '</div>' +
      '</section></div>';
  }

  global.DkjReportPrint = { render: render };
})(window);
