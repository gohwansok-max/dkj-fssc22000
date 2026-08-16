#!/usr/bin/env python3
"""Read-only Google Drive inventory for the 동김제농협 source folder.
Uses the configured gws CLI only; it does not modify Drive files.
"""
import json
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT_ID = "1rwH0kGjBAQJ5kPalSPX_I9I2xYkCIE61"
OUT = Path("/home/ubuntu/dkj_drive_inventory_all.json")
FIELDS = "files(id,name,mimeType,size,modifiedTime,parents,webViewLink,md5Checksum),nextPageToken"
FOLDER_MIME = "application/vnd.google-apps.folder"


def list_children(parent_id):
    params = {
        "q": f"'{parent_id}' in parents and trashed = false",
        "pageSize": 1000,
        "orderBy": "folder,name_natural",
        "fields": FIELDS,
    }
    proc = subprocess.run(
        ["gws", "drive", "files", "list", "--params", json.dumps(params, ensure_ascii=False), "--format", "json"],
        check=True,
        text=True,
        capture_output=True,
    )
    return json.loads(proc.stdout).get("files", [])


def walk(folder_id, rel_path=""):
    for item in list_children(folder_id):
        name = item.get("name", "")
        item["relativePath"] = f"{rel_path}/{name}" if rel_path else name
        yield item
        if item.get("mimeType") == FOLDER_MIME:
            yield from walk(item["id"], item["relativePath"])


def main():
    try:
        items = list(walk(ROOT_ID))
    except subprocess.CalledProcessError as exc:
        sys.stderr.write(exc.stderr)
        raise
    files = [i for i in items if i.get("mimeType") != FOLDER_MIME]
    folders = [i for i in items if i.get("mimeType") == FOLDER_MIME]
    payload = {
        "rootId": ROOT_ID,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "fileCount": len(files),
            "folderCount": len(folders),
            "mimeTypes": dict(sorted(Counter(i.get("mimeType", "unknown") for i in files).items())),
            "totalBytes": sum(int(i.get("size", 0) or 0) for i in files),
        },
        "items": items,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload["summary"], ensure_ascii=False, indent=2))
    print(f"Inventory written to {OUT}")


if __name__ == "__main__":
    main()
