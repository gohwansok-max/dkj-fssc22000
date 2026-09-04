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
    # 생산일지(DKJ-F-053) 기준설정 — js/dkj-master-data.js 가 읽는다
    ("production-master.json", "production-master.bundle.js", "DKJ_PRODUCTION_MASTER"),
    # 직원별 결재 권한 — js/dkj-auth.js 가 읽는다
    ("staff-roles.json", "staff-roles.bundle.js", "DKJ_STAFF_ROLES"),
    # MDR 카탈로그
    ("mdr-catalog.json", "mdr-catalog.bundle.js", "DKJ_MDR_CATALOG"),
    # Google Drive 정본 문서 매니페스트
    ("drive-document-manifest.json", "drive-document-manifest.bundle.js", "DKJ_DRIVE_DOCUMENTS"),
    # PDF 및 문서 자산 매니페스트
    ("pdf-manifest.json", "pdf-manifest.bundle.js", "DKJ_PDF_MANIFEST"),
    ("doc-assets.json", "doc-assets.bundle.js", "DKJ_DOC_ASSETS"),
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
        # 기존 번들 파일이 CRLF로 커밋돼 있으면 그대로 유지한다 — 안 그러면
        # Path.write_text() 가 기본으로 LF만 쓰기 때문에, 내용은 안 바뀌어도
        # 매번 다시 빌드할 때마다 파일 전체가 diff에 걸려 나온다(실제로
        # menu-catalog.bundle.js/record-catalog.bundle.js에서 발생했다).
        newline = "\r\n" if out.is_file() and b"\r\n" in out.read_bytes() else "\n"
        with out.open("w", encoding="utf-8", newline=newline) as f:
            f.write(f"window.{global_name}={raw};\n")
        print("OK", out_name, "->", global_name)


if __name__ == "__main__":
    main()
