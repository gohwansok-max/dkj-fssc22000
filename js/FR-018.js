/**
 * FR-018 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-018",
  "title": "내부심사 실시계획서",
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
      "label": "심사명/연도 *",
      "type": "text",
      "required": true
    },
    {
      "id": "period",
      "label": "계획기간",
      "type": "text"
    },
    {
      "id": "leadAuditor",
      "label": "심사팀장",
      "type": "text"
    },
    {
      "id": "scope",
      "label": "심사범위",
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
      "id": "schedule",
      "label": "일정·부서별 계획",
      "placeholder": ""
    },
    {
      "id": "criteria",
      "label": "심사기준·체크리스트",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 산지유통센터",
    "docNo": "FR-018",
    "title": "내부심사 실시계획서",
    "subtitle": "FSSC22000 · 연간",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "심사명/연도"
      },
      {
        "key": "period",
        "label": "계획기간"
      },
      {
        "key": "leadAuditor",
        "label": "심사팀장"
      },
      {
        "key": "scope",
        "label": "심사범위"
      }
    ],
    "rows": [],
    "sections": [
      {
        "id": "schedule",
        "label": "일정·부서별 계획"
      },
      {
        "id": "criteria",
        "label": "심사기준·체크리스트"
      }
    ]
  }
});
})();
