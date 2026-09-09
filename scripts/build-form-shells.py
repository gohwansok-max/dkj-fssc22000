#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""matrix · ox · report 엔진 서식의 화면 HTML 과 부트 스크립트를 사양에서 생성한다.

    data/<엔진>-form-specs/<코드>.json   ← 정본(SSOT). 사람이 고치는 곳.
        ↓
    records/<코드>.html   화면 껍데기
    js/<코드>.js          Dkj<엔진>Form.mount(<사양>) 부트 스크립트

대장(ledger) 엔진은 같은 방식의 별도 스크립트 scripts/build-ledger-forms.py 가 맡는다.
fr 엔진은 규약이 반대다 — scripts/gen-fr-forms.py 안의 SPECS 가 정본이고 사양 JSON 이
생성물이다. 셋을 헷갈리지 말 것.

사용:
    python scripts/build-form-shells.py                 # 전체(15종)
    python scripts/build-form-shells.py DKJ-S-02-06     # 특정 코드만
    python scripts/build-form-shells.py --check         # 쓰지 않고 차이만 보고(종료코드 1)

껍데기는 지금 배포본과 같아야 한다 — 상단 내비, 로그인·클라우드 동기화, 전자결재
패널, 딥링크, PWA, 다국어, 접근성 스크립트, 캐시버전 `?v=NN`. 2026-09-08 에 15종이
바이트 단위로 같게 재생성되는 것을 확인했다.
**템플릿을 고쳤으면 `--check` 로 기존 파일과 같은지 먼저 확인하고 커밋할 것.**

엔진별로 화면이 사양에서 읽는 값:

    공통      title / subtitle / headerLinks / footerLinks
    matrix    screen{newLabel, periodLabel, startLabel, sectionTitle, fillAria,
                     fillText, hint}   — hint 는 <strong> 을 쓰므로 이스케이프하지 않는다
    ox        fields(① 기본정보 입력칸) / sectionOxTitle(② 제목) / customBoot
    report    (제목·부제 외에 화면 변형 없음. 본문은 blocks 를 엔진이 그린다)

예외 — js/DKJ-STORE-01.js 는 생성하지 않는다. FR-014 입고에서 넘어온 파라미터를
읽는 손으로 쓴 코드가 mount() 앞뒤에 붙어 있어서, 생성하면 그 로직이 날아간다.
HTML 은 생성 대상이다(customBoot: "store" 로 연계 배너·공정바·마스터데이터 스크립트가
붙는다).
"""
from __future__ import annotations

import collections
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
REC_DIR = ROOT / "records"
JS_DIR = ROOT / "js"

# 캐시버전(?v=NN) — 배포본에서 실제로 쓰이는 값을 읽는다. 여기 숫자를 박아 두면 전체
# 버전을 올릴 때마다 이 파일만 뒤처져서, 나중에 재생성했을 때 옛 버전 태그가 되살아난다.
CACHE_VERSION_FALLBACK = "90"

ENGINES = {
    "matrix": {"spec_dir": "matrix-form-specs", "mount": "DkjMatrixForm",
               "extra_css": ["dkj-matrix.css"],
               "engine_js": ["dkj-matrix-print.js", "dkj-matrix-form.js"]},
    "ox": {"spec_dir": "ox-form-specs", "mount": "DkjOxForm",
           "extra_css": [],
           "engine_js": ["dkj-print-form.js", "dkj-print-official.js", "dkj-ox-form.js"]},
    "report": {"spec_dir": "report-form-specs", "mount": "DkjReportForm",
               "extra_css": ["dkj-matrix.css"],
               "engine_js": ["dkj-report-print.js", "dkj-report-form.js"]},
}

# 부트 JS 를 생성하지 않는 서식 — 손으로 쓴 코드가 mount() 주변에 붙어 있다.
JS_SKIP = {"DKJ-STORE-01"}

# ox 부트는 사양 전체가 아니라 런타임이 실제로 쓰는 키만 담는다.
OX_BOOT_KEYS = ["code", "title", "pattern", "minChecks", "titleKey",
                "historyKeys", "fields", "items", "print"]

# 화면 껍데기를 그릴 때만 쓰는 키 — 부트 스크립트에는 넣지 않는다.
# 엔진이 안 쓰는 값을 실어 보내면 기록 저장·동기화 payload 만 커진다.
HTML_ONLY_KEYS = {"screen", "headerLinks", "footerLinks"}

BOOT_TEMPLATE = """/**
 * {code} - {engine} boot (SSOT: data/{spec_dir}/{code}.json)
 */
