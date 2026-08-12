/**
 * FR-017 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "FR-017",
  "title": "모의회수 훈련 결과보고서",
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
      "label": "훈련명 *",
      "type": "text",
      "required": true
    },
    {
      "id": "drillDate",
      "label": "실시일",
      "type": "date"
    },
    {
      "id": "scenario",
      "label": "시나리오",
      "type": "text"
    },
    {
      "id": "participants",
      "label": "참석인원",
      "type": "number"
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
      "key": "d01",
      "group": "훈련",
      "label": "연락체계 작동",
      "hint": ""
    },
    {
      "key": "d02",
      "group": "훈련",
      "label": "추적성 확인",
      "hint": ""
    },
    {
      "key": "d03",
      "group": "훈련",
      "label": "회수결정·기록",
      "hint": ""
    },
    {
      "key": "d04",
      "group": "훈련",
      "label": "소요시간 목표 내",
      "hint": ""
    }
  ],
  "sections": [
    {
      "id": "process",
      "label": "훈련 진행 내용",
      "placeholder": ""
    },
    {
      "id": "findings",
      "label": "발견사항·개선점",
      "placeholder": ""
    },
    {
      "id": "followup",
      "label": "후속조치",
      "placeholder": ""
    }
  ],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 가공센터",
    "docNo": "FR-017",
    "title": "모의회수 훈련 결과보고서",
    "subtitle": "FSSC22000 · 연간",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "metaFields": [
      {
        "key": "subject",
        "label": "훈련명"
      },
      {
        "key": "drillDate",
        "label": "실시일"
      },
      {
        "key": "scenario",
        "label": "시나리오"
      },
      {
        "key": "participants",
        "label": "참석인원"
      }
    ],
    "rows": [
      {
        "key": "d01",
        "group": "훈련",
        "label": "연락체계 작동",
        "hint": "",
        "freq": "D"
      },
      {
        "key": "d02",
        "group": "훈련",
        "label": "추적성 확인",
        "hint": "",
        "freq": "D"
      },
      {
        "key": "d03",
        "group": "훈련",
        "label": "회수결정·기록",
        "hint": "",
        "freq": "D"
      },
      {
        "key": "d04",
        "group": "훈련",
        "label": "소요시간 목표 내",
        "hint": "",
        "freq": "D"
      }
    ],
    "sections": [
      {
        "id": "process",
        "label": "훈련 진행 내용"
      },
      {
        "id": "findings",
        "label": "발견사항·개선점"
      },
      {
        "id": "followup",
        "label": "후속조치"
      }
    ]
  }
});
})();
