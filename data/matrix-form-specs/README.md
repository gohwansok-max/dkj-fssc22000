# 유형 A — 항목 × 날짜 매트릭스 서식

종이 정본이 **"한 장 = 여러 날짜"** 인 서식을 위한 규격이다.
기존 `ox`(1장 = 1일, 결과 열 1개)로는 종이와 같은 인쇄물이 나오지 않는다.

## 적용 대상 (원본 실측 기준)

| 서식 | 열 구성 | 상태 |
|---|---|---|
| DKJ-S-02-01 작업장 위생점검 일지 | 점검일자 6열(월~토), 주 단위 결재 | ✅ 구현 |
| DKJ-S-02-03 개인위생 점검일지 | 점검일자 다수열 | ⬜ 미적용 |
| DKJ-S-02-13 저수조관리 점검표 | 1주~5주 5열 (`period: "month"`) | ⬜ 미적용 |

## 구성 파일

```
data/matrix-form-specs/<CODE>.json   ← SSOT (스펙 원본)
js/<CODE>.js                          ← 위 JSON을 인라인한 부트 스크립트
js/dkj-matrix-form.js                 ← 입력 엔진 (공용)
js/dkj-matrix-print.js                ← 정본 인쇄 엔진 (공용)
css/dkj-matrix.css                    ← 화면 입력 UI (공용)
css/dkj-print.css `.off-matrix` 블록  ← 인쇄 스타일 (공용)
```

새 서식 추가 시 **JSON 하나 + 부트 스크립트 + HTML 한 장**만 만들면 된다.
엔진·CSS는 건드리지 않는다.

## 스펙 필드

| 키 | 설명 |
|---|---|
| `pattern` | `"matrix"` 고정 |
| `period` | `"week"` \| `"month"` — 기록 단위 |
| `days` | 날짜 열 개수 (작업장 위생 = 6) |
| `dayLabels` | 열 머리 보조 라벨 (`["월","화",...]`) |
| `pageBreakAfter` | 쪽 나눔 위치. 종이 원본의 쪽 구성을 그대로 재현한다 (예: `[20]`) |
| `legend` | 하단 평가·범례 문구 (원본 문구 그대로) |
| `signRowLabel` | 일자별 작성 서명행 라벨 |
| `incident` | 이상 발생 내역표 정의 (`label`, `rows`, `columns[]`) |
| `groups[]` | `{ major, minors[{ name, items[{ key, label, freq }] }] }` — 구분 2단계 |

`groups`의 계층이 인쇄물의 `rowspan`을 그대로 만든다.
`major`/`minor`가 연속으로 같으면 자동 병합된다.

## 저장 모델

`1 레코드 = 1 기간(주/월)`. 날짜별 값은 배열로 보관한다.

```json
{
  "weekStart": "2026-08-10",
  "days": ["2026-08-10", "...x6"],
  "checks": { "i01": ["O","O","X","","",""] },
  "notes":  { "i01": "" },
  "signs":  ["고환석","","","","",""],
  "incidents": [{ "occurredAt":"", "place":"", "detail":"", "action":"", "doneAt":"", "actor":"", "confirmer":"" }],
  "approvals": { "writer":"", "reviewer":"", "approver":"" },
  "locked": false
}
```

## 입력 규칙

- 셀 클릭 시 `공란 → ○ → × → —` 순환
- 저장 조건: 작성자 입력 + **최소 하루치 전 항목 완료**
- `×`가 있으면 **이상 발생 내역 1건 이상 필수** (HACCP 시정조치 기록 요건)
- `작성완료`(잠금) 후에는 전체 입력 비활성화

## 항목 추출 방법

종이 원본(.hwp)에서 항목을 옮길 때는 수작업 대신 변환을 쓴다.

```bash
pip install pyhwp
hwp5html --output out 원본.hwp     # out/index.xhtml 의 <table>에서 rowspan/colspan 복원
```

`구분 / 소분류 / 점검사항 / 주기(D·W·M)` 열을 그대로 읽어 `groups`로 옮기면
문구 오타 없이 정본과 일치시킬 수 있다.
