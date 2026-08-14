#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Batch-upgrade remaining 12 forms to official HWP print layouts."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPEC = ROOT / "data" / "ox-form-specs"
PRINT = ROOT / "data" / "print-templates"
JS = ROOT / "js"
REC = ROOT / "records"

AREA_LABELS = {
    "전처리": "전처리실",
    "소독헹굼": "소독·헹굼실",
    "포장": "포장실",
    "냉장": "냉장창고",
    "전체": "작업장 전체",
}

# code -> print overrides
OX_FORMS = {
    "DKJ-S-02-03": {
        "layout": "official-prp-ox",
        "columnMode": "ampm",
        "subtitle": "선행요건 · 매일",
        "sectionTitle": "● 개인위생 점검 결과 ●",
        "showMeta": ["shift", "team", "headcount"],
        "metaFields": [
            {"key": "shift", "label": "근무조"},
            {"key": "team", "label": "작업팀"},
            {"key": "headcount", "label": "점검인원"},
        ],
    },
    "DKJ-S-02-04": {
        "layout": "official-prp-ox",
        "columnMode": "result",
        "subtitle": "선행요건 · 매일",
        "sectionTitle": "● 이물관리 점검 결과 ●",
        "showMeta": ["shift", "area"],
    },
    "DKJ-S-02-06": {
        "layout": "official-prp-ox",
        "columnMode": "result",
        "subtitle": "선행요건 · 매일",
        "sectionTitle": "● 환기·급배기 점검 결과 ●",
        "showMeta": ["shift", "area"],
    },
    "DKJ-S-02-07": {
        "layout": "official-prp-ox",
        "columnMode": "result",
        "subtitle": "선행요건 · 매일",
        "sectionTitle": "● 방충방서 점검 결과 ●",
        "showMeta": ["shift", "area", "pestVendor"],
        "metaFields": [
            {"key": "shift", "label": "근무조"},
            {"key": "area", "label": "점검구역"},
            {"key": "pestVendor", "label": "방제업체"},
        ],
    },
    "DKJ-S-02-12": {
        "layout": "official-prp-ox",
        "columnMode": "result",
        "subtitle": "선행요건 · 매일",
        "sectionTitle": "● 제조시설·설비 점검 결과 ●",
        "showMeta": ["shift", "area"],
    },
    "DKJ-S-02-13": {
        "layout": "official-prp-ox",
        "columnMode": "result",
        "subtitle": "선행요건 · 주기점검",
        "sectionTitle": "● 저수조·물탱크 위생점검 결과 ●",
        "showMeta": ["shift", "area"],
    },
    "DKJ-S-02-18": {
        "layout": "official-prp-ox",
        "columnMode": "result",
        "subtitle": "선행요건 · 출하/회차",
        "sectionTitle": "● 운송차량 위생점검 결과 ●",
        "showMeta": ["vehicleNo", "driver", "destination", "shift"],
        "metaFields": [
            {"key": "vehicleNo", "label": "차량번호"},
            {"key": "driver", "label": "운전자"},
            {"key": "destination", "label": "행선/용도"},
            {"key": "shift", "label": "시점"},
        ],
    },
    "DKJ-S-02-29": {
        "layout": "official-prp-ox",
        "columnMode": "ampm",
        "subtitle": "선행요건 · 매일",
        "sectionTitle": "● 종사자 건강상태 확인 결과 ●",
        "showMeta": ["shift", "team"],
        "metaFields": [
            {"key": "shift", "label": "근무조"},
            {"key": "team", "label": "작업팀"},
        ],
    },
    "DKJ-STORE-01": {
        "layout": "official-prp-ox",
        "columnMode": "result",
        "subtitle": "입고 적합 후 · FIFO",
        "sectionTitle": "● 원료보관·선입선출 점검 결과 ●",
        "dateKey": "storeDate",
        "dateLabel": "보관일자",
        "showMeta": ["itemName", "lot", "supplier", "location", "qty", "storeTemp", "expiry"],
        "metaFields": [
            {"key": "itemName", "label": "품명"},
            {"key": "lot", "label": "LOT"},
            {"key": "supplier", "label": "공급처"},
            {"key": "location", "label": "보관장소"},
            {"key": "qty", "label": "수량"},
            {"key": "storeTemp", "label": "보관온도"},
            {"key": "expiry", "label": "유통기한"},
        ],
    },
}

