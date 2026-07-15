/**
 * DKJ-S-02-06 — generated boot
 */
(function () {
  'use strict';
  DkjOxForm.mount({
  "code": "DKJ-S-02-06",
  "title": "환기 및 급·배기시설점검표",
  "pattern": "ox",
  "minChecks": 4,
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
      "key": "v01",
      "group": "필터",
      "label": "급기·배기 필터 오염·파손 없음",
      "hint": "교체주기 확인"
    },
    {
      "key": "v02",
      "group": "덕트",
      "label": "덕트·후드 결로·잔사 없음",
      "hint": "육안점검"
    },
    {
      "key": "v03",
      "group": "운전",
      "label": "팬·모터 이상음·진동 없음",
      "hint": "운전 중"
    },
    {
      "key": "v04",
      "group": "환기",
      "label": "작업장 환기량·공기흐름 적정",
      "hint": "냄새·습기"
    },
    {
      "key": "v05",
      "group": "방충",
      "label": "급배기구 방충망·방서 정상",
      "hint": "파손 없음"
    },
    {
      "key": "v06",
      "group": "청소",
      "label": "필터·후드 청소 실시",
      "hint": "계획 대비"
    }
  ],
  "print": {
    "layout": "ox",
    "columnMode": "result",
    "orgName": "동김제농협 가공센터",
    "docNo": "DKJ-S-02-06",
    "title": "환기 및 급·배기시설점검표",
    "rev": "0",
    "enactDate": "2026.07.10",
    "reviseDate": "2026.07.10",
    "rows": [
      {
        "key": "v01",
        "group": "필터",
        "label": "급기·배기 필터 오염·파손 없음",
        "hint": "교체주기 확인",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "v02",
        "group": "덕트",
        "label": "덕트·후드 결로·잔사 없음",
        "hint": "육안점검",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "v03",
        "group": "운전",
        "label": "팬·모터 이상음·진동 없음",
        "hint": "운전 중",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "v04",
        "group": "환기",
        "label": "작업장 환기량·공기흐름 적정",
        "hint": "냄새·습기",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "v05",
        "group": "방충",
        "label": "급배기구 방충망·방서 정상",
        "hint": "파손 없음",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "v06",
        "group": "청소",
        "label": "필터·후드 청소 실시",
        "hint": "계획 대비",
        "freq": "M",
        "ampm": false
      }
    ],
    "note": "※ 평가 — 양호: ○ , 부적합(시정조치 필요): × , 해당없음: —    ※ 주기 — D:매일 W:주간 M:월간"
  }
});
})();
