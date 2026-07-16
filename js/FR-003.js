/**
 * FR-003 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-003",
  "title": "문서회수대장",
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
      "label": "회수 개정번호",
      "type": "text"
    },
    {
      "id": "fromDept",
      "label": "회수처 *",
      "type": "text",
      "required": true
    },
    {
      "id": "qty",
      "label": "회수부수",
      "type": "number",
      "default": 1
    },
    {
      "id": "dispose",
      "label": "처리방법",
      "type": "select",
      "options": [
        "폐기",
        "보관",
        "개정본 교체"
      ],
      "default": "폐기"
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
      "label": "회수·폐기 확인",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 가공센터",
    "docNo": "FR-003",
    "title": "문서회수대장",
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
        "label": "회수 개정번호"
      },
      {
        "key": "fromDept",
        "label": "회수처"
      },
      {
        "key": "qty",
        "label": "회수부수"
      },
      {
        "key": "dispose",
        "label": "처리방법"
      }
    ],
    "rows": [],
    "sections": [
      {
        "id": "noteDetail",
        "label": "회수·폐기 확인"
      }
    ]
  }
});
})();
