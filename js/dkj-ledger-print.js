/**
 * DkjLedgerPrint — 유형 E(대장/검사일지) 정본 인쇄 레이아웃
 *
 * 종이 원본 공통 구조:
 *   헤더(양식번호·제정·개정·개정번호 + 제목 + 결재)
 *   정보행(점검일자/점검기간/점검자 …)
 *   본표: 2단 헤더(그룹행 + 세부열) + 건별 행 N개
 *   하단 범례
 */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function headHtml(spec, state) {
    var apv = state.approvals || {};
    return '' +
      '<table class="off-head mx-head">' +
      '<tr>' +
      '<th class="mx-mlab">양식번호</th><td class="mx-mval">' + esc(spec.docNo || spec.code) + '</td>' +
      '<td class="off-title-cell mx-title-cell" rowspan="4">' +
      '<div class="off-title">' + esc(spec.title) + '</div></td>' +
      '<th class="mx-apv-lab" rowspan="4">결<br>재</th>' +
      '<th class="mx-apv">작 성</th><th class="mx-apv">검 토</th><th class="mx-apv">승 인</th>' +
      '</tr>' +
      '<tr><th class="mx-mlab">제정일자</th><td class="mx-mval">' + esc(spec.enactDate || '') + '</td>' +
      '<td class="mx-sign" rowspan="3">' + esc(apv.writer || '') + '</td>' +
      '<td class="mx-sign" rowspan="3">' + esc(apv.reviewer || '') + '</td>' +
      '<td class="mx-sign" rowspan="3">' + esc(apv.approver || '') + '</td></tr>' +
      '<tr><th class="mx-mlab">개정일자</th><td class="mx-mval">' + esc(spec.reviseDate || '-') + '</td></tr>' +
      '<tr><th class="mx-mlab">개정번호</th><td class="mx-mval">' + esc(spec.rev != null ? spec.rev : '0') + '</td></tr>' +
      '</table>';
  }

  function infoHtml(spec, state) {
    var fs = spec.infoFields || [];
    if (!fs.length) return '';
    var info = state.info || {};
    var cells = fs.map(function (f) {
      return '<th class="lg-ilab">' + esc(f.label) + '</th>' +
        '<td class="lg-ival"' + (f.span ? ' colspan="' + f.span + '"' : '') + '>' +
        esc(info[f.id] || '') + '</td>';
    }).join('');
    return '<table class="off-grid lg-info"><tr>' + cells + '</tr></table>';
  }

  /** 2단 헤더 생성 — columns[].group 이 있으면 묶는다 */
  function theadHtml(cols) {
    var hasGroup = cols.some(function (c) { return c.group; });
    if (!hasGroup) {
      return '<tr>' + cols.map(function (c) {
        return '<th' + (c.width ? ' style="width:' + c.width + '"' : '') + '>' + esc(c.label) + '</th>';
      }).join('') + '</tr>';
    }
    var r1 = '', r2 = '';
    var i = 0;
    while (i < cols.length) {
      var c = cols[i];
      if (!c.group) {
        r1 += '<th rowspan="2"' + (c.width ? ' style="width:' + c.width + '"' : '') + '>' +
          esc(c.label) + '</th>';
        i++;
      } else {
        var j = i;
        while (j + 1 < cols.length && cols[j + 1].group === c.group) j++;
        r1 += '<th colspan="' + (j - i + 1) + '">' + esc(c.group) + '</th>';
        for (var k = i; k <= j; k++) {
          r2 += '<th' + (cols[k].width ? ' style="width:' + cols[k].width + '"' : '') + '>' +
            esc(cols[k].label) + '</th>';
        }
        i = j + 1;
      }
    }
    return '<tr>' + r1 + '</tr><tr>' + r2 + '</tr>';
  }

  function cellText(col, v) {
    if (v != null && v !== '') return esc(v);
    // 미기재 칸은 종이 정본처럼 선택지를 흐리게 남겨 수기 대응이 가능하게 한다
    if (col.type === 'choice' && col.choices && col.choices.length) {
      return '<span class="lg-opt">' + esc(col.choices.join(' / ')) + '</span>';
    }
    if (col.unit) return '<span class="lg-opt">' + esc(col.unit) + '</span>';
    return '';
  }

  function gridHtml(spec, state) {
    var cols = spec.columns || [];
    var rows = state.rows || [];
    var min = spec.defaultRows ? spec.defaultRows.length : (spec.rows || 12);
    var n = Math.max(min, rows.length);
    var body = '';
    for (var i = 0; i < n; i++) {
      var r = rows[i] || {};
      body += '<tr>' + cols.map(function (c) {
        return '<td class="' + (c.align === 'left' ? 'l' : 'c') + ' lg-cell">' +
          cellText(c, r[c.key]) + '</td>';
      }).join('') + '</tr>';
    }
    return '<table class="off-grid lg-grid"><thead>' + theadHtml(cols) + '</thead><tbody>' +
      body + '</tbody></table>';
  }

  function render(spec, state) {
    var st = state || {};
    return '<div class="off-ccp off-matrix off-ledger">' +
      '<section class="mx-page">' +
      headHtml(spec, st) +
      infoHtml(spec, st) +
      gridHtml(spec, st) +
      (spec.infoNote ? '<div class="off-box tiny lg-note">' + esc(spec.infoNote) + '</div>' : '') +
      (spec.legend ? '<div class="off-box tiny lg-legend">' + esc(spec.legend) + '</div>' : '') +
      '<div class="off-foot">' + esc(spec.orgName || '동김제농협 가공센터') +
      ' · ' + esc(spec.docNo || '') + '</div>' +
      '</section></div>';
  }

  global.DkjLedgerPrint = { render: render, theadHtml: theadHtml };
})(window);
