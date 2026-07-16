/**
 * FR-005 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-005",
  "title": "폐기문서관리대장",
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
      "label": "문서명 *",
      "type": "text",
      "required": true
    },
    {
      "id": "docCode",
      "label": "문서번호",
      "type": "text"
    },
    {
      "id": "rev",
      "label": "개정번호",
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
        "소각",
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
      "label": "폐기 사유",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 가공센터",
    "docNo": "FR-005",
    "title": "폐기문서관리대장",
    "subtitle": "FSSC22000 · 이슈",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "문서명"
      },
      {
        "key": "docCode",
        "label": "문서번호"
      },
      {
        "key": "rev",
        "label": "개정번호"
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
        "label": "폐기 사유"
      }
    ]
  }
});
})();
