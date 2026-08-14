/**
 * FR-039 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-039",
  "title": "부적합품관리 기록양식 세트",
  "pattern": "fr",
  "minChecks": 0,
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
      "label": "품명 *",
      "type": "text",
      "required": true
    },
    {
      "id": "lot",
      "label": "LOT",
      "type": "text"
    },
    {
      "id": "qty",
      "label": "수량",
      "type": "text"
    },
    {
      "id": "ncType",
      "label": "부적합유형",
      "type": "text"
    },
    {
      "id": "disposition",
      "label": "처리",
      "type": "select",
      "options": [
        "격리",
        "재작업",
        "용도변경",
        "폐기",
        "반품"
      ],
      "default": "격리"
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
  "items": [],
  "sections": [
    {
      "id": "detail",
      "label": "발생내용",
      "placeholder": ""
    },
    {
      "id": "dispose",
      "label": "처리결과·확인",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 산지유통센터",
    "docNo": "FR-039",
    "title": "부적합품관리 기록양식 세트",
    "subtitle": "FSSC22000 · 이슈",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "품명"
      },
      {
        "key": "lot",
        "label": "LOT"
      },
      {
        "key": "qty",
        "label": "수량"
      },
      {
        "key": "ncType",
        "label": "부적합유형"
      },
      {
        "key": "disposition",
        "label": "처리"
      }
    ],
    "rows": [],
    "sections": [
      {
        "id": "detail",
        "label": "발생내용"
      },
      {
        "id": "dispose",
        "label": "처리결과·확인"
      }
    ]
  }
});
})();