LUX_FORM = {
    "DKJ-S-02-02": {
        "layout": "official-prp-mon-lux",
        "monMode": "lux",
        "subtitle": "선행요건 · 월간",
        "stdNote": "※ 관리기준 — 일반작업 ≥200 lx · 검사·정밀작업 ≥500 lx (현장 확정 CL 적용)",
        "note": "※ 관리기준 이탈 시 즉시조치란에 기재한다.",
    }
}


def upgrade_print_block(old: dict, overrides: dict, title: str, code: str) -> dict:
    out = dict(old) if old else {}
    out.update(overrides)
    out["orgName"] = "동김제농협 산지유통센터"
    out["docNo"] = code
    out["title"] = title
    out["rev"] = out.get("rev") or "0"
    out["enactDate"] = "2024. 02. 13"
    out["reviseDate"] = "-"
    if out.get("layout") == "official-prp-ox" and "areaLabels" not in out:
        # keep area labels for forms that use area
        if "area" in (out.get("showMeta") or []) or any(
            m.get("key") == "area" for m in (out.get("metaFields") or [])
        ):
            out["areaLabels"] = AREA_LABELS
    if "note" not in out and out.get("layout") == "official-prp-ox":
        out["note"] = (
            "※ 평가 — 양호: ○ , 부적합(시정조치 필요): × , 해당없음: —"
            "    ※ 주기 — D:매일 W:주간 M:월간"
        )
    return out


