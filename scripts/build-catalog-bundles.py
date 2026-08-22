# -*- coding: utf-8 -*-
"""JSON catalogs → file:// 용 JS 번들 생성"""
from __future__ import annotations

import json
from pathlib import Path

DKJ = Path(__file__).resolve().parents[1]
DATA = DKJ / "data"
JS = DKJ / "js"

BUNDLES = [
    ("doc-catalog.json", "doc-catalog.bundle.js", "DKJ_DOC_CATALOG"),
    ("menu-catalog.json", "menu-catalog.bundle.js", "DKJ_MENU_CATALOG"),
    ("record-catalog.json", "record-catalog.bundle.js", "DKJ_RECORD_CATALOG"),
    # 콘솔 홈과 서식 공통 네비가 함께 읽는다 — 이게 없으면 file:// 에서 콘솔이 빈 화면이 된다
    ("console-forms.json", "console-forms.bundle.js", "DKJ_CONSOLE_FORMS"),
    # 마스터 데이터 (js/dkj-master-data.js)
    ("products.json", "products.bundle.js", "DKJ_PRODUCTS"),
    ("process-line.json", "process-line.bundle.js", "DKJ_PROCESS_LINE"),
    # 직원별 결재 권한 — js/dkj-auth.js 가 읽는다
    ("staff-roles.json", "staff-roles.bundle.js", "DKJ_STAFF_ROLES"),
    # MDR 카탈로그
    ("mdr-catalog.json", "mdr-catalog.bundle.js", "DKJ_MDR_CATALOG"),
    # Google Drive 정본 문서 매니페스트
    ("drive-document-manifest.json", "drive-document-manifest.bundle.js", "DKJ_DRIVE_DOCUMENTS"),
]


def main():
    for src_name, out_name, global_name in BUNDLES:
        src = DATA / src_name
        if not src.is_file():
            print("SKIP missing", src)
            continue
        raw = src.read_text(encoding="utf-8").strip()
        # validate
        json.loads(raw)
        out = JS / out_name
        out.write_text(
            f"window.{global_name}={raw};\n",
            encoding="utf-8",
        )
        print("OK", out_name, "->", global_name)


if __name__ == "__main__":
    main()
