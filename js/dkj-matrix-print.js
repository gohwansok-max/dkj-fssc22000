/**
 * DkjMatrixPrint — 유형 A(항목 × 날짜 매트릭스) 정본 인쇄 레이아웃
 *
 * 종이 원본(선행_1.작업장위생점검일지.hwp) 대조 기준:
 *   구분(대분류/소분류 2단계) | 점 검 사 항 | 주기 | 점검일자 6열 | 비 고
 *   + 일자별 작성 서명행 + 평가/범례행 + 이상 발생 내역표
 * 결재는 주 단위로 실시하므로 시트 1장 = 1주(6일)이다.
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

  function mark(v) {
    if (v === 'O' || v === '○') return '○';
    if (v === 'X' || v === '×') return '×';
    if (v === '-' || v === '—') return '—';
    return '';
  }

  /** 마크 표기 — spec.markMap 이 있으면 우선한다 (예: 계획 ○ / 실시 ●) */
  function marker(spec) {
    var m = spec && spec.markMap;
    if (!m) return mark;
    return function (v) {
      if (v == null || v === '') return '';
      return m[v] != null ? esc(m[v]) : mark(v);
    };
  }

  /** spec.groups 를 인쇄용 평면 행 목록으로 변환.
   *  leadColumns 방식(연간계획서 등)이면 spec.rows 를 그대로 쓴다. */
  function flatten(spec) {
    if (spec.leadColumns) return (spec.rows || []).slice();
    var out = [];
    (spec.groups || []).forEach(function (g) {
      (g.minors || []).forEach(function (m) {
        (m.items || []).forEach(function (it) {
          out.push({
            major: g.major,
            minor: m.name,
            key: it.key,
            label: it.label,
            freq: it.freq || 'D'
          });
        });
      });
    });
    return out;
  }

  /** pageBreakAfter 기준으로 행을 쪽 단위로 자른다 */
  function paginate(rows, breaks) {
    var cuts = (breaks || []).slice().sort(function (a, b) { return a - b; });
    var pages = [];
    var start = 0;
    cuts.forEach(function (c) {
      if (c > start && c < rows.length) {
        pages.push(rows.slice(start, c));
        start = c;
      }
    });
    pages.push(rows.slice(start));
    return pages;
  }

  /** 연속 동일값 구간 길이(rowspan) 계산 */
  function spans(rows, field) {
    var res = new Array(rows.length).fill(0);
    var i = 0;
    while (i < rows.length) {
      var j = i;
      while (j + 1 < rows.length &&
             rows[j + 1][field] === rows[i][field] &&
             (field !== 'minor' || rows[j + 1].major === rows[i].major)) {
        j++;
      }
      res[i] = j - i + 1;
      i = j + 1;
    }
    return res;
  }

  function headHtml(spec, state) {
    var apv = state.approvals || {};
    return '' +
      '<table class="off-head mx-head">' +
      '<tr>' +
      '<th class="mx-mlab">양식번호</th><td class="mx-mval">' + esc(spec.docNo || spec.code) + '</td>' +
      '<td class="off-title-cell mx-title-cell" rowspan="4">' +
      '<div class="off-title">' + esc(spec.title) + '</div>' +
      '</td>' +
      '<th class="mx-apv-lab" rowspan="4">결<br>재</th>' +
      '<th class="mx-apv">작 성</th><th class="mx-apv">검 토</th><th class="mx-apv">승 인</th>' +
      '</tr>' +
      '<tr>' +
      '<th class="mx-mlab">제정일자</th><td class="mx-mval">' + esc(spec.enactDate || '') + '</td>' +
      '<td class="mx-sign" rowspan="3">' + esc(apv.writer || '') + '</td>' +
      '<td class="mx-sign" rowspan="3">' + esc(apv.reviewer || '') + '</td>' +
      '<td class="mx-sign" rowspan="3">' + esc(apv.approver || '') + '</td>' +
      '</tr>' +
      '<tr><th class="mx-mlab">개정일자</th><td class="mx-mval">' + esc(spec.reviseDate || '-') + '</td></tr>' +
      '<tr><th class="mx-mlab">개정번호</th><td class="mx-mval">' + esc(spec.rev != null ? spec.rev : '0') + '</td></tr>' +
      '</table>';
    }

  /** 점검일자 헤더 — dayMode: 'date'(M/D) | 'week'(N주 (M/D)) */
  function dayHead(spec, state, n) {
    var days = state.days || [];
    var labels = spec.dayLabels;
    var weekMode = spec.dayMode === 'week';
    var labelMode = spec.dayMode === 'label';
    var out = '';
    for (var i = 0; i < n; i++) {
      var d = days[i] || '';
      var md = (d && d.length >= 10)
        ? (Number(d.slice(5, 7)) + ' / ' + Number(d.slice(8, 10)))
        : '&nbsp;/&nbsp;';
      var lab = labels && labels[i] ? esc(labels[i]) : '';
      var main = labelMode ? lab : (weekMode ? (lab || (i + 1) + '주') : md);
      var sub = labelMode ? '' : (weekMode ? md : (lab ? '(' + lab + ')' : ''));
      out += '<th class="mx-day">' + main +
        (sub ? '<div class="mx-dow">' + sub + '</div>' : '') + '</th>';
    }
    return out;
  }

  /** leadColumns 방식 본표 — 앞 열 개수·병합을 스펙이 정한다 */
  function leadGridHtml(spec, state, pageRows, isLast) {
    var n = spec.days || 12;
    var lead = spec.leadColumns || [];
    var hasNote = spec.showNote === true;
    var total = lead.length + n + (hasNote ? 1 : 0);
    var checks = state.checks || {};
    var notes = state.notes || {};
    var mk = marker(spec);
    var spanOf = {};
    lead.forEach(function (c) {
      if (c.merge) spanOf[c.key] = spans(pageRows, c.key);
    });

    var head =
      '<tr>' +
      lead.map(function (c, i) {
        if (!c.label) return '';
        var span = 1;
        while (i + span < lead.length && !lead[i + span].label) span++;
        return '<th rowspan="2"' + (span > 1 ? ' colspan="' + span + '"' : '') +
          (c.width ? ' style="width:' + c.width + '"' : '') +
          ' class="mx-lead">' + esc(c.label) + '</th>';
      }).join('') +
      '<th colspan="' + n + '">' + esc(spec.dayHeader || '점검일자') + '</th>' +
      (hasNote ? '<th rowspan="2" class="mx-note">비 고</th>' : '') +
      '</tr><tr>' + dayHead(spec, state, n) + '</tr>';

    var body = pageRows.map(function (r, i) {
      var tds = lead.map(function (c) {
        if (c.merge) {
          if (!spanOf[c.key][i]) return '';
          return '<td class="lab mx-major" rowspan="' + spanOf[c.key][i] + '">' +
            esc(r[c.key] || '') + '</td>';
        }
        return '<td class="' + (c.align === 'center' ? 'c' : 'l') + ' mx-label">' +
          esc(r[c.key] || '') + '</td>';
      }).join('');
      var vals = checks[r.key] || [];
      for (var d = 0; d < n; d++) tds += '<td class="c mx-cell">' + mk(vals[d]) + '</td>';
      if (hasNote) tds += '<td class="l mx-note">' + esc(notes[r.key] || '') + '</td>';
      return '<tr>' + tds + '</tr>';
    }).join('');

    var tail = isLast && spec.legend
      ? '<tr class="mx-legendrow"><td colspan="' + total + '" class="tiny">' +
        esc(spec.legend) + '</td></tr>'
      : '';

    return '<table class="off-grid mx-grid mx-lead-grid"><thead>' + head +
      '</thead><tbody>' + body + tail + '</tbody></table>';
  }

  function gridHtml(spec, state, pageRows, isLast) {
    if (spec.leadColumns) return leadGridHtml(spec, state, pageRows, isLast);
    var n = spec.days || 6;
    var lv = spec.divLevels === 1 ? 1 : 2;        // 구분 계층 (1단계 / 2단계)
    var hasFreq = spec.showFreq !== false;        // 주기 열 유무
    var hasNote = spec.showNote !== false;        // 비고 열 유무
    var total = lv + 1 + (hasFreq ? 1 : 0) + n + (hasNote ? 1 : 0);
    var checks = state.checks || {};
    var notes = state.notes || {};
    var majorSpan = spans(pageRows, 'major');
    var minorSpan = lv === 2 ? spans(pageRows, 'minor') : null;

    var head =
      '<tr>' +
      '<th colspan="' + lv + '" rowspan="2" class="mx-div">구 분</th>' +
      '<th rowspan="2" class="mx-item">' + esc(spec.itemHeader || '점 검 사 항') + '</th>' +
      (hasFreq ? '<th rowspan="2" class="mx-freq">주기</th>' : '') +
      '<th colspan="' + n + '">' + esc(spec.dayHeader || '점검일자') + '</th>' +
      (hasNote ? '<th rowspan="2" class="mx-note">비 고</th>' : '') +
      '</tr>' +
      '<tr>' + dayHead(spec, state, n) + '</tr>';

    var body = pageRows.map(function (r, i) {
      var tds = '';
      if (majorSpan[i]) {
        tds += '<td class="lab mx-major" rowspan="' + majorSpan[i] + '">' + esc(r.major) + '</td>';
      }
      if (lv === 2 && minorSpan[i]) {
        tds += '<td class="lab mx-minor" rowspan="' + minorSpan[i] + '">' + esc(r.minor) + '</td>';
      }
      tds += '<td class="l mx-label">' + esc(r.label) + '</td>';
      if (hasFreq) tds += '<td class="c mx-freq">' + esc(r.freq) + '</td>';
      var vals = checks[r.key] || [];
      var mk = marker(spec);
      for (var d = 0; d < n; d++) {
        tds += '<td class="c mx-cell">' + mk(vals[d]) + '</td>';
      }
      if (hasNote) tds += '<td class="l mx-note">' + esc(notes[r.key] || '') + '</td>';
      return '<tr>' + tds + '</tr>';
    }).join('');

    var tail = '';
    if (isLast) {
      var signs = state.signs || [];
      var signCells = '';
      for (var s = 0; s < n; s++) {
        signCells += '<td class="c mx-cell">' + esc(signs[s] || '') + '</td>';
      }
      var leadCols = lv + 1 + (hasFreq ? 1 : 0);
      tail =
        '<tr class="mx-signrow">' +
        '<th colspan="' + leadCols + '" class="lab">' + esc(spec.signRowLabel || '작 성') + '</th>' +
        signCells +
        (hasNote ? '<td class="mx-note"></td>' : '') +
        '</tr>' +
        '<tr class="mx-legendrow">' +
        '<td colspan="' + total + '" class="tiny">' + esc(spec.legend || '') + '</td>' +
        '</tr>';
    }

    return '<table class="off-grid mx-grid"><thead>' + head + '</thead><tbody>' +
      body + tail + '</tbody></table>';
  }

  function incidentHtml(spec, state) {
    var cfg = spec.incident;
    if (!cfg) return '';
    var cols = cfg.columns || [];
    var rows = state.incidents || [];
    var count = cfg.rows || 5;
    var head =
      '<tr class="off-nest-hd">' +
      '<th class="vert mx-inc-lab">구 분</th>' +
      cols.map(function (c) {
        return '<th' + (c.width ? ' style="width:' + c.width + '"' : '') + '>' + esc(c.label) + '</th>';
      }).join('') +
      '</tr>';
    var body = '';
    for (var i = 0; i < count; i++) {
      var r = rows[i] || {};
      var cells = cols.map(function (c) {
        return '<td class="l">' + esc(r[c.key] || '') + '</td>';
      }).join('');
      if (i === 0) {
        body += '<tr><th class="vert mx-inc-lab" rowspan="' + count + '">' +
          esc(cfg.label || '이상 발생 내역') + '</th>' + cells + '</tr>';
      } else {
        body += '<tr>' + cells + '</tr>';
      }
    }
    return '<table class="off-correct mx-inc">' + head + body + '</table>';
  }

  function pageWrap(inner) {
    return '<section class="mx-page">' + inner + '</section>';
  }

  function render(spec, state) {
    var st = state || {};
    var rows = flatten(spec);
    var pages = paginate(rows, spec.pageBreakAfter);
    var html = pages.map(function (pageRows, pi) {
      var isLast = pi === pages.length - 1;
      return pageWrap(
        headHtml(spec, st) +
        gridHtml(spec, st, pageRows, isLast) +
        (isLast ? incidentHtml(spec, st) : '') +
        '<div class="off-foot">' + esc(spec.orgName || '동김제농협 가공센터') +
        ' · ' + esc(spec.docNo || '') + ' · ' + (pi + 1) + ' / ' + pages.length + '</div>'
      );
    }).join('');
    return '<div class="off-ccp off-matrix">' + html + '</div>';
  }

  global.DkjMatrixPrint = {
    render: render,
    flatten: flatten,
    paginate: paginate,
    spans: spans
  };
})(window);
