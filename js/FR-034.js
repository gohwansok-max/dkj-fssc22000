/**
 * FR-034 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-034",
  "title": "식품사기 예방 실행계획서",
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
      "required": true
    },
    {
      "id": "owner",
      "label": "책임자",
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
      "id": "plan",
      "label": "예방·모니터링 계획",
      "placeholder": ""
    },
    {
      "id": "response",
      "label": "의심시 대응절차",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 가공센터",
    "docNo": "FR-034",
    "title": "식품사기 예방 실행계획서",
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
        "label": "책임자"
      }
    ],
    "rows": [],
    "sections": [
      {
        "id": "plan",
        "label": "예방·모니터링 계획"
      },
      {
        "id": "response",
        "label": "의심시 대응절차"
      }
    ]
  }
});
})();
