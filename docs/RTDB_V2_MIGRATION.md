# RTDB V2 레코드 단위 동기화 전환 절차

> **중요:** 이 절차는 실제 HACCP 기록이 저장된 Firebase Realtime Database를 다룹니다. 코드 배포만으로 전환되지 않으며, 아래 확인 항목을 모두 충족하기 전에는 `schemaVersion`을 2로 바꾸지 마십시오.

## 전환 목적

기존 V1은 서식별 기록 전체를 배열 하나로 저장했습니다. V2는 아래처럼 기록마다 독립 노드를 사용합니다.

```text
/dkj-fssc22000/records_v2/<인코딩된 서식코드>/<인코딩된 기록ID>
  ├─ data       화면에 표시하는 기록 본문
  ├─ workflow   최초 작성자 UID, 생성시각, 잠금 상태
  ├─ approvals  단계별 결재 서명
  └─ audit      추가 전용 감사이력
```

이 구조는 Firebase 규칙에서 최초 작성자, 잠금 상태, 결재·감사이력의 추가 전용 원칙을 레코드별로 검증할 수 있게 합니다. V1 데이터는 전환 직후에도 삭제하지 않고 읽기 전용 백업으로 보관합니다.

## 사전 준비

| 항목 | 완료 기준 |
|---|---|
| 코드 배포 | 레코드 단위 동기화 코드와 `database.rules.json`이 검토용 브랜치에 반영되어 있습니다. |
| 규칙 검토 | Firebase 콘솔에서 V2 규칙을 붙여넣기 전, 현재 V1 운영 규칙을 별도 텍스트 파일로 백업했습니다. |
| 전체 백업 | Firebase 콘솔에서 `dkj-fssc22000` 전체를 JSON으로 내보내고, 파일명·다운로드 시각·해시를 기록했습니다. |
| 사용자 매핑 | 모든 사번의 Firebase `uid`를 확인해 사번→UID JSON을 만들었습니다. UID는 Authentication 사용자 상세화면에서 확인합니다. |
| 운영 공지 | 전환 시간 동안 기록 입력을 중지하도록 현장 사용자에게 안내했습니다. |
| 복구 담당자 | 전환 실패 시 V1 규칙과 전체 JSON 백업을 복원할 담당자와 연락처를 지정했습니다. |

## 1. 변환 파일 생성

다음처럼 사번과 Firebase UID를 대응한 파일을 만듭니다. 실명이나 비밀번호는 넣지 않습니다.

```json
{
  "0001": "Firebase_UID_여기에_입력",
  "0002": "Firebase_UID_여기에_입력"
}
```

Firebase 콘솔에서 내려받은 전체 백업을 `backup-before-v2.json`으로 저장한 뒤, 저장소 루트에서 변환기를 실행합니다.

```bash
python scripts/migrate-rtdb-v1-to-v2.py \
  --input backup-before-v2.json \
  --uid-map uid-map.json \
  --output-dir v2-migration-output
```

변환기는 Firebase에 접속하지 않습니다. 다음 3개 파일만 생성합니다.

| 파일 | 용도 |
|---|---|
| `records_v2.json` | Firebase `records_v2` 노드에 올릴 신규 기록 구조 |
| `sync_meta_v2.json` | `schemaVersion: 2` 전환 표시 파일 |
| `migration-report.json` | 서식·기록 건수, UID 미매핑, 중복 ID 등 검증 결과 |

`migration-report.json`의 `safeToImport`가 `true`이고 `problemCount`가 0일 때만 다음 단계로 넘어갑니다. UID가 비어 있는 기록은 전환하지 마십시오.

## 2. 사전 검증

전환 전 아래 숫자가 일치해야 합니다.

| 검증 | 기준 |
|---|---|
| 서식 수 | V1 전체 백업의 기록 배열을 가진 서식 수 = `migration-report.json.formCount` |
| 기록 수 | V1 모든 배열의 기록 수 합계 = `migration-report.json.recordCount` |
| UID 매핑 | `problemCount = 0` |
| 잠금 기록 | V1 잠금 기록 수와 `records_v2.json`의 `workflow.locked=true` 기록 수 일치 |
| 결재 이력 | V1 `signoff`·`audit` 존재 기록 수와 V2 `approvals`·`audit` 노드 존재 기록 수 일치 |

## 3. Firebase 콘솔 전환 순서

1. 현장 기록 입력을 중지합니다.
2. Firebase 콘솔에서 `dkj-fssc22000` 전체 JSON을 다시 한 번 내보냅니다. 이것이 최종 롤백 백업입니다.
3. Realtime Database 데이터 탭에서 `dkj-fssc22000/records_v2` 노드를 선택하고 `records_v2.json`을 **import**합니다. 기존 `records` 노드는 건드리지 않습니다.
4. Realtime Database 규칙 탭에 저장소의 최신 `database.rules.json` 내용을 붙여넣고 게시합니다. 이 규칙은 V1 `records`와 V2 `records_v2`를 모두 읽을 수 있게 두되, V2 쓰기는 레코드 단위로 제한합니다.
5. 테스트용 계정으로 기록 1건을 새로 작성하고, 다른 권한 계정에서 다음을 확인합니다.
   - 다른 작성자의 본문 수정이 거부되는지
   - 잠금 후 본문 수정이 거부되는지
   - 본인 작성 기록의 결재·감사이력이 추가되는지
   - 목록·보관함·정본 인쇄가 기존과 동일하게 동작하는지
6. 두 대의 테스트 기기에서 오프라인 작성 후 온라인 복귀를 시험합니다.
7. 모든 테스트가 통과한 뒤에만 데이터 탭의 `dkj-fssc22000/sync_meta`에 `sync_meta_v2.json` 내용을 import합니다. 이 순간부터 앱은 V2로 동기화합니다.
8. 즉시 관리 PC와 현장 태블릿에서 기록 수, 잠금 상태, 결재이력을 다시 대조합니다.

## 4. 롤백

V2 전환 후 이상이 있으면 즉시 `sync_meta/schemaVersion`을 1 또는 빈 값으로 되돌립니다. 앱은 V1 `records` 배열 동기화로 돌아갑니다. 필요 시 2단계에서 확보한 최종 전체 백업과 이전 Firebase 규칙을 복원합니다.

`records_v2`는 검증 완료 전까지 삭제하지 마십시오. V1 `records` 삭제는 최소 1회 월간 백업·복구시험과 심사 대응 검토가 끝난 후 별도 승인으로 결정합니다.

## 운영 후 점검

전환 뒤 첫 1개월은 주 1회 아래를 확인합니다.

- 동기화 성공·실패 시각과 오프라인 복귀 동작
- 동일 기록을 두 기기에서 다룰 때 충돌 여부
- 잠금 기록 수정·삭제 시도 거부 여부
- Firebase 사용자 계정 퇴사·이동 시 비활성화 여부
- JSON 전체 백업과 복구시험 결과