(function () {{
  'use strict';
  {mount}.mount({spec});
}})();
"""


def esc(s) -> str:
    return (
        str("" if s is None else s)
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


def head(code: str, spec: dict, v: str, extra_css: list[str]) -> str:
    css = "".join(
        f'\n  <link rel="stylesheet" href="../css/{name}?v={v}">'
        for name in ["dkj-tokens.css", "dkj-form.css", *extra_css, "dkj-print.css"]
    )
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#009a44">
  <title>{esc(code)} {esc(spec["title"])} | 동김제농협</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800&display=swap" rel="stylesheet">{css}
  <link rel="manifest" href="../manifest.json?v={v}">
  <link rel="stylesheet" href="../css/dkj-quick-nav.css?v={v}">
  <link rel="stylesheet" href="../css/dkj-accessibility.css?v={v}">
</head>"""


def header_links(spec: dict) -> str:
    links = spec.get("headerLinks") or [
        {"label": "← 기록목록", "href": "../records-center.html?cat=daily"}
    ]
    return "".join(
        f'<a class="pill-btn ghost" href="{esc(l["href"])}">{esc(l["label"])}</a>' for l in links
    )


def footer_links(spec: dict) -> str:
    links = spec.get("footerLinks") or []
    if not links:
        return ""
    chips = "".join(
        f'<a class="link-chip sm" href="{esc(l["href"])}">{esc(l["label"])}</a>' for l in links
    )
    return f'\n      <div class="dkj-link-bar">\n        {chips}\n      </div>'


def scripts(code: str, v: str, engine_js: list[str], extra_js: str = "") -> str:
    common_head = ["dkj-util.js", "dkj-firebase-config.js", "dkj-auth.js", "dkj-cloud-sync.js",
                   "dkj-nav-bar.js", "dkj-record-store.js", "dkj-deeplink.js", "dkj-approval.js"]
    common_tail = ["dkj-pwa.js", "dkj-quick-nav.js", "dkj-i18n.js", "dkj-accessibility.js"]
    out = "".join(f'\n  <script src="../js/{n}?v={v}"></script>' for n in common_head)
    out += extra_js
    out += "".join(f'\n  <script src="../js/{n}?v={v}"></script>' for n in engine_js)
    out += f'\n  <script src="../js/{esc(code)}.js?v={v}"></script>'
    out += "".join(f'\n  <script src="../js/{n}?v={v}"></script>' for n in common_tail)
    return out


