/**
 * FR-020 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-020",
  "title": "내부심사 결과보고서",
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
      "label": "심사명 *",
      "type": "text",
      "required": true
    },
    {
      "id": "auditDate",
      "label": "심사일",
      "type": "date"
    },
    {
      "id": "leadAuditor",
      "label": "심사팀장",
      "type": "text"
    },
    {
      "id": "ncCount",
      "label": "부적합건수",
      "type": "number",
      "default": 0
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
      "id": "summary",
      "label": "종합 결과",
      "placeholder": ""
    },
    {
      "id": "ncList",
      "label": "부적합·관찰사항",
      "placeholder": ""
    },
    {
      "id": "conclusion",
      "label": "결론·권고",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 가공센터",
    "docNo": "FR-020",
    "title": "내부심사 결과보고서",
    "subtitle": "FSSC22000 · 이슈",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "심사명"
      },
      {
        "key": "auditDate",
        "label": "심사일"
      },
      {
        "key": "leadAuditor",
        "label": "심사팀장"
      },
      {
        "key": "ncCount",
        "label": "부적합건수"
      }
    ],
    "rows": [],
    "sections": [
      {
        "id": "summary",
        "label": "종합 결과"
      },
      {
        "id": "ncList",
        "label": "부적합·관찰사항"
      },
      {
        "id": "conclusion",
        "label": "결론·권고"
      }
    ]
  }
});
})();
