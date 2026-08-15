#!/usr/bin/env python3
"""동김제농협 RTDB 기록 스키마 V1(서식별 배열) → V2(레코드별 노드) 변환기.

이 도구는 Firebase에 접속하거나 데이터를 변경하지 않는다. Firebase 콘솔에서 내려받은
JSON 백업을 읽어 V2 import 파일과 검증 보고서를 만든다. 실제 import·schemaVersion 변경은
반드시 docs/RTDB_V2_MIGRATION.md 절차와 운영 책임자 확인 후 Firebase 콘솔에서 수행한다.
"""

from __future__ import annotations

import argparse
import base64
import json
import sys
from collections import Counter
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def node_key(value: str) -> str:
    return base64.urlsafe_b64encode(value.encode("utf-8")).decode("ascii").rstrip("=")


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def dump_json(path: Path, data: Any) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2, sort_keys=True)
        handle.write("\n")


def legacy_key_to_form_id(encoded_key: str) -> str:
    try:
        padded = encoded_key.replace("_", "/").replace("-", "+")
        padded += "=" * (-len(padded) % 4)
        local_key = base64.b64decode(padded).decode("utf-8")
    except Exception as exc:  # noqa: BLE001 - 변환 보고서에 원인을 남긴다.
        raise ValueError(f"기존 RTDB 키를 읽을 수 없습니다: {encoded_key}") from exc
    parts = local_key.split(":")
    if len(parts) != 5 or parts[0] != "dkj" or parts[1] != "records" or parts[3] != "list" or parts[4] != "v1":
        raise ValueError(f"예상하지 못한 기존 localStorage 키입니다: {local_key}")
    return parts[2]


def uid_for(emp_id: Any, uid_map: dict[str, str], field: str, problems: list[str]) -> str:
    value = str(emp_id or "").strip()
    if value and value in uid_map:
        return uid_map[value]
    problems.append(f"{field}: 사번 {value or '(없음)'}의 Firebase UID 매핑이 없습니다.")
    return ""


def audit_key(entry: dict[str, Any], index: int) -> str:
    raw = str(entry.get("id") or entry.get("hash") or entry.get("at") or index)
    return node_key("a_" + raw)[:96]


def convert_record(form_id: str, record: dict[str, Any], uid_map: dict[str, str], owner_overrides: dict[str, str], problems: list[str], applied_overrides: list[dict[str, str]]) -> tuple[str, dict[str, Any]]:
    data = deepcopy(record)
    record_id = str(data.get("id") or "").strip()
    if not record_id:
        raise ValueError(f"{form_id}: id 없는 기록이 있어 전환할 수 없습니다.")

    owner_emp_id = str(data.get("createdByEmpId") or "").strip()
    if not owner_emp_id and record_id in owner_overrides:
        owner_emp_id = owner_overrides[record_id]
        data["createdByEmpId"] = owner_emp_id
        applied_overrides.append({"formId": form_id, "recordId": record_id, "empId": owner_emp_id})
    owner_uid = str(data.get("createdByUid") or "").strip()
    if not owner_uid:
        owner_uid = uid_for(owner_emp_id, uid_map, f"{form_id}/{record_id} 최초작성자", problems)
    data["id"] = record_id
    data["formId"] = form_id
    data["createdByUid"] = owner_uid

    audit_rows: dict[str, Any] = {}
    for index, raw in enumerate(data.pop("audit", []) or []):
        if not isinstance(raw, dict):
            problems.append(f"{form_id}/{record_id}: {index + 1}번째 감사이력이 객체가 아닙니다.")
            continue
        entry = deepcopy(raw)
        entry["id"] = str(entry.get("id") or audit_key(entry, index))
        if not entry.get("actorUid"):
            entry["actorUid"] = uid_for(entry.get("byEmpId") or data.get("updatedByEmpId") or data.get("createdByEmpId"), uid_map, f"{form_id}/{record_id} 감사이력 {index + 1}", problems)
        audit_rows[node_key(entry["id"])] = entry

    approval_rows: dict[str, Any] = {}
    for stage, raw in (data.pop("signoff", {}) or {}).items():
        if not isinstance(raw, dict):
            problems.append(f"{form_id}/{record_id}: {stage} 결재 값이 객체가 아닙니다.")
            continue
        sign = deepcopy(raw)
        if not sign.get("uid"):
            sign["uid"] = uid_for(sign.get("empId"), uid_map, f"{form_id}/{record_id} {stage} 결재", problems)
        approval_rows[node_key(str(stage))] = sign

    locked = bool(data.pop("locked", False))
    payload = {
        "data": data,
        "workflow": {
            "createdByUid": owner_uid,
            "createdAt": data.get("createdAt") or "",
            "updatedAt": data.get("updatedAt") or data.get("createdAt") or "",
            "locked": locked,
        },
        "approvals": approval_rows,
        "audit": audit_rows,
    }
    return node_key(record_id), payload


