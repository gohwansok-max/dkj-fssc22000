#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
새 서식 하나를 카탈로그 4종에 등록한다 — docs/NEW_TENANT_HARNESS.md PART 5-2의
3~6단계(record-catalog.json / console-forms.json / mdr-catalog.json /
print-templates/<코드>.json)를 대신한다.

기본은 미리보기만 한다 — 실제로 파일을 고치려면 --apply 를 붙여야 한다.
반드시 저장소 루트에서 실행한다.

예시 (fr-form 엔진, 매일 작성, 발생 이벤트형이 아닌 정기 서식):

    python scripts/new-record-catalog-add.py \\
        --code DKJ-S-02-99 --title "우수관 관리점검" \\
        --engine fr --console-group daily --category daily \\
        --role "생산팀" --period "매일" --priority normal \\
        --summary "우수관 정기 점검 및 이물 확인" \\
        --subtitle "선행요건 · 매일"

미리보기 결과가 맞으면 같은 명령에 --apply 를 붙여 다시 실행한다.

이 스크립트가 하지 않는 일 (여전히 사람/Claude가 직접 해야 함):
  - data/<엔진>-form-specs/<코드>.json 의 실제 fields/sections 작성 — 문서를 읽고
    항목을 옮기는 판단 작업이라 자동화 대상이 아니다(docs/NEW_TENANT_HARNESS.md
    PART 5-1/5-2 참고).
  - records/<코드>.html 셸 생성 — 같은 엔진의 기존 서식 HTML을 복사해서 코드만
    바꾸는 게 가장 빠르다.
  - print-templates/<코드>.json 의 정확한 "layout" 값 선택 — 이 스크립트는
    엔진별로 안전한 기본값만 넣고, 애매하면 명백히 틀린 placeholder를 넣어
    반드시 사람이 고치도록 강제한다(아래 --print-layout 참고).
