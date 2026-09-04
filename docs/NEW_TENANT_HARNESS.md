# 새 사업장(농협) 찍어내기 하네스

이 문서는 동김제농협 배포 과정에서 실제로 며칠씩 걸렸던 디버깅들을 기록한 것이다.
**목적은 하나다 — 다음 농협 사업장을 새로 만들 때 이 목록을 그대로 따라가면
같은 삽질을 반복하지 않는 것.** 코드만 보고 판단하지 말고, 실제 상태(라이브
설정값)를 직접 확인하라는 교훈이 특히 여러 번 반복됐다.

`dkj-fssc22000`은 원래 코엔에프의 `smart-haccp-system`(단순 문서 포털)을 fork한
1호 사업장이었지만, 서식 74종·5개 엔진·클라우드 동기화·계정 체계까지 갖추며
독자적으로 훨씬 앞서 발전했다. **그래서 다음 사업장의 실제 베이스는
`smart-haccp-system`이 아니라 지금의 `dkj-fssc22000`이어야 한다** — 안 그러면
서식 엔진·동기화·로그인을 처음부터 다시 만드는 셈이라 오히려 더 오래 걸린다.

---

## PART 0. 진짜 목표 — 오프라인 문서 받으면 2일 안에 시스템 완성

**최종 목표는 브랜딩 치환이 아니다.** 새 농협의 기존 오프라인 문서(HACCP 계획서·
SOP·점검표 등 Word/PDF/한글 원본)를 받아서, 그걸 이 시스템의 서식으로 코딩해
넣으면 동김제농협과 똑같이 완결된 시스템이 사업장 하나당 **2일 안에** 뜨는 것이
목표다.

시간이 실제로 드는 곳은 이 순서다 — 뒤로 갈수록 기계적이라 이미 자동화됐거나
자동화하기 쉽고, **1번이 압도적으로 오래 걸린다**:

1. **문서를 읽고 서식으로 옮기는 판단 작업** (가장 오래 걸림, 사람/Claude의 판단이
   매번 필요 — PART 5 참고)
2. 카탈로그 JSON 4종에 새 서식 등록 (기계적이지만 아직 스크립트 없음 — PART 3
   "아직 안 된 일" 참고)
3. 브랜딩 치환 — `scripts/new-tenant-rename.py`로 자동화 완료 (PART 3)
4. Firebase 신규 프로젝트 연결·배포 — 체크리스트로 자동화(사람이 콘솔 클릭은
   해야 함, PART 1)

그래서 2일을 노린다면 **Day 1은 문서 매핑(PART 5)에 몰아쓰고, Day 2는 브랜딩·
Firebase·배포·실기기 검증(PART 1, PART 3)에 쓰는 게 현실적인 배분이다.**

---

## PART 1. 새 사업장 배포 전 필수 체크리스트

새 Firebase 프로젝트를 연결하고 처음 배포할 때, **반드시** 아래 순서대로 확인한다.
콘솔 UI에 값을 입력했다고 해서 실제로 저장됐다고 믿지 말 것 — 아래 "직접 확인"
단계가 매번 필요하다.

- [ ] **Firebase 프로젝트를 새로 만든다** (기존 프로젝트 재사용 금지 — 사업장 간
      데이터가 섞인다). Realtime Database를 생성한다.
- [ ] `js/dkj-firebase-config.js`에 새 프로젝트의 `apiKey`/`databaseURL`/`root`
      값을 넣는다.
- [ ] `database.rules.json`을 Firebase 콘솔 **Rules** 탭에 붙여넣고 **Publish**를
      누른다. (Data 탭이 아니라 Rules 탭이다 — 서로 다른 화면이라 헷갈리기 쉽다.)
- [ ] **RTDB `sync_meta/schemaVersion`을 Data 탭에서 `1`로 명시적으로 만든다.**
      값을 입력한 뒤 반드시 Enter/확인을 눌러 실제로 저장됐는지 재확인한다 —
      이 세션에서 값을 고쳤다고 생각했는데 실제로는 반영이 안 돼 있던 사례가
      있었다(아래 값 자체를 직접 GET해서 재확인하는 습관이 필요한 이유).
      **`records_v2`(레코드 단위 스키마)는 아직 쓰지 않는다** — `auth.uid` 기반
      권한 규칙이 로컬 계정 로그인 체계와 근본적으로 안 맞는다(PART 2-A 참고).
      섣불리 `schemaVersion`을 2로 바꾸면 기록 저장이 전부 막힌다.
