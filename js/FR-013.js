/**
 * FR-013 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-013",
  "title": "구매 발주 및 검토 기록",
  "pattern": "fr",
  "minChecks": 2,
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
      "label": "품명 *",
      "type": "text",
      "required": true
    },
    {
      "id": "supplier",
      "label": "공급업체",
      "type": "text"
    },
    {
      "id": "qty",
      "label": "발주수량",
      "type": "text"
    },
    {
      "id": "unit",
      "label": "단위",
      "type": "select",
      "options": [
        "kg",
        "박스",
        "EA"
      ],
      "default": "kg"
    },
    {
      "id": "needDate",
      "label": "납기요청일",
      "type": "date"
    },
    {
      "id": "poNo",
      "label": "발주번호",
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
      "key": "p01",
      "group": "검토",
      "label": "승인업체 여부",
      "hint": ""
    },
    {
      "key": "p02",
      "group": "검토",
      "label": "규격·사양 명확",
      "hint": ""
    },
    {
      "key": "p03",
      "group": "검토",
      "label": "납기 가능",
      "hint": ""
    }
  ],
  "sections": [
    {
      "id": "spec",
      "label": "규격·품질요건",
      "placeholder": ""
    },
    {
      "id": "review",
      "label": "구매검토 의견",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 가공센터",
    "docNo": "FR-013",
    "title": "구매 발주 및 검토 기록",
    "subtitle": "FSSC22000 · 이슈",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "품명"
      },
      {
        "key": "supplier",
        "label": "공급업체"
      },
      {
        "key": "qty",
        "label": "발주수량"
      },
      {
        "key": "unit",
        "label": "단위"
      },
      {
        "key": "needDate",
        "label": "납기요청일"
      },
      {
        "key": "poNo",
        "label": "발주번호"
      }
    ],
    "rows": [
      {
        "key": "p01",
        "group": "검토",
        "label": "승인업체 여부",
        "hint": "",
        "freq": "D"
      },
      {
        "key": "p02",
        "group": "검토",
        "label": "규격·사양 명확",
        "hint": "",
        "freq": "D"
      },
      {
        "key": "p03",
        "group": "검토",
        "label": "납기 가능",
        "hint": "",
        "freq": "D"
      }
    ],
    "sections": [
      {
        "id": "spec",
        "label": "규격·품질요건"
      },
      {
        "id": "review",
        "label": "구매검토 의견"
      }
    ]
  }
});
})();