def render_matrix(code: str, spec: dict, v: str) -> str:
    sc = spec.get("screen", {})
    cfg = ENGINES["matrix"]
    return f"""{head(code, spec, v, cfg["extra_css"])}
<body class="dkj-form-page">
  <div class="screen-only">
  <nav id="dkjNav"></nav>
  <header class="dkj-form-header">
    <div class="container">
      <div><h1>{esc(code)} {esc(spec["title"])}</h1><p>{esc(spec.get("subtitle", ""))}</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        {header_links(spec)}
      </div>
    </div>
  </header>
  <main class="container dkj-form-body">
    <div class="dkj-form-toolbar">
      <div class="dkj-status" id="saveStatus"><span class="dot"></span> 준비</div>
      <button type="button" class="pill-btn green" id="btnSave">저장</button>
      <button type="button" class="pill-btn blue" id="btnLock">작성완료</button>
      <button type="button" class="pill-btn ghost" id="btnNew">{esc(sc.get("newLabel", "새 시트"))}</button>
      <button type="button" class="pill-btn ghost" id="btnPrint">인쇄(정본)</button>
    </div>
    <section class="dkj-panel">
      <h2>① {esc(sc.get("periodLabel", "점검"))} · 결재</h2>
      <div class="dkj-field-grid">
        <div class="dkj-field"><label for="weekStart">{esc(sc.get("startLabel", "시작일 *"))}</label><input type="date" id="weekStart"></div>
        <div class="dkj-field"><label>점검 기간</label><div class="mxf-range" id="weekRange">—</div></div>
      </div>
      <div class="dkj-field-grid mxf-approval-row">
        <div class="dkj-field"><label for="writer">작성 *</label><input type="text" id="writer" placeholder="점검자"></div>
        <div class="dkj-field"><label for="reviewer">검토</label><input type="text" id="reviewer" placeholder="HACCP팀장"></div>
        <div class="dkj-field"><label for="approver">승인</label><input type="text" id="approver" placeholder="센터장"></div>
      </div>
      <p class="mxf-hint">{sc.get("hint", "")}</p>
    </section>
    <section class="dkj-panel">
      <h2>② {esc(sc.get("sectionTitle", "점검"))} <span style="font-weight:500;color:#888;font-size:12px;">(셀을 누르면 ○ → × → — → 공란 순환)</span></h2>
      <div class="mxf-toolbar">
        <div class="mxf-summary" id="mxSummary"></div>
        <div class="mxf-quick">
          <select id="fillDay" aria-label="{esc(sc.get("fillAria", "일괄 입력 대상"))}"></select>
          <button type="button" class="pill-btn ghost" id="btnFillO">{esc(sc.get("fillText", "해당 열 미입력 전체 ○"))}</button>
        </div>
      </div>
      <div class="mxf-scroll" id="matrixGrid"></div>
    </section>
    <section class="dkj-panel">
      <h2>③ 이상 발생 내역 <span style="font-weight:500;color:#888;font-size:12px;">(× 판정 시 필수)</span></h2>
      <div class="mxf-scroll" id="incidentGrid"></div>
      <div class="dkj-field full" style="margin-top:12px;"><label for="remark">비고</label><textarea id="remark"></textarea></div>{footer_links(spec)}
    </section>
    <section class="dkj-panel">
      <h2>전자결재 · 감사이력</h2>
      <div id="approvalPanel"></div>
    </section>
    <section class="dkj-panel history"><h2>④ 최근 저장</h2><div id="historyList"></div></section>
  </main>
  </div>
  <div id="printSheet" class="print-sheet" aria-hidden="true"></div>{scripts(code, v, cfg["engine_js"])}
</body>
</html>
"""


def ox_field(f: dict) -> str:
    fid, label = f["id"], esc(f["label"])
    typ = f.get("type", "text")
    if typ == "select":
        # 선택지는 문자열(저장값=표시값) 또는 {value, label} 둘 다 받는다.
        # 점검구역처럼 저장값('전처리')과 화면 표시('전처리실')가 다른 칸이 있다.
        opts = ""
        for o in f.get("options") or []:
            val, lab = (o["value"], o["label"]) if isinstance(o, dict) else (o, o)
            opts += f'<option value="{esc(val)}">{esc(lab)}</option>' 
        return f'<div class="dkj-field"><label for="{fid}">{label}</label><select id="{fid}">{opts}</select></div>'
    if typ == "number":
        val = f' value="{esc(f["default"])}"' if f.get("default") is not None else ""
        return f'<div class="dkj-field"><label for="{fid}">{label}</label><input type="number" id="{fid}"{val}></div>'
    if typ == "date":
        return f'<div class="dkj-field"><label for="{fid}">{label}</label><input type="date" id="{fid}"></div>'
    if typ == "time":
        return f'<div class="dkj-field"><label for="{fid}">{label}</label><input type="time" id="{fid}"></div>'
    ph = esc(f.get("placeholder", ""))
    return f'<div class="dkj-field"><label for="{fid}">{label}</label><input type="text" id="{fid}" placeholder="{ph}"></div>'


