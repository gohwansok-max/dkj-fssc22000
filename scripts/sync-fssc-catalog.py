# -*- coding: utf-8 -*-
"""
동김제 FSSC22000 V6 최종본 → doc-catalog.json / menu-catalog.json 동기화

Usage (from tenants/dkj):
  python scripts/sync-fssc-catalog.py
"""
from __future__ import annotations

import json
import os
import re
from collections import defaultdict
from datetime import date
from pathlib import Path

DKJ_ROOT = Path(__file__).resolve().parents[1]
SOURCES = DKJ_ROOT / "data" / "asset-sources.json"
OUT_DOC = DKJ_ROOT / "data" / "doc-catalog.json"
OUT_MENU = DKJ_ROOT / "data" / "menu-catalog.json"
OLD_DOC = DKJ_ROOT / "data" / "doc-catalog.json"

SKIP_EXT = {".ini", ".tmp", ".ds_store"}
SKIP_NAME_PREFIX = ("~$",)

CATEGORY_RULES = [
    # (category_id, path_prefix_or_regex, code_regex)
    ("manual", r"^01_", re.compile(r"^(DKJ-M-\d+)", re.I)),
    ("procedure", r"^02_", re.compile(r"^(DKJ-P-\d+)", re.I)),
    ("prp", r"^03_", re.compile(r"^(PRP-\d+|PP-\d+)", re.I)),
    ("prp_form", r"DKJ-S-02", re.compile(r"^(DKJ-S-02-\d+)", re.I)),
    ("sop", r"^04_", re.compile(r"^(DKJ-W-\d+)", re.I)),
    ("haccp", r"^05_", re.compile(r"^(DKJ-H-\d+-\d+|HC-\d+|REF-\d+)", re.I)),
    ("form", r"^06_", re.compile(r"^(DKJ-F-\d+)", re.I)),
    ("education", r"^07_", re.compile(r"^(EDU-\d+(?:-\d+)?)", re.I)),
    ("audit", r"^08_", re.compile(r"^(DKJ-F-\d+|IA-)", re.I)),
    ("mgmt_review", r"^09_", re.compile(r"^(DKJ-F-\d+|FSC-\d+)", re.I)),
    ("mdr", r"^13_", re.compile(r"^(MDR-\d+|DOC-\d+|DT-\d+)", re.I)),
]

CATEGORY_META = [
    {
        "id": "manual",
        "label": "통합매뉴얼",
        "code": "DKJ-M",
        "icon": "📘",
        "description": "식품안전경영시스템 통합매뉴얼 (FSSC22000 V6)",
        "menuGroup": "문서체계",
    },
    {
        "id": "procedure",
        "label": "절차서",
        "code": "DKJ-P",
        "icon": "📗",
        "description": "FSSC22000 V6 운영 절차서 — SIPOC·실무TIP·심사확인",
        "menuGroup": "문서체계",
    },
    {
        "id": "prp",
        "label": "선행요건(PRP)",
        "code": "PRP",
        "icon": "🧪",
        "description": "PRP-001~008 관리기준 · PP 체계 인덱스",
        "menuGroup": "선행요건",
    },
    {
        "id": "prp_form",
        "label": "선행요건 일지",
        "code": "DKJ-S-02",
        "icon": "📒",
        "description": "작업장·위생·온습도·검교정 등 일상 PRP 점검 기록",
        "menuGroup": "선행요건",
    },
    {
        "id": "sop",
        "label": "SOP·작업표준",
        "code": "DKJ-W",
        "icon": "📙",
        "description": "현장 작업표준서 (입고~출하·부적합)",
        "menuGroup": "현장표준",
    },
    {
        "id": "haccp",
        "label": "HACCP·CCP",
        "code": "DKJ-H",
        "icon": "🛡️",
        "description": "CCP 점검·검증·교육·HACCP팀 양식",
        "menuGroup": "HACCP",
    },
    {
        "id": "form",
        "label": "기록양식(Form)",
        "code": "DKJ-F",
        "icon": "📋",
        "description": "시스템 기록양식 DKJ-F / FR 연동",
        "menuGroup": "기록",
    },
    {
        "id": "education",
        "label": "교육자료",
        "code": "EDU",
        "icon": "🎓",
        "description": "CCP·위생·내부심사·식품방어 교육 PPT",
        "menuGroup": "교육·심사",
    },
    {
        "id": "audit",
        "label": "내부심사",
        "code": "IA",
        "icon": "🔍",
        "description": "내부심사 계획·체크리스트·결과·CAR 패키지",
        "menuGroup": "교육·심사",
    },
    {
        "id": "mgmt_review",
        "label": "경영검토",
        "code": "MR",
        "icon": "📊",
        "description": "경영검토 입력자료·의사록·식품안전문화",
        "menuGroup": "교육·심사",
    },
    {
        "id": "mdr",
        "label": "MDR·문서관리",
        "code": "MDR",
        "icon": "📑",
        "description": "Master Document Register · 문서번호체계",
        "menuGroup": "문서체계",
    },
]

