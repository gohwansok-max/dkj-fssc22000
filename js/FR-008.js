/**
 * FR-008 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-008",
  "title": "연간 교육훈련 계획서",
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
      "label": "계획연도 *",
      "type": "text",
      "required": true,
      "placeholder": "2026"
    },
    {
      "id": "owner",
      "label": "교육책임자",
      "type": "text"
    },
    {
      "id": "scope",
      "label": "대상부서",
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
      "id": "planSummary",
      "label": "연간 교육 계획 요약",
      "placeholder": "월별·주제·대상·시간"
    },
    {
      "id": "budget",
      "label": "예산·외부강사",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 가공센터",
    "docNo": "FR-008",
    "title": "연간 교육훈련 계획서",
    "subtitle": "FSSC22000 · 연간",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "계획연도"
      },
      {
        "key": "owner",
        "label": "교육책임자"
      },
      {
        "key": "scope",
        "label": "대상부서"
      }
    ],
    "rows": [],
    "sections": [
      {
        "id": "planSummary",
        "label": "연간 교육 계획 요약"
      },
      {
        "id": "budget",
        "label": "예산·외부강사"
      }
    ]
  }
});
})();
