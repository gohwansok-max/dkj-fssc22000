# 업무 콘솔 생산일·비생산일 관리

업무 콘솔은 `data/console-forms.json`의 `operationCalendar` 설정으로 **정기 일지의 작성 의무일**을 판단합니다. 기본값은 월요일부터 금요일까지 생산일이며, 토요일·일요일은 비생산일입니다.

| 상황 | 설정 위치 | 입력 예시 |
|---|---|---|
| 공휴일·센터 휴무일 | `nonProductionDates` | `"2026-10-05"` |
| 주말 생산·임시 생산일 | `productionDates` | `"2026-09-12"` |
| 정기 생산 요일 변경 | `workdays` | 월~토는 `[1,2,3,4,5,6]` |

```json
"operationCalendar": {
  "label": "기본 생산일: 월요일~금요일",
  "workdays": [1, 2, 3, 4, 5],
  "nonProductionDates": ["2026-10-05", "2026-10-06"],
  "productionDates": ["2026-09-12"]
}
```

비생산일은 오늘 할 일과 작성률의 분모에서 자동 제외되고, 월 캘린더에는 **비생산**으로 표시됩니다. 일정 변경 후에는 `python3 scripts/build-catalog-bundles.py`, `python3 scripts/build-sw-precache.py`를 실행하고 배포합니다.
