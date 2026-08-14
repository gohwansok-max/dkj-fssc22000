/**
 * FR-037 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-037",
  "title": "환경모니터링 계획서",
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
      "label": "계획연도 *",
      "type": "text",
      "required": true
    },
    {
      "id": "owner",
      "label": "책임자",
      "type": "text"
    },
    {
      "id": "lab",
      "label": "시험기관",
      "type": "text"
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
      "id": "sites",
      "label": "채취지점·주기",
      "placeholder": ""
    },
    {
      "id": "criteria",
      "label": "판정기준·조치",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 산지유통센터",
    "docNo": "FR-037",
    "title": "환경모니터링 계획서",
    "subtitle": "FSSC22000 · 연간",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "계획연도"
      },
      {
        "key": "owner",
        "label": "책임자"
      },
      {
        "key": "lab",
        "label": "시험기관"
      }
    ],
    "rows": [],
    "sections": [
      {
        "id": "sites",
        "label": "채취지점·주기"
      },
      {
        "id": "criteria",
        "label": "판정기준·조치"
      }
    ]
  }
});
})();
