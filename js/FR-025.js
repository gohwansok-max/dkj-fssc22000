/**
 * FR-025 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-025",
  "title": "경영검토 후속조치표",
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
      "label": "조치항목 *",
      "type": "text",
      "required": true
    },
    {
      "id": "owner",
      "label": "책임자",
      "type": "text"
    },
    {
      "id": "dueDate",
      "label": "기한",
      "type": "date"
    },
    {
      "id": "status",
      "label": "상태",
      "type": "select",
      "options": [
        "진행",
        "완료"
      ],
      "default": "진행"
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
      "id": "action",
      "label": "조치내용",
      "placeholder": ""
    },
    {
      "id": "result",
      "label": "완료확인",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 가공센터",
    "docNo": "FR-025",
    "title": "경영검토 후속조치표",
    "subtitle": "FSSC22000 · 이슈",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "조치항목"
      },
      {
        "key": "owner",
        "label": "책임자"
      },
      {
        "key": "dueDate",
        "label": "기한"
      },
      {
        "key": "status",
        "label": "상태"
      }
    ],
    "rows": [],
    "sections": [
      {
        "id": "action",
        "label": "조치내용"
      },
      {
        "id": "result",
        "label": "완료확인"
      }
    ]
  }
});
})();
