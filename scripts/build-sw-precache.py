#!/usr/bin/env python3
"""서비스워커 프리캐시 목록(sw-precache.js)을 생성한다.

작업장 와이파이가 끊겨도 서식 74종이 다 열려야 하므로 앱 셸을 통째로 담는다.
목록에서 빠지는 것은 용량이 크고 현장에서 급하지 않은 것들뿐이다.

  담는다   : HTML 전부(루트 + records/), css, js(내보내기용 exceljs 포함),
             data/*.json, config.json, manifest.json, 아이콘
  안 담는다: assets/docs/(문서 원본 PDF·DOCX — 열람할 때 런타임 캐시에 들어간다),
             scripts/, *.md, *.py — 애초에 배포에도 안 올라간다

버전 문자열은 담은 파일 내용의 해시다. 파일이 하나라도 바뀌면 값이 달라지고,
서비스워커는 그때 캐시를 새로 만든다. 배포 전에 이 스크립트를 돌려야
바뀐 파일이 태블릿에 반영된다.
"""
import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'sw-precache.js'

# (디렉터리, 확장자) — 디렉터리가 '' 면 저장소 루트만(하위 폴더 제외)
INCLUDE = [
    ('', ('.html',)),
    ('records', ('.html',)),
    ('css', ('.css',)),
    ('js', ('.js',)),
    ('data', ('.json',)),
    ('assets/brand', ('.svg',)),
]
# 루트에서 개별로 담는 것
INCLUDE_FILES = ['config.json', 'manifest.json']
# 서비스워커 자신과 목록 파일은 캐시하지 않는다 — 갱신을 막는다
EXCLUDE_NAMES = {'sw.js', 'sw-precache.js'}


def collect():
    seen, out = set(), []

    def add(rel):
        if rel in seen:
            return
        seen.add(rel)
        out.append(rel)

    for sub, exts in INCLUDE:
        base = ROOT / sub if sub else ROOT
        if not base.is_dir():
            continue
        it = base.rglob('*') if sub else base.glob('*')
        for p in sorted(it):
            if not p.is_file() or p.suffix not in exts or p.name in EXCLUDE_NAMES:
                continue
            add(p.relative_to(ROOT).as_posix())

    for name in INCLUDE_FILES:
        if (ROOT / name).is_file():
            add(name)

    return sorted(out)


def main():
    files = collect()
    h = hashlib.sha1()
    total = 0
    for rel in files:
        data = (ROOT / rel).read_bytes()
        total += len(data)
        # 담는 것이 전부 텍스트 파일이라 CRLF/LF 차이는 무시한다.
        # 안 그러면 윈도우에서 돌릴 때와 CI 에서 돌릴 때 버전이 달라진다.
        h.update(rel.encode('utf-8'))
        h.update(hashlib.sha1(data.replace(b'\r\n', b'\n')).digest())
    version = 'v1-' + h.hexdigest()[:12]

    lines = [
        '/* 자동 생성 — scripts/build-sw-precache.py. 직접 고치지 마세요. */',
        "self.DKJ_SW_VERSION = '%s';" % version,
        'self.DKJ_PRECACHE = [',
    ]
    lines += ["  './%s'," % rel for rel in files]
    lines += ['];', '']
    OUT.write_text('\n'.join(lines), encoding='utf-8')

    # 윈도우 콘솔(cp949)에서도 깨지지 않게 ASCII 로만 찍는다
    print('%s: %d files / %.1f MB / %s' % (OUT.name, len(files), total / 1048576, version))
    return 0


if __name__ == '__main__':
    sys.exit(main())
