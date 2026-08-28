/**
 * FR-030 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-030",
  "title": "의사소통 기록대장",
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
      "label": "주제 *",
      "type": "text",
      "required": true
    },
    {
      "id": "channel",
      "label": "경로",
      "type": "select",
      "options": [
        "내부",
        "고객",
        "관할관청",
        "공급업체",
        "기타"
      ],
      "default": "내부"
    },
    {
      "id": "fromTo",
      "label": "발신/수신",
      "type": "text"
    },
    {
      "id": "commDate",
      "label": "일시",
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
      "id": "content",
      "label": "소통내용",
      "placeholder": ""
    },
    {
      "id": "action",
      "label": "후속조치",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 산지유통센터",
    "docNo": "FR-030",
    "title": "의사소통 기록대장",
    "subtitle": "FSSC22000 · 이슈",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "주제"
      },
      {
        "key": "channel",
        "label": "경로"
      },
      {
        "key": "fromTo",
        "label": "발신/수신"
      },
      {
        "key": "commDate",
        "label": "일시"
      }
    ],
    "rows": [],
    "sections": [
      {
        "id": "content",
        "label": "소통내용"
      },
      {
        "id": "action",
        "label": "후속조치"
      }
    ]
  }
});
})();