- [ ] 위 두 단계가 끝나면 **브라우저에서 직접 RTDB REST URL을 열어** 값을 확인한다.
      콘솔 UI나 앱 화면을 거치지 않고 raw JSON을 보는 게 가장 확실하다:
      ```
      https://<프로젝트>-default-rtdb.<리전>.firebasedatabase.app/<root>/sync_meta/schemaVersion.json
      ```
      `1`이 그대로 찍혀야 한다.
- [ ] `system-settings.html`에서 첫 시스템 관리자 계정을 등록한다(사번은 새로
      정한다 — `4343`은 동김제 고유 값이다. PART 3 참고).
- [ ] 캐시 버전(`?v=`)이 새 사업장 파일 전체에서 통일돼 있는지 확인한다
      (`grep -roh '?v=[0-9]*' *.html js/*.js | sort | uniq -c`).
- [ ] `python scripts/build-catalog-bundles.py` / `build-sw-precache.py`를
      한 번 돌려 번들·프리캐시가 최신 데이터 기준으로 만들어졌는지 확인한다.
- [ ] 배포 후 PC 브라우저 + 스마트폰 브라우저 양쪽에서 로그인 → 서식 저장 →
      상대 기기에 동기화되는지 **실제로** 확인한다(로컬스토리지만 보고 "됐다"고
      판단하지 말 것 — 이번 세션에서 그렇게 판단했다가 여러 번 틀렸다).

---

## PART 2. 발견된 버그 패턴 카탈로그 (증상 → 원인 → 교훈)

아래는 전부 동김제 배포 후 실사용 중 실제로 터진 버그다. 코드는 이미
`dkj-fssc22000`에 고쳐져 있으므로, **다음 사업장을 이 저장소 기준으로 fork하면
자동으로 상속된다.** 여기 적는 이유는 (1) 왜 그렇게 짜여 있는지 이유를 남기고,
(2) 유사한 새 기능을 짤 때 같은 함정에 다시 빠지지 않기 위해서다.

### A. RTDB 스키마 버전을 방치하면 동기화가 통째로 죽는다 (가장 크게 시간을 잡아먹은 버그)

- **증상**: 코드 수정을 아무리 해도 두 기기 간 동기화가 안 됨. 토스트 문구가
  화면마다 다르게 뜸("기존 동기화 완료" vs "레코드 단위 동기화 완료").
- **원인**: `sync_meta/schemaVersion`이 `2`(V2, 레코드 단위 스키마)로 남아있었는데,
  V2는 `records_v2`의 `auth.uid` 기반 권한 규칙을 요구한다. 이 앱은 로그인을
  Firebase Authentication이 아니라 자체 로컬 계정 체계로 하기 때문에(2026-08-30
  변경) 진짜 `auth.uid`를 절대 만들어낼 수 없다 — 즉 V2는 죽은 코드다.
  `schemaVersion`이 2인 상태에서는 앱이 조용히 V2 경로로 돌면서 매번 실패한다.
- **교훈**: **코드만 보고 "이미 전환됐다"고 판단하지 말 것.** 살아있는 설정값은
  코드 밖(DB)에 있다. 의심스러우면 PART 1의 "직접 확인" 단계처럼 raw 값을
  직접 GET해서 확인한다 — 이게 이번 세션에서 가장 신뢰도 높았던 디버깅 방법이었다.

### B. Firebase RTDB는 빈 배열/객체를 저장하지 않고 속성째로 지운다

- **증상**: 클라우드 노드에 `updatedAt`/`updatedBy`/`device`는 있는데 `value`
  (기록 배열) 자체가 없음. 동기화 로직이 이 키를 계속 "클라우드 종수"에는
  잡지만 실제로는 영원히 건너뛰기만 해서, 로컬에 진짜 데이터가 있는 기기조차
  스스로 복구를 못 함.
