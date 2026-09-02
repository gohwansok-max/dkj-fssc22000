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
python scripts/sync-fssc-catalog.py       # 원본 문서 → doc-catalog / menu-catalog
powershell -ExecutionPolicy Bypass -File scripts\sync-dkj-assets.ps1 -PdfOnly   # 절차서 PDF 생성 (Word 필요)
```

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
`QUALITY_ALERT_AUTOMATION.md`, `GOOGLE_DRIVE_DOCUMENT_LIBRARY.md`, `NEXT_STEPS_AFTER_V2.md`)에
더 자세히 있습니다. `docs/`는 배포 제외 대상이라 소스에만 있습니다.

## AI 도우미 · 불편접수

`js/dkj-chatbot.js`는 선택 메뉴 없이 불편사항 입력창을 바로 열고, 전송한 메시지를 기존
`DkjTelegram.sendMessage()` 경로로 관리자 텔레그램에 전달합니다. 음성 입력은 브라우저 내장
Web Speech API(`SpeechRecognition`/`webkitSpeechRecognition`)를 사용하며 한국어·베트남어 UI
언어에 맞춰 인식합니다. 오인식 방지를 위해 음성 결과는 입력칸에만 채우고 사용자가 확인 후
전송해야 합니다. 전송 실패 시 입력 내용을 복원하며, 지원하지 않는 브라우저에서는 마이크
버튼만 비활성화됩니다.

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
> 표시이름 — `system-settings.html`에서 관리자가 지정한 이름이 정본입니다(로컬 디렉터리에
> 저장, RTDB `system/users`로 기기 간 동기화). `data/staff-roles.json`의 `name`은 항상 빈
> 문자열입니다(아래 참고).
>
> 주의 — GitHub Pages 사이트는 저장소가 비공개여도 **누구나 열람 가능**합니다.
> `data/staff-roles.json` 이 공개 주소에서 읽히기 때문에, 여기 실명·사번을 같이 적어
> 두면 직원 개인정보가 그대로 노출됩니다. 그래서 `name` 필드는 항상 비워 두기로 했습니다
> (기록에는 사번이 남아 추적성은 유지됩니다). RTDB 를 연 사람에게는 위에서 설명한 대로
> 어차피 노출되지만, 최소한 이 정적 파일 하나만 보고 실명이 특정되지는 않게 합니다.

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
| `staff-roles.json` | 직원별 **기본** 역할·결재 권한 — 실제 운영 권한은 RTDB `system/users`가 우선 |

`staff-roles.json` 이 localStorage 가 아니라 배포 파일인 이유: 역할표는 모든 태블릿에서
같아야 하는데 `js/dkj-cloud-sync.js` 는 기록 키(`dkj:records:*:list:v1`)만 동기화합니다.
`staff` 가 비어 있으면 아무도 막지 않습니다(지금까지 동작 그대로). 실제 사번을 채우는
순간부터 제한이 걸리고, 표에 없는 사번은 결재를 확정할 수 없습니다. 로그인 자체가 없는
상태(클라우드 미설정)에서는 누구인지 모르므로 역시 막지 않습니다.

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
