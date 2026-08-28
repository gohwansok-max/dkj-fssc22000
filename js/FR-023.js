/**
 * FR-023 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-023",
  "title": "경영검토 입력자료",
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
      "label": "검토연도/회차 *",
      "type": "text",
      "required": true
    },
    {
      "id": "period",
      "label": "대상기간",
      "type": "text"
    },
    {
      "id": "preparedBy",
      "label": "자료작성",
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
      "id": "kpi",
      "label": "목표·KPI·부적합 현황",
      "placeholder": ""
    },
    {
      "id": "audit",
      "label": "내·외부심사·고객피드백",
      "placeholder": ""
    },
    {
      "id": "resource",
      "label": "자원·변경·개선 필요",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 산지유통센터",
    "docNo": "FR-023",
    "title": "경영검토 입력자료",
    "subtitle": "FSSC22000 · 연간",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "검토연도/회차"
      },
      {
        "key": "period",
        "label": "대상기간"
      },
      {
        "key": "preparedBy",
        "label": "자료작성"
      }
    ],
    "rows": [],
    "sections": [
      {
        "id": "kpi",
        "label": "목표·KPI·부적합 현황"
      },
      {
        "id": "audit",
        "label": "내·외부심사·고객피드백"
      },
      {
        "id": "resource",
        "label": "자원·변경·개선 필요"
      }
    ]
  }
});
})();
