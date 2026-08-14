/**
 * FR-004 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-004",
  "title": "외부문서관리대장",
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
      "label": "외부문서명 *",
      "type": "text",
      "required": true
    },
    {
      "id": "issuer",
      "label": "발행기관",
      "type": "text"
    },
    {
      "id": "extNo",
      "label": "문서번호/고시번호",
      "type": "text"
    },
    {
      "id": "recvDate",
      "label": "입수일",
      "type": "date"
    },
    {
      "id": "owner",
      "label": "관리책임자",
      "type": "text"
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
      "label": "적용범위·비고",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 산지유통센터",
    "docNo": "FR-004",
    "title": "외부문서관리대장",
    "subtitle": "FSSC22000 · 월간",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "외부문서명"
      },
      {
        "key": "issuer",
        "label": "발행기관"
      },
      {
        "key": "extNo",
        "label": "문서번호/고시번호"
      },
      {
        "key": "recvDate",
        "label": "입수일"
      },
      {
        "key": "owner",
        "label": "관리책임자"
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
        "label": "적용범위·비고"
      }
    ]
  }
});
})();
