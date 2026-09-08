#!/usr/bin/env python3
"""data/ledger-form-specs/<코드>.json → js/<코드>.js 부트 스크립트 재생성.

대장(유형 E) 서식은 JSON 사양이 정본이고 js/<코드>.js 는 그 사양을 그대로 감싼
생성물이다. 화면은 file:// 로도 열려야 해서 JSON fetch 대신 이 부트 스크립트를 읽는다.
JSON 을 고쳤으면 반드시 이 스크립트를 돌려야 화면에 반영된다.

사용: python scripts/build-ledger-forms.py [코드 ...]   (인자 없으면 전체)
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPEC_DIR = ROOT / 'data' / 'ledger-form-specs'
JS_DIR = ROOT / 'js'

TEMPLATE = """/**
 * {code} - ledger boot (SSOT: data/ledger-form-specs/{code}.json)
 */
(function () {{
  'use strict';
  DkjLedgerForm.mount({spec});
}})();
"""


def build(code):
    spec = json.loads((SPEC_DIR / (code + '.json')).read_text(encoding='utf-8'))
    body = json.dumps(spec, ensure_ascii=False, indent=2)
    (JS_DIR / (code + '.js')).write_text(
        TEMPLATE.format(code=code, spec=body), encoding='utf-8')
    return code


def main():
    codes = sys.argv[1:] or sorted(p.stem for p in SPEC_DIR.glob('*.json'))
    for c in codes:
        print('built', build(c))


if __name__ == '__main__':
    main()
