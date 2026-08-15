#!/usr/bin/env python3
"""기록 서식 페이지에 전자결재 패널(#approvalPanel)과 dkj-approval.js 를 주입한다.

FR 45종은 결재란이 없어 서식마다 결재 유무가 달랐다. 두 가지를 넣는다.

  1) '최근 저장' 패널 바로 앞에 <section> — 결재 단계·감사이력이 렌더될 자리
  2) dkj-record-store.js 뒤에 <script> — 저장 훅을 걸어야 하므로 저장소보다 뒤

이미 들어 있는 페이지는 건드리지 않는다(멱등). 서식 74종 전체를 대상으로 돌려도
기존 29종은 그대로 skip 된다.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SCRIPT_LINE = '<script src="../js/dkj-approval.js?v=36"></script>'
SCRIPT_ANCHOR = re.compile(
    r'^([ \t]*)<script src="\.\./js/dkj-record-store\.js[^"]*"></script>\n', re.M)

PANEL_HTML = (
    '<section class="dkj-panel">\n'
    '      <h2>전자결재 · 감사이력</h2>\n'
    '      <div id="approvalPanel"></div>\n'
    '    </section>\n'
)
# '④ 최근 저장' 패널 — 결재는 그 앞에 온다
PANEL_ANCHOR = re.compile(r'^([ \t]*)<section class="dkj-panel history">', re.M)


def main():
    injected, skipped, failed = [], [], []
    for path in sorted((ROOT / 'records').glob('*.html')):
        text = path.read_text(encoding='utf-8')
        orig = text
        problem = []

        if 'id="approvalPanel"' not in text:
            m = PANEL_ANCHOR.search(text)
            if m:
                text = text[:m.start()] + m.group(1) + PANEL_HTML + text[m.start():]
            else:
                problem.append('history 패널 없음')

        if 'dkj-approval.js' not in text:
            m = SCRIPT_ANCHOR.search(text)
            if m:
                text = text[:m.end()] + m.group(1) + SCRIPT_LINE + '\n' + text[m.end():]
            else:
                problem.append('dkj-record-store.js 없음')

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