def render_ox(code: str, spec: dict, v: str) -> str:
    cfg = ENGINES["ox"]
    store = spec.get("customBoot") == "store"
    fields = "".join(ox_field(f) for f in spec.get("fields", []))
    banner = (
        '\n    <div class="viewer-notice" id="from014Banner" hidden style="margin-bottom:14px;'
        'background:#e8f5e9;border-color:#a5d6a7;color:#1b5e20;">'
        "\n      ✓ FR-014 적합 입고에서 연계되었습니다. 보관 위치를 지정하고 FIFO 점검을 완료하세요."
        "\n    </div>"
        '\n    <div class="process-bar-wrap" style="margin-bottom:14px;">'
        '\n      <div id="processBar"></div>'
        "\n    </div>"
        if store
        else ""
    )
    extra_js = f'\n  <script src="../js/dkj-master-data.js?v={v}"></script>' if store else "\n  "
    return f"""{head(code, spec, v, cfg["extra_css"])}
<body class="dkj-form-page">
  <div class="screen-only">
  <nav id="dkjNav"></nav>
  <header class="dkj-form-header">
    <div class="container">
      <div>
        <h1>{esc(code)} {esc(spec["title"])}</h1>
        <p>{esc(spec.get("subtitle", ""))}</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        {header_links(spec)}
      </div>
    </div>
  </header>
  <main class="container dkj-form-body">
    <div class="dkj-form-toolbar">
      <div class="dkj-status" id="saveStatus"><span class="dot"></span> 준비</div>
      <button type="button" class="pill-btn green" id="btnSave">저장</button>
      <button type="button" class="pill-btn blue" id="btnLock">작성완료</button>
      <button type="button" class="pill-btn ghost" id="btnNew">새 일보</button>
      <button type="button" class="pill-btn ghost" id="btnPrint">인쇄(정본)</button>
    </div>
    {banner}
    <section class="dkj-panel">
      <h2>① 점검 기본정보</h2>
      <div class="dkj-field-grid">
        {fields}
      </div>
    </section>
    <section class="dkj-panel">
      <h2>② {esc(spec.get("sectionOxTitle", "점검 O/X"))} <span style="font-weight:500;color:#888;font-size:12px;">(O 적합 · X 부적합 · - 해당없음)</span></h2>
      <div class="ox-grid" id="oxGrid"></div>
    </section>
    <section class="dkj-panel">
      <h2>③ 판정·시정</h2>
      <div class="dkj-field-grid">
        <div class="dkj-field full"><label>종합판정 *</label>
          <div class="judge-row">
            <button type="button" class="judge-btn ok" id="judgeOk" data-judge="적합">✓ 적합</button>
            <button type="button" class="judge-btn ng" id="judgeNg" data-judge="부적합">✕ 부적합</button>
          </div>
        </div>
        <div class="dkj-field full"><label for="corrective">부적합 시 즉시조치</label>
          <textarea id="corrective" placeholder="내용·조치자·완료시각"></textarea></div>
        <div class="dkj-field"><label for="inspector">점검자 *</label><input type="text" id="inspector" placeholder=""></div><div class="dkj-field"><label for="confirmer">확인자</label><input type="text" id="confirmer" placeholder=""></div>
        <div class="dkj-field full"><label for="remark">비고</label><textarea id="remark"></textarea></div>
      </div>{footer_links(spec)}
    </section>
    <section class="dkj-panel">
      <h2>전자결재 · 감사이력</h2>
      <div id="approvalPanel"></div>
    </section>
    <section class="dkj-panel history"><h2>④ 최근 저장</h2><div id="historyList"></div></section>
  </main>
  </div>
  <div id="printSheet" class="print-sheet" aria-hidden="true"></div>{scripts(code, v, cfg["engine_js"], extra_js)}
</body>
</html>
"""


