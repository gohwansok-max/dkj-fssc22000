# IndexedDB 전환 0단계 — 준비 절차와 검증 기록

작성일: 2026-10-16 / 기준: main f6107ba, 캐시 v=136
작업 브랜치: feat/indexeddb-store
상태: 준비 문서 작성, 실제 기기 측정·백업은 미실행. 1단계 착수 전 사람 결정 대기.

## 기준과 범위

- 저장소 CLAUDE.md와 정본 `C:\Users\VISION\.aside\u\0\sessions\2026-10-16_LgBcL4ghyZ8nNfsX\artifacts\저장공간_1번_IndexedDB_전환_계획.md`를 읽었다.
- 같은 디렉터리의 `보류_삭제기록_사진정리_마이그레이션.patch`는 검토만 했으며 적용하지 않았다.
- 정본의 0~6단계를 유지한다. 이 문서는 대체 계획서가 아닌 0단계 수행 절차다.
- 코드, 캐시, 운영 데이터, RTDB V2 설정은 변경하지 않았다. push·배포하지 않는다.
- 계획서의 19개 파일/77곳, DkjRecordStore 163곳은 계획 기준 수치다. 이 단계에서 같은 검색 기준으로 재집계한 실측 수치는 아니다.

## 현재 localStorage 키와 용량 기록 방법 (사람 실행)

각 PC·태블릿의 실제 업무 브라우저 프로필과 origin을 구분한다. `https://dkj.qaplus.kr`과 localhost·옛 GitHub Pages 주소는 서로 다른 저장소다. 시크릿 창도 별도다. 운영 사이트를 새로 열면 기존 앱의 자동 동기화·마이그레이션이 동작할 수 있으므로, 측정 스니펫 자체의 읽기 전용 성격과 구분한다.

작성·저장을 잠시 마친 상태에서 개발자도구 Console의 대상 origin을 확인하고 다음을 실행한다. 이 코드는 localStorage를 읽기만 하며 값 본문·비밀번호·사진을 출력하지 않는다. 개발 과정에서는 실행하지 않았다.

```javascript
(() => {
  const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
    .filter(k => k !== null).sort();
  const entries = keys.map(key => {
    const value = localStorage.getItem(key);
    if (value === null) throw new Error('측정 중 키 변경: 다시 측정하세요');
    let items = null, active = null, tombstones = null, parseError = false;
    if (/^dkj:records:.+:list:v1$/.test(key)) {
      try {
        const list = JSON.parse(value);
        if (!Array.isArray(list)) throw new Error('배열 아님');
        items = list.length;
        tombstones = list.filter(r => r && r.deleted).length;
        active = items - tombstones;
      } catch (_) { parseError = true; }
    }
    return { key, valueChars: value.length,
      utf16EstimateBytes: 2 * (key.length + value.length),
      items, active, tombstones, parseError };
  });
  const report = { measuredAt: new Date().toISOString(), origin: location.origin,
    keyCount: entries.length,
    utf16EstimateBytes: entries.reduce((sum, row) => sum + row.utf16EstimateBytes, 0),
    entries };
  console.table(entries);
  console.log(JSON.stringify(report, null, 2));
  return report;
})();
```



위 출력 JSON을 기기명·프로필명과 함께 별도 파일에 보관한다. UTF-16 추정 바이트는 키·값 문자열 길이의 2배이며 실제 디스크 점유나 브라우저 쿼터의 정확한 값이 아니다. 동기화 중 측정은 원자적 스냅샷이 아니므로 작성·동기화가 안정된 뒤 재확인한다. JSON 오류나 배열이 아닌 기록 키가 있으면 백업 누락 여부를 확인하고 이전을 진행하지 않는다.

키 분류는 실제 출력 목록이 정본이며 소스에서 확인한 예시는 다음과 같다.

| 분류 | 키 예시 | 기록보관함 JSON 포함 |
|---|---|---|
| 기록·삭제 표식 | dkj:records:<서식>:list:v1 | 포함 (원본 배열) |
| 작성 중 임시본 | dkj:records:<서식>:draft:v1 | 제외 |
| 계정 디렉터리 | dkj:auth:directory:v3 | 제외 |
| 인증 관련 값 | dkj:auth:* | 제외 |
| 텔레그램 설정 | dkj:telegram:config:v1 | 제외 |
| 이전 표식 | dkj:migrations:v1 | 제외 |
| 백업 시각 | dkj:backup:lastBackupAt:v1 | 제외 |
| 기타 설정·동기화 메타 | 실제 목록 확인 | 제외 |

