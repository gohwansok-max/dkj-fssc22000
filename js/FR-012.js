/**
 * FR-012 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-012",
  "title": "승인공급업체 목록",
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
      "label": "업체명 *",
      "type": "text",
      "required": true
    },
    {
      "id": "item",
      "label": "공급품목 *",
      "type": "text",
      "required": true
    },
    {
      "id": "contact",
      "label": "담당자/연락처",
      "type": "text"
    },
    {
      "id": "approvedDate",
      "label": "승인일",
      "type": "date"
    },
    {
      "id": "nextEval",
      "label": "차기평가일",
      "type": "date"
    },
    {
      "id": "status",
      "label": "상태",
      "type": "select",
      "options": [
        "승인",
        "정지",
        "제외"
      ],
      "default": "승인"
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
      "label": "비고·제한조건",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 산지유통센터",
    "docNo": "FR-012",
    "title": "승인공급업체 목록",
    "subtitle": "FSSC22000 · 월간",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "업체명"
      },
      {
        "key": "item",
        "label": "공급품목"
      },
      {
        "key": "contact",
        "label": "담당자/연락처"
      },
      {
        "key": "approvedDate",
        "label": "승인일"
      },
      {
        "key": "nextEval",
        "label": "차기평가일"
      },
      {
        "key": "status",
        "label": "상태"
      }
    ],
    "rows": [],
    "sections": [
      {
        "id": "noteDetail",
        "label": "비고·제한조건"
      }
    ]
  }
});
})();
