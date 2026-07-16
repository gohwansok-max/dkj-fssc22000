/**
 * FR-022 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-022",
  "title": "시정조치 관리대장",
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
      "label": "CAR번호/제목 *",
      "type": "text",
      "required": true
    },
    {
      "id": "openDate",
      "label": "발행일",
      "type": "date"
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
        "완료",
        "지연"
      ],
      "default": "진행"
    },
    {
      "id": "closeDate",
      "label": "완료일",
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
      "label": "진행 현황·비고",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 가공센터",
    "docNo": "FR-022",
    "title": "시정조치 관리대장",
    "subtitle": "FSSC22000 · 월간",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "CAR번호/제목"
      },
      {
        "key": "openDate",
        "label": "발행일"
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
      },
      {
        "key": "closeDate",
        "label": "완료일"
      }
    ],
    "rows": [],
    "sections": [
      {
        "id": "noteDetail",
        "label": "진행 현황·비고"
      }
    ]
  }
});
})();