키 목록·용량 보고서는 데이터 백업이 아니다. 계정·임시본·설정은 기록 JSON으로 복구할 수 없으므로 원본 브라우저 저장소를 계속 보존한다. 실제 값은 저장소나 공개 보고서에 올리지 않는다.

## 기록보관함 전체 백업(JSON) 절차 (사람 실행)

1. 기록이 있는 동일 기기·프로필·origin에서 업무 입력을 마무리한다. 기록보관함 `records-archive.html`을 연다.
2. “전체 백업(JSON)”을 한 번 누르고 다운로드 성공과 파일 크기가 0보다 큰지 확인한다. 예상 이름은 `동김제_기록백업_*.json`이다.
3. 파일을 안전한 별도 위치에 복사한다. 기기명, origin, 백업 시각, 파일명, 바이트 크기를 기록한다.
4. 파일을 텍스트로 열어 `site`, `exportedAt`, `records`를 확인한다. `records`의 키별 배열 길이를 합산하고 활성 기록·삭제 표식을 따로 세어 직전 용량 보고서와 대조한다. 화면 필터 결과 건수와 전체 원본 건수를 혼동하지 않는다.
5. 키 누락, JSON 오류, 건수 불일치가 있으면 원인을 확인한 뒤 다음 단계로 진행한다. 0단계에서는 “백업 복원”을 누르지 않는다.

코드 근거: `records-archive.html`의 arcBackup → `js/records-archive.js` → `DkjExport.toJsonBackup()` (`js/dkj-export.js`). 화면 이름은 “전체”지만 실제로는 기록 목록 키만 백업한다. 삭제 표식도 배열에 포함되며 임시본·계정·설정은 포함되지 않는다. 반환 숫자는 기록 건수가 아닌 기록 키 수다. JSON 파싱 오류는 해당 키를 누락시킬 수 있어 반드시 목록과 대조한다.

버튼 실행은 `dkj:backup:lastBackupAt:v1`을 갱신한다. 따라서 개발자가 대신 실행하지 않았다. `toFullBackup()`은 별도 함수로, 이 버튼의 호출 대상이 아니다. 복원은 localStorage를 실제로 쓰므로 운영 복원 검증은 별도 승인 후 진행한다.

## 다음 단계용 화면 검증표 (전부 미검증)

운영 데이터 대신 클라우드에서 격리한 시험 환경·시험 기록으로 수행한다. 운영 저장·삭제·복원을 이 문서로 승인한 것으로 간주하지 않는다.

각 서식에서 저장 → 새로고침 → 동일 기록 불러오기 → 값·사진·audit 확인 → 시험 기록 삭제 → 재조회 시 비노출·tombstone 확인 → 기록보관함 조회 → JSON 백업을 확인한다. 잠금 기록은 본문 수정 차단, 정상 결재는 DkjApproval.append 경로와 해시 체인 유지도 확인한다.

| 화면 | 위 순서 검증 |
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

- 기록보관함 필터·전체 조회, 백업 내 원본 건수·사진·audit·삭제 표식 대조: 미검증.
- 격리 시험 환경의 백업 복원·최신본 병합·삭제 표식 유지: 미검증.
- PC↔태블릿 저장·삭제 동기화, 오프라인 저장 후 복귀: 미검증.
- 일반/시크릿 창에서 독립적인 시험 데이터를 구성한 뒤 저장소 비교: 미검증.

## 자동 검증과 인계

2026-10-16, 기존 tests/*.test.js 14개 파일을 명시적으로 전달했다.

```powershell
$files = Get-ChildItem tests -Filter *.test.js | ForEach-Object { $_.FullName }; node --test $files
```

Node 집계: 통과 49 / 실패 0 / 취소 0 / 건너뜀 0. 별도 자체 실행 방식의 클라우드 동기화 테스트는 내부적으로 16 PASS를 출력하며 Node 집계에서는 파일 1건으로 표시된다. 이 수치는 실제 브라우저·운영 데이터 검증을 의미하지 않는다.

변경 파일은 이 문서 1개뿐이다. 실제 측정값, 백업 파일 크기·기록 건수는 사람이 기입해야 하며 아직 미검증이다. 따라서 정본 0단계의 실기기 완료 기준은 미충족이다.

사람 결정: 위 측정·백업 결과를 확인하고 1단계 어댑터 개발 착수를 지시한다. 1단계에는 앱 연결·실데이터 이전을 포함하지 않는다. 여기서 멈춘다.