TITLE_MAP = {
    "DKJ-P-01": "문서관리 절차서",
    "DKJ-P-02": "기록관리 절차서",
    "DKJ-P-03": "교육훈련 절차서",
    "DKJ-P-04": "공급업체 및 구매관리 절차서",
    "DKJ-P-05": "원부자재 입고검사 절차서",
    "DKJ-P-06": "제품회수 절차서",
    "DKJ-P-07": "내부심사 절차서",
    "DKJ-P-08": "경영검토 절차서",
    "DKJ-P-09": "시정조치 절차서",
    "DKJ-P-10": "계측기 검교정 관리 절차서",
    "DKJ-P-11": "변경관리 절차서",
    "DKJ-P-12": "의사소통 절차서",
    "DKJ-P-13": "식품방어 절차서",
    "DKJ-P-14": "식품사기 예방 절차서",
    "DKJ-P-15": "알레르겐 관리 절차서",
    "DKJ-P-16": "환경모니터링 절차서",
    "DKJ-P-17": "부적합품 관리 절차서",
    "DKJ-P-18": "추적성 관리 절차서",
    "DKJ-P-19": "비상대응 절차서",
    "DKJ-P-20": "고객불만 관리 절차서",
    "DKJ-M-01": "식품안전경영시스템 통합매뉴얼",
    "PRP-001": "영업장관리 기준",
    "PRP-002": "위생관리 기준",
    "PRP-003": "제조시설·설비관리 기준",
    "PRP-004": "냉장·냉동시설·설비관리 기준",
    "PRP-005": "용수관리 기준",
    "PRP-006": "보관·운송관리 기준",
    "PRP-007": "검사관리 기준",
    "PRP-008": "회수프로그램관리 기준",
    "PP-00": "PRP 체계 인덱스",
    "HC-00": "HACCP 체계 인덱스",
    "MDR-001": "Master Document Register",
    "DOC-001": "문서번호 체계",
    "DT-001": "문서체계 템플릿",
}


def load_fssc_root() -> Path:
    data = json.loads(SOURCES.read_text(encoding="utf-8"))
    root = Path(data["fsscRoot"])
    if not root.is_dir():
        raise SystemExit(f"FSSC root not found: {root}")
    return root


def file_type(path: Path) -> str:
    ext = path.suffix.lower().lstrip(".")
    return ext or "file"


def parse_rev(name: str) -> str:
    m = re.search(r"(Rev\d+)", name, re.I)
    return m.group(1) if m else "Rev0"


def human_title(code: str, filename: str) -> str:
    if code in TITLE_MAP:
        return TITLE_MAP[code]
    # strip code + rev + org noise
    stem = Path(filename).stem
    stem = re.sub(rf"^{re.escape(code)}[_-]?", "", stem, flags=re.I)
    stem = re.sub(r"_?Rev\d+.*$", "", stem, flags=re.I)
    stem = re.sub(r"_?동김제.*$", "", stem)
    stem = re.sub(r"_?FSSC22000.*$", "", stem, flags=re.I)
    stem = stem.replace("_", " ").replace("-", " ").strip()
    return stem or code


def pick_category(rel: str, name: str) -> tuple[str, str] | None:
    """Return (category_id, code) or None."""
    rel_norm = rel.replace("\\", "/")
    for cat_id, prefix, code_re in CATEGORY_RULES:
        if prefix.startswith("^"):
            if not re.search(prefix, rel_norm):
                continue
        elif prefix not in rel_norm:
            continue
        m = code_re.search(name)
        if m:
            return cat_id, m.group(1).upper().replace("DKJ-M-", "DKJ-M-").replace("DKJ-P-", "DKJ-P-")
        # fallback: EDU folders without code in filename but folder has EDU
        if cat_id == "education":
            fm = re.search(r"(EDU-\d+(?:-\d+)?)", rel_norm, re.I)
            if fm:
                return cat_id, fm.group(1).upper()
        if cat_id == "audit" and "IA-" in name.upper():
            return cat_id, Path(name).stem[:40]
    return None


