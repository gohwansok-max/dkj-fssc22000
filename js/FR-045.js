/**
 * FR-045 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-045",
  "title": "Loss & Waste 관리표",
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
      "label": "품목/공정 *",
      "type": "text",
      "required": true
    },
    {
      "id": "period",
      "label": "대상기간",
      "type": "text"
    },
    {
      "id": "lossQty",
      "label": "Loss량",
      "type": "text"
    },
    {
      "id": "wasteQty",
      "label": "Waste량",
      "type": "text"
    },
    {
      "id": "unit",
      "label": "단위",
      "type": "text",
      "default": "kg"
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
      "id": "cause",
      "label": "원인분석",
      "placeholder": ""
    },
    {
      "id": "improve",
      "label": "개선대책",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 가공센터",
    "docNo": "FR-045",
    "title": "Loss & Waste 관리표",
    "subtitle": "FSSC22000 · 월간",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "품목/공정"
      },
      {
        "key": "period",
        "label": "대상기간"
      },
      {
        "key": "lossQty",
        "label": "Loss량"
      },
      {
        "key": "wasteQty",
        "label": "Waste량"
      },
      {
        "key": "unit",
        "label": "단위"
      }
    ],
    "rows": [],
    "sections": [
      {
        "id": "cause",
        "label": "원인분석"
      },
      {
        "id": "improve",
        "label": "개선대책"
      }
    ]
  }
});
})();
