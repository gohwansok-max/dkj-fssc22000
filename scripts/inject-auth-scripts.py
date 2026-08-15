#!/usr/bin/env python3
"""로그인·클라우드 동기화 스크립트를 모든 페이지에 주입한다.

주입 위치는 각 페이지의 **첫 번째 로컬 js 스크립트 태그 바로 앞** — dkj-auth.js 가
DkjCloudSync 와 DkjRecordStore 보다 먼저 올라와야 작성자 정보가 붙는다.
이미 주입된 페이지는 건드리지 않으므로 몇 번을 돌려도 안전하다.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VER = '?v=34'
FILES = ['dkj-firebase-config.js', 'dkj-auth.js', 'dkj-cloud-sync.js']

# 첫 번째 로컬 js 스크립트 (앞의 들여쓰기까지 함께 잡는다)
FIRST_SCRIPT = re.compile(r'^([ \t]*)<script src="((?:\.\./)?js/[^"]+)"', re.M)


def targets():
    yield from sorted((ROOT / 'records').glob('*.html'))
    for name in ('index.html', 'doc-viewer.html', 'docs-center.html',
                 'mdr-register.html', 'record-viewer.html', 'records-center.html'):
        p = ROOT / name
        if p.exists():
            yield p


def main():
    done, skipped, failed = [], [], []
    for path in targets():
        text = path.read_text(encoding='utf-8')
        if 'dkj-auth.js' in text:
            skipped.append(path.name)
            continue
        m = FIRST_SCRIPT.search(text)
        if not m:
            failed.append(path.name)
            continue
        indent, src = m.group(1), m.group(2)
        prefix = '../js/' if src.startswith('../') else 'js/'
        block = ''.join(
            '%s<script src="%s%s%s"></script>\n' % (indent, prefix, f, VER)
            for f in FILES
        )
        path.write_text(text[:m.start()] + block + text[m.start():], encoding='utf-8')
        done.append(path.name)

    print('주입 %d건 / 이미 적용 %d건 / 실패 %d건' % (len(done), len(skipped), len(failed)))
    if skipped:
        print('  이미 적용:', ', '.join(skipped))
    if failed:
        print('  실패(스크립트 태그 못 찾음):', ', '.join(failed))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
