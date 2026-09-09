# CLAUDE.md

이 파일은 Claude Code(claude.ai/code)가 이 저장소에서 작업할 때 참고하는 안내입니다.

## 이 저장소가 무엇인가

동김제농협 산지유통센터의 스마트 HACCP / FSSC22000 V6 시스템 — 현장 태블릿과 PC에서
쓰는 사내 웹앱입니다. 기록양식 작성·전자결재·문서 열람·기록 보관을 다룹니다.

**프레임워크·번들러·패키지 매니저가 없습니다.** 순수 HTML/CSS/JS 파일을 정적으로
서빙하거나 브라우저에서 직접 엽니다. **서버가 전혀 없습니다** — 모든 것이 브라우저에서
돌고 `localStorage` 에 저장되며, Firebase RTDB 로 기기 간 동기화합니다.
**테스트·린터·빌드 단계가 없습니다** — 검증은 브라우저에서 직접 열어 확인합니다.

이 저장소는 코엔에프 스마트 HACCP 시스템(`smart-haccp-system`)을 템플릿으로 fork 한
1호 사업장입니다. 그래서 옛 경로(`tenants/dkj/...`)나 코엔에프 흔적이 가끔 남아 있는데,
발견하면 이 저장소 기준으로 고치세요.

**단, 지금은 관계가 뒤집혔습니다(2026-09-04).** `smart-haccp-system`은 이후 별도로
발전이 멈춘 단순 문서 포털(로그인·서식엔진·클라우드 동기화 없음)로 남았고, 이
저장소가 서식 74종·5개 엔진·Firebase 동기화·계정 체계까지 갖추며 훨씬 앞서
발전했습니다. **다음 농협 사업장을 새로 찍어낼 때 실제 베이스는 `smart-haccp-system`이
아니라 지금의 이 저장소입니다.** 새 사업장을 만들자는 요청("OO농협꺼 만들자" 등)이
오면 `.claude/skills/new-tenant-scaffold/SKILL.md`와 `docs/NEW_TENANT_HARNESS.md`를
먼저 확인하세요 — 특히 하네스 문서에는 동김제 배포 중 실제로 며칠씩 걸렸던 버그들
(RTDB 스키마 버전 방치, 빈 배열 프루닝, 삭제-병합 충돌, 서비스워커 캐시, 로그인
레이스 등)과 다음 사업장에서 반드시 확인해야 할 배포 전 체크리스트가 정리돼 있습니다.

**저장소는 비공개입니다.** `js/dkj-firebase-config.js` 에 실제 Firebase 자격증명이 들어
있고 `data/` 에는 사업장 문서 정보가 있습니다. 공개 전환을 제안하지 마세요.

## 작업 폴더는 D 드라이브 클론입니다

`D:\Github\dkj-fssc22000` 에서 작업하고 커밋합니다. Google Drive 안의
`smart-haccp-system-main` 은 코엔에프(원본 템플릿) 폴더로 별개이고, Drive 쪽 dkj 사본이
있더라도 2026-07 에 멈춘 옛것이라 쓰지 않습니다.

배포는 `main` 에 push 하면 끝입니다 — `.github/workflows/deploy-pages.yml` 이 GitHub
Pages 로 올립니다. 로컬에서 돌릴 배포 스크립트는 없습니다.

```
https://gohwansok-max.github.io/dkj-fssc22000/
```

## 실행

```bash
# 정적 서버 (아무 정적 서버나 됨)
python -m http.server 5500
# → http://localhost:5500/index.html  (업무 콘솔이 홈)
```

`file://` 로 HTML 을 직접 열어도 대부분 동작합니다(카탈로그를 JSON fetch 가 아니라
`js/*.bundle.js` 로 읽는 이유가 이것입니다). 다만 서비스워커는 `http://` 에서만 붙습니다.

데이터 갱신 스크립트는 전부 **저장소 루트에서** 실행합니다:

```bash
python scripts/build-catalog-bundles.py   # data/*.json → js/*.bundle.js  (JSON 고쳤으면 필수)
python scripts/build-sw-precache.py       # sw-precache.js 재생성 (배포 때 자동으로도 돌아감)
python scripts/build-ledger-forms.py      # data/ledger-form-specs/*.json → records/<코드>.html + js/<코드>.js
python scripts/build-form-shells.py       # matrix·ox·report 사양 → records/<코드>.html + js/<코드>.js
python scripts/gen-fr-forms.py            # FR 서식 45종의 HTML·부트JS·사양·인쇄템플릿 일괄 생성
python scripts/sync-fssc-catalog.py       # 원본 문서 → doc-catalog / menu-catalog
powershell -ExecutionPolicy Bypass -File scripts\sync-dkj-assets.ps1 -PdfOnly   # 절차서 PDF 생성 (Word 필요)
```

`gen-fr-forms.py` 는 파일 안의 `SPECS` 가 정본이고, FR 서식 45종을 통째로 다시 씁니다.
템플릿이 옛 버전(로그인·전자결재·PWA 누락)에 멈춰 있던 것을 2026-09-08 에 배포본 기준으로
되살렸고, 지금은 실행해도 기존 파일과 바이트 단위로 같게 나옵니다. **FR 서식을 손으로
고쳤다면 이 스크립트의 `SPECS` 에도 같이 반영해야** 다음 실행 때 되돌아가지 않습니다.
실행 후 `git status` 로 의도한 파일만 바뀌었는지 확인하세요.

`build-ledger-forms.py`(대장)와 `build-form-shells.py`(matrix·ox·report)는 반대로
**JSON 이 정본**입니다 — `data/<엔진>-form-specs/<코드>.json` 을 고치고 이걸 돌리면
`records/<코드>.html` 과 `js/<코드>.js` 가 다시 만들어집니다. 둘 다 `--check` 를 붙이면
파일을 쓰지 않고 사양과 어긋난 파일만 알려줍니다(어긋나면 종료코드 1).
화면 껍데기에 필요한 것도 전부 사양에서 읽으니, **이 네 엔진의 서식은 HTML 을 직접
손대지 말고 사양만 고치세요.**

