/**
 * FR-027 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-027",
  "title": "검교정 계획 및 결과표",
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
      "label": "계측기명 *",
      "type": "text",
      "required": true
    },
    {
      "id": "assetNo",
      "label": "관리번호",
      "type": "text"
    },
    {
      "id": "calDate",
      "label": "교정일",
      "type": "date"
    },
    {
      "id": "agency",
      "label": "교정기관",
      "type": "text"
    },
    {
      "id": "result",
      "label": "결과",
      "type": "select",
      "options": [
        "합격",
        "조정후합격",
        "불합격"
      ],
      "default": "합격"
    },
    {
      "id": "certNo",
      "label": "성적서번호",
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
      "key": "k01",
      "group": "결과",
      "label": "교정성적서 수령",
      "hint": ""
    },
    {
      "key": "k02",
      "group": "결과",
      "label": "라벨 부착",
      "hint": ""
    },
    {
      "key": "k03",
      "group": "결과",
      "label": "대장 반영",
      "hint": ""
    }
  ],
  "sections": [
    {
      "id": "noteDetail",
      "label": "불확도·조치",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 산지유통센터",
    "docNo": "FR-027",
    "title": "검교정 계획 및 결과표",
    "subtitle": "FSSC22000 · 이슈",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "계측기명"
      },
      {
        "key": "assetNo",
        "label": "관리번호"
      },
      {
        "key": "calDate",
        "label": "교정일"
      },
      {
        "key": "agency",
        "label": "교정기관"
      },
      {
        "key": "result",
        "label": "결과"
      },
      {
        "key": "certNo",
        "label": "성적서번호"
      }
    ],
    "rows": [
      {
        "key": "k01",
        "group": "결과",
        "label": "교정성적서 수령",
        "hint": "",
        "freq": "D"
      },
      {
        "key": "k02",
        "group": "결과",
        "label": "라벨 부착",
        "hint": "",
        "freq": "D"
      },
      {
        "key": "k03",
        "group": "결과",
        "label": "대장 반영",
        "hint": "",
        "freq": "D"
      }
    ],
    "sections": [
      {
        "id": "noteDetail",
        "label": "불확도·조치"
      }
    ]
  }
});
})();
