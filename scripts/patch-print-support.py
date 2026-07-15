#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Patch non-generated record HTML/JS for print-sheet support."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
REC = ROOT / "records"
JS = ROOT / "js"

FORMS = [
    "DKJ-H-01-01",
    "DKJ-H-01-02",
    "FR-014",
    "FR-015",
]


def patch_html(code: str) -> None:
    path = REC / f"{code}.html"
    if not path.exists():
        print("skip html", code)
        return
    html = path.read_text(encoding="utf-8")
    if "dkj-print.css" not in html:
        html = html.replace(
            '<link rel="stylesheet" href="../css/dkj-form.css">',
            '<link rel="stylesheet" href="../css/dkj-form.css">\n  <link rel="stylesheet" href="../css/dkj-print.css">',
        )
    if 'class="screen-only"' not in html:
        html = html.replace(
            '<body class="dkj-form-page">',
            '<body class="dkj-form-page">\n  <div class="screen-only">',
            1,
        )
        # before scripts, close screen-only and add printSheet
        html = re.sub(
            r"(\s*)(<script src=\"../js/dkj-record-store)",
            r'\1</div>\n  <div id="printSheet" class="print-sheet" aria-hidden="true"></div>\n\1\2',
            html,
            count=1,
        )
    if "dkj-print-form.js" not in html:
        html = html.replace(
            '<script src="../js/dkj-record-store.js"></script>',
            '<script src="../js/dkj-record-store.js"></script>\n  <script src="../js/dkj-print-form.js"></script>',
        )
    html = html.replace(">인쇄</button>", ">인쇄(정본)</button>")
    path.write_text(html, encoding="utf-8")
    print("html", code)


PRINT_SNIPPET = """
  function dkjDoPrint() {
    var st = (typeof collect === 'function') ? collect() : (typeof state !== 'undefined' ? state : {});
    if (window.DkjPrint) {
      var tmpl = {
        layout: 'ox',
        columnMode: 'result',
        orgName: '동김제농협 가공센터',
        docNo: FORM_ID,
        title: document.title.split('|')[0].trim(),
        rev: '0',
        enactDate: '2026.07.10',
        reviseDate: '2026.07.10',
        rows: (typeof CHECK_ITEMS !== 'undefined' ? CHECK_ITEMS : []).map(function (it) {
          return { key: it.key, group: it.group || '', label: it.label, freq: 'D', hint: it.hint || '' };
        }),
        note: '※ 평가 — 양호: ○ , 부적합: ×   ※ 작성화면과 분리된 정본형 출력'
      };
      if (!tmpl.rows.length && st.checks) {
        tmpl.rows = Object.keys(st.checks).map(function (k) {
          return { key: k, group: '', label: k, freq: 'D' };
        });
      }
      // CCP: synthesize rows from known fields
      if (!tmpl.rows.length) {
        tmpl.rows = [
          { key: '_judge', group: '판정', label: '종합판정', freq: 'D' },
          { key: '_corr', group: '조치', label: '즉시조치', freq: 'D' }
        ];
        st.checks = st.checks || {};
        st.checks._judge = st.judge || st.result || '';
        st.checks._corr = (st.corrective || '').slice(0, 20) ? 'O' : '';
      }
      DkjPrint.print(tmpl, st);
    } else {
      window.print();
    }
  }
"""


def patch_js(code: str) -> None:
    path = JS / f"{code}.js"
    if not path.exists():
        print("skip js", code)
        return
    text = path.read_text(encoding="utf-8")
    if "dkjDoPrint" in text or "DkjPrint.print" in text:
        print("js already", code)
        return
    # inject helper before btnPrint binding
    text2 = text.replace(
        "$('btnPrint').addEventListener('click', function () { window.print(); });",
        "if (!window._dkjDoPrintReady) { window._dkjDoPrintReady = true; }\n"
        + PRINT_SNIPPET
        + "\n    $('btnPrint').addEventListener('click', function () { dkjDoPrint(); });",
    )
    if text2 == text:
        # try alternate
        text2 = text.replace(
            "window.print();",
            "if (window.DkjPrint) { dkjDoPrint(); } else { window.print(); }",
            1,
        )
        if "function dkjDoPrint" not in text2:
            # prepend helper inside IIFE after FORM_ID
            text2 = text.replace(
                f"var FORM_ID = '{code}';",
                f"var FORM_ID = '{code}';\n{PRINT_SNIPPET}",
                1,
            )
            text2 = text2.replace(
                "$('btnPrint').addEventListener('click', function () { window.print(); });",
                "$('btnPrint').addEventListener('click', function () { dkjDoPrint(); });",
            )
    path.write_text(text2, encoding="utf-8")
    print("js", code)


def main():
    for c in FORMS:
        patch_html(c)
        patch_js(c)


if __name__ == "__main__":
    main()
