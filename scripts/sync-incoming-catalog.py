# -*- coding: utf-8 -*-
"""data/incoming-catalog.json(업체·품목 정본) → DKJ-S-02-14/15 사양 JSON 의 업체·품목 선택지.

  python scripts/sync-incoming-catalog.py          # 사양 JSON 갱신
  python scripts/sync-incoming-catalog.py --check  # 어긋난 곳만 알리고 종료코드 1

갱신 뒤에는 `python scripts/build-ledger-forms.py` 로 records/·js/ 를 다시 만든다.
(FR-014 는 js/incoming-catalog.bundle.js 를 직접 읽으므로 build-catalog-bundles.py 만 돌리면 된다.)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

DKJ = Path(__file__).resolve().parents[1]
CAT = json.loads((DKJ / "data" / "incoming-catalog.json").read_text(encoding="utf-8"))["categories"]


def uniq(seq):
    out = []
    for v in seq:
        if v not in out:
            out.append(v)
    return out


def patch(code, fn):
    path = DKJ / "data" / "ledger-form-specs" / f"{code}.json"
    spec = json.loads(path.read_text(encoding="utf-8"))
    cols = {c["key"]: c for c in spec["columns"]}
    before = json.dumps(spec, ensure_ascii=False)
    fn(cols)
    after = json.dumps(spec, ensure_ascii=False)
    return path, spec, before != after


def s14(cols):
    cols["vendor"]["choices"] = list(CAT["원료"]["vendors"])
    cols["item"]["choices"] = list(CAT["원료"]["items"])


def s15(cols):
    kinds = json.loads((DKJ / "data" / "incoming-catalog.json").read_text(encoding="utf-8"))["ledgerKinds"]["DKJ-S-02-15"]
    vmap = {k: list(CAT[c]["vendors"]) for k, c in kinds.items()}
    imap = {k: list(CAT[c]["items"]) for k, c in kinds.items()}
    cols["vendor"]["choices"] = uniq(v for k in kinds for v in vmap[k])
    cols["vendor"]["choicesBy"] = {"field": "kind", "map": vmap}
    cols["item"]["choices"] = uniq(v for k in kinds for v in imap[k])
    cols["item"]["choicesBy"] = {"field": "kind", "map": imap}


def main():
    check = "--check" in sys.argv
    bad = 0
    for code, fn in (("DKJ-S-02-14", s14), ("DKJ-S-02-15", s15)):
        path, spec, changed = patch(code, fn)
        if changed:
            bad += 1
            print(("어긋남 " if check else "갱신 ") + code)
            if not check:
                path.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        else:
            print("일치 " + code)
    if check and bad:
        sys.exit(1)


if __name__ == "__main__":
    main()
