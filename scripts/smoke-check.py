#!/usr/bin/env python3
"""동김제농협 정적 웹앱의 가벼운 배포 전 점검.

프레임워크·테스트 러너를 추가하지 않고, 서식·카탈로그·캐시 버전·정적 자원 연결의
기본 결함을 찾는다. 실제 Firebase 로그인·동기화·인쇄는 현장 브라우저 점검 대상이다.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RECORDS = ROOT / "records"
DATA = ROOT / "data"

errors: list[str] = []
warnings: list[str] = []


def load_json(path: Path):
    try:
        # 기존 카탈로그 일부는 UTF-8 BOM으로 저장돼 있어 utf-8-sig로 읽는다.
        with path.open("r", encoding="utf-8-sig") as handle:
            return json.load(handle)
    except Exception as exc:  # noqa: BLE001 - 실패한 파일을 모두 보고한다.
        errors.append(f"JSON 읽기 실패: {path.relative_to(ROOT)} ({exc})")
        return None


def check_json_files() -> None:
    for path in sorted(DATA.rglob("*.json")):
        load_json(path)
    for path in [ROOT / "database.rules.json", ROOT / "manifest.json"]:
        load_json(path)


def check_catalog_links() -> None:
    catalog = load_json(DATA / "record-catalog.json")
    if not isinstance(catalog, dict):
        return
    records = catalog.get("records", catalog.get("forms", []))
    if not isinstance(records, list):
        errors.append("data/record-catalog.json의 records/forms 배열을 찾지 못했습니다.")
        return
    codes = set()
    for row in records:
        if not isinstance(row, dict):
            errors.append("record-catalog에 객체가 아닌 항목이 있습니다.")
            continue
        code = str(row.get("code") or "").strip()
        if not code:
            errors.append("record-catalog에 코드 없는 항목이 있습니다.")
            continue
        if code in codes:
            errors.append(f"record-catalog에 중복 코드가 있습니다: {code}")
        codes.add(code)
        html = RECORDS / f"{code}.html"
        if not html.exists():
            errors.append(f"카탈로그 서식의 HTML이 없습니다: records/{code}.html")


def extract_versions(text: str) -> set[str]:
    return set(re.findall(r"\?v=(\d+)", text))


def check_html_assets() -> None:
    html_files = [ROOT / "index.html", ROOT / "records-center.html", ROOT / "records-archive.html", ROOT / "docs-center.html"]
    html_files.extend(sorted(RECORDS.glob("*.html")))
    all_versions: set[str] = set()
    for path in html_files:
        if not path.exists():
            errors.append(f"필수 화면이 없습니다: {path.relative_to(ROOT)}")
            continue
        text = path.read_text(encoding="utf-8")
        all_versions.update(extract_versions(text))
        if path.parent == RECORDS:
            for script in ["dkj-firebase-config.js", "dkj-auth.js", "dkj-cloud-sync.js", "dkj-record-store.js", "dkj-approval.js"]:
                if script not in text:
                    errors.append(f"기록양식 공통 스크립트 누락: {path.relative_to(ROOT)} → {script}")
    if len(all_versions) != 1:
        errors.append("HTML 정적 자원 캐시 버전이 일치하지 않습니다: " + ", ".join(sorted(all_versions)))
    elif not all_versions:
        warnings.append("HTML에서 ?v= 캐시 버전을 찾지 못했습니다.")


def check_generated_bundles() -> None:
    pairs = {
        "console-forms.json": "console-forms.bundle.js",
        "record-catalog.json": "record-catalog.bundle.js",
        "doc-catalog.json": "doc-catalog.bundle.js",
        "menu-catalog.json": "menu-catalog.bundle.js",
        "mdr-catalog.json": "mdr-catalog.bundle.js",
        "staff-roles.json": "staff-roles.bundle.js",
    }
    for source, bundle in pairs.items():
        src = DATA / source
        out = ROOT / "js" / bundle
        if not out.exists():
            errors.append(f"생성 번들이 없습니다: js/{bundle}")
            continue
        if src.exists() and out.stat().st_mtime < src.stat().st_mtime:
            warnings.append(f"JSON보다 번들이 오래되었습니다. build-catalog-bundles.py 실행 필요: {bundle}")


def check_rules_structure() -> None:
    rules = load_json(ROOT / "database.rules.json")
    try:
        root = rules["rules"]["dkj-fssc22000"]
        if "records" not in root:
            errors.append("database.rules.json에 기존 V1 records 규칙이 없습니다.")
        if "records_v2" not in root:
            errors.append("database.rules.json에 V2 records_v2 규칙이 없습니다.")
        if "sync_meta" not in root:
            errors.append("database.rules.json에 sync_meta 규칙이 없습니다.")
    except (KeyError, TypeError):
        errors.append("database.rules.json의 사업장 루트 구조가 예상과 다릅니다.")


def main() -> int:
    check_json_files()
    check_catalog_links()
    check_html_assets()
    check_generated_bundles()
    check_rules_structure()

    for item in warnings:
        print("경고: " + item)
    for item in errors:
        print("오류: " + item)
    if errors:
        print(f"스모크 점검 실패: 오류 {len(errors)}건, 경고 {len(warnings)}건")
        return 1
    print(f"스모크 점검 통과: 오류 0건, 경고 {len(warnings)}건")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
