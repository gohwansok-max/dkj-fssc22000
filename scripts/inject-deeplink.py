#!/usr/bin/env python3
"""기록 서식 페이지에 dkj-deeplink.js 를 주입한다.

dkj-record-store.js 바로 뒤에 넣는다 — 딥링크는 저장소에서 기록을 꺼내 쓰므로
저장소보다 먼저 올라오면 안 된다. 이미 주입된 페이지는 건드리지 않는다.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LINE = '<script src="../js/dkj-deeplink.js?v=64"></script>'
ANCHOR = re.compile(r'^([ \t]*)<script src="\.\./js/dkj-record-store\.js[^"]*"></script>\n', re.M)


def main():
    done, skipped, failed = [], [], []
    for path in sorted((ROOT / 'records').glob('*.html')):
        text = path.read_text(encoding='utf-8')
        if 'dkj-deeplink.js' in text:
            skipped.append(path.name)
            continue
        m = ANCHOR.search(text)
        if not m:
            failed.append(path.name)
            continue
        insert = m.end()
        text = text[:insert] + m.group(1) + LINE + '\n' + text[insert:]
        path.write_text(text, encoding='utf-8')
        done.append(path.name)

    print('injected=%d skipped=%d failed=%d' % (len(done), len(skipped), len(failed)))
    if failed:
        print('  failed:', ', '.join(failed))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
