/**
 * FR-046 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-046",
  "title": "설비 예방보전 계획 및 기록",
  "pattern": "fr",
  "minChecks": 2,
  "titleKey": "subject",
  "historyKeys": [
    "docDate",
    "subject"
  ],
  "fields": [
    {
      "id": "docDate",
      "label": "작성일자 *",
      "type": "date",
      "required": true
    },
    {
      "id": "subject",
      "label": "설비명 *",
      "type": "text",
      "required": true
    },
    {
      "id": "assetNo",
      "label": "관리번호",
      "type": "text"
    },
    {
      "id": "pmDate",
      "label": "보전일",
      "type": "date"
    },
    {
      "id": "pmType",
      "label": "구분",
      "type": "select",
      "options": [
        "일상",
        "정기",
        "긴급"
      ],
      "default": "정기"
    },
    {
      "id": "result",
      "label": "결과",
      "type": "select",
      "options": [
        "정상",
        "수리필요",
        "수리완료"
      ],
      "default": "정상"
    },
    {
      "id": "writer",
      "label": "작성자 *",
      "type": "text",
      "required": true
    },
    {
      "id": "reviewer",
      "label": "검토자",
      "type": "text"
    },
    {
      "id": "approver",
      "label": "승인자",
      "type": "text"
    }
  ],
  "items": [
    {
      "key": "m01",
      "group": "PM",
      "label": "외관·이상음",
      "hint": ""
    },
    {
      "key": "m02",
      "group": "PM",
      "label": "윤활·체결",
      "hint": ""
    },
    {
      "key": "m03",
      "group": "PM",
      "label": "안전장치",
      "hint": ""
    },
    {
      "key": "m04",
      "group": "PM",
      "label": "위생상태",
      "hint": ""
    }
  ],
  "sections": [
    {
      "id": "work",
      "label": "작업내용",
      "placeholder": ""
    },
    {
      "id": "parts",
      "label": "부품·소모품",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 가공센터",
    "docNo": "FR-046",
    "title": "설비 예방보전 계획 및 기록",
    "subtitle": "FSSC22000 · 월간",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "설비명"
      },
      {
        "key": "assetNo",
        "label": "관리번호"
      },
      {
        "key": "pmDate",
        "label": "보전일"
      },
      {
        "key": "pmType",
        "label": "구분"
      },
      {
        "key": "result",
        "label": "결과"
      }
    ],
    "rows": [
      {
        "key": "m01",
        "group": "PM",
        "label": "외관·이상음",
        "hint": "",
        "freq": "D"
      },
      {
        "key": "m02",
        "group": "PM",
        "label": "윤활·체결",
        "hint": "",
        "freq": "D"
      },
      {
        "key": "m03",
        "group": "PM",
        "label": "안전장치",
        "hint": "",
        "freq": "D"
      },
      {
        "key": "m04",
        "group": "PM",
        "label": "위생상태",
        "hint": "",
        "freq": "D"
      }
    ],
    "sections": [
      {
        "id": "work",
        "label": "작업내용"
      },
      {
        "id": "parts",
        "label": "부품·소모품"
      }
    ]
  }
});
})();
