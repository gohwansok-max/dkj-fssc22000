#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""대장(유형 E) 서식의 화면 HTML 과 부트 스크립트를 사양에서 생성한다.

    data/ledger-form-specs/<코드>.json   ← 정본(SSOT). 사람이 고치는 곳.
        ↓
    js/<코드>.js          DkjLedgerForm.mount(<사양>) 부트 스크립트
    records/<코드>.html   화면 껍데기

화면이 사양 JSON 을 fetch 하지 않고 부트 스크립트를 읽는 이유는 `file://` 로 열어도
동작해야 하기 때문이다(CLAUDE.md 참고). 그래서 사양을 고쳤으면 반드시 이 스크립트를
돌려야 화면에 반영된다.

사용:
    python scripts/build-ledger-forms.py              # 전체
    python scripts/build-ledger-forms.py DKJ-S-02-14  # 특정 코드만
    python scripts/build-ledger-forms.py --check      # 쓰지 않고 차이만 보고(종료코드 1)

껍데기는 지금 배포본과 같아야 한다 — 상단 내비, 로그인·클라우드 동기화, 전자결재
패널, 딥링크, PWA, 다국어, 접근성 스크립트, 캐시버전 `?v=NN`. 2026-09-08 에 대장
서식 10종이 HTML·부트 JS 모두 바이트 단위로 같게 재생성되는 것을 확인했다.
**템플릿을 고쳤으면 `--check` 로 기존 파일과 같은지 먼저 확인하고 커밋할 것.**
(fr 엔진의 같은 역할은 scripts/gen-fr-forms.py 다. 다만 그쪽은 사양이 파이썬 파일
안의 SPECS 에 있고, 대장은 JSON 이 정본이라는 점이 다르다.)

화면 껍데기가 사양에서 읽는 값:
    title / subtitle          제목·부제
    cat                       기록목록 링크의 ?cat= (기본 daily)
    defaultRows               있으면 행 추가 버튼을 비운다(서식에 행이 고정된 대장)
    incident                  있으면 하단 '이상 발생 내역' 표 자리를 넣는다
    pageClass                 body 에 덧붙일 클래스(예: 온도표의 temperature-log-page)
    bulkChoice                있으면 적/부 일괄 입력 버튼 묶음을 넣는다
                              {label, aria, okText, ngText}

새 대장 서식을 추가할 때는 이 스크립트로 HTML·부트 JS 를 만든 뒤,
`python scripts/new-record-catalog-add.py --apply` 로 카탈로그 4종에 등록하고
`python scripts/build-catalog-bundles.py`, `python scripts/build-sw-precache.py` 를
돌린다.
"""
from __future__ import annotations

import collections
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPEC_DIR = ROOT / "data" / "ledger-form-specs"
REC_DIR = ROOT / "records"
JS_DIR = ROOT / "js"

# 캐시버전(?v=NN) — 배포본에서 실제로 쓰이는 값을 읽는다. 여기 숫자를 박아 두면
# 전체 버전을 올릴 때마다 이 파일만 뒤처져서, 나중에 재생성했을 때 옛 버전 태그가
# 되살아난다(2026-08 에 scripts/inject-*.py 가 실제로 그렇게 v=38 에 멈춰 있었다).
CACHE_VERSION_FALLBACK = "88"

BOOT_TEMPLATE = """/**
 * {code} - ledger boot (SSOT: data/ledger-form-specs/{code}.json)
 */
