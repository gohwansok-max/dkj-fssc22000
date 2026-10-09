#!/usr/bin/env python3
"""사용현황 일일 스냅샷 → RTDB 기록 (GitHub Actions 스케줄 실행 전용).

이 앱은 서버가 없다(CLAUDE.md 참고) — RTDB는 "지금 값"만 들고 있어서, 시간이
지나며 "요즘 잘 쓰고 있는지" 추이를 보려면 매일 그 시점의 값을 따로 떠서 쌓아둬야
한다. 이 스크립트가 그 역할이다: GitHub Actions 스케줄 워크플로
(.github/workflows/usage-snapshot.yml)가 매일 한 번 돌려서, 그날의

- 로그인 활동 — system/users 각 계정의 lastLoginAt(2026-10-09부터 로그인 성공 시
  js/dkj-auth.js 가 클라우드에도 올림, 그 전 기록은 없음) 기준 "오늘 로그인"·
  "최근 7일 로그인" 사용자 수
- 기록 작성 활동 — data/record-catalog.json 의 서식 코드마다 records/<키> 배열을
  읽어 그 날짜의 updatedAt/createdAt 를 가진 레코드 수(서식별 상위 목록 포함)

를 집계해 records/<고정 키 prefix>:<날짜> 에 저장한다.

RTDB 규칙은 전혀 고치지 않는다 — records/$recordKey 는 {value, updatedAt} 형태면
어떤 키든 이미 쓰기가 열려 있다(scripts/notify_missing_records.py의 운영달력·알림
상태 저장과 같은 패턴). 그래서 Firebase 콘솔 Rules 재게시가 필요 없다.

스키마는 사업장 이름을 전혀 담지 않는다(활성 사용자 수·작성 건수 같은 범용 키뿐).
나중에 다른 농협 사업장(별도 Firebase 프로젝트)이 늘어도 같은 스크립트·같은 키
구조를 그대로 복제해 쓸 수 있게 하기 위해서다 — docs/USAGE_MONITORING.md 참고.
"""
from __future__ import annotations

import base64
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RECORD_CATALOG_PATH = REPO_ROOT / 'data' / 'record-catalog.json'

DB_URL = 'https://dkj-fssc22000-default-rtdb.asia-southeast1.firebasedatabase.app'
ROOT = 'dkj-fssc22000'
KST = timezone(timedelta(hours=9))

DRY_RUN = os.environ.get('DRY_RUN', '').strip().lower() in ('1', 'true', 'yes')


def node_key(value: str) -> str:
    """js/dkj-cloud-sync.js 의 nodeKey()와 동일한 base64url 인코딩."""
    return base64.urlsafe_b64encode(value.encode('utf-8')).decode('ascii').rstrip('=')


def rtdb_get(path: str):
    url = f'{DB_URL}/{ROOT}/{path}.json'
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            body = resp.read().decode('utf-8')
    except urllib.error.URLError as e:
        raise RuntimeError(f'RTDB 조회 실패({path}): {e}') from e
    return json.loads(body) if body and body != 'null' else None


def rtdb_put(path: str, value) -> None:
    if DRY_RUN:
        print(f'[dry-run] PUT {path} <- {json.dumps(value, ensure_ascii=False)[:400]}')
        return
    url = f'{DB_URL}/{ROOT}/{path}.json'
    payload = json.dumps(value).encode('utf-8')
    req = urllib.request.Request(url, data=payload, method='PUT', headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=15) as resp:
        resp.read()


def parse_iso(value) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        v = value.replace('Z', '+00:00')
        dt = datetime.fromisoformat(v)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(KST)
    except ValueError:
        return None


def login_stats(today: date) -> dict:
    users = rtdb_get('system/users') or {}
    if not isinstance(users, dict):
        users = {}
    total = 0
    today_count = 0
    last7_count = 0
    for _uid, item in users.items():
        if not isinstance(item, dict):
            continue
        total += 1
        last = parse_iso(item.get('lastLoginAt'))
        if not last:
            continue
        d = last.date()
        if d == today:
            today_count += 1
        if (today - d).days < 7:
            last7_count += 1
    return {'totalAccounts': total, 'loggedInToday': today_count, 'loggedInLast7d': last7_count}


def record_stats(today: date) -> dict:
    try:
        catalog = json.loads(RECORD_CATALOG_PATH.read_text(encoding='utf-8'))
    except Exception as e:
        print(f'record-catalog.json 로드 실패: {e}', file=sys.stderr)
        return {'writtenToday': 0, 'byForm': {}, 'formsTouched': 0, 'formsTotal': 0}

    codes = [r.get('code') for r in catalog.get('records', []) if r.get('code')]
    by_form = {}
    written_today = 0
    for code in codes:
        local_key = f'dkj:records:{code}:list:v1'
        try:
            data = rtdb_get(f'records/{node_key(local_key)}')
        except Exception as e:
            print(f'{code} 조회 실패(건너뜀): {e}', file=sys.stderr)
            continue
        value = (data or {}).get('value') if isinstance(data, dict) else None
        if not isinstance(value, list):
            continue
        count = 0
        for rec in value:
            if not isinstance(rec, dict) or rec.get('deleted'):
                continue
            stamp = parse_iso(rec.get('updatedAt')) or parse_iso(rec.get('createdAt'))
            if stamp and stamp.date() == today:
                count += 1
        if count:
            by_form[code] = count
            written_today += count

    return {
        'writtenToday': written_today,
        'byForm': by_form,
        'formsTouched': len(by_form),
        'formsTotal': len(codes)
    }


def main() -> int:
    now_kst = datetime.now(KST)
    today = now_kst.date()
    today_iso = today.isoformat()

    logins = login_stats(today)
    records = record_stats(today)

    snapshot = {
        'date': today_iso,
        'generatedAt': now_kst.isoformat(),
        'logins': logins,
        'records': records
    }

    print(json.dumps(snapshot, ensure_ascii=False, indent=2))

    key = node_key(f'dkj:usage-daily:{today_iso}:v1')
    rtdb_put(f'records/{key}', {
        'value': snapshot,
        'updatedAt': int(datetime.now(timezone.utc).timestamp() * 1000)
    })
    return 0


if __name__ == '__main__':
    sys.exit(main())
