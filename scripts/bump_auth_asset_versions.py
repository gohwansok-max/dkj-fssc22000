#!/usr/bin/env python3
"""공용 로그인 자원 URL의 캐시 버전만 갱신하며 기존 줄바꿈은 보존한다."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
VERSION = b'54'
changed = 0
for path in ROOT.rglob('*.html'):
    raw = path.read_bytes()
    updated = re.sub(rb'\?v=\d+', b'?v=' + VERSION, raw)
    if updated != raw:
        path.write_bytes(updated)
        changed += 1
print(f'공용 로그인 자산 버전 {VERSION.decode()}: {changed}개 HTML 갱신')
