/**
 * FR-026 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-026",
  "title": "계측기 관리대장",
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
      "label": "계측기명 *",
      "type": "text",
      "required": true
    },
    {
      "id": "assetNo",
      "label": "관리번호",
      "type": "text"
    },
    {
      "id": "location",
      "label": "설치위치",
      "type": "text"
    },
    {
      "id": "range",
      "label": "측정범위",
      "type": "text"
    },
    {
      "id": "calCycle",
      "label": "교정주기",
      "type": "text",
      "default": "1년"
    },
    {
      "id": "nextCal",
      "label": "차기교정일",
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
      "id": "noteDetail",
      "label": "상태·비고",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 가공센터",
    "docNo": "FR-026",
    "title": "계측기 관리대장",
    "subtitle": "FSSC22000 · 월간",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "계측기명"
      },
      {
        "key": "assetNo",
        "label": "관리번호"
      },
      {
        "key": "location",
        "label": "설치위치"
      },
      {
        "key": "range",
        "label": "측정범위"
      },
      {
        "key": "calCycle",
        "label": "교정주기"
      },
      {
        "key": "nextCal",
        "label": "차기교정일"
      }
    ],
    "rows": [],
    "sections": [
      {
        "id": "noteDetail",
        "label": "상태·비고"
      }
    ]
  }
});
})();
