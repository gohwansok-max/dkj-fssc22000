#!/usr/bin/env python3
"""일지 미작성 감시 → 텔레그램 알림 (GitHub Actions 스케줄 실행 전용).

이 앱은 서버가 없다(CLAUDE.md 참고) — 그래서 "화면을 아무도 안 열어놔도 카톡이
가게" 하려면 바깥에서 주기적으로 찔러주는 무언가가 필요하다. 이 스크립트가 그
역할이다: GitHub Actions 스케줄 워크플로(.github/workflows/missing-record-alert.yml)가
이 스크립트를 주기적으로 돌려서, RTDB를 REST로 직접 읽어(이미 database.rules.json이
열어둔 경로만 사용 — 규칙 변경·재게시 불필요) 마감이 지났는데도 안 써진 일지를
찾아 기존 불편접수용 텔레그램 봇/챗으로 알림을 보낸다.

판정 로직은 js/dkj-console.js 의 evaluate()를 최대한 그대로 옮긴 것이다 — 화면에
뜨는 "오늘 미작성"과 이 알림이 다른 기준으로 판정되면 안 되기 때문이다. 다만
draft(임시저장)는 이 기기 로컬에만 있고 클라우드에 없으므로, 여기서는 항상
"저장됨/안 됨"만 본다(작성 중 상태는 없음) — 알림 목적에는 오히려 더 정확하다.

감시 대상은 console-forms.json의 daily/weekly 그룹뿐이다. daily 그룹은 check.mode가
무엇이든(perDay/dayColumn/dayRow) 오늘 15시를 마감으로 본다(퇴근 16시 전 마지막
확인 기회). weekly 그룹은 perPeriod(주/월)만 다룬다 — dayColumn/dayRow가 "주 1회를
어느 요일에나 채우면 되는지" 같은
실제 운영 의도가 코드만 봐서는 불명확해서, 잘못 판정해 헛알림을 보내는 것보다
아예 건너뛰는 쪽을 택했다(대상: DKJ-S-02-13 저수조 관리, DKJ-S-02-09 세척소독제
관리 — 실제 운영 주기를 확인하면 추가할 것).

알림 상태(오늘 몇 번째 알림을 보냈는지)는 records/<고정키> 에 저장한다. 이건
dkj-console.js의 공유 운영달력(records/ZGtqOm9wZXJhdGlvbi1jYWxlbmRhcjpzaGFyZWQ6djE)과
같은 패턴이다 — records/$recordKey 는 {value, updatedAt} 형태면 어떤 키든 쓰기가
이미 열려 있어서, database.rules.json을 고치고 Firebase 콘솔에서 재게시할 필요가
없다.
"""
from __future__ import annotations

import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from calendar import monthrange
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CONSOLE_FORMS_PATH = REPO_ROOT / 'data' / 'console-forms.json'

DB_URL = 'https://dkj-fssc22000-default-rtdb.asia-southeast1.firebasedatabase.app'
ROOT = 'dkj-fssc22000'
SITE_BASE = 'https://dkj.qaplus.kr/'
KST = timezone(timedelta(hours=9))

# nodeKey('dkj:operation-calendar:shared:v1') — js/dkj-console.js의 상수와 동일.
OPERATION_CALENDAR_KEY = 'ZGtqOm9wZXJhdGlvbi1jYWxlbmRhcjpzaGFyZWQ6djE'
# nodeKey('dkj:alerts:missing-records:v1') — 이 스크립트 전용 알림 상태 저장 위치.
ALERT_STATE_KEY = 'ZGtqOmFsZXJ0czptaXNzaW5nLXJlY29yZHM6djE'

DEADLINE_HOUR = 15  # 매일/주간·월간 서식 공통 마감 시각(KST) — 농협 퇴근(16시) 전 마지막 확인 기회
ESCALATE_HOURS_DAILY = 2   # 매일 서식: 마감 후 2시간마다 재알림
ESCALATE_HOURS_PERIOD = 24  # 주간/월간 서식: 마감 후 24시간마다 재알림
MAX_ALERTS_DAILY = 4
MAX_ALERTS_PERIOD = 3

DRY_RUN = os.environ.get('DRY_RUN', '').strip().lower() in ('1', 'true', 'yes')
# 마감·미작성 여부와 무관하게 텔레그램 발송 경로만 즉시 확인하고 싶을 때 쓰는 스위치.
TEST_SEND = os.environ.get('TEST_SEND', '').strip().lower() in ('1', 'true', 'yes')


