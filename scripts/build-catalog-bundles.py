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