"""
import argparse
import json
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

RECORD_CATALOG = REPO_ROOT / 'data' / 'record-catalog.json'
CONSOLE_FORMS = REPO_ROOT / 'data' / 'console-forms.json'
MDR_CATALOG = REPO_ROOT / 'data' / 'mdr-catalog.json'
PRINT_TEMPLATES_DIR = REPO_ROOT / 'data' / 'print-templates'

VALID_CONSOLE_GROUPS = ('daily', 'weekly', 'event', 'annual')
VALID_PRIORITIES = ('critical', 'high', 'normal')

# 엔진별 console-forms.json check.mode 기본값 — docs/NEW_TENANT_HARNESS.md PART 5-1 매핑표와 대응.
ENGINE_CHECK_DEFAULTS = {
    'fr': {'mode': 'perDay', 'dateField': 'docDate'},
    'ox': {'mode': 'perDay', 'dateField': 'docDate'},
    'ledger': {'mode': 'dayRow', 'dayKey': 'day'},
    'matrix': {'mode': 'dayColumn'},
    'report': {'mode': 'event'},
    'custom': {'mode': 'event'},
}

# js/dkj-print-form.js 가 실제로 아는 layout 값(2026-09-04 기준 grep으로 확인).
# 엔진과 1:1로 안 맞는 것들(ledger의 mon-lux/mon-th 처럼 측정 종류에 따라 갈림)은
# 일부러 명백히 틀린 값을 넣어서 반드시 사람이 고치게 한다.
KNOWN_PRINT_LAYOUTS = [
    'official-fr-generic', 'official-prp-ox', 'official-prp-mon-lux',
    'official-prp-mon-th', 'ccp-rows', 'mon', 'mon-lux', 'mon-th',
]
ENGINE_PRINT_LAYOUT_DEFAULTS = {
    'fr': 'official-fr-generic',
    'ox': 'official-prp-ox',
    'ledger': 'TODO-CHOOSE-LAYOUT',   # mon-lux / mon-th 등 측정 종류에 따라 다름 — 직접 골라야 함
    'matrix': 'TODO-CHOOSE-LAYOUT',
    'report': 'TODO-CHOOSE-LAYOUT',
    'custom': 'TODO-CHOOSE-LAYOUT',
}


def sniff_newline(path):
    """원본 파일의 줄바꿈 방식(CRLF/LF)을 그대로 유지한다 — 안 지키면 코드
    내용은 한 줄만 바꿨는데 줄바꿈 문자 차이로 파일 전체가 diff에 걸려
    나온다(mdr-catalog.json이 CRLF라 실제로 이 문제가 있었다)."""
    raw = path.read_bytes()
    return '\r\n' if b'\r\n' in raw else '\n'


def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def dump_json(path, data, newline='\n'):
    with open(path, 'w', encoding='utf-8', newline=newline) as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')


def find_existing(code):
    """이미 등록된 서식이면 어느 카탈로그에 있는지 알려준다 — 중복 등록 방지."""
    hits = []
    rc = load_json(RECORD_CATALOG)
    if any(r.get('code') == code for r in rc['records']):
        hits.append('record-catalog.json')
    cf = load_json(CONSOLE_FORMS)
    for g in cf['groups']:
        if any(f.get('code') == code for f in g.get('forms', [])):
            hits.append('console-forms.json')
            break
    mdr = load_json(MDR_CATALOG)
    if any(e.get('code') == code for e in mdr['entries']):
        hits.append('mdr-catalog.json')
    if (PRINT_TEMPLATES_DIR / (code + '.json')).exists():
        hits.append('print-templates/%s.json' % code)
    return hits


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument('--code', required=True, help='서식 코드 (예: DKJ-S-02-99)')
    ap.add_argument('--title', required=True, help='서식 제목')
    ap.add_argument('--engine', required=True, choices=list(ENGINE_CHECK_DEFAULTS),
                     help='서식 엔진 — docs/NEW_TENANT_HARNESS.md PART 5-1 표로 고른다')
    ap.add_argument('--console-group', required=True, choices=VALID_CONSOLE_GROUPS,
                     help='업무 콘솔에서 어느 묶음에 넣을지 (daily/weekly/event/annual)')
    ap.add_argument('--category', required=True,
                     help='record-catalog.json 의 category id. 기존 categories 목록에 '
                          '없으면 경고만 하고 record 는 등록하되 categories[].codes 에는 '
                          '추가하지 않는다 — 새 카테고리를 만드는 건 이 스크립트 범위 밖')
    ap.add_argument('--role', required=True, help='담당 (예: "품질팀")')
    ap.add_argument('--period', required=True, help='주기 표시 텍스트 (예: "매일", "주 1회")')
    ap.add_argument('--priority', default='normal', choices=VALID_PRIORITIES)
    ap.add_argument('--summary', default='', help='record-catalog.json 의 summary')
    ap.add_argument('--subtitle', default='', help='인쇄 정본 subtitle (예: "선행요건 · 매일")')
    ap.add_argument('--mdr-doc-type', default='선행요건 문서/기록',
                     help='mdr-catalog.json entries[].docType')
    ap.add_argument('--org-name', default=None,
                     help='인쇄 정본 orgName. 생략하면 record-catalog.json 의 site 값을 그대로 씀')
    ap.add_argument('--rev', default='0', help='인쇄 정본 rev (개정번호)')
    ap.add_argument('--enact-date', default=None,
                     help='인쇄 정본 제정일 ("YYYY. MM. DD"). 생략하면 오늘 날짜')
    ap.add_argument('--check-mode-override', default=None,
                     help='console-forms.json check.mode 를 엔진 기본값 대신 직접 지정 '
                          '(perDay/dayRow/dayColumn/perPeriod/event 중 하나)')
    ap.add_argument('--ccp', action='store_true', help='CCP 서식이면 console-forms.json 항목에 ccp:true 표시')
    ap.add_argument('--apply', action='store_true', help='실제로 파일을 고친다. 기본은 미리보기만.')
    args = ap.parse_args()

    existing = find_existing(args.code)
    if existing:
        sys.exit(
            '오류: "%s" 는 이미 등록돼 있습니다 (%s). 다른 코드를 쓰거나, '
            '기존 등록을 먼저 정리하세요.' % (args.code, ', '.join(existing))
        )

    rc = load_json(RECORD_CATALOG)
    valid_categories = [c['id'] for c in rc.get('categories', [])]
    if args.category not in valid_categories:
        print('경고: category "%s" 는 categories 목록에 없습니다 (기존: %s). '
              'record는 등록하지만 categories[].codes 에는 못 넣습니다 — '
              '먼저 카테고리를 만들거나 기존 id를 쓰세요.'
              % (args.category, ', '.join(valid_categories)), file=sys.stderr)

    org_name = args.org_name or rc.get('site', '')
    enact_date = args.enact_date or date.today().strftime('%Y. %m. %d')

    # 1) record-catalog.json
    new_record = {
        'code': args.code,
        'title': args.title,
        'period': args.period,
        'category': args.category,
        'role': args.role,
        'file': 'records/%s.html' % args.code,
        'summary': args.summary,
    }
    rc['records'].append(new_record)
    for c in rc.get('categories', []):
        if c['id'] == args.category:
            c.setdefault('codes', []).append(args.code)

    # 2) console-forms.json
    cf = load_json(CONSOLE_FORMS)
    check = dict(args.check_mode_override and {'mode': args.check_mode_override}
                 or ENGINE_CHECK_DEFAULTS[args.engine])
    new_form_entry = {
        'code': args.code,
        'title': args.title,
        'priority': args.priority,
        'href': 'records/%s.html' % args.code,
        'check': check,
    }
    if args.ccp:
        new_form_entry['ccp'] = True
    group = next((g for g in cf['groups'] if g['id'] == args.console_group), None)
    if group is None:
        sys.exit('오류: console-forms.json 에 group id "%s" 가 없습니다.' % args.console_group)
    group.setdefault('forms', []).append(new_form_entry)

    # 3) mdr-catalog.json — workflowStatus/status 는 "아직 검증 안 됨"이 기본값이다.
    #    이 스크립트가 만든 항목을 사람이 확인하기 전에 "완료/운영중"으로 보이면 안 된다.
    mdr = load_json(MDR_CATALOG)
    next_row = max((e.get('mdrRow', 0) for e in mdr['entries']), default=0) + 1
    new_entry = {
        'mdrRow': next_row,
        'id': args.code,
        'code': args.code,
        'title': args.title,
        'rev': 'Rev' + args.rev,
        'docType': args.mdr_doc_type,
        'category': 'other',
        'workflowStatus': '초안',
        'status': '검토대기',
        'filePath': '',
        'related': '',
        'note': '(scripts/new-record-catalog-add.py 로 생성 — 사람 확인 전)',
        'enacted': '0',
        'revised': '',
    }
    mdr['entries'].append(new_entry)
    mdr['entryCount'] = len(mdr['entries'])

    # 4) print-templates/<code>.json
    layout = ENGINE_PRINT_LAYOUT_DEFAULTS[args.engine]
    print_template = {
        'layout': layout,
        'orgName': org_name,
        'docNo': args.code,
        'title': args.title,
        'rev': args.rev,
        'enactDate': enact_date,
        'reviseDate': '-',
        'subtitle': args.subtitle,
    }

    print('%s "%s" 등록 %s:'
          % ('[적용]' if args.apply else '[미리보기 — --apply 없이 실행됨, 아무 파일도 안 바뀜]',
             args.code, '완료' if args.apply else '예정'))
    print('  1. record-catalog.json  → records[] + categories["%s"].codes' % args.category)
    print('  2. console-forms.json   → groups["%s"].forms  (check.mode=%s)'
          % (args.console_group, check.get('mode')))
    print('  3. mdr-catalog.json     → entries[]  (workflowStatus=초안, status=검토대기)')
    print('  4. print-templates/%s.json  (layout=%s)' % (args.code, layout))
    if layout == 'TODO-CHOOSE-LAYOUT':
        print('     ⚠ 이 엔진은 layout을 자동으로 못 고릅니다 — 알려진 값 중 하나로 직접')
        print('       바꾸세요: %s' % ', '.join(KNOWN_PRINT_LAYOUTS))

    if args.apply:
        dump_json(RECORD_CATALOG, rc, newline=sniff_newline(RECORD_CATALOG))
        dump_json(CONSOLE_FORMS, cf, newline=sniff_newline(CONSOLE_FORMS))
        dump_json(MDR_CATALOG, mdr, newline=sniff_newline(MDR_CATALOG))
        PRINT_TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)
        # 새로 만드는 파일은 참고할 기존 줄바꿈이 없으니 LF(기본)로 둔다 — 다른
        # print-templates/*.json 파일들도 LF인지 한 번 확인해 두면 좋다.
        dump_json(PRINT_TEMPLATES_DIR / (args.code + '.json'), print_template)

    print()
    print('이 스크립트가 하지 않은 것 (직접 해야 함):')
    print('  - data/%s-form-specs/%s.json 의 실제 fields/sections 작성' % (args.engine, args.code))
    print('  - records/%s.html 셸 생성 (같은 엔진의 기존 서식 HTML을 복사해서 코드만 바꾸는 게 제일 빠름)' % args.code)
    print('  - python scripts/build-catalog-bundles.py  (반드시 실행 — 화면은 JSON이 아니라 번들을 읽음)')
    if not args.apply:
        print()
        print('위 결과가 맞으면 --apply 를 추가해 다시 실행하세요.')


if __name__ == '__main__':
    main()
