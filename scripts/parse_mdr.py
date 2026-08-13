# -*- coding: utf-8 -*-
"""MDR-001 Rev4 xlsx -> tenants/dkj/data/mdr-catalog.json"""
import zipfile, re, json, sys, os
from datetime import date

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "mdr-catalog.json")
# 원본 xlsx 경로는 공개 배포되지 않도록 data/asset-sources.local.json(gitignore)에서 읽는다
LOCAL = os.path.join(os.path.dirname(__file__), "..", "data", "asset-sources.local.json")


def default_path() -> str:
    if not os.path.isfile(LOCAL):
        return ""
    with open(LOCAL, encoding="utf-8") as fh:
        cfg = json.load(fh)
    root, rel = cfg.get("fsscRoot", ""), cfg.get("mdrOfficial", "")
    return os.path.join(root, rel) if root and rel else ""


path = sys.argv[1] if len(sys.argv) > 1 else default_path()
if not path:
    print("MDR xlsx 경로를 인자로 주거나 data/asset-sources.local.json 을 두세요.")
    sys.exit(1)
if not os.path.exists(path):
    print(json.dumps({"error": "not found", "path": path}, ensure_ascii=False))
    sys.exit(1)

z = zipfile.ZipFile(path)
ss = z.read("xl/sharedStrings.xml").decode("utf-8")
strings = re.findall(r"<t[^>]*>([^<]*)</t>", ss)
wb = z.read("xl/workbook.xml").decode("utf-8")
sheets = re.findall(r'<sheet[^>]+name="([^"]+)"', wb)

# find MDR_Main sheet index
main_idx = sheets.index("MDR_Main") + 1 if "MDR_Main" in sheets else 2
sh = z.read("xl/worksheets/sheet%d.xml" % main_idx).decode("utf-8")

row_map = {}
for m in re.finditer(
    r'<c r="([A-Z]+)(\d+)"([^>]*)>(?:<v>([^<]*)</v>|<is><t>([^<]*)</t></is>)',
    sh,
):
    col, row, attrs, v, inline = m.groups()
    val = inline if inline else v
    if attrs and 't="s"' in attrs and val:
        try:
            val = strings[int(val)]
        except (ValueError, IndexError):
            pass
    if val is None:
        continue
    val = str(val).strip()
    if not val:
        continue
    r = int(row)
    row_map.setdefault(r, {})[col] = val

# MDR_Main columns (from sample row 3):
# A=no B=code C=title D=type E=rev F=제정 G=개정 H=시행 I~L=결재 M=배포 N=위치 O=보존 P=권한 Q=표준 R=관련 S=상태 T=파일경로 U=비고

TYPE_MAP = {
    "PR": "procedure",
    "PRC": "procedure",
    "WI": "sop",
    "FR": "record",
    "F": "record",
    "MDR": "mdr",
    "DOC": "mdr",
    "MN": "manual",
    "HACCP": "manual",
    "PM": "processmap",
    "MAP": "processmap",
}

entries = []
for r in sorted(row_map.keys()):
    if r < 2:
        continue
    c = row_map[r]
    code = c.get("B", "")
    if not code or code in ("문서번호", "Code", "B"):
        continue
    doc_type = c.get("D", "")
    rev_num = c.get("E", "0")
    rev = "Rev%s" % rev_num if rev_num else "Rev0"
    status = c.get("S", "운영중")
    workflow = "완료" if "운영중" in status else "수정필요" if "개정" in status else "완료"
    cat = TYPE_MAP.get(doc_type.upper() if len(doc_type) <= 4 else doc_type[:2], "other")
    if code.startswith("DKJ-P"):
        cat = "procedure"
    elif code.startswith("DKJ-WI") or code.startswith("WI-"):
        cat = "sop"
    elif code.startswith("DKJ-F") or code.startswith("FR-"):
        cat = "record"
    elif code.startswith("PM-"):
        cat = "processmap"
    elif code in ("MDR-001", "DOC-001"):
        cat = "mdr"

    # normalize FR codes: DKJ-F-014 -> FR-014 for portal
    portal_id = code
    if code.startswith("DKJ-F-"):
        portal_id = code.replace("DKJ-F-", "FR-")
    elif code.startswith("F-"):
        portal_id = "FR-" + code[2:]

    entries.append({
        "mdrRow": r,
        "id": portal_id,
        "code": code,
        "title": c.get("C", ""),
        "rev": rev,
        "docType": doc_type,
        "category": cat,
        "workflowStatus": workflow,
        "status": status,
        "filePath": c.get("T", ""),
        "related": c.get("R", ""),
        "note": c.get("U", ""),
        "enacted": c.get("F", ""),
        "revised": c.get("G", ""),
    })

out = {
    "source": path,
    "mdrCode": "MDR-001",
    "mdrRev": "Rev11" if "Rev11" in path else ("Rev4" if "Rev4" in path else "Rev"),
    "parsedAt": str(date.today()),
    "sheets": sheets,
    "entryCount": len(entries),
    "entries": entries,
}

# prefer filename RevN
_m = re.search(r"(Rev\d+)", os.path.basename(path), re.I)
if _m:
    out["mdrRev"] = _m.group(1)

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print("OK", len(entries), "entries ->", OUT)

# JS bundle for file:// (no fetch CORS)
bundle_out = os.path.join(os.path.dirname(OUT), "..", "js", "mdr-catalog.bundle.js")
with open(OUT, "r", encoding="utf-8") as f:
    raw = f.read()
with open(bundle_out, "w", encoding="utf-8") as f:
    f.write("window.DKJ_MDR_CATALOG=" + raw + ";\n")
print("bundle ->", bundle_out)
