/**
 * FR-009 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-009",
  "title": "교육훈련 실시 및 평가 기록",
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
      "label": "교육주제 *",
      "type": "text",
      "required": true
    },
    {
      "id": "eduDate",
      "label": "교육일",
      "type": "date"
    },
    {
      "id": "hours",
      "label": "교육시간(h)",
      "type": "number",
      "default": 1
    },
    {
      "id": "trainer",
      "label": "강사",
      "type": "text"
    },
    {
      "id": "attendees",
      "label": "참석인원",
      "type": "number"
    },
    {
      "id": "place",
      "label": "장소",
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
      "key": "e01",
      "group": "출석",
      "label": "출석 확인 완료",
      "hint": ""
    },
    {
      "key": "e02",
      "group": "자료",
      "label": "교육자료 배포",
      "hint": ""
    },
    {
      "key": "e03",
      "group": "평가",
      "label": "평가 실시",
      "hint": ""
    },
    {
      "key": "e04",
      "group": "기록",
      "label": "기록 보관",
      "hint": ""
    }
  ],
  "sections": [
    {
      "id": "content",
      "label": "교육내용",
      "placeholder": ""
    },
    {
      "id": "evaluation",
      "label": "평가결과·이해도",
      "placeholder": ""
    },
    {
      "id": "followup",
      "label": "추가교육·개선사항",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 가공센터",
    "docNo": "FR-009",
    "title": "교육훈련 실시 및 평가 기록",
    "subtitle": "FSSC22000 · 이슈",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "교육주제"
      },
      {
        "key": "eduDate",
        "label": "교육일"
      },
      {
        "key": "hours",
        "label": "교육시간(h)"
      },
      {
        "key": "trainer",
        "label": "강사"
      },
      {
        "key": "attendees",
        "label": "참석인원"
      },
      {
        "key": "place",
        "label": "장소"
      }
    ],
    "rows": [
      {
        "key": "e01",
        "group": "출석",
        "label": "출석 확인 완료",
        "hint": "",
        "freq": "D"
      },
      {
        "key": "e02",
        "group": "자료",
        "label": "교육자료 배포",
        "hint": "",
        "freq": "D"
      },
      {
        "key": "e03",
        "group": "평가",
        "label": "평가 실시",
        "hint": "",
        "freq": "D"
      },
      {
        "key": "e04",
        "group": "기록",
        "label": "기록 보관",
        "hint": "",
        "freq": "D"
      }
    ],
    "sections": [
      {
        "id": "content",
        "label": "교육내용"
      },
      {
        "id": "evaluation",
        "label": "평가결과·이해도"
      },
      {
        "id": "followup",
        "label": "추가교육·개선사항"
      }
    ]
  }
});
})();
