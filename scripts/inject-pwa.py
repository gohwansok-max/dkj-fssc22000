#!/usr/bin/env python3
"""모든 페이지에 PWA 연결을 주입한다 — manifest 링크 + js/dkj-pwa.js.

  manifest 링크  : </head> 바로 앞 (theme-color 는 이미 전 페이지에 있다)
  dkj-pwa.js     : 마지막 </body> 앞. 서비스워커 등록은 다른 스크립트와 순서를
                   다툴 일이 없고, 화면 그리기를 늦추지 않는 게 낫다.

records/ 아래 페이지는 '../' 를 붙인다. 이미 주입된 페이지는 건드리지 않으므로
몇 번을 돌려도 안전하다.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VER = '?v=25'
HEAD_ANCHOR = re.compile(r'^([ \t]*)</head>', re.M)
BODY_ANCHOR = re.compile(r'^([ \t]*)</body>', re.M)

# 오프라인 안내 페이지 자신은 대상이 아니다
SKIP = {'offline.html'}


def targets():
    for p in sorted(ROOT.glob('*.html')):
        if p.name not in SKIP:
            yield p
    yield from sorted((ROOT / 'records').glob('*.html'))


def main():
    injected, skipped, failed = [], [], []
    for path in targets():
        text = path.read_text(encoding='utf-8')
        orig = text
        prefix = '../' if path.parent.name == 'records' else ''
        problem = []

        if 'rel="manifest"' not in text:
            m = HEAD_ANCHOR.search(text)
            if m:
                line = '%s<link rel="manifest" href="%smanifest.json%s">\n' % (
                    m.group(1) + '  ', prefix, VER)
                text = text[:m.start()] + line + text[m.start():]
            else:
                problem.append('</head> 없음')

        if 'dkj-pwa.js' not in text:
            m = BODY_ANCHOR.search(text)
            if m:
                line = '%s<script src="%sjs/dkj-pwa.js%s"></script>\n' % (
                    m.group(1) + '  ', prefix, VER)
                text = text[:m.start()] + line + text[m.start():]
            else:
                problem.append('</body> 없음')

        if problem:
            failed.append('%s (%s)' % (path.name, ', '.join(problem)))
            continue
        if text == orig:
            skipped.append(path.name)
            continue
        path.write_text(text, encoding='utf-8')
        injected.append(path.name)

    print('injected=%d skipped=%d failed=%d' % (len(injected), len(skipped), len(failed)))
    if failed:
        print('  failed:', ', '.join(failed))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
