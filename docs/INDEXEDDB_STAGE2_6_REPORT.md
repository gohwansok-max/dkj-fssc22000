# IndexedDB 전환 2~6단계 구현·검증 보고

작성일: 2026-10-16 / 브랜치: feat/indexeddb-store / 기준: main f6107ba

사용자의 “끝까지 다해서 배포까지” 요청에 따라 단계별 중단을 해제하고 검증·PR·배포까지 진행한다. 기존 localStorage 정리 실행, 보류 patch 적용, RTDB V2 전환은 여전히 제외한다.

## 1. 한 일 — 단계별 변경 파일과 이유

| 단계 | 변경 파일 | 핵심 내용 |
|---|---|---|
| 2 이중 쓰기 | js/dkj-record-store.js, tests/dkj-record-store-mirror.test.js | 기존 동기 읽기를 유지한 순차 이중 쓰기와 실패 조회 제공. 별도 커밋으로 보존. 최종 읽기 전환 후에는 새 기록을 localStorage에 쓰지 않음 |
| 2~3 대조·이전 | js/dkj-storage-migration.js, tests/dkj-storage-migration.test.js | 전체 localStorage 원문 복사, 키 수·길이·SHA-256 대조, 안정된 원본 확인 후에만 IndexedDB 표식 기록. 중단 후 재시도 |
| 3~4 초기화·읽기 | js/dkj-storage.js, js/dkj-store.js | 초기화 장벽, IndexedDB 우선 기록 조회, 원본 localStorage 보존, Web Locks 직렬화, 원자적 batch, 영구 저장 결과 표시 |
| 4~5 호출부 | js/dkj-record-store.js, js/dkj-approval.js, 공용 서식 엔진·전용 서식·관리 화면 JS | 공개 저장 API의 Promise 반환, await 전환, 최신 스냅샷 안에서 기존 감사·잠금·삭제 훅 실행. 중복 저장 클릭 차단 |
| 5 클라우드·백업 | js/dkj-cloud-sync.js, js/dkj-export.js, js/dkj-console.js, js/traceability-hub.js 등 | 초기 이전 완료 전 클라우드 요청 대기. 비동기 스냅샷·원문 재검사·잠금 안의 비교 후 병합. 백업·복원은 쓰기와 직렬화 |
| 5 초기화 지원 | js/dkj-async.js, HTML, scripts/build-ledger-forms.py, scripts/build-form-shells.py, scripts/gen-fr-forms.py | 비동기 순회·콜백 대기, 저장소 의존성 로드 순서, 생성기와 생성물 일치 |
| 6 준비만 | js/dkj-storage.js의 cleanup | enabled=true와 별도 확인 문자열이 있어야 실행 가능. 기본 꺼짐, 자동 호출 없음. 이전 표식 해시·기록/삭제 표식 보존·검사 중 원문 변경 여부 확인. 실제 정리 미실행 |
| 최종 배포 준비 | HTML/JS의 ?v=137, scripts/inject-*.py, sw-precache.js | 캐시 136→137 한 번 갱신. 주입 스크립트의 기존 129도 137로 맞춤. 프리캐시 재생성 |

기존 자산을 유지했다. 계정·텔레그램·UI 설정 등 비기록 동기 작성자는 기존 localStorage 경로를 유지한다. 최초 이전은 이 키들도 IndexedDB에 원문 사본을 남기지만, 이후 설정 정본을 IndexedDB로 완전히 전환한 것은 아니다. 기록 목록·초안이 용량 제한을 벗어나는 것이 이번 작업의 적용 범위다.

서식 검증 과정에서 FR-014 “전체 적합” 버튼이 존재하지 않는 함수 두 개를 호출하던 기존 오류를 확인했다. 기존 renderOxGrid/renderJudge 호출로만 정정했다. 서식·기록 본문 의미는 바꾸지 않았다.

## 2. 확인된 것

### Node 및 정적 검사