def normalize_code(code: str) -> str:
    code = code.upper()
    # keep DKJ-F-031 style
    m = re.match(r"(DKJ-[A-Z]+-\d+(?:-\d+)?|PRP-\d+|PP-\d+|HC-\d+|REF-\d+|MDR-\d+|DOC-\d+|DT-\d+|EDU-\d+(?:-\d+)?)", code, re.I)
    if m:
        return m.group(1).upper()
    return code


def load_old_highlights() -> dict:
    if not OLD_DOC.is_file():
        return {}
    try:
        old = json.loads(OLD_DOC.read_text(encoding="utf-8"))
    except Exception:
        return {}
    out = {}
    for d in old.get("documents", []):
        out[d.get("id")] = {
            "highlights": d.get("highlights"),
            "tags": d.get("tags"),
            "excerpt": d.get("excerpt"),
        }
    return out


def prefer_newer(existing: dict, candidate: dict) -> dict:
    """Keep higher Rev and later dated file."""
    def rev_num(r: str) -> int:
        m = re.search(r"(\d+)", r or "")
        return int(m.group(1)) if m else 0

    if rev_num(candidate.get("rev")) > rev_num(existing.get("rev")):
        return candidate
    if rev_num(candidate.get("rev")) < rev_num(existing.get("rev")):
        return existing
    # same rev → prefer longer/newer filename (often has 20260713)
    if candidate["sourcePath"] > existing["sourcePath"]:
        return candidate
    return existing


def scan(root: Path) -> list[dict]:
    old = load_old_highlights()
    by_id: dict[str, dict] = {}

    for dirpath, _, filenames in os.walk(root):
        rel_dir = os.path.relpath(dirpath, root)
        for name in filenames:
            if name.startswith(SKIP_NAME_PREFIX):
                continue
            path = Path(dirpath) / name
            if path.suffix.lower() in SKIP_EXT:
                continue
            if path.suffix.lower() not in {".docx", ".xlsx", ".xls", ".hwp", ".pptx", ".ppt", ".pdf"}:
                continue

            picked = pick_category(rel_dir, name)
            if not picked:
                continue
            cat_id, code = picked
            code = normalize_code(code)
            doc_id = code
            # disambiguate multiple EDU revisions — keep one per code
            rel_path = str(Path(rel_dir) / name)
            if rel_path.startswith("."):
                rel_path = name

            tags = []
            if cat_id == "procedure":
                tags = ["절차서", "FSSC V6"]
            elif cat_id == "prp":
                tags = ["PRP", "선행요건"]
            elif cat_id == "prp_form":
                tags = ["PRP일지", "일상점검"]
            elif cat_id == "haccp":
                tags = ["HACCP", "CCP"]
            elif cat_id == "sop":
                tags = ["SOP", "작업표준"]
            elif cat_id == "form":
                tags = ["Form", "기록"]
            elif cat_id == "education":
                tags = ["교육", "PPT"]
            elif cat_id == "audit":
                tags = ["내부심사"]
            elif cat_id == "mgmt_review":
                tags = ["경영검토"]
            elif cat_id == "mdr":
                tags = ["MDR", "문서관리"]

            prev = old.get(doc_id, {})
            doc = {
                "id": doc_id,
                "category": cat_id,
                "code": code,
                "title": human_title(code, name),
                "rev": parse_rev(name),
                "workflowStatus": "완료",
                "fileType": file_type(path),
                "mdrRev": "Rev11",
                "mdrStatus": "운영중",
                "sourcePath": rel_path.replace("/", "\\"),
                "tags": prev.get("tags") or tags,
                "highlights": prev.get("highlights")
                or ["최종본 260714 정본", "FSSC22000 V6"],
            }
            if prev.get("excerpt"):
                doc["excerpt"] = prev["excerpt"]

            if doc_id in by_id:
                by_id[doc_id] = prefer_newer(by_id[doc_id], doc)
            else:
                by_id[doc_id] = doc

    # stable sort
    docs = list(by_id.values())
    order = {c["id"]: i for i, c in enumerate(CATEGORY_META)}

    def sort_key(d):
        return (order.get(d["category"], 99), d["code"])

    docs.sort(key=sort_key)
    return docs


