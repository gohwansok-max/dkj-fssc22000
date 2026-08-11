/**
 * DKJ-H-01-11 - report boot (SSOT: data/report-form-specs/DKJ-H-01-11.json)
 */
(function () {
  'use strict';
  DkjReportForm.mount({
  "code": "DKJ-H-01-11",
  "title": "교육・훈련 일지",
  "subtitle": "HACCP · 교육 실시 시마다 · 참석자 명단 포함",
  "pattern": "report",
  "docNo": "DKJ-H-01-11",
  "rev": "0",
  "enactDate": "2026. 02. 13",
  "reviseDate": "-",
  "orgName": "동김제농협 가공센터",
  "titleField": "eduDate",
  "blocks": [
    {
      "type": "pairs",
      "label": "기본정보",
      "perRow": 2,
      "fields": [
        {
          "id": "writeDate",
          "label": "작성일자",
          "type": "date",
          "required": true
        },
        {
          "id": "writer2",
          "label": "작 성 자",
          "required": true
        }
      ]
    },
    {
      "type": "check",
      "id": "category",
      "label": "교육・훈련 구분",
      "required": true,
      "options": [
        "HACCP교육",
        "선행요건교육",
        "위생교육",
        "기타"
      ]
    },
    {
      "type": "check",
      "id": "kind",
      "label": "교육・훈련 종류",
      "required": true,
      "options": [
        "정기교육",
        "수시교육",
        "외부교육",
        "특별교육"
      ]
    },
    {
      "type": "pairs",
      "label": "교육 정보",
      "perRow": 2,
      "fields": [
        {
          "id": "eduDate",
          "label": "교육일자",
          "type": "date",
          "required": true
        },
        {
          "id": "teacher",
          "label": "교육담당자",
          "required": true
        },
        {
          "id": "place",
          "label": "교육장소"
        },
        {
          "id": "time",
          "label": "교육시간",
          "placeholder": "08:00 ~ 08:30"
        },
        {
          "id": "targetCnt",
          "label": "교육대상 (명)"
        },
        {
          "id": "joinCnt",
          "label": "참석인원 (명)"
        },
        {
          "id": "absentCnt",
          "label": "미참석인원 (명)"
        },
        {
          "id": "subject",
          "label": "교육주제",
          "required": true
        }
      ]
    },
    {
      "type": "text",
      "id": "content",
      "label": "교 육 내 용",
      "height": 110,
      "uiRows": 7,
      "required": true
    },
    {
      "type": "table",
      "id": "attendees",
      "label": "참석자 명단 및 평가",
      "rows": 16,
      "columns": [
        {
          "key": "no",
          "label": "NO",
          "width": "8%",
          "align": "center"
        },
        {
          "key": "name",
          "label": "성명",
          "width": "30%"
        },
        {
          "key": "sign",
          "label": "확인(사인)",
          "width": "30%"
        },
        {
          "key": "remark",
          "label": "비고",
          "width": "32%"
        }
      ]
    },
    {
      "type": "text",
      "id": "remark",
      "label": "비 고",
      "height": 40,
      "uiRows": 2
    }
  ],
  "legend": "※ 교육 참석자는 본인이 직접 서명하며, 미참석자는 별도 보충교육을 실시한다."
});
})();