def render_report(code: str, spec: dict, v: str) -> str:
    cfg = ENGINES["report"]
    return f"""{head(code, spec, v, cfg["extra_css"])}
<body class="dkj-form-page">
  <div class="screen-only">
  <nav id="dkjNav"></nav>
  <header class="dkj-form-header">
    <div class="container">
      <div><h1>{esc(code)} {esc(spec["title"])}</h1><p>{esc(spec.get("subtitle", ""))}</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        {header_links(spec)}
      </div>
    </div>
  </header>
  <main class="container dkj-form-body">
    <div class="dkj-form-toolbar">
      <div class="dkj-status" id="saveStatus"><span class="dot"></span> 준비</div>
      <button type="button" class="pill-btn green" id="btnSave">저장</button>
      <button type="button" class="pill-btn blue" id="btnLock">작성완료</button>
      <button type="button" class="pill-btn ghost" id="btnNew">새 보고서</button>
      <button type="button" class="pill-btn ghost" id="btnPrint">인쇄(정본)</button>
    </div>
    <section class="dkj-panel">
      <h2>① 결재</h2>
      <div class="dkj-field-grid">
        <div class="dkj-field"><label for="writer">작성 *</label><input type="text" id="writer"></div>
        <div class="dkj-field"><label for="reviewer">검토</label><input type="text" id="reviewer"></div>
        <div class="dkj-field"><label for="approver">승인</label><input type="text" id="approver"></div>
      </div>
    </section>
    <section class="dkj-panel">
      <h2>② 보고 내용</h2>
      <div id="reportBlocks"></div>
    </section>
    <section class="dkj-panel">
      <h2>전자결재 · 감사이력</h2>
      <div id="approvalPanel"></div>
    </section>
    <section class="dkj-panel history"><h2>③ 최근 저장</h2><div id="historyList"></div></section>
  </main>
  </div>
  <div id="printSheet" class="print-sheet" aria-hidden="true"></div>{scripts(code, v, cfg["engine_js"])}
</body>
</html>
"""


RENDERERS = {"matrix": render_matrix, "ox": render_ox, "report": render_report}


def render_js(engine: str, code: str, spec: dict) -> str:
    cfg = ENGINES[engine]
    if engine == "ox":
        boot = collections.OrderedDict((k, spec[k]) for k in OX_BOOT_KEYS if k in spec)
    else:
        boot = collections.OrderedDict(
            (k, v) for k, v in spec.items() if k not in HTML_ONLY_KEYS
        )
    return BOOT_TEMPLATE.format(
        code=code, engine=engine, spec_dir=cfg["spec_dir"], mount=cfg["mount"],
        spec=json.dumps(boot, ensure_ascii=False, indent=2),
    )


def all_specs() -> list[tuple[str, str]]:
    out = []
    for engine, cfg in ENGINES.items():
        for path in sorted((ROOT / "data" / cfg["spec_dir"]).glob("*.json")):
            out.append((engine, path.stem))
    return out


def build(engine: str, code: str, v: str, check: bool) -> list[str]:
    cfg = ENGINES[engine]
    spec = json.loads(
        (ROOT / "data" / cfg["spec_dir"] / f"{code}.json").read_text(encoding="utf-8")
    )
    outputs = {REC_DIR / f"{code}.html": RENDERERS[engine](code, spec, v)}
    if code not in JS_SKIP:
        outputs[JS_DIR / f"{code}.js"] = render_js(engine, code, spec)
    changed = []
    for path, text in outputs.items():
        if path.exists() and path.read_text(encoding="utf-8") == text:
            continue
        changed.append(str(path.relative_to(ROOT)))
        if not check:
            path.write_text(text, encoding="utf-8")
    return changed


def main() -> int:
    check = "--check" in sys.argv[1:]
    wanted = [a for a in sys.argv[1:] if a != "--check"]
    targets = [(e, c) for e, c in all_specs() if not wanted or c in wanted]
    if wanted and not targets:
        print("해당 코드의 사양을 찾지 못했습니다:", ", ".join(wanted))
        return 1
    v = cache_version()
    changed: list[str] = []
    for engine, code in targets:
        changed += build(engine, code, v, check)
    if check:
        if changed:
            print("사양과 다른 파일:")
            for c in changed:
                print("  ", c)
            return 1
        print(f"일치 — 서식 {len(targets)}종 (캐시버전 v={v})")
        return 0
    print(f"생성 완료 — 서식 {len(targets)}종 (캐시버전 v={v})")
    for c in changed:
        print("   갱신", c)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
