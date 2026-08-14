/**
 * FR-021 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-021",
  "title": "시정조치 요구서(CAR)",
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
      "label": "제목 *",
      "type": "text",
      "required": true
    },
    {
      "id": "source",
      "label": "발생원",
      "type": "select",
      "options": [
        "내부심사",
        "이탈",
        "고객불만",
        "기타"
      ],
      "default": "이탈"
    },
    {
      "id": "dueDate",
      "label": "조치기한",
      "type": "date"
    },
    {
      "id": "owner",
      "label": "조치책임자",
      "type": "text"
    },
    {
      "id": "status",
      "label": "상태",
      "type": "select",
      "options": [
        "접수",
        "조치중",
        "완료",
        "유효성확인"
      ],
      "default": "접수"
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
      "id": "problem",
      "label": "문제·부적합 내용",
      "placeholder": ""
    },
    {
      "id": "rootCause",
      "label": "원인분석",
      "placeholder": ""
    },
    {
      "id": "correctivePlan",
      "label": "시정·예방조치",
      "placeholder": ""
    },
    {
      "id": "effectiveness",
      "label": "유효성 확인",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 산지유통센터",
    "docNo": "FR-021",
    "title": "시정조치 요구서(CAR)",
    "subtitle": "FSSC22000 · 이슈",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "제목"
      },
      {
        "key": "source",
        "label": "발생원"
      },
      {
        "key": "dueDate",
        "label": "조치기한"
      },
      {
        "key": "owner",
        "label": "조치책임자"
      },
      {
        "key": "status",
        "label": "상태"
      }
    ],
    "rows": [],
    "sections": [
      {
        "id": "problem",
        "label": "문제·부적합 내용"
      },
      {
        "id": "rootCause",
        "label": "원인분석"
      },
      {
        "id": "correctivePlan",
        "label": "시정·예방조치"
      },
      {
        "id": "effectiveness",
        "label": "유효성 확인"
      }
    ]
  }
});
})();
