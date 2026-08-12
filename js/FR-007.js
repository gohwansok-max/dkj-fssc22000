/**
 * FR-007 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-007",
  "title": "기록폐기대장",
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
      "label": "해당기간",
      "type": "text"
    },
    {
      "id": "disposeDate",
      "label": "폐기일",
      "type": "date"
    },
    {
      "id": "method",
      "label": "폐기방법",
      "type": "select",
      "options": [
        "파쇄",
        "전자삭제"
      ],
      "default": "파쇄"
    },
    {
      "id": "witness",
      "label": "입회자",
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
      "label": "폐기 사유·확인",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 가공센터",
    "docNo": "FR-007",
    "title": "기록폐기대장",
    "subtitle": "FSSC22000 · 이슈",
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
        "label": "해당기간"
      },
      {
        "key": "disposeDate",
        "label": "폐기일"
      },
      {
        "key": "method",
        "label": "폐기방법"
      },
      {
        "key": "witness",
        "label": "입회자"
      }
    ],
    "rows": [],
    "sections": [
      {
        "id": "noteDetail",
        "label": "폐기 사유·확인"
      }
    ]
  }
});
})();
