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

    documents = []
    for item in raw:
        name = item.get('name', '')
        kind = extension(name)
        code = code_of(name)
        related_pdf = None
        if kind != 'pdf':
            if code and pdf_by_code.get(code):
                related_pdf = sorted(pdf_by_code[code], key=lambda row: row.get('name', ''))[0]
            elif pdf_by_stem.get(normalized_stem(name)):
                related_pdf = sorted(pdf_by_stem[normalized_stem(name)], key=lambda row: row.get('name', ''))[0]
        path = item.get('relativePath', name)
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
            row['pdf'] = {
                'id': related_pdf['id'],
                'name': related_pdf.get('name', ''),
                **drive_urls(related_pdf['id']),
            }
        documents.append(row)

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
