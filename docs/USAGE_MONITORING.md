# 사용현황 모니터링 — 설계와 운영 절차

## 1. 왜 필요한가

이 시스템은 서버가 없다(`CLAUDE.md` 참고) — Firebase RTDB도 "지금 값"만 들고
있어서, 운영자(관리자)가 "요즘 현장에서 잘 쓰고 있는가"를 판단하려면 그때그때
RTDB를 들여다보는 것 말고는 방법이 없었다. 2026-10-09에 다음 두 가지를 추가해
이 질문에 주기적으로, 추이로 답할 수 있게 했다.

1. **로그인 활동 집계** — `js/dkj-auth.js`의 `login()`이 로컬 계정 로그인에
   성공하면 `lastLoginAt`을 RTDB `system/users/<uid>`에도 올린다(기존에는 이
   값이 이 기기의 localStorage에만 남고 클라우드로 전혀 안 올라갔다).
2. **일일 스냅샷** — GitHub Actions 스케줄 워크플로
   (`.github/workflows/usage-snapshot.yml`)가 매일 23:50(KST)에
   `scripts/snapshot_usage.py`를 돌려, 그날의 로그인 활동(오늘/최근 7일 로그인
   계정 수)과 기록 작성 활동(서식 74종 전체를 훑어 오늘 작성·수정된 기록 수,
   서식별 분포)을 집계해 RTDB에 날짜별로 쌓는다.

운영자는 **사용현황 모니터링**(`usage-dashboard.html`, 시스템 관리자 4343 전용)
화면에서 최근 14일 추이를 본다.

## 2. 데이터는 어디에 쌓이는가 — RTDB 규칙 변경 없음

`records/<nodeKey('dkj:usage-daily:<YYYY-MM-DD>:v1')>` = `{ value: {...}, updatedAt }`

`database.rules.json`의 `records/$recordKey`는 이미 `{value, updatedAt}` 형태면
어떤 키든 읽기·쓰기가 열려 있다(`docs/MISSING_RECORD_ALERT.md`의 알림 상태·운영
달력과 같은 패턴). 그래서 이 기능을 추가하는 데 Firebase 콘솔에서 Rules를
다시 게시할 필요가 전혀 없었다 — 새 경로(`system/usage_*`)를 만들지 않고 기존에
이미 열려 있는 `records` 아래에 날짜별 키로 얹었다.

스냅샷 하나의 모양:

```json
{
  "date": "2026-10-09",
  "generatedAt": "2026-10-09T23:50:12+09:00",
  "logins": { "totalAccounts": 7, "loggedInToday": 5, "loggedInLast7d": 6 },
  "records": { "writtenToday": 42, "formsTouched": 18, "formsTotal": 77, "byForm": { "DKJ-QC-001": 3, "...": 1 } }
}
```

**스키마에 사업장 이름이 전혀 없다.** 의도적이다 — 4절 참고.

## 3. 로그인 집계의 한계

- `lastLoginAt`을 클라우드에 올리는 코드는 2026-10-09에 추가됐다. **그 이전의
  로그인 이력은 없다** — 과거로 거슬러 추이를 만들 수 없다.
- 지금은 "마지막 로그인 시각" 하나만 본다. 하루에 같은 사람이 몇 번
  로그인했는지, 몇 시에 로그인했는지는 모른다 — 그 정도까지 필요해지면
  `system/users/<uid>`를 매번 덮어쓰는 대신 `records/<날짜별 로그인 이벤트 키>`에
  로그인마다 별도 항목을 쌓는 방식으로 확장해야 한다(지금은 과하다고 판단해
  넣지 않았다).
- 챗봇 불편접수 건수는 이번 스냅샷에 넣지 않았다 — 이미 텔레그램 채팅방에
  모든 메시지가 그대로 쌓이고 있어, RTDB에 또 로그를 남기지 않아도 기존 채널로
  충분히 추적된다.
- "미작성 알림이 오늘 몇 건 나갔는가"도 넣지 않았다 — `scripts/notify_missing_records.py`의
  알림 상태(`records/ZGtqOmFsZXJ0czptaXNzaW5nLXJlY29yZHM6djE`)는 재알림
  단계·기록 정리용으로 설계된 구조라 "오늘 보낸 건수"를 안전하게 뽑아내려면
  그 스크립트 쪽 구조를 먼저 손봐야 한다 — 지금은 범위를 좁혀 로그인·기록작성
  두 가지만 다룬다.

## 4. 나중에 사업장이 늘어나면 — 통합 관제 화면

동김제농협은 1호 사업장이고, 다음 농협 사업장을 새로 찍어낼 때는
`docs/NEW_TENANT_HARNESS.md`를 따라 **별도 Firebase 프로젝트 + 별도 저장소**로
뜬다. 즉 사업장이 늘어도 RTDB가 하나로 합쳐지지 않는다 — 사업장 수만큼
`databaseURL`이 따로 존재한다.

그래서 "여러 사업장을 한 화면에서 모니터링"하려면 이 레포 안에 기능을 넣는 게
아니라, **별도의 관제(control tower) 정적 사이트**가 필요하다. 구조는 지금과
같은 서버 없는 방식으로 충분하다:

1. 관제 사이트가 사업장별 `{ name, databaseURL, root }` 목록을 설정값으로 들고
   있는다(이 값 자체도 각 사업장의 공개 배포 파일(`js/dkj-firebase-config.js`)에
   이미 들어 있는 값이라 새로 보호할 비밀이 아니다).
2. 사업장마다 위 2절의 `records/<nodeKey('dkj:usage-daily:...')>` 경로를 그대로
   REST로 GET 한다 — 각 사업장의 규칙이 이미 열려 있으니 인증이 필요 없다.
3. 받아온 스냅샷들을 사업장별 카드로 나열한다.

**이번 작업은 1~2번이 그대로 재사용되도록 스키마를 범용으로 설계해 둔 것까지다.**
관제 사이트 자체(3번)는 아직 만들지 않았다 — 지금 세션은 `gohwansok-max/dkj-fssc22000`
레포 하나만 접근 권한이 있어서, 그 사이트를 둘 새 레포(또는 기존 `smart-haccp-system`)가
정해지면 그때 만든다. 사업장이 실제로 2곳 이상이 되는 시점에 다시 요청하면 된다.

## 5. 테스트·수동 실행

```bash
DRY_RUN=1 python3 scripts/snapshot_usage.py
```

GitHub Actions에서 "사용현황 일일 스냅샷" 워크플로를 **Run workflow**로 수동
실행할 수 있다. 수동 실행 기본값은 `dry_run: true`(콘솔 로그만, RTDB에 안 씀).
실제로 RTDB에 써서 화면에 바로 반영해 보려면 `dry_run`을 `false`로 바꿔 실행한다.
정기 스케줄(cron) 실행은 항상 `dry_run=false`(실제 저장)로 동작한다.
