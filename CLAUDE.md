# CLAUDE.md

이 파일은 Claude Code(claude.ai/code)가 이 저장소에서 작업할 때 참고하는 안내입니다.

## 이 저장소가 무엇인가

동김제농협 산지유통센터의 스마트 HACCP / FSSC22000 V6 시스템 — 현장 태블릿과 PC에서
쓰는 사내 웹앱입니다. 기록양식 작성·전자결재·문서 열람·기록 보관을 다룹니다.

**프레임워크·번들러·패키지 매니저가 없습니다.** 순수 HTML/CSS/JS 파일을 정적으로
서빙하거나 브라우저에서 직접 엽니다. **서버가 전혀 없습니다** — 모든 것이 브라우저에서
돌고 `localStorage` 에 저장되며, Firebase RTDB 로 기기 간 동기화합니다.
**테스트·린터·빌드 단계가 없습니다** — 검증은 브라우저에서 직접 열어 확인합니다. 다만 `scripts/smoke-check.py`로 JSON·서식·캐시·규칙의 정적 연결 오류를 먼저 점검할 수 있습니다.

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
python scripts/smoke-check.py              # JSON·서식·캐시·규칙의 가벼운 배포 전 점검
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

## 데이터 저장 — 전부 브라우저에

- **정본(SSOT)은 브라우저 `localStorage`** 이고, Firebase RTDB(`js/dkj-cloud-sync.js`)가
  기기 간 동기화 사본입니다. 서버 DB 는 없습니다.

> **클라우드 켜짐 (2026-08-14 설정 완료).**
> `js/dkj-firebase-config.js` 에 Firebase 프로젝트 `dkj-fssc22000` 값이 들어가 있어
> `DkjAuth.configured()` 가 `true` 입니다. 그래서 지금 동작은 이렇습니다.
> - `records/` 아래 서식을 열면 **사번·비밀번호 로그인 화면**이 먼저 뜹니다.
> - 저장된 기록(`dkj:records:*:list:v1`)은 30초 주기로 RTDB 와 양방향 병합됩니다.
>   같은 id 는 `updatedAt` 이 최신인 쪽이 남습니다(통째 덮어쓰기 아님).
> - 결재 서명이 **로그인한 사람** 기준으로 남고, `data/staff-roles.json` 의 단계 권한이
>   실제로 걸립니다. 표에 없는 사번은 결재를 확정할 수 없습니다.
>
> 계정 체계 — 이메일은 `emp<사번>@dkj-fssc.internal`(실제 메일 주소 아님), 콘솔에서
> 관리자가 직접 추가합니다(공개 가입·삭제는 콘솔에서 차단해 뒀습니다). 사번은 4자리이고
> 로그인 화면에서 `1` 만 입력해도 `0001` 로 채워집니다(`normId()`).
>
> 표시이름 — 콘솔에서 만든 계정에는 `displayName` 이 없습니다. 예전에는 로그인 시
> `data/staff-roles.json` 의 실명으로 그 자리를 채웠지만, **2026-08-15부터 이 파일의
> `name` 은 전부 빈 문자열**입니다(아래 주의사항 참고). 그래서 지금은 Firebase 콘솔에서
> 계정을 만들 때 `displayName` 에 직접 실명을 넣어야만 기록에 이름이 남고, 안 넣으면
> 사번이 그대로 남습니다. `staff-roles.json` 은 `stages`(결재 단계 권한)만 채우면 됩니다.
>
> 주의 — GitHub Pages 사이트는 저장소가 비공개여도 **누구나 열람 가능**합니다.
> `data/staff-roles.json` 이 로그인 없이 공개 주소에서 읽히기 때문에, 여기 실명·사번을
> 같이 적어 두면 직원 개인정보가 그대로 노출됩니다. 그래서 `name` 필드는 항상 비워
> 두기로 했습니다(기록에는 사번이 남아 추적성은 유지됩니다). 실명을 남기고 싶으면
> `staff-roles.json` 이 아니라 **Firebase 콘솔의 계정 `displayName`**에 넣으세요 —
> 그건 로그인해야만 읽히는 값입니다.
> 실제 기록 내용은 로그인 + RTDB 규칙(`auth != null`)으로 보호되므로 공개되지 않습니다.

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
| `staff-roles.json` | 직원별 결재 권한 — 사번마다 확정할 수 있는 단계 |

`staff-roles.json` 이 localStorage 가 아니라 배포 파일인 이유: 역할표는 모든 태블릿에서
같아야 하는데 `js/dkj-cloud-sync.js` 는 기록 키(`dkj:records:*:list:v1`)만 동기화합니다.
`staff` 가 비어 있으면 아무도 막지 않습니다(지금까지 동작 그대로). 실제 사번을 채우는
순간부터 제한이 걸리고, 표에 없는 사번은 결재를 확정할 수 없습니다. 로그인 자체가 없는
상태(클라우드 미설정)에서는 누구인지 모르므로 역시 막지 않습니다.

서식 제목이나 문서명이 필요하면 지어내지 말고 `mdr-catalog.json`(문서관리대장)에서
가져오세요. 주기 분류는 `console-forms.json` 의 그룹을 따릅니다.

## 캐시 버전과 서비스워커

정적 자원은 전부 `?v=<숫자>` 를 달고 있습니다. **JS/CSS 를 고쳤으면 이 숫자를 올려야**
기존 사용자 브라우저가 새 파일을 받습니다:

```bash
grep -rl "?v=21" --include=*.html --include=*.js . | xargs sed -i 's/?v=21/?v=22/g'
sed -i "s/v=21/v=22/g" scripts/inject-*.py     # 주입 스크립트도 함께 (안 하면 다음 실행 때 옛 버전을 되넣음)
python scripts/build-sw-precache.py
```

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
`_site`, `scripts`, `*.md`, `*.local.json`. 사이트가 실제로 읽는 건 `data/*.json`, `css`,
`js`, `assets`, `records` 뿐입니다. 배포된 사이트가 필요로 하는 파일을 이 제외 목록에
걸리게 두지 마세요.

`data/asset-sources.local.json` 은 컨설팅 원본 폴더의 로컬 절대경로라 gitignore 대상입니다.
공개 배포물에 로컬 경로나 직원 실명이 들어가지 않게 주의하세요.

## 언어

코드 주석, 문서, UI 문구가 전부 한국어입니다. 기존 파일을 고칠 때 영어로 바꾸지 말고
그 관례를 따르세요.