| 엔진 | 스크립트 | 화면 관련 사양 키 |
|---|---|---|
| ledger | `build-ledger-forms.py` | `cat` `defaultRows` `incident` `pageClass` `bulkChoice` |
| matrix | `build-form-shells.py` | `screen{newLabel,periodLabel,startLabel,sectionTitle,fillAria,fillText,hint}` `headerLinks` `footerLinks` |
| ox | `build-form-shells.py` | `fields` `sectionOxTitle` `customBoot` `headerLinks` `footerLinks` |
| report | `build-form-shells.py` | 제목·부제 외 변형 없음 |

`build-form-shells.py` 는 `js/DKJ-STORE-01.js` 만 생성하지 않습니다 — FR-014 입고 연계
파라미터를 읽는 손으로 쓴 코드가 `mount()` 앞뒤에 붙어 있어서, 생성하면 그게 날아갑니다.
(HTML 은 생성 대상입니다.) `screen`·`headerLinks`·`footerLinks` 는 화면 전용이라 부트
스크립트에는 실리지 않습니다.

`scripts/gen-ox-forms.py` 는 2026-09-08 에 삭제했습니다 — 관리하던 12종 중 7종이 이후
matrix·ledger 엔진으로 이관돼, 실행하면 현장 서식을 옛 O/X 버전으로 덮어썼습니다.
같은 코드 목록을 건드리는 `scripts/batch-official-print.py` 도 1회성 스크립트라 다시
돌리면 안 됩니다(파일 상단 경고 참고). 살아있는 ox 서식 5종은 위 `build-form-shells.py`
가 사양 JSON 에서 생성합니다.

## 화면 구성

| 화면 | 파일 | 하는 일 |
|---|---|---|
| 업무 콘솔(홈) | `index.html` | 오늘 써야 할 기록을 주기별로 모아 보여줌 |
| 기록양식 | `records-center.html` → `records/<코드>.html` | 서식 74종 작성·저장·정본 인쇄 |
| 기록보관함 | `records-archive.html` | 저장된 기록 통합 조회 + 엑셀/CSV/PDF 내보내기 + 백업·복원 |
| 문서센터 | `docs-center.html` → `doc-viewer.html` | 매뉴얼·절차서 열람 |
| 문서관리대장 | `mdr-register.html` | MDR-001 등록대장 |
| 정본 문서 열람실 | `official-documents.html` | Google Drive 원본·PDF 259건 검색·열람·인쇄 (문서센터와 별개 경로) |
| 시스템 설정 | `system-settings.html` | 시스템 관리자(사번 4343) 전용 — 로그인한 사용자 역할 배정 |
| 종합 품질 대시보드 | `quality-dashboard.html` | CAPA 기한초과·모의회수 목표미달·추적성 후속확인 실시간 경보 |
| 이탈·시정조치(CAPA) 관리 | `capa-management.html` | CCP 이탈·부적합의 CAPA 등록·진행·종결 |
| 추적성 검증·모의회수 | `traceability.html` | 모의회수 훈련 기록, 2시간 목표·수량대조 |
| 경영검토·식품안전문화 | `management-culture.html` | 경영검토 회의록, 식품안전문화 활동 |
| FSSC 추가요건 심사준비 | `fssc-audit-readiness.html` | FSSC22000 4대 영역 요구사항 체크 |
| HACCP팀 위험·환경 설정 | `haccp-team-settings.html` | HACCP팀 구성, 위해요소·환경 기준 설정 |
| 회사소개서 | `company-profile.html` | 대외 제안용 회사소개서 |

새 화면들은 2026-08-16에 마누스(다른 AI 에이전트)가 PR #26~#35로 main에 직접 merge했습니다.
각 화면의 배경·운영 절차는 `docs/*.md`(특히 `RTDB_V2_MIGRATION.md`, `ENTRY_LOGIN_AND_ROLE_SETUP.md`,
`QUALITY_ALERT_AUTOMATION.md`, `GOOGLE_DRIVE_DOCUMENT_LIBRARY.md`, `NEXT_STEPS_AFTER_V2.md`,
`NEW_TENANT_HARNESS.md` — 다른 농협 사업장을 새로 찍어낼 때 필요한 체크리스트,
`MISSING_RECORD_ALERT.md` — 일지 미작성 시 텔레그램으로 알리는 GitHub Actions
스케줄 워크플로)에 더 자세히 있습니다. `docs/`는 배포 제외 대상이라 소스에만 있습니다.

## AI 도우미 · 불편접수

`js/dkj-chatbot.js`는 선택 메뉴 없이 불편사항 입력창을 바로 열고, 전송한 메시지를 기존
`DkjTelegram.sendMessage()` 경로로 관리자 텔레그램에 전달합니다. 음성 입력은 브라우저 내장
Web Speech API(`SpeechRecognition`/`webkitSpeechRecognition`)를 사용하며 한국어·베트남어 UI
언어에 맞춰 인식합니다. 오인식 방지를 위해 음성 결과는 입력칸에만 채우고 사용자가 확인 후
전송해야 합니다. 전송 실패 시 입력 내용을 복원하며, 지원하지 않는 브라우저에서는 마이크
버튼만 비활성화됩니다. 텔레그램 Bot Token과 Chat ID는 기존 localStorage 키
`dkj:telegram:config:v1`을 유지하면서 RTDB `system/settings/telegram`에도 저장하고 재조회해
영구 저장 여부를 확인합니다. 다음 접속 때는 RTDB 값을 먼저 동기화하므로 기기나 도메인이
바뀌어도 다시 입력하지 않습니다.

## 데이터 저장 — 전부 브라우저에