def extract_root(source: dict[str, Any], root_name: str) -> dict[str, Any]:
    if root_name in source and isinstance(source[root_name], dict):
        return source[root_name]
    return source


def main() -> int:
    parser = argparse.ArgumentParser(description="동김제농협 RTDB V1 기록을 V2 레코드 단위 구조로 변환합니다.")
    parser.add_argument("--input", required=True, type=Path, help="Firebase 콘솔에서 내려받은 전체 DB 또는 사업장 루트 JSON")
    parser.add_argument("--uid-map", required=True, type=Path, help="사번→Firebase UID JSON 파일")
    parser.add_argument("--output-dir", required=True, type=Path, help="변환 결과를 저장할 빈 폴더")
    parser.add_argument("--root", default="dkj-fssc22000", help="Firebase 사업장 루트 키")
    parser.add_argument("--allow-unmapped", action="store_true", help="UID 미매핑 기록도 빈 UID로 출력합니다. 실제 import에는 사용하지 마십시오.")
    parser.add_argument("--owner-overrides", type=Path, help="최초작성 사번 누락 기록의 승인된 보정값 JSON. 형식: {\"기록ID\": \"사번\"}")
    args = parser.parse_args()

    source = load_json(args.input)
    if not isinstance(source, dict):
        raise SystemExit("입력 JSON 최상위는 객체여야 합니다.")
    uid_map = load_json(args.uid_map)
    if not isinstance(uid_map, dict) or not all(isinstance(v, str) and v for v in uid_map.values()):
        raise SystemExit("UID 매핑은 {\"사번\": \"Firebase UID\"} 형식의 JSON이어야 합니다.")
    owner_overrides = load_json(args.owner_overrides) if args.owner_overrides else {}
    if not isinstance(owner_overrides, dict) or not all(isinstance(k, str) and isinstance(v, str) and v for k, v in owner_overrides.items()):
        raise SystemExit("소유자 보정값은 {\"기록ID\": \"사번\"} 형식의 JSON이어야 합니다.")
    if args.output_dir.exists() and any(args.output_dir.iterdir()):
        raise SystemExit("출력 폴더는 비어 있어야 합니다.")
    args.output_dir.mkdir(parents=True, exist_ok=True)

    root = extract_root(source, args.root)
    legacy = root.get("records")
    if not isinstance(legacy, dict):
        raise SystemExit("입력 JSON에서 기존 records 노드를 찾지 못했습니다.")

    problems: list[str] = []
    applied_overrides: list[dict[str, str]] = []
    converted: dict[str, Any] = {}
    counts: Counter[str] = Counter()
    for encoded_form, wrapper in legacy.items():
        if not isinstance(wrapper, dict) or not isinstance(wrapper.get("value"), list):
            continue
        form_id = legacy_key_to_form_id(encoded_form)
        target_form = converted.setdefault(node_key(form_id), {})
        for raw_record in wrapper["value"]:
            if not isinstance(raw_record, dict):
                problems.append(f"{form_id}: 객체가 아닌 기록을 건너뛰었습니다.")
                continue
            record_key, payload = convert_record(form_id, raw_record, uid_map, owner_overrides, problems, applied_overrides)
            if record_key in target_form:
                problems.append(f"{form_id}: 중복 기록 ID {raw_record.get('id')}가 있습니다.")
                continue
            target_form[record_key] = payload
            counts[form_id] += 1

    report = {
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "root": args.root,
        "schema": "V1 배열 → V2 레코드 단위",
        "forms": dict(sorted(counts.items())),
        "formCount": len(counts),
        "recordCount": sum(counts.values()),
        "problemCount": len(problems),
        "problems": problems,
        "safeToImport": not problems,
        "appliedOwnerOverrides": applied_overrides,
        "nextStep": "safeToImport가 true일 때만 docs/RTDB_V2_MIGRATION.md 절차에 따라 Firebase 콘솔에서 records_v2 노드로 import하십시오.",
    }
    dump_json(args.output_dir / "records_v2.json", converted)
    dump_json(args.output_dir / "sync_meta_v2.json", {"schemaVersion": 2, "migratedAt": datetime.now(timezone.utc).isoformat()})
    dump_json(args.output_dir / "migration-report.json", report)

    print(f"서식 {report['formCount']}종, 기록 {report['recordCount']}건을 변환했습니다.")
    if problems:
        print(f"경고 {len(problems)}건: migration-report.json을 확인하십시오.", file=sys.stderr)
        return 0 if args.allow_unmapped else 2
    print("UID 매핑 검증을 통과했습니다. 아직 Firebase에는 어떤 변경도 하지 않았습니다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
