#!/usr/bin/env python3
"""Build a static, read-only Drive document manifest for the web document library.

Input is a locally generated Drive inventory. The script never changes Google Drive.
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

INVENTORY = Path('/home/ubuntu/dkj_drive_inventory_all.json')
OUT_JSON = Path('/home/ubuntu/dkj-fssc22000/data/drive-document-manifest.json')
OUT_BUNDLE = Path('/home/ubuntu/dkj-fssc22000/js/drive-document-manifest.bundle.js')
FOLDER_MIME = 'application/vnd.google-apps.folder'
DOC_MIMES = {
    'application/pdf',
    'application/x-hwp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
}
TYPE_LABELS = {
    'pdf': 'PDF', 'hwp': 'HWP', 'docx': 'Word', 'pptx': 'PowerPoint',
    'xlsx': 'Excel', 'xls': 'Excel', 'ppt': 'PowerPoint',
}
CODE_RE = re.compile(r'(DKJ-(?:[A-Z0-9]+-)+[A-Z0-9]+)', re.I)

# 이 스크립트는 scripts/ 라 GitHub Pages 에 배포되지 않는다(deploy-pages.yml 제외 목록) —
# 그러니 여기 이름을 적어 두는 것 자체는 공개 노출이 아니다. 문제는 이 스크립트의
# *산출물*(data/drive-document-manifest.json, js/drive-document-manifest.bundle.js)이
# 배포되는데, Drive 원본 파일명에 실명이 그대로 박혀 있으면 그 이름이 파일명 그대로
# 정본 문서 열람실(official-documents.html)에 노출된다는 것이다
# (2026-09-09 발견 — 08_내부심사/02_내부심사원_자격인정자료_최민재_이다은_권화선_IA-2026-01.xlsx).
#
# 근본 해결은 Drive 쪽 파일명을 바꾸는 것이고(이 스크립트가 Drive 를 고치지는 않는다 —
# 파일 상단 설명 참고), 그건 사람이 해야 한다. 그때까지는 이 목록에 걸리는 이름을
# 파일명·경로에서 지우고 만든다 — CLAUDE.md 의 "직원 이름을 하드코딩하지 않는다"
# 원칙과 같은 이유다. 사람이 Drive 파일명을 바로잡으면 이 목록에서 지워도 된다.
REDACT_NAMES = ['최민재', '이다은', '권화선']
_REDACT_RE = re.compile('|'.join(re.escape(n) for n in REDACT_NAMES)) if REDACT_NAMES else None


def redact(text: str) -> str:
    if not _REDACT_RE or not text:
        return text
    out = _REDACT_RE.sub('', text)
    # 이름을 지우고 남은 구분자(_최민재_ → __)를 정리한다
    out = re.sub(r'[_\-]{2,}', lambda m: m.group(0)[0], out)
    out = re.sub(r'^[_\-]+|[_\-]+(?=\.[A-Za-z0-9]+$)|[_\-]+$', '', out)
    return out


def extension(name: str) -> str:
    return name.rsplit('.', 1)[-1].lower() if '.' in name else 'file'


def code_of(name: str) -> str:
    match = CODE_RE.search(name)
    return match.group(1).upper() if match else ''


def normalized_stem(name: str) -> str:
    stem = name.rsplit('.', 1)[0].lower()
    return re.sub(r'[\\s._()\-]+', '', stem)


def drive_urls(file_id: str) -> dict:
    return {
        'viewUrl': f'https://drive.google.com/file/d/{file_id}/view',
        'previewUrl': f'https://drive.google.com/file/d/{file_id}/preview',
        'downloadUrl': f'https://drive.google.com/uc?export=download&id={file_id}',
    }


def category(path: str) -> str:
    segments = path.split('/')
    if not segments:
        return '미분류'
    if segments[0] == 'pdf' and len(segments) > 1:
        return f'PDF 변환본 · {segments[1]}'
    return segments[0]


def main() -> None:
    inventory = json.loads(INVENTORY.read_text(encoding='utf-8'))
    raw = [
        item for item in inventory.get('items', [])
        if item.get('mimeType') in DOC_MIMES
    ]
    pdf_by_code: dict[str, list[dict]] = defaultdict(list)
    pdf_by_stem: dict[str, list[dict]] = defaultdict(list)
    for item in raw:
        if extension(item.get('name', '')) == 'pdf':
            pdf_by_stem[normalized_stem(item['name'])].append(item)
            if code_of(item.get('name', '')):
                pdf_by_code[code_of(item['name'])].append(item)

    redacted_log = []

    documents = []
    for item in raw:
        raw_name = item.get('name', '')
        # 원본 이름은 code_of()/normalized_stem() 매칭(짝 PDF 찾기)에 쓰고,
        # 화면에 실리는 값(name/title/relativePath)만 실명을 지운 뒤 값으로 쓴다 —
        # 매칭 로직까지 지운 이름으로 바꾸면 문서번호 접두사가 안 걸릴 수 있다.
        name = redact(raw_name)
        if name != raw_name:
            redacted_log.append(raw_name + ' → ' + name)
        kind = extension(raw_name)
        code = code_of(raw_name)
        related_pdf = None
        if kind != 'pdf':
            if code and pdf_by_code.get(code):
                related_pdf = sorted(pdf_by_code[code], key=lambda row: row.get('name', ''))[0]
            elif pdf_by_stem.get(normalized_stem(raw_name)):
                related_pdf = sorted(pdf_by_stem[normalized_stem(raw_name)], key=lambda row: row.get('name', ''))[0]
        path = redact(item.get('relativePath', raw_name))
        row = {
            'id': item['id'],
            'name': name,
            'title': name.rsplit('.', 1)[0],
            'fileType': kind,
            'fileTypeLabel': TYPE_LABELS.get(kind, kind.upper()),
            'mimeType': item.get('mimeType', ''),
            'code': code,
            'category': category(path),
            'relativePath': path,
            'modifiedTime': item.get('modifiedTime', ''),
            'size': int(item.get('size', 0) or 0),
            **drive_urls(item['id']),
        }
        if related_pdf:
            pdf_raw_name = related_pdf.get('name', '')
            pdf_name = redact(pdf_raw_name)
            if pdf_name != pdf_raw_name:
                redacted_log.append(pdf_raw_name + ' → ' + pdf_name)
            row['pdf'] = {
                'id': related_pdf['id'],
                'name': pdf_name,
                **drive_urls(related_pdf['id']),
            }
        documents.append(row)

    if redacted_log:
        print('실명을 지운 파일명 ' + str(len(redacted_log)) + '건 — Drive 원본 파일명을 '
              '바로잡는 것을 권장합니다(REDACT_NAMES 는 임시방편입니다):')
        for line in redacted_log:
            print('  ' + line)

    documents.sort(key=lambda row: (row['category'], row['name'].lower()))
    categories = [
        {'name': name, 'count': count}
        for name, count in sorted(Counter(row['category'] for row in documents).items())
    ]
    payload = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'source': 'Google Drive 동김제농협 FSSC22000 V6 운영체계구축 최종본260714',
        'rootFolderId': inventory.get('rootId', ''),
        'counts': {
            'documents': len(documents),
            'withPdfPair': sum(1 for row in documents if row.get('pdf')),
            'byType': dict(sorted(Counter(row['fileType'] for row in documents).items())),
        },
        'categories': categories,
        'documents': documents,
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    OUT_BUNDLE.write_text(
        '/* Generated from the approved Google Drive document inventory. */\n'
        'window.DKJ_DRIVE_DOCUMENTS = ' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';\n',
        encoding='utf-8',
    )
    print(json.dumps(payload['counts'], ensure_ascii=False, indent=2))
    print(f'Wrote {OUT_JSON} and {OUT_BUNDLE}')


if __name__ == '__main__':
    main()
