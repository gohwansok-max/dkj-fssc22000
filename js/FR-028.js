/**
 * FR-028 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-028",
  "title": "변경관리 신청서",
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
      "label": "변경제목 *",
      "type": "text",
      "required": true
    },
    {
      "id": "changeType",
      "label": "변경유형",
      "type": "select",
      "options": [
        "설비",
        "원료",
        "공정",
        "문서",
        "기타"
      ],
      "default": "공정"
    },
    {
      "id": "requestor",
      "label": "신청자",
      "type": "text"
    },
    {
      "id": "targetDate",
      "label": "희망시행일",
      "type": "date"
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
      "id": "current",
      "label": "현황",
      "placeholder": ""
    },
    {
      "id": "proposed",
      "label": "변경안",
      "placeholder": ""
    },
    {
      "id": "reason",
      "label": "사유",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 가공센터",
    "docNo": "FR-028",
    "title": "변경관리 신청서",
    "subtitle": "FSSC22000 · 이슈",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "변경제목"
      },
      {
        "key": "changeType",
        "label": "변경유형"
      },
      {
        "key": "requestor",
        "label": "신청자"
      },
      {
        "key": "targetDate",
        "label": "희망시행일"
      }
    ],
    "rows": [],
    "sections": [
      {
        "id": "current",
        "label": "현황"
      },
      {
        "id": "proposed",
        "label": "변경안"
      },
      {
        "id": "reason",
        "label": "사유"
      }
    ]
  }
});
})();