def node_key(value: str) -> str:
    """js/dkj-cloud-sync.js 의 nodeKey()와 동일한 base64url 인코딩."""
    return base64.urlsafe_b64encode(value.encode('utf-8')).decode('ascii').rstrip('=')


def esc(value) -> str:
    return str(value if value is not None else '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def rtdb_get(path: str):
    url = f'{DB_URL}/{ROOT}/{path}.json'
    with urllib.request.urlopen(url, timeout=15) as resp:
        body = resp.read().decode('utf-8')
    return json.loads(body) if body and body != 'null' else None


def rtdb_put(path: str, value) -> None:
    if DRY_RUN:
        print(f'[dry-run] PUT {path} <- {json.dumps(value, ensure_ascii=False)[:200]}')
        return
    url = f'{DB_URL}/{ROOT}/{path}.json'
    payload = json.dumps(value).encode('utf-8')
    req = urllib.request.Request(url, data=payload, method='PUT', headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=15) as resp:
        resp.read()


def send_telegram(bot_token: str, chat_id: str, text: str) -> None:
    if DRY_RUN:
        print('[dry-run] 텔레그램 발송 내용:\n' + text + '\n')
        return
    url = f'https://api.telegram.org/bot{urllib.parse.quote(bot_token)}/sendMessage'
    payload = json.dumps({
        'chat_id': chat_id,
        'text': text,
        'parse_mode': 'HTML',
        'disable_web_page_preview': True
    }).encode('utf-8')
    req = urllib.request.Request(url, data=payload, method='POST', headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=15) as resp:
        body = json.loads(resp.read().decode('utf-8'))
    if not body.get('ok'):
        raise RuntimeError(f'텔레그램 전송 실패: {body}')


def load_operation_calendar() -> dict:
    default = {'workdays': [1, 2, 3, 4, 5], 'nonProductionDates': [], 'productionDates': []}
    try:
        console = json.loads(CONSOLE_FORMS_PATH.read_text(encoding='utf-8'))
        default.update(console.get('operationCalendar') or {})
    except Exception:
        pass
    try:
        remote = rtdb_get(f'records/{OPERATION_CALENDAR_KEY}')
    except Exception as e:
        print(f'운영달력 원격 조회 실패(기본값 사용): {e}', file=sys.stderr)
        remote = None
    if isinstance(remote, dict):
        cal = (remote.get('value') or {}).get('calendar')
        if isinstance(cal, dict) and cal.get('workdays'):
            return {
                'workdays': cal.get('workdays') or default['workdays'],
                'nonProductionDates': cal.get('nonProductionDates') or [],
                'productionDates': cal.get('productionDates') or []
            }
    return default


def is_production_day(d: date, calendar: dict) -> bool:
    iso = d.isoformat()
    if iso in (calendar.get('productionDates') or []):
        return True
    if iso in (calendar.get('nonProductionDates') or []):
        return False
    js_dow = (d.weekday() + 1) % 7  # Python Mon=0..Sun=6 -> JS Sun=0..Sat=6
    return js_dow in (calendar.get('workdays') or [1, 2, 3, 4, 5])


def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def read_record_list(code: str) -> list:
    local_key = f'dkj:records:{code}:list:v1'
    try:
        data = rtdb_get(f'records/{node_key(local_key)}')
    except Exception as e:
        raise RuntimeError(f'{code} 기록 조회 실패: {e}') from e
    if isinstance(data, dict):
        value = data.get('value')
        if isinstance(value, list):
            return [r for r in value if isinstance(r, dict) and not r.get('deleted')]
    return []


def field_value(rec: dict, field: str):
    info = rec.get('info') if isinstance(rec.get('info'), dict) else None
    if info is not None and info.get(field):
        return info.get(field)
    return rec.get(field)


def parse_date(value) -> date | None:
    try:
        return datetime.strptime(str(value)[:10], '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return None


def per_day_done(recs: list, date_field: str, target_iso: str) -> bool:
    return any(field_value(r, date_field) == target_iso for r in recs)


def per_period_done(recs: list, date_field: str, *, monday: date | None = None, month_of: date | None = None) -> bool:
    for r in recs:
        d = parse_date(field_value(r, date_field))
        if not d:
            continue
        if monday is not None and d >= monday:
            return True
        if month_of is not None and d.year == month_of.year and d.month == month_of.month:
            return True
    return False


def day_column_done(recs: list, target_iso: str) -> bool:
    for r in recs:
        days = r.get('days')
        checks = r.get('checks')
        if not isinstance(days, list) or not isinstance(checks, dict) or not checks:
            continue
        if target_iso not in days:
            continue
        idx = days.index(target_iso)
        keys = list(checks.keys())
        filled = sum(1 for k in keys if idx < len(checks.get(k) or []) and (checks[k] or [])[idx])
        if filled == len(keys) and keys:
            return True
    return False


def day_row_done(recs: list, day_num: int, day_key: str = 'day') -> bool:
    """js/dkj-console.js 의 evaluate() dayRow 분기와 정확히 같은 기준을 쓴다 —
    그 행의 칸 중 **하나라도** 값이 있으면 '오늘 행 입력됨'(done)이다. 예전엔
    '행의 모든 칸이 채워져야 done'으로 더 엄격하게 짰는데, 그게 실제로 오늘
    기록한 서식을 미작성으로 잘못 알리는 원인이었다(2026-09-09).

    원인은 두 가지가 겹친다.
      1) 이 대장들의 행은 손댄 칸만 키로 남는다(`js/dkj-ledger-form.js`) — 안 쓴
         구역은 애초에 키가 없다. 그래서 '모든 칸' 기준이라도 사람이 실제로
         쓴 칸끼리는 항상 다 채워진 것처럼 보이기 쉬운데, 문제는 다음이다.
      2) DKJ-S-02-09(세척 소독제 관리대장)의 이어지는 재고 자동계산
         (`runningStock`)은 시트 안 아무 칸이나 한 번만 고쳐도 그 달 전체
         행에 계산 칸(prev/now)을 채워 넣는다 — 그 제품을 이번 달에 한 번도
         안 썼으면 그 칸은 빈 문자열로 채워진다. 그러면 오늘 행에 실제로
         적은 제품(예: 2종)은 다 채워졌는데도, 안 쓴 다른 제품의 계산 칸이
         빈 채로 같이 끼어들어 '모든 칸'을 못 채운 것처럼 보였다.

    화면(dkj-console.js)은 애초에 이런 자동계산 칸까지 다 채우라고 요구하지
    않는다 — 그 행에 뭐라도 적혀 있으면 오늘 쓴 것으로 본다. 알림도 같아야
    한다. """
    for r in recs:
        rows = r.get('rows')
        if not isinstance(rows, list):
            continue
        for row in rows:
            digits = ''.join(ch for ch in str(row.get(day_key, '')) if ch.isdigit())
            if not digits or int(digits) != day_num:
                continue
            values = [k for k in row.keys() if k not in (day_key, 'dow')]
            if any(str(row.get(k, '')).strip() for k in values):
                return True
    return False


def evaluate_form(form: dict, group_id: str, now: datetime, calendar: dict):
    """반환: None(감시 대상 아님) 또는
    {done, deadline, period_key, unit, escalate_hours, max_alerts}"""
    check = form.get('check') or {}
    mode = check.get('mode', 'event')
    today = now.date()

    if group_id == 'daily':
        if not is_production_day(today, calendar):
            return None
        deadline = datetime.combine(today, time(DEADLINE_HOUR, 0), tzinfo=KST)
        target_iso = today.isoformat()
        common = {'deadline': deadline, 'period_key': target_iso, 'unit': '오늘',
                  'escalate_hours': ESCALATE_HOURS_DAILY, 'max_alerts': MAX_ALERTS_DAILY}
        if mode == 'perDay':
            recs = read_record_list(form['code'])
            done = per_day_done(recs, check.get('dateField', 'checkDate'), target_iso)
            return {**common, 'done': done}
        if mode == 'dayColumn':
            recs = read_record_list(form['code'])
            return {**common, 'done': day_column_done(recs, target_iso)}
        if mode == 'dayRow':
            recs = read_record_list(form['code'])
            return {**common, 'done': day_row_done(recs, today.day, check.get('dayKey', 'day'))}
        return None  # event 등은 미작성 알림 대상 아님

    if group_id == 'weekly':
        if mode != 'perPeriod':
            return None  # dayColumn/dayRow는 실제 운영 주기가 불명확해 이번엔 건너뜀
        period = check.get('period', 'week')
        date_field = check.get('dateField', 'checkDate')
        if period == 'month':
            last_day = monthrange(today.year, today.month)[1]
            if today.day != last_day:
                return None  # 이번 달 마지막 날이 아니면 아직 판단하지 않는다
            deadline = datetime.combine(today, time(DEADLINE_HOUR, 0), tzinfo=KST)
            recs = read_record_list(form['code'])
            done = per_period_done(recs, date_field, month_of=today)
            return {'done': done, 'deadline': deadline, 'period_key': today.strftime('%Y-%m'),
                    'unit': '이번 달', 'escalate_hours': ESCALATE_HOURS_PERIOD, 'max_alerts': MAX_ALERTS_PERIOD}
        # period == 'week'
        if today.weekday() < 4:  # 월~목(0~3)은 아직 이번 주 마감 전
            return None
        monday = monday_of(today)
        friday = monday + timedelta(days=4)
        deadline = datetime.combine(friday, time(DEADLINE_HOUR, 0), tzinfo=KST)
        recs = read_record_list(form['code'])
        done = per_period_done(recs, date_field, monday=monday)
        return {'done': done, 'deadline': deadline, 'period_key': monday.isoformat(),
                'unit': '이번 주', 'escalate_hours': ESCALATE_HOURS_PERIOD, 'max_alerts': MAX_ALERTS_PERIOD}

    return None


def severity(desired: int, max_alerts: int) -> tuple[str, str]:
    if desired >= max_alerts:
        return '🚨🚨', '긴급 — 즉시 확인 필요'
    if desired >= 3:
        return '🚨', '경고 — 반복 미작성'
    if desired >= 2:
        return '⚠️', '재알림'
    return '⏰', '작성 안내'


# 심각도 아이콘의 상대적 순위 — 배치 메시지 헤더에 "가장 급한 것" 아이콘을 쓰기 위함.
SEVERITY_RANK = {'⏰': 0, '⚠️': 1, '🚨': 2, '🚨🚨': 3}


def worst_severity(overdue_items: list) -> tuple[str, str]:
    worst_icon, worst_tag, worst_rank = '⏰', '작성 안내', -1
    for item in overdue_items:
        icon, tag = severity(item['desired'], item['result']['max_alerts'])
        rank = SEVERITY_RANK.get(icon, 0)
        if rank > worst_rank:
            worst_icon, worst_tag, worst_rank = icon, tag, rank
    return worst_icon, worst_tag


def build_batch_message(overdue_items: list, resolved_items: list) -> str:
    """이번 실행에서 새로 알릴 게 있는 모든 서식을 한 메시지로 묶는다 — 서식마다
    따로 보내면 한 번에 여러 건이 겹칠 때 톡방에 메시지가 줄줄이 쌓이기 때문."""
    lines = []
    if overdue_items:
        icon, tag = worst_severity(overdue_items)
        lines.append(f'{icon} <b>[동김제농협 스마트 HACCP] 일지 미작성 알림 — {len(overdue_items)}건 · {esc(tag)}</b>')
        lines.append('━━━━━━━━━━━━━━━━━━━━')
        for item in overdue_items:
            form, result = item['form'], item['result']
            i_icon, _ = severity(item['desired'], result['max_alerts'])
            href = SITE_BASE + str(form.get('href', '')).lstrip('/')
            lines.append(
                f'{i_icon} <b>{esc(form["code"])}</b> {esc(form["title"])} · '
                f'{result["unit"]} 마감({result["deadline"].strftime("%H:%M")}) 후 약 '
                f'{int(item["hours_over"])}시간 · {item["desired"]}번째'
            )
            lines.append(f'   {esc(href)}')
    if resolved_items:
        if lines:
            lines.append('━━━━━━━━━━━━━━━━━━━━')
        lines.append(f'✅ <b>[동김제농협 스마트 HACCP] 작성 확인됨 — {len(resolved_items)}건</b>')
        for item in resolved_items:
            form, result = item['form'], item['result']
            lines.append(f'· {esc(form["code"])} {esc(form["title"])} ({result["unit"]} 몫)')
    lines.append('━━━━━━━━━━━━━━━━━━━━')
    lines.append('담당자가 각자 작성했는지 확인해 주세요.')
    return '\n'.join(lines)


def load_alert_state() -> dict:
    try:
        data = rtdb_get(f'records/{ALERT_STATE_KEY}')
    except Exception as e:
        print(f'알림 상태 조회 실패(빈 상태로 시작): {e}', file=sys.stderr)
        return {}
    if isinstance(data, dict) and isinstance(data.get('value'), dict):
        return data['value']
    return {}


def save_alert_state(state: dict, now: datetime) -> None:
    # 40일 넘은 항목은 정리한다(무한정 커지지 않게) — 형식을 모르는 키는 안전하게 남긴다.
    cutoff = (now - timedelta(days=40)).date()
    pruned = {}
    for key, entry in state.items():
        if key == '_meta':
            continue
        period_key = key.split('|', 1)[0]
        d = parse_date(period_key) or parse_date(period_key + '-01')
        if d and d < cutoff:
            continue
        pruned[key] = entry
    # RTDB는 빈 객체를 저장하려 하면 그 속성을 통째로 지운다(harness PART 2-B와
    # 같은 함정) — 알림 이력이 하나도 없는 첫 실행에서 pruned가 {}가 되면
    # database.rules.json의 ".validate"(value 필드 존재 요구)를 못 만족해 PUT이
    # 401로 거부된다. _meta를 항상 넣어서 value가 절대 빈 객체가 되지 않게 한다.
    pruned['_meta'] = {'lastRunAt': now.isoformat()}
    rtdb_put(f'records/{ALERT_STATE_KEY}', {
        'value': pruned,
        'updatedAt': int(datetime.now(timezone.utc).timestamp() * 1000)
    })


def main(now: datetime | None = None) -> int:
    now = now or datetime.now(KST)
    console = json.loads(CONSOLE_FORMS_PATH.read_text(encoding='utf-8'))
    calendar = load_operation_calendar()

    try:
        tg = rtdb_get('system/settings/telegram') or {}
    except Exception as e:
        print(f'텔레그램 설정 조회 실패, 이번 실행은 건너뜁니다: {e}', file=sys.stderr)
        return 1
    bot_token = str(tg.get('botToken') or '').strip()
    chat_id = str(tg.get('chatId') or '').strip()
    if tg.get('enabled') is False or not bot_token or not chat_id:
        print('텔레그램 설정이 없거나 꺼져 있어 알림을 보내지 않습니다.')
        return 0

    if TEST_SEND:
        # 마감·미작성 여부·상태 저장을 전부 건너뛰고 텔레그램 발송 경로만 확인한다.
        # dry_run 체크와 무관하게 실제로 보낸다(연결 확인이 목적이라 dry-run이면 의미가 없다).
        global DRY_RUN
        was_dry_run = DRY_RUN
        DRY_RUN = False
        try:
            send_telegram(bot_token, chat_id, '\n'.join([
                '🔧 <b>[동김제농협 스마트 HACCP] 일지 미작성 알림 — 연결 테스트</b>',
                '━━━━━━━━━━━━━━━━━━━━',
                f'실행 시각: {now.strftime("%Y-%m-%d %H:%M")} (KST)',
                '이 메시지가 보이면 텔레그램 발송 경로가 정상 동작하는 것입니다.',
                '(실제 미작성 판정과는 무관한 테스트 메시지입니다.)',
                '━━━━━━━━━━━━━━━━━━━━'
            ]))
        finally:
            DRY_RUN = was_dry_run
        print('테스트 메시지 발송 완료')
        return 0

    state = load_alert_state()
    overdue_items = []
    resolved_items = []

    for group in console.get('groups', []):
        if group.get('id') not in ('daily', 'weekly'):
            continue
        for form in group.get('forms', []):
            try:
                result = evaluate_form(form, group['id'], now, calendar)
            except Exception as e:
                print(f'{form.get("code")} 평가 중 오류, 건너뜀: {e}', file=sys.stderr)
                continue
            if result is None:
                continue

            key = result['period_key'] + '|' + form['code']
            entry = state.get(key) or {'count': 0, 'resolvedNotified': False}

            if result['done']:
                if entry.get('count', 0) > 0 and not entry.get('resolvedNotified'):
                    resolved_items.append({'form': form, 'result': result})
                    entry['resolvedNotified'] = True
                    state[key] = entry
                continue

            if now < result['deadline']:
                continue

            hours_over = (now - result['deadline']).total_seconds() / 3600
            desired = min(1 + int(hours_over // result['escalate_hours']), result['max_alerts'])
            if entry.get('count', 0) < desired:
                overdue_items.append({'form': form, 'result': result, 'desired': desired, 'hours_over': hours_over})
                entry['count'] = desired
                entry['lastNotifiedAt'] = now.isoformat()
                entry['resolvedNotified'] = False
                state[key] = entry

    # 서식마다 따로 보내지 않고, 이번 실행에서 새로 알릴 게 있으면 전부 모아 한 번에 보낸다.
    if overdue_items or resolved_items:
        send_telegram(bot_token, chat_id, build_batch_message(overdue_items, resolved_items))

    save_alert_state(state, now)
    print(
        f'{len(overdue_items)}건 미작성 알림 · {len(resolved_items)}건 해소 알림 '
        f'(메시지 {1 if (overdue_items or resolved_items) else 0}건 발송), 상태 {len(state)}건 저장'
        + (' (dry-run)' if DRY_RUN else '')
    )
    return 0


if __name__ == '__main__':
    sys.exit(main())
