/**
 * FR-043 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-043",
  "title": "제품 미생물검사 기록지",
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
      "label": "제품명 *",
      "type": "text",
      "required": true
    },
    {
      "id": "lot",
      "label": "LOT",
      "type": "text"
    },
    {
      "id": "testDate",
      "label": "시험일",
      "type": "date"
    },
    {
      "id": "lab",
      "label": "시험기관",
      "type": "text"
    },
    {
      "id": "result",
      "label": "판정",
      "type": "select",
      "options": [
        "적합",
        "부적합"
      ],
      "default": "적합"
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
      "id": "items",
      "label": "시험항목·결과수치",
      "placeholder": ""
    },
    {
      "id": "action",
      "label": "부적합 시 조치",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 산지유통센터",
    "docNo": "FR-043",
    "title": "제품 미생물검사 기록지",
    "subtitle": "FSSC22000 · 이슈",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "제품명"
      },
      {
        "key": "lot",
        "label": "LOT"
      },
      {
        "key": "testDate",
        "label": "시험일"
      },
      {
        "key": "lab",
        "label": "시험기관"
      },
      {
        "key": "result",
        "label": "판정"
      }
    ],
    "rows": [],
    "sections": [
      {
        "id": "items",
        "label": "시험항목·결과수치"
      },
      {
        "id": "action",
        "label": "부적합 시 조치"
      }
    ]
  }
});
})();
