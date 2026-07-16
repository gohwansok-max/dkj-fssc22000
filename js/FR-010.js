/**
 * FR-010 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-010",
  "title": "개인별 역량평가표",
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
      "label": "성명 *",
      "type": "text",
      "required": true
    },
    {
      "id": "dept",
      "label": "부서/직무",
      "type": "text"
    },
    {
      "id": "evalYear",
      "label": "평가연도",
      "type": "text",
      "placeholder": "2026"
    },
    {
      "id": "evaluator",
      "label": "평가자",
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
      "group": "역량",
      "label": "직무지식",
      "hint": ""
    },
    {
      "key": "c02",
      "group": "역량",
      "label": "HACCP/위생",
      "hint": ""
    },
    {
      "key": "c03",
      "group": "역량",
      "label": "작업숙련도",
      "hint": ""
    },
    {
      "key": "c04",
      "group": "역량",
      "label": "법규·절차 준수",
      "hint": ""
    }
  ],
  "sections": [
    {
      "id": "competence",
      "label": "역량 요구사항·평가결과",
      "placeholder": ""
    },
    {
      "id": "gap",
      "label": "갭·교육필요",
      "placeholder": ""
    },
    {
      "id": "plan",
      "label": "개인 개발계획",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 가공센터",
    "docNo": "FR-010",
    "title": "개인별 역량평가표",
    "subtitle": "FSSC22000 · 연간",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "성명"
      },
      {
        "key": "dept",
        "label": "부서/직무"
      },
      {
        "key": "evalYear",
        "label": "평가연도"
      },
      {
        "key": "evaluator",
        "label": "평가자"
      }
    ],
    "rows": [
      {
        "key": "c01",
        "group": "역량",
        "label": "직무지식",
        "hint": "",
        "freq": "D"
      },
      {
        "key": "c02",
        "group": "역량",
        "label": "HACCP/위생",
        "hint": "",
        "freq": "D"
      },
      {
        "key": "c03",
        "group": "역량",
        "label": "작업숙련도",
        "hint": "",
        "freq": "D"
      },
      {
        "key": "c04",
        "group": "역량",
        "label": "법규·절차 준수",
        "hint": "",
        "freq": "D"
      }
    ],
    "sections": [
      {
        "id": "competence",
        "label": "역량 요구사항·평가결과"
      },
      {
        "id": "gap",
        "label": "갭·교육필요"
      },
      {
        "id": "plan",
        "label": "개인 개발계획"
      }
    ]
  }
});
})();
