/**
 * FR-011 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-011",
  "title": "공급업체 승인평가표",
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
      "label": "업체명 *",
      "type": "text",
      "required": true
    },
    {
      "id": "item",
      "label": "공급품목",
      "type": "text"
    },
    {
      "id": "evalType",
      "label": "평가구분",
      "type": "select",
      "options": [
        "신규",
        "정기",
        "특별"
      ],
      "default": "신규"
    },
    {
      "id": "result",
      "label": "승인결과",
      "type": "select",
      "options": [
        "승인",
        "조건부승인",
        "반려"
      ],
      "default": "승인"
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
      "key": "s01",
      "group": "자격",
      "label": "영업허가·인허가",
      "hint": ""
    },
    {
      "key": "s02",
      "group": "자격",
      "label": "HACCP/인증 보유",
      "hint": ""
    },
    {
      "key": "s03",
      "group": "품질",
      "label": "품질·위생 수준",
      "hint": ""
    },
    {
      "key": "s04",
      "group": "공급",
      "label": "납기·대응력",
      "hint": ""
    },
    {
      "key": "s05",
      "group": "표시",
      "label": "원산지·표시 적정",
      "hint": ""
    }
  ],
  "sections": [
    {
      "id": "evalDetail",
      "label": "평가내용·증빙",
      "placeholder": ""
    },
    {
      "id": "condition",
      "label": "조건부 시 조치",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 가공센터",
    "docNo": "FR-011",
    "title": "공급업체 승인평가표",
    "subtitle": "FSSC22000 · 이슈",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "업체명"
      },
      {
        "key": "item",
        "label": "공급품목"
      },
      {
        "key": "evalType",
        "label": "평가구분"
      },
      {
        "key": "result",
        "label": "승인결과"
      }
    ],
    "rows": [
      {
        "key": "s01",
        "group": "자격",
        "label": "영업허가·인허가",
        "hint": "",
        "freq": "D"
      },
      {
        "key": "s02",
        "group": "자격",
        "label": "HACCP/인증 보유",
        "hint": "",
        "freq": "D"
      },
      {
        "key": "s03",
        "group": "품질",
        "label": "품질·위생 수준",
        "hint": "",
        "freq": "D"
      },
      {
        "key": "s04",
        "group": "공급",
        "label": "납기·대응력",
        "hint": "",
        "freq": "D"
      },
      {
        "key": "s05",
        "group": "표시",
        "label": "원산지·표시 적정",
        "hint": "",
        "freq": "D"
      }
    ],
    "sections": [
      {
        "id": "evalDetail",
        "label": "평가내용·증빙"
      },
      {
        "id": "condition",
        "label": "조건부 시 조치"
      }
    ]
  }
});
})();
