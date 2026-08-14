/**
 * FR-047 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-047",
  "title": "식품안전문화 평가표",
  "pattern": "fr",
  "minChecks": 3,
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
      "label": "평가연도 *",
      "type": "text",
      "required": true
    },
    {
      "id": "evalDate",
      "label": "평가일",
      "type": "date"
    },
    {
      "id": "team",
      "label": "평가팀",
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
  "items": [
    {
      "key": "c01",
      "group": "문화",
      "label": "리더십·비전 공유",
      "hint": ""
    },
    {
      "key": "c02",
      "group": "문화",
      "label": "의사소통·보고 문화",
      "hint": ""
    },
    {
      "key": "c03",
      "group": "문화",
      "label": "교육·참여",
      "hint": ""
    },
    {
      "key": "c04",
      "group": "문화",
      "label": "현장 실행력",
      "hint": ""
    },
    {
      "key": "c05",
      "group": "문화",
      "label": "인정·보상",
      "hint": ""
    }
  ],
  "sections": [
    {
      "id": "summary",
      "label": "종합의견",
      "placeholder": ""
    },
    {
      "id": "improve",
      "label": "개선과제",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 산지유통센터",
    "docNo": "FR-047",
    "title": "식품안전문화 평가표",
    "subtitle": "FSSC22000 · 연간",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "평가연도"
      },
      {
        "key": "evalDate",
        "label": "평가일"
      },
      {
        "key": "team",
        "label": "평가팀"
      }
    ],
    "rows": [
      {
        "key": "c01",
        "group": "문화",
        "label": "리더십·비전 공유",
        "hint": "",
        "freq": "D"
      },
      {
        "key": "c02",
        "group": "문화",
        "label": "의사소통·보고 문화",
        "hint": "",
        "freq": "D"
      },
      {
        "key": "c03",
        "group": "문화",
        "label": "교육·참여",
        "hint": "",
        "freq": "D"
      },
      {
        "key": "c04",
        "group": "문화",
        "label": "현장 실행력",
        "hint": "",
        "freq": "D"
      },
      {
        "key": "c05",
        "group": "문화",
        "label": "인정·보상",
        "hint": "",
        "freq": "D"
      }
    ],
    "sections": [
      {
        "id": "summary",
        "label": "종합의견"
      },
      {
        "id": "improve",
        "label": "개선과제"
      }
    ]
  }
});
})();
