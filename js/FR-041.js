/**
 * FR-041 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-041",
  "title": "비상상황 발생보고서",
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
      "label": "비상유형 *",
      "type": "text",
      "required": true
    },
    {
      "id": "occurDate",
      "label": "발생일시",
      "type": "date"
    },
    {
      "id": "location",
      "label": "장소",
      "type": "text"
    },
    {
      "id": "severity",
      "label": "심각도",
      "type": "select",
      "options": [
        "낮음",
        "중간",
        "높음"
      ],
      "default": "중간"
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
      "id": "situation",
      "label": "상황 설명",
      "placeholder": ""
    },
    {
      "id": "response",
      "label": "초기대응",
      "placeholder": ""
    },
    {
      "id": "recovery",
      "label": "복구·재발방지",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 가공센터",
    "docNo": "FR-041",
    "title": "비상상황 발생보고서",
    "subtitle": "FSSC22000 · 이슈",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "비상유형"
      },
      {
        "key": "occurDate",
        "label": "발생일시"
      },
      {
        "key": "location",
        "label": "장소"
      },
      {
        "key": "severity",
        "label": "심각도"
      }
    ],
    "rows": [],
    "sections": [
      {
        "id": "situation",
        "label": "상황 설명"
      },
      {
        "id": "response",
        "label": "초기대응"
      },
      {
        "id": "recovery",
        "label": "복구·재발방지"
      }
    ]
  }
});
})();