- **원인**: 어떤 기기가 그 서식의 마지막 기록을 (예전 물리삭제 버그로) 지워서
  로컬 배열이 진짜 빈 배열(`[]`)이 된 상태로 클라우드에 PUT됐다. RTDB REST API는
  `PUT`으로 들어온 값이 빈 배열/객체면 그 속성을 아예 저장하지 않는다(속성이
  사라짐) — 이건 Firebase RTDB 자체의 동작이라 앱 코드로 막을 수 없다.
- **고침**: `js/dkj-cloud-sync.js`의 `legacySyncAll()` — 클라우드 `value`가
  배열이 아닌 걸 만나면, 이 기기의 로컬 배열이 비어있지 않을 때 그 값으로
  즉시 덮어써 복구하도록 자가치유 로직을 넣었다. **동기화 로직에서 "이 값이
  이상하면 조용히 건너뛴다"는 절대 하지 말 것 — 복구를 시도하거나, 최소한
  로그를 남겨야 한다.**

### C. 물리 삭제 + 합집합 병합 = 삭제가 되살아난다

- **증상**: PC에서 기록을 삭제했는데 스마트폰에는 그대로 남아있고, 몇 초 뒤
  PC에도 다시 나타남.
- **원인**: 기존 동기화는 두 기기의 배열을 "합집합"으로 병합한다
  (`mergeRecords`, id 기준으로 더 최신 `updatedAt`이 이김). 이 로직은 "이 기록이
  더 이상 존재하지 않는다"는 상태를 표현할 방법이 없다 — 배열에서 항목을 빼는
  물리 삭제는 병합 관점에서 "이 기기가 아직 이 기록을 모른다"와 구분이 안 된다.
- **고침**: `js/dkj-record-store.js`의 `remove()`가 배열에서 항목을 빼지 않고
  `deleted: true` 표식 + `deletedAt`/`deletedBy`를 남기고 `updatedAt`을 갱신한다
  (tombstone 패턴). `list()`/`get()`은 이 표식을 걸러내서 화면·내보내기에는 그대로
  안 보인다. **동기화 대상 데이터에 삭제 기능을 새로 만들 때는 절대 배열에서
  물리적으로 빼지 말 것 — 반드시 tombstone.**
- 관련: `js/dkj-export.js`, `js/dkj-console.js`, `js/traceability-hub.js` 등
  로컬스토리지를 직접 읽는 모든 코드에 `if (rec.deleted) return;` 가드가
  필요하다 — `DkjRecordStore.list()`를 거치지 않고 raw로 읽는 곳은 전부 빠뜨리기
  쉽다.

### D. 태블릿·폰이 백그라운드로 가면 동기화 타이머가 멈춘다

- **증상**: "PC에서 저장했는데 스마트폰엔 안 뜬다"는 흔한 신고. 화면을 새로고침하면
  된다.
- **원인**: 브라우저가 배터리 절약을 위해 백그라운드 탭/화면 꺼짐 상태에서
  `setInterval` 타이머를 그대로 멈춘다. 30초 주기 동기화도 예외가 아니다.
- **고침**: `js/dkj-cloud-sync.js`의 `start()`에 `visibilitychange`/`pageshow`/
  `focus` 이벤트로 화면이 다시 보일 때 즉시 한 번 동기화하는 `resumeSync()`를
  추가했다(3초 디바운스). **태블릿을 며칠씩 켜두는 현장 전제의 앱에서는 타이머만
  믿지 말고 반드시 화면 복귀 훅을 같이 넣을 것.**

### E. 서비스워커 캐시가 새 배포를 계속 숨긴다

- **증상**: 배포하고 캐시버전(`?v=`)을 올렸는데도 기기에서 옛 화면이 계속 뜸.
- **원인**: `sw.js`의 `cacheFirst()`가 `{ ignoreSearch: true }`로 캐시를 조회해서
  `?v=` 쿼리스트링만으로는 새 파일로 안 바뀐다. 새 서비스워커 감지는
  `reg.update()`를 명시적으로 호출해야 일어나는데, 예전엔 `index.html`에만 이
  호출이 있어서 `records-archive.html` 등 다른 화면은 새로고침 한 번으로 최신을
  못 받는 경우가 있었다.