(function () {{
  'use strict';
  DkjLedgerForm.mount({spec});
}})();
"""


def esc(s: str) -> str:
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def cache_version() -> str:
    """records/*.html 에서 가장 많이 쓰인 ?v=NN 을 캐시버전으로 본다."""
    seen: collections.Counter[str] = collections.Counter()
    for path in REC_DIR.glob("*.html"):
        seen.update(re.findall(r"\?v=(\d+)", path.read_text(encoding="utf-8")))
    return seen.most_common(1)[0][0] if seen else CACHE_VERSION_FALLBACK


def render_js(code: str, spec: dict) -> str:
    return BOOT_TEMPLATE.format(
        code=code, spec=json.dumps(spec, ensure_ascii=False, indent=2)
    )


def render_html(code: str, spec: dict, v: str) -> str:
    title = f'{code} {spec["title"]}'
    page_class = spec.get("pageClass")
    body_class = "dkj-form-page" + (f" {page_class}" if page_class else "")

    # 행이 서식에 고정된 대장(구역별·일자별)은 작업자가 행을 늘릴 일이 없다.
    # 버튼 자체를 지우면 툴바 높이가 달라져 표가 흔들려서, 자리만 비워 둔다.
    add_label = "　" if spec.get("defaultRows") else "+ 행 추가"

    bulk = spec.get("bulkChoice")
    bulk_html = ""
    if bulk:
        bulk_html = (
            f'\n        <div class="mxf-quick temperature-bulk-actions" '
            f'aria-label="{esc(bulk["aria"])}">'
            f'\n          <span>{esc(bulk["label"])}</span>'
            f'\n          <button type="button" class="pill-btn green" id="btnBulkOk">'
            f'{esc(bulk["okText"])}</button>'
            f'\n          <button type="button" class="pill-btn ghost" id="btnBulkNg">'
            f'{esc(bulk["ngText"])}</button>'
            f"\n        </div>"
        )
    toolbar = (
        f'      <div class="mxf-toolbar">{bulk_html}\n'
        if bulk
        else '      <div class="mxf-toolbar"><div></div>\n'
    )

    incident_html = (
        '\n      <div class="mxf-scroll" id="incidentGrid" style="margin-top:14px;"></div>'
        if spec.get("incident")
        else ""
    )

    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#009a44">
  <title>{esc(title)} | 동김제농협</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../css/dkj-tokens.css?v={v}">
  <link rel="stylesheet" href="../css/dkj-form.css?v={v}">
  <link rel="stylesheet" href="../css/dkj-matrix.css?v={v}">
  <link rel="stylesheet" href="../css/dkj-print.css?v={v}">
  <link rel="manifest" href="../manifest.json?v={v}">
  <link rel="stylesheet" href="../css/dkj-quick-nav.css?v={v}">
  <link rel="stylesheet" href="../css/dkj-accessibility.css?v={v}">
</head>
<body class="{body_class}">
  <div class="screen-only">
  <nav id="dkjNav"></nav>
  <header class="dkj-form-header">
    <div class="container">
      <div><h1>{esc(title)}</h1><p>{esc(spec.get("subtitle", ""))}</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <a class="pill-btn ghost" href="../records-center.html?cat={esc(spec.get("cat", "daily"))}">← 기록목록</a>
      </div>
    </div>
  </header>
  <main class="container dkj-form-body">
    <div class="dkj-form-toolbar">
      <div class="dkj-status" id="saveStatus"><span class="dot"></span> 준비</div>
      <button type="button" class="pill-btn green" id="btnSave">저장</button>
      <button type="button" class="pill-btn blue" id="btnLock">작성완료</button>
      <button type="button" class="pill-btn ghost" id="btnNew">새 시트</button>
      <button type="button" class="pill-btn ghost" id="btnPrint">인쇄(정본)</button>
    </div>
    <section class="dkj-panel">
      <h2>① 기본정보 · 결재</h2>
      <div class="dkj-field-grid" id="infoFields"></div>
      <div class="dkj-field-grid" style="margin-top:10px;">
        <div class="dkj-field"><label for="writer">작성 *</label><input type="text" id="writer"></div>
        <div class="dkj-field"><label for="reviewer">검토</label><input type="text" id="reviewer"></div>
        <div class="dkj-field"><label for="approver">승인</label><input type="text" id="approver"></div>
      </div>
    </section>
    <section class="dkj-panel">
      <h2>② 기록 <span style="font-weight:500;color:#888;font-size:12px;">(건별로 행을 추가하세요)</span></h2>
{toolbar}        <div class="mxf-quick"><button type="button" class="pill-btn ghost" id="btnAddRow">{add_label}</button></div>
      </div>
      <div class="mxf-scroll" id="ledgerGrid"></div>{incident_html}
      <div class="dkj-field full" style="margin-top:12px;"><label for="remark">비고</label><textarea id="remark"></textarea></div>
    </section>
    <section class="dkj-panel">
      <h2>전자결재 · 감사이력</h2>
      <div id="approvalPanel"></div>
    </section>
    <section class="dkj-panel history"><h2>③ 최근 저장</h2><div id="historyList"></div></section>
  </main>
  </div>
  <div id="printSheet" class="print-sheet" aria-hidden="true"></div>
  <script src="../js/dkj-util.js?v={v}"></script>
  <script src="../js/dkj-firebase-config.js?v={v}"></script>
  <script src="../js/dkj-auth.js?v={v}"></script>
  <script src="../js/dkj-cloud-sync.js?v={v}"></script>
  <script src="../js/dkj-nav-bar.js?v={v}"></script>
  <script src="../js/dkj-record-store.js?v={v}"></script>
  <script src="../js/dkj-deeplink.js?v={v}"></script>
  <script src="../js/dkj-approval.js?v={v}"></script>
  <script src="../js/dkj-ledger-print.js?v={v}"></script>
  <script src="../js/dkj-ledger-form.js?v={v}"></script>
  <script src="../js/{esc(code)}.js?v={v}"></script>
  <script src="../js/dkj-pwa.js?v={v}"></script>
  <script src="../js/dkj-quick-nav.js?v={v}"></script>
  <script src="../js/dkj-i18n.js?v={v}"></script>
  <script src="../js/dkj-accessibility.js?v={v}"></script>
</body>
</html>
"""


def build(code: str, v: str, check: bool) -> list[str]:
    """생성 결과를 쓰거나(check=False), 달라진 파일 목록만 돌려준다(check=True)."""
    spec = json.loads((SPEC_DIR / f"{code}.json").read_text(encoding="utf-8"))
    outputs = {
        JS_DIR / f"{code}.js": render_js(code, spec),
        REC_DIR / f"{code}.html": render_html(code, spec, v),
    }
    changed = []
    for path, text in outputs.items():
        old = path.read_text(encoding="utf-8") if path.exists() else None
        if old == text:
            continue
        changed.append(str(path.relative_to(ROOT)))
        if not check:
            path.write_text(text, encoding="utf-8")
    return changed


def main() -> int:
    args = [a for a in sys.argv[1:] if a != "--check"]
    check = "--check" in sys.argv[1:]
    codes = args or sorted(p.stem for p in SPEC_DIR.glob("*.json"))
    v = cache_version()
    changed: list[str] = []
    for code in codes:
        changed += build(code, v, check)
    if check:
        if changed:
            print("사양과 다른 파일:")
            for c in changed:
                print("  ", c)
            return 1
        print(f"일치 — 서식 {len(codes)}종 (캐시버전 v={v})")
        return 0
    print(f"생성 완료 — 서식 {len(codes)}종 (캐시버전 v={v})")
    for c in changed:
        print("   갱신", c)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
