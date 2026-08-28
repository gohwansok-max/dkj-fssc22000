/**
 * FR-002 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-002",
  "title": "문서배포대장",
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
      "type": "text",
      "default": "0"
    },
    {
      "id": "recipient",
      "label": "배포처 *",
      "type": "text",
      "required": true
    },
    {
      "id": "copies",
      "label": "부수",
      "type": "number",
      "default": 1
    },
    {
      "id": "method",
      "label": "배포방법",
      "type": "select",
      "options": [
        "인쇄",
        "전자",
        "게시"
      ],
      "default": "전자"
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
      "label": "배포 특이사항",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 산지유통센터",
    "docNo": "FR-002",
    "title": "문서배포대장",
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
        "key": "recipient",
        "label": "배포처"
      },
      {
        "key": "copies",
        "label": "부수"
      },
      {
        "key": "method",
        "label": "배포방법"
      }
    ],
    "rows": [],
    "sections": [
      {
        "id": "noteDetail",
        "label": "배포 특이사항"
      }
    ]
  }
});
})();