- **고침**: `js/dkj-pwa.js`의 `register()`에서 서비스워커 등록 직후 모든 화면
  공통으로 `reg.update()`를 호출하도록 중앙화했다. 새 버전이 설치되면 화면
  아래 "새 버전이 준비됐습니다" 배너가 뜨고, 작업자가 눌러야 반영된다(작성 중인
  일지가 날아가지 않도록 자동 새로고침은 하지 않음).
- **주의**: `?v=`를 올릴 때 `scripts/inject-*.py`(승인패널/인증/딥링크/PWA 주입
  스크립트)도 같이 안 올리면, 다음에 누가 그 스크립트를 실행했을 때 최신 화면에
  옛 버전 태그를 도로 심는다. 버전 올릴 때마다
  `grep -rn "v=[0-9]" scripts/inject-*.py`로 반드시 같이 확인.

### F. 로그인 레이스 컨디션 — 로컬 계정이 있는데도 깨진 레거시 경로로 샌다

- **증상**: 캐시를 방금 지운 기기에서 등록된 계정으로 로그인해도 401.
- **원인**: 로그인 함수가 로컬 디렉터리를 먼저 완전히 확인하기 전에 조건 분기
  순서가 꼬여서, 특정 상황(디렉터리가 아직 안 채워진 상태)에 원래 안 써야 할
  옛 Firebase Authentication 경로로 새 버렸다.
- **고침**: `js/dkj-auth.js`의 `login()` — 로컬에 계정이 없거나 비밀번호가 안
  맞으면, RTDB에서 최신 사용자 디렉터리를 한 번 더 받아와 재시도한 뒤에도 안
  되면 그때 레거시 경로로 넘어가도록 순서를 명확히 했다. **"이 기기는 처음
  본다"는 상태를 항상 테스트 케이스에 넣을 것 — 새 태블릿 배포 때마다 겪는다.**

### G. CSS `[hidden]`이 다른 규칙에 밀려서 숨김 처리가 씹힌다

- **증상**: 시스템 관리자 전용 버튼(`data-system-admin hidden`)이 일반 작업자
  화면에도 그대로 보임.
- **원인**: `[hidden]`은 브라우저 기본 스타일시트의 **일반 우선순위** 규칙이다.
  `display`를 명시하는 **어떤 author 규칙**이든(`.ck-hbtn { display: inline-flex }`
  같은 흔한 버튼 스타일) 우선순위상 무조건 이긴다 — CSS 캐스케이드에서 출처
  (origin)가 명시도(specificity)보다 먼저 판정되기 때문이다. 선택자를 아무리
  구체적으로 써도 소용없다.
- **고침**: `css/dkj-tokens.css` 최상단에 `[hidden] { display: none !important; }`를
  전역으로 추가했다. **`hidden` 속성으로 권한별 화면 요소를 숨기는 패턴을 쓸
  때는 이 전역 리셋이 항상 먼저 로드돼 있어야 한다.**

### H. 브라우저/프록시 GET 캐시가 "동기화 성공"인데 옛 응답을 보여준다

- **증상**: "지금 동기화" 버튼을 눌러 성공 문구가 떴는데도 목록이 그대로.
- **고침**: `js/dkj-cloud-sync.js`의 `request()`에 `cache: 'no-store'`와
  타임스탬프 쿼리스트링(`&_=<Date.now()>`)을 추가했다. `cache:'no-store'`만으로는
  중간 프록시 캐시까지 못 뚫는 경우가 있어 타임스탬프를 같이 붙인다.

### I. 파괴적 진단(캐시 전체 삭제)이 아직 동기화 안 된 로컬 데이터를 지운다

- **실제로 데이터 손실이 있었던 사건**: 서비스워커 캐시 문제를 의심해 "사이트
  데이터/캐시 전체 삭제"를 권했다가, 그 기기에만 있던(아직 클라우드에 한 번도
  안 올라간) 기록이 영구히 사라졌다.
- **교훈**: 캐시 클리어를 권하기 **전에** 항상 "전체 백업(JSON)"부터 하도록
  안내할 것. 가능하면 캐시 클리어보다 덜 파괴적인 진단(버전 배지 확인, Wi-Fi/LTE
  전환, RTDB REST 직접 확인)을 먼저 시도한다.

