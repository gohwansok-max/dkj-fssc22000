/**
 * DKJ-S-02-04 — generated boot
 */
(function () {
  'use strict';
  DkjOxForm.mount({
  "code": "DKJ-S-02-04",
  "title": "이물관리점검일지",
  "pattern": "ox",
  "minChecks": 5,
  "titleKey": "area",
  "historyKeys": [
    "checkDate",
    "area"
  ],
  "fields": [
    {
      "id": "checkDate",
      "label": "점검일자 *",
      "type": "date",
      "required": true
    },
    {
      "id": "shift",
      "label": "근무조",
      "type": "select",
      "options": [
        "주간",
        "야간",
        "기타"
      ],
      "default": "주간"
    },
    {
      "id": "area",
      "label": "점검구역",
      "type": "select",
      "options": [
        "전처리",
        "소독헹굼",
        "포장",
        "냉장",
        "전체"
      ],
      "optionLabels": {
        "전처리": "전처리실",
        "소독헹굼": "소독·헹굼실",
        "포장": "포장실",
        "냉장": "냉장창고",
        "전체": "작업장 전체"
      },
      "default": "전체"
    }
  ],
  "items": [
    {
      "key": "i01",
      "group": "원료",
      "label": "원료 이물·이취·변질 이상 없음",
      "hint": "입고·투입 전"
    },
    {
      "key": "i02",
      "group": "선별",
      "label": "이물선별대·조명 정상",
      "hint": "작업 시작 전"
    },
    {
      "key": "i03",
      "group": "설비",
      "label": "설비·벨트 잔사·금속·유리 없음",
      "hint": "가동 전후"
    },
    {
      "key": "i04",
      "group": "공구",
      "label": "칼·가위·집게 파손·분실 없음",
      "hint": "수량 확인"
    },
    {
      "key": "i05",
      "group": "포장",
      "label": "포장재 파손·이물 혼입 없음",
      "hint": "포장 전"
    },
    {
      "key": "i06",
      "group": "바닥",
      "label": "바닥·배수로 이물·잔사 없음",
      "hint": "청소 후"
    },
    {
      "key": "i07",
      "group": "조명",
      "label": "조명커버·방폭커버 파손 없음",
      "hint": "비산방지"
    },
    {
      "key": "i08",
      "group": "기록",
      "label": "이물 발견 시 즉시 보고·격리",
      "hint": "해당시"
    }
  ],
  "print": {
    "layout": "ox",
    "columnMode": "result",
    "orgName": "동김제농협 가공센터",
    "docNo": "DKJ-S-02-04",
    "title": "이물관리점검일지",
    "rev": "0",
    "enactDate": "2026.07.10",
    "reviseDate": "2026.07.10",
    "rows": [
      {
        "key": "i01",
        "group": "원료",
        "label": "원료 이물·이취·변질 이상 없음",
        "hint": "입고·투입 전",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "i02",
        "group": "선별",
        "label": "이물선별대·조명 정상",
        "hint": "작업 시작 전",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "i03",
        "group": "설비",
        "label": "설비·벨트 잔사·금속·유리 없음",
        "hint": "가동 전후",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "i04",
        "group": "공구",
        "label": "칼·가위·집게 파손·분실 없음",
        "hint": "수량 확인",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "i05",
        "group": "포장",
        "label": "포장재 파손·이물 혼입 없음",
        "hint": "포장 전",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "i06",
        "group": "바닥",
        "label": "바닥·배수로 이물·잔사 없음",
        "hint": "청소 후",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "i07",
        "group": "조명",
        "label": "조명커버·방폭커버 파손 없음",
        "hint": "비산방지",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "i08",
        "group": "기록",
        "label": "이물 발견 시 즉시 보고·격리",
        "hint": "해당시",
        "freq": "D",
        "ampm": false
      }
    ],
    "note": "※ 평가 — 양호: ○ , 부적합(시정조치 필요): × , 해당없음: —    ※ 주기 — D:매일 W:주간 M:월간"
  }
});
})();