- 1단계: 기존 포함 63 통과 / 실패 0.
- 2~3단계 도구 추가: 70 통과 / 실패 0.
- 실제 저장소·결재 훅 연결 통합 테스트 추가: 74 통과 / 실패 0.
- 최종 호출부·HTML 순서 회귀 검사 포함: **76 통과 / 실패 0 / 취소 0 / 건너뜀 0**.
- 클라우드 기존 자체 테스트 16 PASS는 위 Node 집계에서 파일 1건으로 표시된다.
- 기존 기능 테스트의 기대값은 유지했다. 캐시 URL 테스트는 136 하드코딩 대신 정본 index.html의 현재 버전과 일치하는지 검사하고 별도 rev=137 검사는 유지한다. 이는 필수 캐시 갱신에 따른 테스트 유지보수다. Promise 반환으로 바뀐 호출을 await하고 테스트 이벤트 도우미가 비동기 핸들러 완료를 기다리게 했다. 클라우드 테스트에는 비동기 순회 도우미를 로드했다.
- 공개 기록 메서드 호출을 전수 검색하고 await 누락 검사를 추가했다. 내부 동기 core는 저장소 스냅샷 계산과 기존 훅에만 쓰며 화면에 노출한 공개 API에서 동기 반환하지 않는다.
- ledger 10종, matrix/ox/report 15종 생성기 --check 일치. FR 생성기도 새 의존성과 await 부트 코드를 재현한다.
- 스모크 검사: 오류 0 / 경고 0. JS 문법·git diff --check 검사 수행.

주요 자동 검증 범위: 원문·사진·audit·tombstone 유지, 키 목록·삭제·빈 문자열, commit 완료 대기, 요청·연결 실패와 재연결, blocked 연결, 중단 후 재이전, 같은 길이 오염 검출, 원본 변화 검출, 잠금 본문 변경·해제·삭제 차단, 해시 체인 검증, 병렬 저장 직렬화, 저장 실패 시 원본 유지, persist 거부 후 저장.

### 격리 Edge 브라우저 검증

운영 프로필 대신 새 컨텍스트를 사용했다. localhost 외 실제 네트워크 요청은 차단했고 클라우드는 가짜 RTDB 응답으로 검증했다. 실제 사용자 데이터·운영 RTDB를 변경하지 않았다.

| 서식 | 화면 저장(연속 두 번 클릭해도 1건) | 새로고침·불러오기 | 화면 삭제 |
|---|---|---|---|
| DKJ-H-01-01 | 통과 | 통과 | 통과 |
| DKJ-H-01-02 | 통과 | 통과 | 통과 |
| DKJ-F-053 | 통과 | 통과 | 통과 |
| DKJ-QC-001 | 통과 | 통과 | 통과 |
| DKJ-S-02-01 | 통과 | 통과 | 통과 |
| DKJ-S-02-02 | 통과 | 통과 | 통과 |
| DKJ-S-02-09 | 통과 | 통과 | 통과 |
| DKJ-S-02-12 | 통과 | 통과 | 통과 |
| DKJ-S-02-32 | 통과 | 통과 | 통과 |
| FR-014 | 통과 | 통과 | 통과 |

- 위 10종에서 별도로 API를 통한 사진 문자열 저장·재조회·삭제도 확인했다. 새 기록이 localStorage에 쓰이지 않음을 확인했다.
- 콘솔·기록보관함·감사이력·경영진/품질/생산 대시보드·CAPA·주기관리·비상훈련·경영검토·추적성·FSSC 심사준비·HACCP팀 설정 등 13개 주요 화면의 로드에서 pageerror 0건.
- 기록보관함 JSON 다운로드에 원본 기록이 포함됨, 같은 백업 복원 시 중복 추가 0건, 수집 결과 유지.
- 두 탭 동시 저장 시 2건 모두 유지.
- 이전 복사를 의도적으로 멈춘 동안 클라우드 네트워크 요청 0건, 해제 후 업로드 재개.
- 가짜 클라우드 연결 실패 중 저장 유지, 복귀 후 업로드 확인.
- 구버전 탭의 localStorage 변경을 받아들이면서 IndexedDB에만 있던 기록도 유지.
- **12MiB 사진 문자열 포함 기록 저장 성공**, localStorage 기록 키는 생성되지 않음.
- 실제 IndexedDB의 readwrite 트랜잭션 강제 abort 시 기존 목록 유지, 함께 넣던 초안은 미생성. 감사 해시 체인 유효.
- 브라우저 병렬 실행 중 일부 자원 로드 실패가 있어 최종 브라우저 검사는 순차 실행으로 재확인했다. 앱 테스트 성공으로 간주하지 않고 실패한 실행과 재실행을 구분했다.

