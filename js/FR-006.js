/**
 * FR-006 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-006",
  "title": "기록관리대장",
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
      "label": "기록명 *",
      "type": "text",
      "required": true
    },
    {
      "id": "formCode",
      "label": "양식번호",
      "type": "text"
    },
    {
      "id": "period",
      "label": "기록기간",
      "type": "text"
    },
    {
      "id": "keeper",
      "label": "보관부서",
      "type": "text"
    },
    {
      "id": "retention",
      "label": "보존기간",
      "type": "text",
      "default": "3년"
    },
    {
      "id": "location",
      "label": "보관위치",
      "type": "text"
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
      "id": "noteDetail",
      "label": "이관·폐기 계획",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 가공센터",
    "docNo": "FR-006",
    "title": "기록관리대장",
    "subtitle": "FSSC22000 · 월간",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "기록명"
      },
      {
        "key": "formCode",
        "label": "양식번호"
      },
      {
        "key": "period",
        "label": "기록기간"
      },
      {
        "key": "keeper",
        "label": "보관부서"
      },
      {
        "key": "retention",
        "label": "보존기간"
      },
      {
        "key": "location",
        "label": "보관위치"
      }
    ],
    "rows": [],
    "sections": [
      {
        "id": "noteDetail",
        "label": "이관·폐기 계획"
      }
    ]
  }
});
})();
