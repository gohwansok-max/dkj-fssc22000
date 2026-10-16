# IndexedDB 전환 1단계 보고

작성일: 2026-10-16 / 브랜치: feat/indexeddb-store / 기준 커밋: f6107ba

## 1. 한 일

- `js/dkj-store.js`: IndexedDB DB `dkj-store`(버전 1), object store `entries`를 사용하는 독립 어댑터를 추가했다.
- `get`, `set`, `remove`, `keys`, `estimate`, `requestPersistence`는 Promise를 반환한다. 키는 비어 있지 않은 문자열, 값은 문자열로 제한해 기존 localStorage 원문을 재직렬화하지 않고 보존한다. 없는 키의 get 결과는 undefined다. set/remove 성공 반환값은 undefined다.
- 요청 성공이 아닌 트랜잭션 완료 시 쓰기 성공을 반환한다. 연결 실패 시 재시도, blocked 연결 실패 처리, 버전 변경·연결 종료 시 재연결을 지원한다.
- `tests/dkj-store.test.js`: 외부 패키지 없는 메모리 기반 IndexedDB 가짜 구현과 테스트 14건을 추가했다. 실제 브라우저 저장소나 네트워크에 연결하지 않는다.
- `docs/INDEXEDDB_STAGE1_REPORT.md`: 이 단계의 계약·검증·인계 내용을 기록했다. 0단계 문서는 이전 단계에서 작성한 파일로 그대로 유지했다.

## 2. 확인된 것

- 신규 단위 테스트: 14건 통과 / 실패 0건.
- 기존 포함 tests/*.test.js 15개 파일 전체: Node 집계 63건 통과 / 실패 0건 / 취소 0건 / 건너뜀 0건. 클라우드 자체 테스트 내부 16 PASS는 파일 1건으로 집계된다.
- 읽기·쓰기·덮어쓰기·삭제·반복 삭제·키 목록·빈 문자열·없는 키, 사진·audit·tombstone을 포함한 원문 보존을 확인했다.
- commit 전 미완료, commit 중단 시 기존 값 보존, 요청 오류, 동기 예외, open 실패 후 재시도, blocked 연결의 늦은 성공 연결 닫기, 버전 변경·비정상 종료 후 재연결을 확인했다.
- 영구 저장 승인·거부·미지원·예외와 거부 후 저장, 용량 추정 성공·미지원·실패를 확인했다. persist 거부·예외는 false이며 앱 동작을 중단하지 않는다. estimate 미지원은 null, 조회 실패는 reject한다.
- 스크립트 로드 시 DB open·persist 호출이 없고 localStorage 접근 시 실패하는 테스트 환경에서도 전체 신규 테스트가 통과했다.
- 두 신규 JS 파일의 node --check 통과. git diff --check 오류 없음. HTML·기존 앱 JS에서 신규 어댑터 로드 참조 없음(검색 결과 0건).

실행 명령:

```powershell
node --test tests/dkj-store.test.js
$files = Get-ChildItem tests -Filter *.test.js | ForEach-Object { $_.FullName }; node --test $files
node --check js/dkj-store.js
node --check tests/dkj-store.test.js
git diff --check
```

## 3. 미확인 것

- 가짜 구현은 브라우저 IndexedDB 전체 사양을 구현하지 않는다. 실제 PC·태블릿 브라우저의 재접속 후 영속성, 저장 공간 부족, 브라우저 강제 종료·복구, 다른 탭과의 동시 접근은 미검증이다.
- 실제 navigator.storage.estimate/persist 반환값·권한 정책·시크릿 모드 동작은 미검증이다. estimate는 origin 전체의 추정치이며 이 DB 단독 점유량이나 보장 용량이 아니다.
- 0단계 사람 실행 대상인 실제 기기 키 목록·용량·백업 파일 크기·기록 건수는 확인 자료를 받지 않아 미검증이다.
- 서식 화면과 앱 연결은 이 단계 범위에 없으므로 동작 검증은 미검증이다.

화면 검증 체크리스트: 클라우드에서 격리한 시험 환경과 시험 기록으로 수행한다. 실제 운영 데이터 변경은 별도 승인 대상이다.

| 화면 | 저장 → 새로고침 → 불러오기 → 삭제 → 기록보관함 → JSON 백업 |
|---|---|
| DKJ-H-01-01 | 미검증 |
| DKJ-H-01-02 | 미검증 |
| DKJ-F-053 | 미검증 |
| DKJ-QC-001 | 미검증 |
| DKJ-S-02-01 | 미검증 |
| DKJ-S-02-02 | 미검증 |
| DKJ-S-02-09 | 미검증 |
| DKJ-S-02-12 | 미검증 |
| DKJ-S-02-32 | 미검증 |
| FR-014 | 미검증 |

추가 확인: 사진·rows 원문과 audit 해시 체인 유지, DkjApproval.append 경로, 잠금 기록 본문 수정 차단, 삭제 표식 유지, 격리 환경의 백업 복원, PC↔태블릿 동기화, 오프라인 복귀 모두 미검증.

## 4. 다음 단계에 필요한 사람의 결정 사항

2단계 이중 쓰기 착수 여부를 결정한다. 이 단계에서는 어댑터를 앱에 연결하지 않았고 이전·삭제·정리 코드를 실행하지 않았다. 실제 기기 측정·백업 결과는 운영 연결·이전 전에 확인해야 한다.

보류 patch 적용, 기록 본문 의미 변경, 기존 테스트 변경, RTDB V2 변경, localStorage 데이터 접근·삭제·덮어쓰기 실행, 캐시 버전 변경, push·배포는 하지 않았다. 커밋도 아직 만들지 않았다. 요청대로 1단계에서 멈춘다.