---

## PART 3. `dkj-fssc22000` → 새 테넌트 전환 시 반드시 바꿔야 하는 것

이 저장소를 fork해서 새 농협용으로 쓰려면, 아래는 전부 동김제 고유 값이라
그대로 두면 안 된다. (2026-09-04 기준 조사)

| 항목 | 위치 | 비고 |
|---|---|---|
| Firebase 프로젝트 설정 | `js/dkj-firebase-config.js` | 새 Firebase 프로젝트로 완전히 교체 (PART 1 참고) |
| 시스템 관리자 사번 `4343` | `js/dkj-auth.js`, `js/dkj-approval.js`, `js/dkj-backup-reminder.js`, `js/dkj-chatbot.js`, `js/dkj-i18n.js`, `js/records-archive.js`, `system-settings.html`, `js/system-settings.js`, `data/staff-roles.json` 등 9개 파일 | **자동화됨** — `python scripts/new-tenant-rename.py --admin-emp-id <새사번> ... --apply` |
| 회사명("동김제농협 산지유통센터") | 100개 넘는 파일 (`.html`/`.js`/`.json`) — 헤더 워드마크, 페이지 타이틀, 문서 서식 정본, 서식별 JS 안의 "OO 계약농가" 류 문구 등 | **자동화됨** — 같은 스크립트가 `--org-full`/`--org-mid`/`--org-short` 세 단계로 치환. `index.html` 헤더는 조합명과 시설유형("산지유통센터")이 별도 태그라 시설유형이 다르면 직접 고쳐야 함(스크립트 실행 결과에 안내됨). CLAUDE.md·docs/**는 의도적으로 건드리지 않음 |
| 브랜드 로고 | `assets/brand/dkj-icon.svg`, `dkj-icon-maskable.svg`, `nh-symbol.svg`, `nh-symbol-green.svg` | 새 사업장 로고로 교체 (nh-symbol은 농협 공통 심볼이라 재사용 가능할 수 있음) |
| 문서번호 프리픽스 (`DKJ-*`) | `data/record-catalog.json`, `data/mdr-catalog.json`, `data/print-templates/*.json`, `records/DKJ-*.html`, 다수 `js/DKJ-*.js` | 서식 코드 체계 전체가 `DKJ-` 프리픽스. 완전히 새 프리픽스로 바꾸려면 74개 서식 코드·파일명·사양 JSON을 전부 리네임해야 하는 큰 작업 — 처음엔 `DKJ-`를 유지하고 회사명/로고만 바꾸는 것도 현실적 선택지 |
| 사업장 고유 데이터 (14개 카탈로그) | `data/*.json` 전체 (`console-forms`, `doc-catalog`, `menu-catalog`, `mdr-catalog`, `staff-roles`, `products`, `production-master`, `process-line`, `drive-document-manifest`, `asset-sources` 등) | 문서 목록·직원 명단·제품 마스터 등 전부 새 사업장 내용으로 교체 필요. 그중 서식 하나를 새로 추가하는 등록 자체는 **자동화됨** — `python scripts/new-record-catalog-add.py --apply` (PART 5 참고). 고친 뒤 `python scripts/build-catalog-bundles.py` 필수 |
| GitHub Pages 커스텀 도메인 | 저장소 설정(Repo Settings → Pages) — 저장소 안에는 CNAME 파일이 없음 | 새 사업장용 도메인을 새로 연결 |
| Google Drive 정본 문서 폴더 | `official-documents.html`, `data/drive-document-manifest.json` | 새 사업장의 Drive 폴더로 교체, `scripts/inventory_drive_tree.py` → `build_drive_document_manifest.py` 재실행 |
| Telegram 봇/불편접수 | `js/dkj-telegram-config.js`, RTDB `system/settings/telegram` | 새 사업장의 텔레그램 Bot Token/Chat ID |

**카탈로그 4종 자동 등록 — 자동화 완료 (2026-09-04)**: `scripts/new-record-catalog-add.py`가
`record-catalog.json`(`records[]` + `categories[].codes`) / `console-forms.json`
(`groups[].forms[]`, 엔진에 따라 `check.mode` 자동 결정) / `mdr-catalog.json`
(`entries[]`, `workflowStatus: 초안` · `status: 검토대기`로 시작 — 사람이 확인하기
전엔 "완료/운영중"처럼 보이면 안 되므로) / `print-templates/<코드>.json` 4곳에
한 번에 등록한다. 기본은 미리보기만 하고, `--apply`로 실제 적용. 이미 등록된
코드는 자동으로 막는다. **원본 파일의 줄바꿈 방식(CRLF/LF)을 그대로 유지한다** —
안 그러면 한 줄만 고쳐도 파일 전체가 diff에 걸려 나온다(`mdr-catalog.json`이
CRLF라 실제로 이 문제를 겪고 고쳤다). `layout`처럼 엔진만으로 못 정하는 값은
일부러 `TODO-CHOOSE-LAYOUT` 같은 명백히 틀린 값을 넣어 반드시 사람이 고치게
한다. 사용법은 PART 5-2와 스크립트 자체의 `--help`.

**아직 안 된 일** (2026-09-04 기준, 우선순위 순):
1. 회사명·로고·Firebase 설정처럼 "값만 바꾸면 되는" 항목을 모아 설정 파일 하나로
   빼내는 리팩터(지금은 여러 파일에 흩어져 있음).
2. `data/<엔진>-form-specs/<코드>.json`의 `fields`/`sections` 자체를 문서에서
   반자동으로 뽑아내는 것 — 이건 판단 작업이라 완전 자동화보다는, Claude가 문서를
   읽고 초안을 빠르게 만드는 워크플로를 다듬는 쪽이 현실적이다(PART 5).
3. `python scripts/build-catalog-bundles.py`가 일부 번들 파일(`menu-catalog.bundle.js`,
   `record-catalog.bundle.js`에서 확인됨)을 원본과 다른 줄바꿈 방식으로 다시 써서,
   실제 등록 없이 빌드만 다시 돌려도 diff가 수천 줄씩 나오는 문제가 있다 — 위
   `new-record-catalog-add.py`에서 고친 것과 같은 원인(CRLF/LF)일 가능성이 높다.
   아직 고치지 않음.

---

## PART 4. 디버깅 방법론 — 뭐가 진짜 통했나

- **가장 신뢰도 높았던 방법**: 브라우저에서 RTDB REST URL을 직접 열어 raw
  JSON을 보는 것. 앱 코드·캐시·서비스워커를 전부 우회하기 때문에, 코드를 아무리
  뜯어봐도 안 잡히던 문제(스키마 버전, 빈 배열 프루닝)가 이 방법으로는 바로
  드러났다.
- **"코드만 보고 판단하지 말 것"**: 이 세션의 근본 원인 두 개(스키마 버전 방치,
  RTDB의 빈 배열 프루닝) 모두 코드가 아니라 **라이브 상태값**에 있었다. 코드
  리뷰만으로는 절대 못 찾는다.
- **실기기 재현이 필수**: 로컬스토리지 시뮬레이션이나 헤드리스 테스트로는 안
  잡히던 백그라운드 탭 타이머 정지, 실제 401 등은 사용자가 실제 PC/폰에서
  재현해준 뒤에야 원인을 좁힐 수 있었다.

---

## PART 5. 오프라인 문서 → 서식 매핑 (진짜 시간이 드는 곳)

새 사업장의 기존 Word/PDF/한글 문서 하나를 이 시스템의 작동하는 서식 하나로
옮기는 절차. **`records/<코드>.html`은 껍데기이고 실제 동작은 공용 엔진 +
서식별 사양(JSON) 조합이라는 게 핵심이다** — 대부분의 문서는 새 JS 코드를
한 줄도 안 써도 되고, **사양 JSON 하나만 새로 쓰면 서식이 완성된다.** 이게
2일 목표가 가능한 이유다.

### 5-1. 문서 하나를 받으면: 어느 엔진에 맞는지부터 정한다

| 문서가 이렇게 생겼으면… | 엔진 | 사양 위치 | 특징 |
|---|---|---|---|
| 하루 1장, 항목별로 값 입력 + 작성/검토/승인 서명란 | `fr-form` | `data/fr-form-specs/` | 가장 흔한 형태(동김제 74종 중 45종). 필드 목록만 JSON으로 적으면 끝 |
| 한 장에 날짜(1~31일) 세로 행이 쭉 있고, 매일 그 행 하나씩 채우는 대장/관리대장 | `ledger-form` | `data/ledger-form-specs/` | 월 단위로 한 시트에 누적(예: 온도 점검일지, 조도점검일지) |
| 표에서 가로축이 날짜, 세로축이 점검항목인 매트릭스형 주간/월간 점검표 | `matrix-form` | `data/matrix-form-specs/` | 청소·소독 점검표류. `#btnAllPass`(전체 적합) 같은 일괄입력 지원 |
| 항목별로 O/X(적합/부적합)만 체크하는 단순 점검표 | `ox-form` | `data/ox-form-specs/` | 가장 단순한 형태 |
| 사고·이슈 발생 시 작성하는 보고서(부적합·불만·이탈 등 서술형이 많은 문서) | `report-form` | `data/report-form-specs/` | 체크블록(`.rpf-chk`/`data-chk`) + 서술형 섹션 혼합 |
| CCP 관리처럼 한계기준 이탈 시 시정조치가 자동으로 강제돼야 하는 문서 | 전용 스크립트 (`js/<코드>.js`) | — | `DKJ-H-01-01`/`-02`처럼 엔진으로 못 담는 예외적 로직이 필요할 때만. **가장 마지막 선택지** — 대부분의 문서는 위 5개 엔진 중 하나로 충분하다 |

애매하면 기존 74종 중 비슷한 문서를 찾아 그 스펙 JSON을 복사해서 시작하는 게
가장 빠르다(`data/record-catalog.json`에서 `category`/`period`로 비슷한 걸
찾는다).

### 5-2. 서식 하나 추가 시 실제로 손대야 하는 파일 (자동화 전 기준)

1. `data/<엔진>-form-specs/<코드>.json` — 문서의 항목을 `fields`/`sections`로
   옮긴다. 기존 서식 하나를 복사해서 `code`/`title`/`fields`만 바꾸는 게 제일
   빠르다.
2. `records/<코드>.html` — 기존 같은 엔진 서식의 HTML을 복사하고 스크립트
   태그의 코드만 바꾼다(엔진이 `data-code`로 스펙을 찾아 읽는 구조라 HTML
   자체는 서식마다 거의 동일).
3. `data/record-catalog.json` — 서식 목록에 항목 추가(`code`/`title`/`period`/
   `category`/`role`/`file`/`summary`).
4. `data/console-forms.json` — `groups[].items[]`에 등록. `check.mode`는
   5-1의 엔진과 거의 1:1 대응한다: `fr-form`→`perDay`, `ledger-form`→`dayRow`,
   `matrix-form`→`dayColumn`, `ox-form`→`perDay`, `report-form`→`event`.
5. `data/mdr-catalog.json` — 문서관리대장에 문서번호·개정번호 등록(**문서
   제목·개정번호의 정본**이므로 서식 제목은 지어내지 말고 여기 기준으로).
6. `data/print-templates/<코드>.json` — 인쇄 정본 레이아웃(문서번호·제정일·
   조직명). 화면 서식과 별개라 빠뜨리기 쉽다.
7. `python scripts/build-catalog-bundles.py` — 위 JSON들을 고쳤으면 반드시
   실행. 화면은 `js/*.bundle.js`를 읽지 JSON을 직접 안 읽는다.

### 5-3. 심사 증거로 쓰이는 기록이라는 것을 잊지 말 것

이 서식들은 실제 HACCP/FSSC22000 심사에서 증거로 제출된다(`quality-record-app-rules`
스킬 참고). 문서를 옮길 때 최소한 이건 지킨다: 문서번호·Rev·작성자/작성일시가
빠지지 않아야 하고, 결재(작성→검토→승인)가 필요한 문서면 승인 후 잠기게 하고,
한계기준 이탈 항목이 있으면 시정조치 입력 없이는 저장을 끝내지 않게 한다.
빠르게 찍어내는 것과 심사에서 지적당하지 않는 것은 같이 가야 한다 — 후자를
희생해서 시간을 버는 건 목표가 아니다.