재현: localhost:5500에서 정적 서버를 열고, 이미 설치된 Playwright를 NODE_PATH에 지정해 아래 스크립트를 하나씩 실행한다. 패키지를 저장소에 추가하거나 설치하지 않는다.

```powershell
$files = Get-ChildItem tests -Filter *.test.js | ForEach-Object { $_.FullName }; node --test $files
python scripts/smoke-check.py
python scripts/build-ledger-forms.py --check
python scripts/build-form-shells.py --check
node tests/browser/indexeddb-ten-forms.cjs
node tests/browser/indexeddb-flows.cjs
node tests/browser/indexeddb-cloud.cjs
node tests/browser/indexeddb-large-atomic.cjs
```

## 3. 미확인 것과 운영상 제약

- 실제 현장 PC↔태블릿 및 실제 Firebase에서 로그인·서명·승인·동기화: 미검증. 로그인 단위 테스트와 가짜 클라우드 검증을 실제 운영 검증으로 간주하지 않는다.
- 현장 기기의 최초 이전 결과·실제 저장 용량·실제 JSON 백업 파일 크기·건수: 미검증. 사람에게 받은 결과 자료가 없다.
- Safari·시크릿 모드·저장소 권한 정책 차이·디스크 부족·기기 강제 종료 복구: 실제 기기 미검증. 지원하지 않는 IndexedDB/Web Locks 환경은 조용히 저장 성공으로 처리하지 않고 실패를 표시한다.
- 서식 전체 75종의 모든 입력 조합·카메라·실물 인쇄·모든 결재 단계: 미검증. 대표 10종과 주요 화면을 확인한 범위다.
- 실제 사이트의 localStorage 정리 실행: 미실행·미검증. 별도 승인 전에 실행하지 않는다.
- IndexedDB는 브라우저가 결정하는 quota 내에서 동작한다. 수십 GB를 무조건 보장하지 않는다. estimate는 origin 전체 추정치다. 영구 저장 거부 시에도 앱은 동작한다.

## 4. 운영 인계와 사람 결정

사용자가 배포까지 승인했으므로 별도 단계별 승인 요청 없이 PR·CI·배포 확인까지 진행한다. main에 직접 push하지 않고 작업 브랜치 PR을 머지한다. 실제 배포 결과는 GitHub PR과 Actions 및 최종 전달 보고서에 기록한다.

기존 localStorage는 이전 시점 백업이다. 전환 이후 기록은 IndexedDB에만 있으므로 **코드만 옛 버전으로 되돌리면 새 기록이 안 보일 수 있다**. 되돌려야 한다면 새 버전에서 먼저 기록 JSON을 확보하고 저장 용량·복원 경로를 검토해야 한다. 자동으로 localStorage에 덮어쓰거나 되돌리는 스크립트는 제공·실행하지 않았다.

배포 후 열린 탭은 새 버전 안내에서 새로고침한다. 작성 중인 입력을 먼저 저장한다. 현장 대표 기기에서 최초 이전 완료, 최근 기록·사진·결재 상태, JSON 백업을 확인한다. 실제 기기 점검과 추후 localStorage 정리 시점은 사람이 결정한다. 보류된 사진 정리 patch, sync_meta/schemaVersion 변경, records_v2 스키마 전환은 수행하지 않았다.
