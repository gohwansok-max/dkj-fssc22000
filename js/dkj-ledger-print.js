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

  function gridHtml(spec, state, cols, from, to) {
    var rows = state.rows || [];
    var min = spec.defaultRows ? spec.defaultRows.length : (spec.rows || 12);
    var n = Math.max(min, rows.length);
    var a = from == null ? 0 : from;
    var b = to == null ? n : Math.min(to, n);
    var body = '';
    for (var i = a; i < b; i++) {
      var r = rows[i] || {};
      body += '<tr>' + cols.map(function (c) {
        return '<td class="' + (c.align === 'left' ? 'l' : 'c') + ' lg-cell">' +
          cellText(c, r[c.key]) + '</td>';
      }).join('') + '</tr>';
    }
    return '<table class="off-grid lg-grid"><thead>' + theadHtml(cols) + '</thead><tbody>' +
      body + '</tbody></table>';
  }

  /** 하단 이상 발생 내역표 */
  function incidentHtml(spec, state) {
    var cfg = spec.incident;
    if (!cfg) return '';
    var cols = cfg.columns || [];
    var rows = state.incidents || [];
    var count = cfg.rows || 4;
    var head = '<tr class="off-nest-hd"><th class="vert mx-inc-lab">구 분</th>' +
      cols.map(function (c) {
        return '<th' + (c.width ? ' style="width:' + c.width + '"' : '') + '>' + esc(c.label) + '</th>';
      }).join('') + '</tr>';
    var body = '';
    for (var i = 0; i < count; i++) {
      var r = rows[i] || {};
      var cells = cols.map(function (c) {
        return '<td class="l">' + esc(r[c.key] || '') + '</td>';
      }).join('');
      body += i === 0
        ? '<tr><th class="vert mx-inc-lab" rowspan="' + count + '">' +
          esc(cfg.label || '이상 발생 내역') + '</th>' + cells + '</tr>'
        : '<tr>' + cells + '</tr>';
    }
    return '<table class="off-correct mx-inc">' + head + body + '</table>';
  }

  /** 인쇄할 (열 묶음 x 행 구간) 쪽 목록 */
  function pagePlan(spec, state) {
    var cols = spec.columns || [];
    var rows = state.rows || [];
    var total = Math.max(spec.defaultRows ? spec.defaultRows.length : (spec.rows || 12), rows.length);

    var colGroups = [cols];
    if (spec.columnPages && spec.columnPages.length) {
      var fixed = cols.filter(function (c) { return c.repeatOnPages; });
      colGroups = spec.columnPages.map(function (keys) {
        return fixed.concat(cols.filter(function (c) {
          return !c.repeatOnPages && keys.indexOf(c.key) !== -1;
        }));
      });
    }

    var rowRanges = [[0, total]];
    if (spec.rowPageBreak && spec.rowPageBreak.length) {
      rowRanges = [];
      var start = 0;
      spec.rowPageBreak.forEach(function (c) {
        if (c > start && c < total) { rowRanges.push([start, c]); start = c; }
      });
      rowRanges.push([start, total]);
    }

    var out = [];
    colGroups.forEach(function (cg) {
      rowRanges.forEach(function (rr) { out.push({ cols: cg, from: rr[0], to: rr[1] }); });
    });
    return out;
  }

  function render(spec, state) {
    var st = state || {};
    var plan = pagePlan(spec, st);
    var html = plan.map(function (pg, i) {
      var last = i === plan.length - 1;
      return '<section class="mx-page">' +
        headHtml(spec, st) +
        infoHtml(spec, st) +
        gridHtml(spec, st, pg.cols, pg.from, pg.to) +
        (last ? incidentHtml(spec, st) : '') +
        (last && spec.infoNote ? '<div class="off-box tiny lg-note">' + esc(spec.infoNote) + '</div>' : '') +
        (last && spec.legend ? '<div class="off-box tiny lg-legend">' + esc(spec.legend) + '</div>' : '') +
        '<div class="off-foot">' + esc(spec.orgName || '동김제농협 산지유통센터') +
        ' · ' + esc(spec.docNo || '') + ' · ' + (i + 1) + ' / ' + plan.length + '</div>' +
        '</section>';
    }).join('');
    return '<div class="off-ccp off-matrix off-ledger">' + html + '</div>';
  }

  global.DkjLedgerPrint = { render: render, theadHtml: theadHtml };
})(window);