- **정본(SSOT)은 브라우저 `localStorage`** 이고, Firebase RTDB(`js/dkj-cloud-sync.js`)가
  기기 간 동기화 사본입니다. 서버 DB 는 없습니다.

> **클라우드 켜짐, 첫 화면 로그인·역할 체계로 확장 (2026-08-16, PR #29~#31).**
> `js/dkj-firebase-config.js` 에 Firebase 프로젝트 `dkj-fssc22000` 값이 들어가 있어
> `DkjAuth.configured()` 가 `true` 입니다. 그래서 지금 동작은 이렇습니다.
> - **모든 화면**(서식뿐 아니라 콘솔·문서센터·관리 화면까지) 첫 진입 시
>   **사번·비밀번호 로그인 화면**이 먼저 뜹니다.
> - 저장된 기록(`dkj:records:*:list:v1`)은 30초 주기로 RTDB 와 양방향 병합됩니다.
>   같은 id 는 `updatedAt` 이 최신인 쪽이 남습니다(통째 덮어쓰기 아님).
> - 결재 서명이 **로그인한 사람** 기준으로 남습니다.
>
> 역할 4단계 — **시스템 관리자**(사번 4343 고정, 사용자 권한 설정 가능) / **책임자**(작성·검토·
> 승인) / **관리자**(작성·검토) / **작업자**(작성만). 운영 절차는
> `docs/ENTRY_LOGIN_AND_ROLE_SETUP.md` 참고.
>
> **계정 체계 — Firebase Authentication 을 쓰지 않습니다 (2026-08-30 변경).** 로그인 계정은
> `system-settings.html`(시스템 관리자 4343 전용)에서 등록·수정하는 **로컬 디렉터리**
> (`js/dkj-auth.js`, localStorage 키 `dkj:auth:directory:v3`)가 정본입니다. 사번·이름·역할·
> 비밀번호를 웹에서 바로 관리하고, Firebase 콘솔에서 계정을 따로 만들 필요가 없습니다.
> `system/users`(RTDB)는 그 디렉터리를 기기 간에 맞추는 사본일 뿐입니다 — 비밀번호는
> **SHA-256 해시로만** 올라갑니다(이 기기의 localStorage 에는 평문이 그대로 남습니다).
> 새 태블릿에서 처음 로그인을 시도하면 로그인 화면이 뜨기 전에 이 사본을 먼저 받아와서,
> 다른 기기에서 등록한 사번도 바로 로그인할 수 있습니다.
>
> **주의 — `database.rules.json` 이 인증 없이 열려 있습니다.** 로그인 신원을 Firebase
> Authentication 이 아니라 이 앱 자체가 판별하므로, RTDB 규칙에서 `auth != null` 같은
> 조건으로는 "진짜 관리자인지" 구분할 방법이 없습니다. 그래서 `records`, `system/users`,
> `system/settings/telegram`, `system/role_audit` 는 전부 읽기·쓰기가 열려 있습니다(비밀번호
> 해시 포함 — 원문 비밀번호는 아님). 즉 이 사이트 주소와 Firebase 설정(`js/dkj-firebase-config.js`,
> 이미 공개 저장소가 아니어도 GitHub Pages 로 누구나 열람 가능한 정적 파일)을 아는 사람은
> 개발자도구로 RTDB 를 직접 읽고 쓸 수 있습니다. **의도적으로 감수한 트레이드오프**입니다
> (2026-08-30, 사용자 요청 — "지금은 사용이 먼저, 나중에 안정화되면 보안 강화"). 나중에 강화할
> 때는 Firebase Authentication 을 다시 붙이거나(전 직원 계정을 콘솔에서 만들어야 함), RTDB
> 규칙에 커스텀 토큰 검증을 넣는 방향을 검토하세요. `records_v2`(아직 미사용, 위 V2 전환
> 참고)만은 예외로 원래의 `auth.uid` 기반 규칙을 그대로 뒀습니다 — 지금은 죽은 코드라
> 손대지 않았을 뿐, V2 전환 전에 반드시 다시 검토해야 합니다.
>
> 사번은 4자리이고 로그인 화면에서 `1` 만 입력해도 `0001` 로 채워집니다(`normId()`).
>
> **비밀번호가 사번과 같으면 로그인 후 주황색 경고 띠가 뜹니다**(`renderWeakPasswordNotice`).
> 사번은 서식·기록에 그대로 적혀 있어 사실상 공개된 값이라, 그걸 비밀번호로 쓰면 누구나
> 그 사람 이름으로 로그인해 결재까지 할 수 있습니다 — 기록의 '누가 썼는가'가 무너집니다.
> 막지는 않습니다(현장 작업을 세우지 않기로 함, 2026-09-09 협의). 닫으면 그 세션 동안만
> 감춰지고 새로 로그인하면 다시 뜹니다.
>
> **미해결 — `js/dkj-auth.js` 의 `DEFAULT_DIRECTORY` 에 시스템 관리자 초기 비밀번호가
> 평문(`'4343'`)으로 남아 있습니다.** 공개 배포되는 파일이라 그대로 읽힙니다. 지우기 전에
> **반드시 `system-settings.html` 에서 4343 의 실제 비밀번호를 먼저 바꿔야 합니다** —
> `passwordMatches()` 는 비밀번호도 해시도 없는 레코드를 **통과시키므로**(과거 동작 유지),
> 실제 비밀번호를 그대로 둔 채 하드코딩만 지우면 새 기기에서 아무 비밀번호나 통과하는
> 더 나쁜 상태가 됩니다. 순서는 ① 화면에서 비밀번호 변경 → ② 하드코딩 제거입니다.
>
> 표시이름 — `system-settings.html`에서 관리자가 지정한 이름이 정본입니다(로컬 디렉터리에
> 저장, RTDB `system/users`로 기기 간 동기화). **JS·HTML·JSON 어디에도 직원 이름을
> 하드코딩하지 마세요** — 카탈로그 절의 '직원 목록·표시이름의 정본은 하나입니다' 참고.
>
> 주의 — GitHub Pages 사이트는 저장소가 비공개여도 **누구나 열람 가능**합니다. 배포되는
> 정적 파일(`js/`, `data/`, `records/`, `*.html`)에 실명을 적으면 사이트 주소만 아는
> 사람에게 직원 개인정보가 그대로 노출됩니다. RTDB 를 연 사람에게는 위에서 설명한 대로
> 어차피 노출되지만, 최소한 정적 파일 하나만 보고 실명이 특정되지는 않게 합니다
> (기록에는 사번이 남아 추적성은 유지됩니다).
>
> 2026-09-09 에 실명이 박혀 있던 다섯 곳을 걷어내고, 직원 명단을 넣어 두던
> `data/staff-roles.json` 은 아예 삭제했습니다 — 아무 화면도 읽지 않는데 실명·사번만
> 배포되고 있었습니다.

### RTDB 기록 저장 스키마 — V1(배열) → V2(레코드별 노드) 전환 준비 완료, 전환 대기중

`js/dkj-cloud-sync.js`는 두 스키마를 동시에 압니다.

- **V1(기존)**: `records/<서식별-인코딩키>` 에 그 서식의 기록 **배열 전체**를 통째로 저장.
  레코드 단위 권한(본인만 수정, 잠금 후 거부)을 RTDB 규칙으로 걸 수 없는 구조입니다.
- **V2(신규)**: `records_v2/<서식>/<기록ID>` 에 기록마다 **독립 노드**로 저장하고
  `data`/`workflow`(최초작성자 uid·잠금상태)/`approvals`/`audit`로 나눕니다. `database.rules.json`이
  이 구조에서 "최초 작성자만 본문 수정", "잠금된 기록은 서버가 쓰기 거부", "결재·감사이력은
  추가만 가능"을 레코드 단위로 강제합니다.

**지금은 V2 코드·규칙이 저장소에 준비돼 있을 뿐, 실제 운영 데이터의 전환(=`sync_meta/schemaVersion`을
2로 바꾸는 것)은 아직 안 됐습니다.** 전환은 되돌리기 어려운 운영 데이터 작업이라 사람이 직접
Firebase 콘솔에서 백업·검증하며 수행해야 합니다 — 절대 코드만 보고 "이미 전환됨"이라 판단하지
말고, 실제로 `sync_meta/schemaVersion`이 몇인지 확인하세요. **추가로(2026-08-30) — 로그인을
Firebase Authentication 없이 자체 계정 체계로 바꾸면서, `records_v2`의 `auth.uid` 기반 규칙은
이제 아무도 실제로 만족시킬 수 없습니다**(모든 로그인이 진짜 Firebase 토큰이 아닌 로컬 토큰을
씁니다). V2 전환 전에 이 규칙을 반드시 다시 설계해야 합니다 — 그대로 두고 `schemaVersion`만
2로 바꾸면 기록 쓰기가 전부 거부됩니다. 절차는 `docs/RTDB_V2_MIGRATION.md`,
변환 스크립트는 `scripts/migrate-rtdb-v1-to-v2.py`(Firebase에 직접 접속하지 않고 백업 JSON을
읽어 import 파일만 생성).

- 기록 저장은 반드시 **`js/dkj-record-store.js`** 를 거칩니다. 키 규칙:
  - `dkj:records:<서식코드>:list:v1` — 저장된 기록 배열 (기록보관함이 읽는 유일한 곳)
  - `dkj:records:<서식코드>:draft:v1` — 작성 중 임시본
### 저장된 기록의 1회성 정정 (마이그레이션)

서식을 고쳐도 **이미 저장된 기록에는 옛 값이 그대로 남습니다.** 기록 정본이 브라우저
localStorage 라 중앙에서 한 번에 고칠 방법이 없어서, 각 기기가 앱을 열 때 스스로 한 번
고치는 방식을 씁니다 — `js/dkj-record-store.js` 안의 `MIGRATIONS` 배열입니다.
적용 여부는 `dkj:migrations:v1` 키에 남고, 같은 정정은 기기마다 한 번만 돕니다.

- **`updatedAt` 을 반드시 올립니다.** 안 올리면 아직 옛 값을 가진 다른 기기가 다음
  동기화(30초)에서 되돌려 놓습니다(`dkj-cloud-sync.js` 의 병합은 `updatedAt` 최신 우선).
- 감사이력은 `DkjApproval.append()` 로만 붙입니다 — 해시 체인이라 직접 밀어 넣으면
  무결성 검증이 깨집니다. 그래서 `dkj-approval.js` 를 싣지 않는 화면(예: 기록보관함,
  업무 콘솔)에서는 정정을 건너뛰고 완료 표시도 하지 않습니다. 서식 화면을 열면 그때 돕니다.
- **넣어도 되는 것은 '뜻이 달라지지 않는 값 교정'뿐입니다.** 이 코드는 작성완료(잠금)
  기록의 수정을 막는 `dkj-approval.js` 의 저장 훅을 우회합니다(훅은 `save()` 만 감쌉니다).
  기록 내용을 바꾸는 마이그레이션은 절대 넣지 마세요.

- `DkjRecordStore.save()` 는 최초작성 정보(`createdAt`/`createdBy`/`createdByEmpId`)를
  이전 레코드에서 물려받습니다. 폼 엔진들이 화면 state 로 record 를 새로 조립해 넘기기
  때문에, 이게 없으면 두 번째 저장에서 '누가 언제 처음 썼는가'가 지워집니다.
  **이 보존 로직을 걷어내지 마세요** — HACCP 기록 추적성의 근간입니다.

## 기록양식은 5개 엔진 + 서식별 스크립트

`records/<코드>.html` 은 껍데기이고, 실제 동작은 **공용 엔진 + 서식별 사양(JSON)** 조합입니다.

| 엔진 | 서식 수 | 사양 위치 |
|---|---|---|
| `js/dkj-fr-form.js` | 45 | `data/fr-form-specs/` |
| `js/dkj-ledger-form.js` | 10 | `data/ledger-form-specs/` |
| `js/dkj-matrix-form.js` | 6 | `data/matrix-form-specs/` |
| `js/dkj-ox-form.js` | 5 | `data/ox-form-specs/` |
| `js/dkj-report-form.js` | 4 | `data/report-form-specs/` |

CCP 2종(`DKJ-H-01-01`, `-02`)과 `FR-014`, `FR-015` 는 엔진 없이 `js/<코드>.js` 전용
스크립트로 돕니다. 새 서식은 되도록 기존 엔진 + 사양 JSON 으로 만드세요.

인쇄 정본은 별도입니다 — `js/dkj-print-form.js`(공용 시트 렌더러)와
`data/print-templates/<코드>.json`(문서번호·제정일·조직명). 화면 서식을 고쳐도 정본
레이아웃은 따라오지 않으니 둘 다 확인해야 합니다.

### 정본을 A4 1쪽에 담기 (`printDensity`)

행이 많은 서식은 기본 치수로는 여러 장이 됩니다. 사양에
`printDensity: { "rowHeight": "12pt", "fontSize": "6.5pt" }` 를 주면 인쇄 루트에
조밀 클래스와 CSS 변수가 붙습니다. **그 서식에만 적용되고 다른 서식의 정본 밀도는
그대로입니다.** 값을 주지 않으면 종전 그대로입니다.

| 엔진 | 렌더러 | 클래스 | 변수 |
|---|---|---|---|
| ledger | `js/dkj-ledger-print.js` | `.lg-dense` | `--lg-row-h` / `--lg-font` |
| matrix | `js/dkj-matrix-print.js` | `.mx-dense` | `--mx-row-h` / `--mx-font` |
| report | `js/dkj-report-print.js` | `.rp-dense` | `--rp-row-h` / `--rp-font` |

예전에는 `printDensity: "compact"` 라는 문자열 스위치였는데, 행 수가 28~55행으로
제각각인 서식들에 같은 값을 먹여 어떤 건 넘치고 어떤 건 아래가 텅 비었습니다.
2026-09-09 에 서식별 값을 주는 객체로 바꿨습니다.

- A4 세로 여백 10/12mm → 쓸 수 있는 높이 275mm, 폭 186mm.
- **높이는 반드시 인쇄폭(186mm = 703px)에서 재세요.** 넓은 뷰포트로 재면 열이 넓어
  줄바꿈이 덜 일어나 실제보다 훨씬 낮게 나옵니다(`DKJ-H-01-06` 을 1000px 에서 재면
  262mm, 703px 에서는 291.3mm — 2장이 되는 이유가 여기 있었습니다).
- `rowPageBreak`·`pageBreakAfter` 가 있으면 섹션이 나뉘어 1쪽에 담을 수 없으니 함께 지웁니다.
- **열 폭은 그 열의 최장 문자열에 맞춰야 합니다.** 조밀 인쇄는 미리 인쇄된 칸
  (`readonly`, 인쇄 시 `lg-fix` 클래스)을 한 줄로 눌러 넘치는 글자를 잘라내기 때문입니다.
  사람이 적는 칸(비고 등)은 일부러 줄바꿈시킵니다 — 길게 적어 한 장을 넘기는 것이
  적은 내용이 안 보이는 것보다 낫습니다. 폭을 바꾼 뒤에는 브라우저에서
  `scrollWidth > clientWidth` 인 칸이 없는지 확인하세요.
- 미기재 칸에 인쇄하는 선택지 힌트는 20자를 넘으면 생략합니다(`OPT_HINT_MAX`).
  `DKJ-S-02-31` 이 3장으로 넘어간 실제 원인이 `작업실` 선택지 57자였습니다.

2026-09-09 기준 서식 75종의 정본 장수: **`DKJ-S-02-05` 3장, 나머지 74종 1장.**
`-05` 는 35개 측정열을 `columnPages` 로 3분할한 구조라 3장이 최소입니다 — 한 장에
몰면 열 폭이 3mm 아래로 떨어집니다.

### 대장 서식의 요일 자동계산·휴무일 (`autoWeekday` / `disableRowIf`)

월 단위 시트(작업장 온도 `DKJ-S-02-05`, 세척 소독제 `DKJ-S-02-09`)는 `점검 월` 을 고르면
`dow` 열에 요일이 자동으로 채워지고, `disableRowIf` 에 걸린 요일(토)은 기재 대상이 아닌
휴무행으로 잠깁니다. 콘솔의 `operationCalendar`(월~금)도 같은 날을 비생산일로 보므로
토·일에는 미작성 알림이 뜨지 않습니다.

**단, 휴무여도 설비가 멈추지 않는 항목은 계속 기재합니다** — `disableRowIf.keepGroups`
(열 `group` 이름 목록) 와 `keepColumns`(열 `key` 목록) 에 적은 열은 휴무행에서도 평일과
똑같이 입력칸으로 남고 정본에도 기재란이 인쇄됩니다. `DKJ-S-02-05` 의 원재료·완제품
냉장창고( 0 ~ 5℃ )와 비고가 그렇습니다. **휴무일에도 냉장창고에는 제품이 들어 있어
온도가 이탈할 수 있는데, 그 칸까지 잠그면 '휴무일 보관온도 모니터링 기록 없음'으로
심사에서 그대로 지적됩니다.** 반대로 작업실 온도는 사람이 없으니 잠급니다.

  화면에서는 열린 칸만 흰 바탕(`lgf-keep-cell`), 잠긴 칸은 회색 위에 '휴무' 로 합쳐
  보입니다. 정본도 같습니다(`lg-keep`). 일괄 입력(`bulkChoiceKeys`)·필수 항목 검증·
  기재 건수(`filledRows`)도 휴무행에서는 열린 열만 대상으로 삼습니다.

- **휴무행의 값은 지우지 않습니다.** 이전에는 기록을 열 때마다 휴무행을 비웠는데, 그러면
  이미 저장된 토요일 값이 조용히 날아갑니다(기록 변조). 지금은 **사용자가 점검 월을 직접
  바꿨을 때만** 비웁니다. 값이 남아 있는 휴무행은 '휴무' 로 가리지 않고 그 값을 읽기전용으로
  보여주고 정본에도 그대로 인쇄합니다 — 저장은 됐는데 아무 화면에도 안 보이는 상태를 막습니다.
  이 '값이 남아 있는가' 판정은 **잠긴 열만** 봅니다. 계속 기재하는 열까지 세면 냉장창고
  온도를 적는 순간 그 행 전체가 읽기전용으로 바뀌어 더는 못 씁니다.
- `점검 월` 을 `type: "month"` 로 바꿀 때 예전 기록이 `'2026 . 08'` 처럼 손으로 적힌 값을
  갖고 있으면 월 선택기가 빈칸으로 보입니다. 그래서 엔진이 화면 표기만 `YYYY-MM` 으로
  맞춥니다(`normMonth`) — **저장 데이터는 건드리지 않고**, 사용자가 저장할 때 정리된 값이
  들어갑니다. 기존 기록을 일괄로 고치는 마이그레이션은 하지 않았습니다.

### 이어지는 재고 자동계산 (`runningStock`)

세척 소독제 관리대장(`DKJ-S-02-09`)처럼 `[전일재고 · 금일 입고 · 금일사용 · 현재 재고]`
가 한 묶음인 대장은 사람이 **금일 입고·금일사용만 적으면** 나머지가 산술로 정해집니다.
손으로 옮겨 적다 앞뒤가 어긋나는 것이 이 대장의 가장 흔한 지적 사항이라 계산으로
고정했습니다. 사양에 `runningStock` 을 주면 엔진이 처리합니다.

```json
"runningStock": {
  "openingRow": 0,
  "decimals": 1,
  "chains": [{ "prev": "p1_prev", "in": "p1_in", "use": "p1_use", "now": "p1_now" }]
}
```

- 계산식 — `전일재고 = 직전에 기재한 날의 현재 재고`, `현재 재고 = 전일재고 + 입고 - 사용`.
- **`openingRow`(기본 0) 행의 전일재고만 사람이 적습니다** — 전월 이월값이라 계산으로
  나오지 않습니다. 그 칸만 흰 바탕이고 나머지 계산 칸은 옅은 회색 읽기전용(`lgf-calc`)입니다.
- **휴무행은 건너뜁니다.** 그 날 재고는 움직이지 않으니 다음 기재일이 직전 기재일의
  현재 재고를 그대로 이어받습니다(금 → 일).
- **입고·사용이 둘 다 빈 행은 채우지 않습니다.** 채우면 아직 아무것도 적지 않은 날까지
  기재된 것처럼 보입니다. 이어지는 재고 값은 그 행을 건너뛰어 유지됩니다.
- **저장된 기록을 열 때는 계산하지 않습니다.** 손으로 적어 산술이 어긋난 옛 기록을
  불러오기만 해도 값이 바뀌면 기록 변조입니다. 사용자가 입고·사용을 고친 순간부터
  다시 계산합니다.
- `0.1` 씩 더하고 빼면 `131.60000000000002` 가 나오므로 `decimals` 자리수로 고정합니다.
- 계산 칸은 `filledRows()` 에서 세지 않습니다 — 사람이 적은 것이 아니라서, 세면 기재
  건수가 부풀고 빈 시트가 검증을 통과합니다.
- 정본에는 계산된 값이 그대로 인쇄되고 **회색 음영은 붙지 않습니다** — 종이로 쓸 때는
  손으로 적는 칸입니다.

### 서식 간 연동 — 읽기 전용 단방향

같은 값을 두 서식에 두 번 적으면 어긋나고, 어긋난 순간 어느 쪽이 맞는지 알 수 없어
심사에서 그대로 지적됩니다. 그래서 값의 **정본이 되는 서식을 하나 정하고, 다른 쪽은
읽어와 보여주기만** 합니다. **다른 서식의 저장 기록을 프로그램이 고치지 마세요** —
기록 변조입니다.

| 읽는 쪽 | 정본 | 무엇 |
|---|---|---|
| `DKJ-STORE-01` (입고 원료 보관대장) | `FR-014` | `?from014=<id>` 로 품목·로트·수량 |
| `DKJ-QC-001` (일일 QC 순회 공정검사일지) | `DKJ-S-02-05` (작업장 온도 일보) | 작업장·냉장창고 온도 |

`DKJ-QC-001` 의 온도 연동(2026-09-09) 규칙 — 두 서식의 회차·구역이 1:1 이 아닙니다.

```
작업장 온도(c03)   1차 ← 전처리실 오전(z1_am), 2차 ← 전처리실 오후(z1_pm)
                  3차 ← 연동 없음 (온도 일보에 3회차 칸이 없다. 직접 적는다)
냉장창고 온도(c04) 회차별로 원재료·완제품 중 관리기준(0~5℃)에서 더 벗어난 값
                  (기준 안이면 높은 쪽 — 냉장은 올라가는 쪽이 위험하다)
```

- **연동 대상 칸은 온도 일보에 값이 없으면 비웁니다.** 안 비우면 날짜를 바꿨을 때 앞
  날짜 값이 남아, 그 날 재지도 않은 온도가 기록으로 남습니다(토요일 작업장 온도 자리에
  수요일 값이 들어가던 실제 버그).
- **저장된 기록을 불러올 때는 연동하지 않습니다.** 그 기록이 그날의 증거인데 지금
  온도 일보 값으로 덮으면 기록 변조입니다. 작성 중인 시트에만 적용합니다.
- 작성 중이던 임시본을 복원할 때는 비우지 않습니다(`applyTempLink(clearMissing)`) —
  그 날짜 기준으로 이미 적어 둔 값을 지우면 안 됩니다.
- 가져온 값도 이탈 검증(`isBad`)을 그대로 통과시켜, 연동된 냉장 6.5℃ 가 이탈 배너를
  띄웁니다. 어디서 가져왔는지는 `state.tempLink`(출처 서식·기록 id·칸 수)로 남깁니다.
- 화면 항목명 옆 `온도일보 연동` 배지는 **화면 전용**입니다 — 정본 인쇄에는 넣지 마세요.

**서식 state 는 평평하지 않습니다.** ledger 계열은 점검일·점검자를 `info` 안에, 결재자를
`approvals` 안에 담습니다. 기록을 가로질러 읽는 코드(`js/dkj-export.js` 의 `pick()`)는
한 겹 아래까지 훑도록 돼 있습니다.

## 카탈로그 — JSON 이 원본, 번들은 생성물

`data/*.json` 을 고쳤으면 **반드시** `python scripts/build-catalog-bundles.py` 를 돌려
`js/*.bundle.js` 를 다시 만드세요. 화면은 번들을 읽습니다(`file://` 로 열어도 되게 하려고
JSON fetch 대신 번들을 씁니다). 번들만 고치면 다음 생성 때 덮여 사라집니다.

| JSON | 무엇 |
|---|---|
| `record-catalog.json` | 기록양식 74종 — 코드·제목·주기·카테고리 |
| `doc-catalog.json` | 문서 143종 — 매뉴얼·절차서·지침서 |
| `menu-catalog.json` | 상단 메뉴 구성 |
| `console-forms.json` | 업무 콘솔의 주기별 그룹(매일/주간·월간/발생 시/연간) |
| `mdr-catalog.json` | 문서관리대장 — **문서 제목·개정번호의 정본** |

`staff-roles.json`(직원별 기본 역할표)은 **2026-09-09 에 삭제했습니다.** 번들이 만들던
`window.DKJ_STAFF_ROLES` 를 참조하는 코드가 하나도 없고 `js/staff-roles.bundle.js` 를
싣는 HTML 도 없는데, 실명 4명이 공개 주소에서 읽히고 있었습니다. 직원 역할·표시이름의
정본은 아래 계정 디렉터리 하나뿐입니다.

### 직원 목록·표시이름의 정본은 하나입니다

`system-settings.html`(시스템 관리자 4343)에서 등록·수정하는 **계정 디렉터리**
(`js/dkj-auth.js`, localStorage `dkj:auth:directory:v3`, RTDB `system/users` 로 기기 간
동기화)가 유일한 정본입니다. 화면의 인원 드롭다운은 전부 여기서 나옵니다.

| 어디 | 무엇 |
|---|---|
| `js/dkj-approval.js` `staffOptions()` | 결재란·인원 칸 `<select>` (`attachStaffPickers`) |
| `js/dkj-util.js` `ensureStaffDatalist()` | `list="dkjStaffList"` datalist (ledger·matrix 표 안의 인원 칸) |

**어느 쪽에도 이름을 하드코딩하지 마세요.** 2026-09-09 전까지 두 곳에 실명이 박혀
있었는데, 공개 배포 파일에 실명이 남는 것보다 **실제와 어긋나는 것이 더 문제였습니다** —
등록에 없는 사람(김영호·박서준)이 목록에 뜨고, 나중에 등록한 직원(임석용·고현호·김도성)은
아무리 등록해도 datalist 에 나타나지 않았습니다(`ensureStaffDatalist()` 가 디렉터리를
아예 보지 않았음). 지금은 `dkj:staff-loaded`·`dkj:auth-ready` 에 다시 채웁니다.

`js/dkj-auth.js` 의 `DEFAULT_DIRECTORY`(새 기기가 아직 디렉터리를 못 받았을 때 쓰는 4343
한 명)도 같은 이유로 이름을 사번으로만 둡니다. 서식 HTML 의 입력칸 `value` 에 사람 이름을
기본값으로 넣는 것도 금지입니다 — 늘 같은 이름이 미리 채워져 있으면 확인 없이 그대로
저장돼 추적성이 깨집니다(`records/DKJ-QC-001.html` 의 검토자·승인자가 그랬습니다).

서식 제목이나 문서명이 필요하면 지어내지 말고 `mdr-catalog.json`(문서관리대장)에서
가져오세요. 주기 분류는 `console-forms.json` 의 그룹을 따릅니다.

## 품질 대시보드 실시간 경보 — 웹 화면은 배포됨, 외부 발송은 미배포

`quality-dashboard.html`은 CAPA 기한초과, 모의회수 2시간 목표 미달, 제품회수·추적성 후속확인을
화면을 열어 둔 상태에서 즉시 보여주고 브라우저 알림도 띄웁니다. 이건 지금 바로 동작합니다.

화면을 닫아도 이메일·카카오 알림톡·문자로 보내는 **외부 자동 발송**은 별도 배포가 필요합니다 —
`functions/index.js`의 `dispatchQualityAlert`(RTDB `records_v2` 변경 트리거) → HMAC 서명 웹훅 →
Make 시나리오 → Gmail/카카오/SMS. 웹훅 URL·서명 비밀은 코드에 없고 Firebase Secret Manager에만
있습니다(`DKJ_ALERT_WEBHOOK_URL`, `DKJ_ALERT_WEBHOOK_SECRET`). 배포하려면 Firebase Blaze 요금제
전환, Functions 배포, Make 시나리오 구성이 먼저 필요합니다 — 자세한 건 `docs/QUALITY_ALERT_AUTOMATION.md`.
**Make의 기존 `Integration Google Sheets, Google Gemini AI, Gmail` 시나리오는 별개 용도이니
승인 없이 건드리지 마세요.**

## Google Drive 정본 문서 열람실

`official-documents.html`은 문서센터(`docs-center.html`)와 별개로, Google Drive 원본 폴더
(`0) 동김제농협_FSSC22000_V6_운영체계구축_최종본260714`)의 원본·PDF 259건을 웹에서 검색·열람·
인쇄합니다. 파일 자체는 GitHub Pages에 복사하지 않고 Drive에 남아 있고, 링크 공개 권한은
**뷰어**로 낮춰져 있습니다(쓰기 권한 절대 금지 — `docs/GOOGLE_DRIVE_DOCUMENT_LIBRARY.md` 참고).

문서를 추가·개정하면 `python scripts/inventory_drive_tree.py` → `python scripts/build_drive_document_manifest.py`
순으로 돌려 `data/drive-document-manifest.json`과 `js/drive-document-manifest.bundle.js`를
갱신해야 반영됩니다. 문서번호(`DKJ-P-01`, `DKJ-H-01-01` 등)가 원본과 PDF에서 같아야 자동으로
연결됩니다.

## 캐시 버전과 서비스워커

정적 자원은 전부 `?v=<숫자>` 를 달고 있습니다. **JS/CSS 를 고쳤으면 이 숫자를 올려야**
기존 사용자 브라우저가 새 파일을 받습니다. 현재 버전은 파일에 직접 물어보고(`grep -roh '?v=[0-9]*' *.html js/*.js | sort | uniq -c`)
가장 많이 쓰인 숫자를 기준으로 다음 숫자로 올리세요 — 아래 21/22는 예시일 뿐입니다.

```bash
grep -rl "?v=21" --include=*.html --include=*.js . | xargs sed -i 's/?v=21/?v=22/g'
sed -i "s/v=21/v=22/g" scripts/inject-*.py     # 주입 스크립트도 함께
python scripts/build-sw-precache.py
```

**`scripts/inject-*.py` 를 빼먹으면 안 됩니다.** 실제로 2026-08-15~08-16 사이 여러 번 버전이
올라가는 동안(v=38→44→46→47) 이 스크립트들은 갱신되지 않고 v=38에 멈춰 있었습니다 — 다음에
누가 `inject-*.py` 를 실행했다면 최신 화면에 옛 버전 스크립트 태그를 도로 심었을 뻔한
상황이었습니다. 버전을 올릴 때마다 `grep -rn "v=[0-9]" scripts/inject-*.py` 로 같이 확인하세요.

주의 — `sw.js` 의 `cacheFirst()` 는 `{ ignoreSearch: true }` 로 캐시를 조회해서
**`?v=` 만으로는 서비스워커를 못 뚫습니다.** 그래서 배포 직후 첫 화면은 이전 것이 뜹니다.

그 뒤는 `js/dkj-pwa.js` 가 처리합니다 — 새 서비스워커가 설치·활성화되면
(`skipWaiting` + `clients.claim`) `controllerchange` 가 떠서 화면 아래에
**"새 버전이 준비됐습니다 [새로고침]"** 띠가 나오고, 작업자가 누르면 최신이 됩니다.
작성 중인 일지가 날아가지 않도록 자동 새로고침은 하지 않습니다. 태블릿을 며칠씩 켜두는
현장을 위해 온라인 복귀·화면 재활성 때 10분에 한 번 갱신을 확인합니다.
(2026-08-14 실측: `reg.update()` → `controllerchange` 1회 → 배너 노출까지 확인)

브라우저에서 눈으로 검증할 때는 서비스워커 해제 + 캐시 삭제 후 다시 여는 게 빠릅니다.
**어느 출처(origin)에서 지우는지 확인하세요** — 배포 사이트에서 지워 놓고 localhost 를
테스트하면 옛 캐시가 계속 나와 한참 헤맵니다.

### 오프라인 (2026-08-14 실측)

정적 서버를 완전히 내리고 확인했습니다 — 프리캐시 351건이 깔려 있으면 그 상태에서도
서식이 그대로 열리고(입력칸 78개 렌더), 저장·감사이력·결재까지 정상 동작하며,
기록은 localStorage 에 남았다가 복귀 후 기록보관함에 그대로 잡힙니다.
캐시에 없는 주소로 가면 `offline.html`('아직 받아두지 않은 화면입니다')이 뜹니다.
화면 아래 오프라인 띠는 `navigator.onLine` 으로 판단하므로, 서버만 죽고 인터넷은 살아
있는 상황에서는 뜨지 않습니다(실제 현장의 와이파이 단절에서는 뜹니다).

오프라인 검증을 재현하려면 `preview_stop` 으로 서버를 내린 뒤 그대로 페이지를 여세요.

## 배포에서 빠지는 것

`deploy-pages.yml` 이 `_site/` 로 rsync 하면서 제외: `.git`, `.github`, `.gitignore`,
`_site`, `scripts`, `functions`, `tests`, `*.md`, `*.local.json`. 사이트가 실제로 읽는 건
`data/*.json`, `css`, `js`, `assets`, `records` 뿐입니다. 배포된 사이트가 필요로 하는 파일을
이 제외 목록에 걸리게 두지 마세요.

`data/asset-sources.local.json` 은 컨설팅 원본 폴더의 로컬 절대경로라 gitignore 대상입니다.
공개 배포물에 로컬 경로나 직원 실명이 들어가지 않게 주의하세요.

`functions`(Firebase Cloud Functions 코드)와 `tests`(마이그레이션 검증용 샘플 JSON)는
2026-08-17에 제외 목록에 추가했습니다 — 그 전에는 브라우저가 쓰지 않는 서버 코드가
그대로 GitHub Pages에 올라가고 있었습니다(비밀값 하드코딩은 없었지만 불필요한 노출).

## 언어

코드 주석, 문서, UI 문구가 전부 한국어입니다. 기존 파일을 고칠 때 영어로 바꾸지 말고
그 관례를 따르세요.
