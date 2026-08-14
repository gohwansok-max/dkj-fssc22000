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

## 데이터 저장 — 전부 브라우저에

- **정본(SSOT)은 브라우저 `localStorage`** 이고, Firebase RTDB(`js/dkj-cloud-sync.js`)가
  기기 간 동기화 사본입니다. 서버 DB 는 없습니다.
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
**`?v=` 만으로는 서비스워커를 못 뚫습니다.** 다만 `skipWaiting()` + `clients.claim()` 이라
새 서비스워커가 활성화되면서 옛 캐시를 지웁니다. 결과적으로 **배포 후 첫 실행은 이전
화면, 두 번째 실행부터 최신**입니다. 브라우저에서 검증할 때는 서비스워커 해제 + 캐시
삭제 후 다시 여세요.

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
