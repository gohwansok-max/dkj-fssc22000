#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
새 농협 사업장으로 브랜드명(회사명)과 시스템 관리자 사번을 일괄 치환한다.

기본은 미리보기만 한다 — 실제로 파일을 고치려면 --apply 를 붙여야 한다.
반드시 저장소 루트에서 실행한다:

    python scripts/new-tenant-rename.py --org-full "부안농협 미곡종합처리장" \\
        --org-mid "부안농협" --org-short "부안" --admin-emp-id 1234
    (결과 확인 후)
    python scripts/new-tenant-rename.py ... --apply

이 스크립트가 하는 일:
  - "동김제농협 산지유통센터" / "동김제농협" / "동김제" 세 가지 형태를 새 이름으로
    치환한다(긴 문자열부터 먼저 치환해서 겹침 문제를 피한다).
  - --admin-emp-id 를 주면, docs/NEW_TENANT_HARNESS.md PART 3 에서 확인된
    시스템 관리자 사번(4343) 하드코딩 지점만 정확히 치환한다(전체 파일을 훑지
    않고 이미 검증된 파일 목록만 건드린다 — 다른 문맥의 "4343"을 잘못 건드릴
    위험을 없앤다).

이 스크립트가 절대 안 하는 일 (docs/NEW_TENANT_HARNESS.md PART 3 참고):
  - CLAUDE.md, docs/** 는 건드리지 않는다 — 동김제 배포의 실제 이력이라 다른
    사업장 이름으로 바꾸면 그 기록 자체가 거짓이 된다. 새 사업장용 CLAUDE.md는
    새로 쓸 것.
  - js/*.bundle.js 는 건드리지 않는다 — data/*.json 에서 자동 생성되는 파일이라
    직접 고쳐도 다음 빌드에서 덮어써진다. 이 스크립트 실행 후 반드시
    `python scripts/build-catalog-bundles.py` 를 돌려서 다시 만들어야 한다.
  - data/*.json 의 실제 내용(품목 마스터·직원 명단·문서 목록 등)은 이름만 바뀔 뿐
    값 자체는 여전히 동김제 것이다 — 새 사업장 데이터로 새로 채워야 한다.
  - assets/brand/*.svg 로고 파일 자체(텍스트가 아니라 이미지라 치환 대상이 아님).
  - 서식별 JS(`js/DKJ-*.js`, `js/FR-*.js`)에 박혀 있는 실제 배합비·거래처명 같은
    업무 데이터. 회사명만 바뀌고 나머지 내용은 동김제 것 그대로 남는다.
"""
import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# 브랜드명 치환 대상에서 제외한다 — 이유는 위 docstring 참고.
EXCLUDE_TOP_DIRS = {'.git', 'docs', 'node_modules', 'functions', 'functions-periodic'}
EXCLUDE_EXACT_NAMES = {'CLAUDE.md'}
EXCLUDE_SUFFIXES = ('.bundle.js',)
EXCLUDE_NAME_SUBSTRINGS = ('html2pdf',)
TEXT_SUFFIXES = {'.html', '.js', '.json', '.svg'}

# 시스템 관리자 사번(4343)이 실제로 하드코딩된 것으로 확인된 파일만 정확히 지정한다
# (2026-09-04 grep으로 검증). data/staff-roles.json이 정본이고, js/staff-roles.bundle.js는
# 거기서 자동 생성되므로 손대지 않는다 — build-catalog-bundles.py가 반영한다.
ADMIN_EMP_ID_FILES = [
    'js/dkj-approval.js',
    'js/dkj-auth.js',
    'js/dkj-backup-reminder.js',
    'js/dkj-chatbot.js',
    'js/dkj-i18n.js',
    'js/records-archive.js',
    'js/system-settings.js',
    'system-settings.html',
    'data/staff-roles.json',
]


def tracked_files():
    out = subprocess.run(
        ['git', '-C', str(REPO_ROOT), 'ls-files'],
        capture_output=True, text=True, check=True
    )
    for rel in out.stdout.splitlines():
        p = Path(rel)
        if p.parts and p.parts[0] in EXCLUDE_TOP_DIRS:
            continue
        if p.name in EXCLUDE_EXACT_NAMES:
            continue
        if p.name.endswith(EXCLUDE_SUFFIXES):
            continue
        if any(s in p.name for s in EXCLUDE_NAME_SUBSTRINGS):
            continue
        if p.suffix not in TEXT_SUFFIXES:
            continue
        yield REPO_ROOT / rel


def apply_replacements(path, replacements, apply):
    try:
        text = path.read_text(encoding='utf-8')
    except (UnicodeDecodeError, FileNotFoundError):
        return 0
    hits = 0
    for old, new in replacements:
        if old in text:
            hits += text.count(old)
            text = text.replace(old, new)
    if hits and apply:
        path.write_text(text, encoding='utf-8')
    return hits


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument('--org-full', required=True,
                     help='정식 전체명칭 (예: "부안농협 미곡종합처리장") — "동김제농협 산지유통센터"를 대체')
    ap.add_argument('--org-mid', required=True,
                     help='조합명 (예: "부안농협") — "동김제농협"을 대체. index.html 헤더는 '
                          '"조합명" + "시설유형"이 별도 태그로 나뉘어 있어, --org-mid 만 반영되고 '
                          '"산지유통센터" 표기는 그대로 남는다 — 시설유형이 다르면 index.html에서 '
                          '직접 고칠 것.')
    ap.add_argument('--org-short', required=True,
                     help='약칭 (예: "부안") — "동김제"를 대체')
    ap.add_argument('--admin-emp-id',
                     help='새 시스템 관리자 사번(4자리). 주면 검증된 파일 목록에서만 4343을 치환')
    ap.add_argument('--apply', action='store_true',
                     help='실제로 파일을 고친다. 기본은 미리보기만 하고 아무것도 바꾸지 않는다.')
    args = ap.parse_args()

    if args.admin_emp_id and not re.fullmatch(r'\d{4}', args.admin_emp_id):
        sys.exit('오류: --admin-emp-id 는 4자리 숫자여야 합니다 (예: 1234)')

    # 긴 문자열부터 먼저 치환해야 "동김제농협 산지유통센터"를 "동김제농협"으로 먼저
    # 잘못 치환해버리는 겹침 문제를 피한다.
    org_replacements = [
        ('동김제농협 산지유통센터', args.org_full),
        ('동김제농협', args.org_mid),
        ('동김제', args.org_short),
    ]

    total_files, total_hits, report = 0, 0, []
    for path in tracked_files():
        hits = apply_replacements(path, org_replacements, args.apply)
        if hits:
            total_files += 1
            total_hits += hits
            report.append((str(path.relative_to(REPO_ROOT)), hits))

    admin_files_touched, admin_hits = 0, 0
    if args.admin_emp_id:
        emp_replacements = [('4343', args.admin_emp_id)]
        for rel in ADMIN_EMP_ID_FILES:
            path = REPO_ROOT / rel
            if not path.exists():
                print(f'경고: {rel} 이(가) 없습니다 — 건너뜀', file=sys.stderr)
                continue
            hits = apply_replacements(path, emp_replacements, args.apply)
            if hits:
                admin_files_touched += 1
                admin_hits += hits
                report.append((rel + ' (사번)', hits))

    report.sort(key=lambda x: -x[1])
    mode = '[적용]' if args.apply else '[미리보기 — --apply 없이 실행됨, 아무 파일도 안 바뀜]'
    print(f'{mode} 브랜드명 {total_files}개 파일 {total_hits}건'
          + (f' · 사번 {admin_files_touched}개 파일 {admin_hits}건' if args.admin_emp_id else ''))
    for name, n in report:
        print(f'  {n:4d}  {name}')

    print()
    print('반드시 이어서 확인/실행:')
    print('  1. index.html 헤더의 <b>산지유통센터</b> — 새 사업장 시설유형이 다르면 직접 고칠 것')
    print('  2. python scripts/build-catalog-bundles.py  (data/*.json 을 고쳤으니 번들 재생성 필수)')
    print('  3. python scripts/build-sw-precache.py')
    print('  4. data/*.json 의 실제 값(품목·직원·문서 목록 등)과 assets/brand/*.svg 로고는')
    print('     이 스크립트가 손대지 않았다 — docs/NEW_TENANT_HARNESS.md PART 3의 나머지 항목 확인')
    if not args.apply:
        print()
        print('위 결과가 맞으면 --apply 를 추가해 다시 실행하세요.')


if __name__ == '__main__':
    main()