def build_menu(docs: list[dict]) -> dict:
    by_cat = defaultdict(list)
    for d in docs:
        by_cat[d["category"]].append(
            {
                "id": d["id"],
                "code": d["code"],
                "title": d["title"],
                "href": f"doc-viewer.html?id={d['id']}",
            }
        )

    gnb = [
        {
            "id": "docs",
            "label": "문서체계",
            "columns": [
                {
                    "title": "매뉴얼·절차서",
                    "links": [
                        {"label": "통합매뉴얼", "href": "docs-center.html?cat=manual"},
                        {"label": "절차서 전체", "href": "docs-center.html?cat=procedure"},
                        {"label": "MDR 등록대장", "href": "mdr-register.html"},
                        {"label": "문서번호체계", "href": "doc-viewer.html?id=DOC-001"},
                    ],
                },
                {
                    "title": "주요 절차서",
                    "links": [
                        {"label": d["code"] + " " + d["title"], "href": d["href"]}
                        for d in by_cat["procedure"][:10]
                    ],
                },
            ],
        },
        {
            "id": "prp",
            "label": "선행요건관리",
            "columns": [
                {
                    "title": "PRP 관리기준",
                    "links": [{"label": d["code"] + " " + d["title"], "href": d["href"]} for d in by_cat["prp"]],
                },
                {
                    "title": "일상 점검일지",
                    "links": [
                        {"label": "선행요건 일지 전체", "href": "docs-center.html?cat=prp_form"},
                        {"label": "기록양식 센터", "href": "records-center.html?cat=daily"},
                    ]
                    + [{"label": d["code"] + " " + d["title"], "href": d["href"]} for d in by_cat["prp_form"][:8]],
                },
            ],
        },
        {
            "id": "haccp",
            "label": "HACCP관리",
            "columns": [
                {
                    "title": "CCP·검증",
                    "links": [{"label": d["code"] + " " + d["title"], "href": d["href"]} for d in by_cat["haccp"][:12]],
                },
                {
                    "title": "SOP 작업표준",
                    "links": [
                        {"label": "SOP 전체", "href": "docs-center.html?cat=sop"},
                    ]
                    + [{"label": d["code"] + " " + d["title"], "href": d["href"]} for d in by_cat["sop"][:8]],
                },
            ],
        },
        {
            "id": "records",
            "label": "기록양식",
            "columns": [
                {
                    "title": "바로가기",
                    "links": [
                        {"label": "기록양식 전체", "href": "records-center.html"},
                        {"label": "FR-014 입고검사", "href": "records/FR-014.html"},
                        {"label": "FR-015 부적합처리", "href": "records/FR-015.html"},
                        {"label": "식품방어·사기", "href": "records-center.html?cat=defense"},
                        {"label": "알레르겐", "href": "records-center.html?cat=allergen"},
                        {"label": "환경모니터링", "href": "records-center.html?cat=env"},
                    ],
                },
                {
                    "title": "DKJ-F 정본",
                    "links": [{"label": d["code"] + " " + d["title"], "href": d["href"]} for d in by_cat["form"][:12]],
                },
            ],
        },
        {
            "id": "audit_edu",
            "label": "교육·심사",
            "columns": [
                {
                    "title": "교육자료",
                    "links": [
                        {"label": "교육자료 전체", "href": "docs-center.html?cat=education"},
                    ]
                    + [{"label": d["code"] + " " + d["title"], "href": d["href"]} for d in by_cat["education"][:8]],
                },
                {
                    "title": "내부심사·경영검토",
                    "links": [
                        {"label": "내부심사 패키지", "href": "docs-center.html?cat=audit"},
                        {"label": "경영검토", "href": "docs-center.html?cat=mgmt_review"},
                        {"label": "기록양식-내부심사", "href": "records-center.html?cat=audit"},
                        {"label": "기록양식-경영검토", "href": "records-center.html?cat=mgmt"},
                    ],
                },
            ],
        },
    ]

    return {
        "updatedAt": date.today().isoformat(),
        "site": "동김제농협 가공센터",
        "certification": "FSSC22000 V6",
        "source": "최종본260714",
        "gnb": gnb,
        "quickLinks": [
            {"label": "문서센터", "href": "docs-center.html"},
            {"label": "MDR Rev11", "href": "mdr-register.html"},
            {"label": "FR-014 입고", "href": "records/FR-014.html"},
            {"label": "CCP·HACCP", "href": "docs-center.html?cat=haccp"},
            {"label": "PRP", "href": "docs-center.html?cat=prp"},
            {"label": "SOP", "href": "docs-center.html?cat=sop"},
            {"label": "교육", "href": "docs-center.html?cat=education"},
            {"label": "내부심사", "href": "docs-center.html?cat=audit"},
        ],
    }