def patch_spec(code: str, overrides: dict) -> None:
    path = SPEC / f"{code}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data["print"] = upgrade_print_block(data.get("print") or {}, overrides, data["title"], code)
    # Ensure rows from items if missing
    if data["print"].get("layout") == "official-prp-ox" and not data["print"].get("rows"):
        data["print"]["rows"] = [
            {
                "key": it["key"],
                "group": it.get("group", ""),
                "label": it["label"],
                "hint": it.get("hint", ""),
                "freq": "D",
                "ampm": data["print"].get("columnMode") == "ampm",
            }
            for it in data.get("items") or []
        ]
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # mirror print-template
    PRINT.mkdir(parents=True, exist_ok=True)
    (PRINT / f"{code}.json").write_text(
        json.dumps(data["print"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("spec", code)


def patch_js_boot(code: str) -> None:
    """Replace print block inside generated boot JS with spec print."""
    spec_path = SPEC / f"{code}.json"
    js_path = JS / f"{code}.js"
    if not js_path.exists():
        print("skip js", code)
        return
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    text = js_path.read_text(encoding="utf-8")
    # Replace "print": { ... } at top level of mount object — match balanced braces carefully
    m = re.search(r'"print"\s*:\s*\{', text)
    if not m:
        print("no print in js", code)
        return
    start = m.start()
    brace_start = text.index("{", m.end() - 1)
    depth = 0
    end = None
    for i, ch in enumerate(text[brace_start:], brace_start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end is None:
        print("brace fail", code)
        return
    new_print = '"print": ' + json.dumps(spec["print"], ensure_ascii=False, indent=2)
    # indent to 2 spaces to match style roughly
    new_print = new_print.replace("\n", "\n  ")
    text = text[:start] + new_print + text[end:]
    js_path.write_text(text, encoding="utf-8")
    print("js", code)


def inject_official_script(code: str) -> None:
    path = REC / f"{code}.html"
    if not path.exists():
        print("skip html", code)
        return
    html = path.read_text(encoding="utf-8")
    if "dkj-print-official.js" in html:
        print("html already", code)
        return
    html = html.replace(
        '<script src="../js/dkj-print-form.js"></script>',
        '<script src="../js/dkj-print-official.js"></script>\n'
        '  <script src="../js/dkj-print-form.js"></script>',
    )
    path.write_text(html, encoding="utf-8")
    print("html", code)


def patch_fr014() -> None:
    rows = [
        {"key": "c01", "label": "승인공급업체", "hint": "승인 목록 등록 업체인가?"},
        {"key": "c02", "label": "납품서·거래명세", "hint": "납품서/명세서 수령"},
        {"key": "c03", "label": "표시사항", "hint": "품명·LOT·원산지"},
        {"key": "c04", "label": "유통기한/제조일", "hint": "표시 일자 확인"},
        {"key": "c05", "label": "운송차량 위생", "hint": "차량 청결·오염 없음"},
        {"key": "c06", "label": "입고 온도", "hint": "기준 온도 이내"},
        {"key": "c07", "label": "외관·이물", "hint": "부패·흙·이물 없음"},
        {"key": "c08", "label": "냄새·변색", "hint": "이상 냄새·변색 없음"},
        {"key": "c09", "label": "시험성적서", "hint": "유/무/해당없음"},
        {"key": "c10", "label": "수량 일치", "hint": "발주·납품 수량 일치"},
    ]
    tmpl = {
        "layout": "official-fr014",
        "orgName": "동김제농협 산지유통센터",
        "docNo": "FR-014",
        "title": "원부자재 입고검사 기록",
        "rev": "0",
        "enactDate": "2024. 02. 13",
        "reviseDate": "-",
        "rows": rows,
    }
    (PRINT / "FR-014.json").write_text(
        json.dumps(tmpl, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    js = JS / "FR-014.js"
    text = js.read_text(encoding="utf-8")
    new_fn = """
  function dkjDoPrint() {
    var st = (typeof collect === 'function') ? collect() : (typeof state !== 'undefined' ? state : {});
    if (window.DkjPrint) {
      DkjPrint.print({
        layout: 'official-fr014',
        orgName: '동김제농협 산지유통센터',
        docNo: 'FR-014',
        title: '원부자재 입고검사 기록',
        rev: '0',
        enactDate: '2024. 02. 13',
        reviseDate: '-',
        rows: (typeof CHECK_ITEMS !== 'undefined' ? CHECK_ITEMS : []).map(function (it) {
          return { key: it.key, group: it.group || '', label: it.label, freq: 'D', hint: it.hint || '' };
        })
      }, st);
    } else {
      window.print();
    }
  }
"""
    text = re.sub(
        r"\n  function dkjDoPrint\(\) \{.*?\n  \}\n",
        new_fn,
        text,
        count=1,
        flags=re.S,
    )
    js.write_text(text, encoding="utf-8")
    inject_official_script("FR-014")
    print("fr014 done")


def patch_fr015() -> None:
    tmpl = {
        "layout": "official-fr015",
        "orgName": "동김제농협 산지유통센터",
        "docNo": "FR-015",
        "title": "부적합 원부자재 처리기록",
        "rev": "0",
        "enactDate": "2024. 02. 13",
        "reviseDate": "-",
    }
    (PRINT / "FR-015.json").write_text(
        json.dumps(tmpl, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    js = JS / "FR-015.js"
    text = js.read_text(encoding="utf-8")
    new_fn = """
  function dkjDoPrint() {
    var st = (typeof collect === 'function') ? collect() : (typeof state !== 'undefined' ? state : {});
    if (window.DkjPrint) {
      DkjPrint.print({
        layout: 'official-fr015',
        orgName: '동김제농협 산지유통센터',
        docNo: 'FR-015',
        title: '부적합 원부자재 처리기록',
        rev: '0',
        enactDate: '2024. 02. 13',
        reviseDate: '-'
      }, st);
    } else {
      window.print();
    }
  }
"""
    text = re.sub(
        r"\n  function dkjDoPrint\(\) \{.*?\n  \}\n",
        new_fn,
        text,
        count=1,
        flags=re.S,
    )
    js.write_text(text, encoding="utf-8")
    inject_official_script("FR-015")
    print("fr015 done")


def main() -> None:
    for code, ov in OX_FORMS.items():
        patch_spec(code, ov)
        patch_js_boot(code)
        inject_official_script(code)
    for code, ov in LUX_FORM.items():
        patch_spec(code, ov)
        patch_js_boot(code)
        inject_official_script(code)
    patch_fr014()
    patch_fr015()
    print("ALL DONE")


if __name__ == "__main__":
    main()