def main():
    root = load_fssc_root()
    docs = scan(root)
    cats = []
    counts = defaultdict(int)
    for d in docs:
        counts[d["category"]] += 1

    for meta in CATEGORY_META:
        m = dict(meta)
        m["workflowStatus"] = "완료"
        m["count"] = counts.get(meta["id"], 0)
        cats.append(m)

    catalog = {
        "updatedAt": date.today().isoformat(),
        "site": "동김제농협 가공센터",
        "certification": "FSSC22000 V6",
        "sourceLabel": "최종본260714",
        "fsscRootNote": str(root),
        "categories": cats,
        "documents": docs,
    }

    menu = build_menu(docs)

    OUT_DOC.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_MENU.write_text(json.dumps(menu, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"OK docs={len(docs)} categories={len(cats)}")
    for meta in CATEGORY_META:
        print(f"  {meta['id']}: {counts.get(meta['id'], 0)}")
    print(f"Wrote {OUT_DOC}")
    print(f"Wrote {OUT_MENU}")

    # In-process MDR merge (avoid GDrive stale read by separate Node process)
    merge_mdr_inplace(catalog)

    # file:// 용 JS 번들
    try:
        from build_catalog_bundles import main as build_bundles  # type: ignore
    except Exception:
        build_bundles = None
    bundle_script = Path(__file__).with_name("build-catalog-bundles.py")
    if bundle_script.is_file():
        import runpy
        runpy.run_path(str(bundle_script), run_name="__main__")



def merge_mdr_inplace(catalog: dict) -> None:
    mdr_path = DKJ_ROOT / "data" / "mdr-catalog.json"
    if not mdr_path.is_file():
        print("MDR catalog missing — skip merge")
        return
    try:
        mdr = json.loads(mdr_path.read_text(encoding="utf-8"))
    except Exception as exc:
        print("MDR read fail:", exc)
        return

    aliases = {
        "procedure": "procedure",
        "manual": "manual",
        "mdr": "mdr",
        "sop": "sop",
        "processmap": "processmap",
        "record": "form",
    }
    by_id = {d["id"]: d for d in catalog["documents"]}
    updated = added = 0
    for e in mdr.get("entries", []):
        cat = aliases.get(e.get("category"), e.get("category"))
        if cat not in {"procedure", "mdr", "sop", "processmap", "manual", "form"}:
            continue
        code = e.get("code") or e.get("id")
        if not code:
            continue
        title = e.get("title") or code
        existing = by_id.get(code) or by_id.get(e.get("id"))
        if existing:
            existing["rev"] = e.get("rev") or existing.get("rev")
            existing["mdrRev"] = mdr.get("mdrRev")
            existing["mdrStatus"] = e.get("status") or existing.get("mdrStatus")
            if e.get("filePath"):
                existing["sourcePath"] = e["filePath"]
            existing["workflowStatus"] = "완료"
            updated += 1
        else:
            entry = {
                "id": code,
                "category": cat,
                "code": code,
                "title": title,
                "rev": e.get("rev", "Rev0"),
                "workflowStatus": "완료",
                "fileType": Path(e.get("filePath") or "x.docx").suffix.lstrip(".") or "file",
                "mdrRev": mdr.get("mdrRev"),
                "mdrStatus": e.get("status"),
                "sourcePath": e.get("filePath"),
                "tags": [e.get("docType") or cat],
                "highlights": [e.get("status") or "운영중", f"{mdr.get('mdrRev')} 정본"],
            }
            catalog["documents"].append(entry)
            by_id[code] = entry
            added += 1

    counts = defaultdict(int)
    for d in catalog["documents"]:
        counts[d["category"]] += 1
    for cat in catalog["categories"]:
        if cat["id"] in counts:
            cat["count"] = counts[cat["id"]]
        if cat["id"] == "mdr":
            cat["description"] = f"MDR-001 {mdr.get('mdrRev')} 정본 · {mdr.get('entryCount')}건 등록"
        if cat["id"] == "sop":
            cat["workflowStatus"] = "완료"

    catalog["mdrSource"] = {
        "file": os.path.basename(mdr.get("source") or ""),
        "rev": mdr.get("mdrRev"),
        "entryCount": mdr.get("entryCount"),
        "syncedAt": date.today().isoformat(),
    }
    OUT_DOC.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"MDR merge updated={updated} added={added} total={len(catalog['documents'])}")


if __name__ == "__main__":
    main()
