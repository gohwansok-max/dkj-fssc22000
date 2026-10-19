/**
 * DKJ-S-02-12 - matrix boot (SSOT: data/matrix-form-specs/DKJ-S-02-12.json)
 */
(async function () {
  'use strict';
  await DkjMatrixForm.mount({
  "code": "DKJ-S-02-12",
  "title": "제조시설·설비점검표",
  "subtitle": "선행요건 · 월 1장 · 설비 상태 매일 O/X",
  "pattern": "matrix",
  "period": "month",
  "dayMode": "day",
  "days": 31,
  "divLevels": 2,
  "showFreq": false,
  "showNote": false,
  "itemHeader": "점검사항",
  "dayHeader": "점검일자 및 결과",
  "docNo": "DKJ-S-02-12",
  "rev": "0",
  "enactDate": "2024. 02. 13",
  "reviseDate": "-",
  "orgName": "동김제농협 산지유통센터",
  "pageBreakAfter": [],
  "printOrientation": "landscape",
  "legend": "양호 : ○, 부적합(시정조치 필요) : ×, 해당없음 : —    /    점검주기 : 매일",
  "signRowLabel": "점검자 (서명)",
  "incident": {
    "label": "이상발생 내역",
    "rows": 3,
    "columns": [
      {
        "key": "detail",
        "label": "발생장소 및 이상 발생내역",
        "width": "36%"
      },
      {
        "key": "action",
        "label": "개선조치 내역 및 결과",
        "width": "36%"
      },
      {
        "key": "actor",
        "label": "조치",
        "width": "14%"
      },
      {
        "key": "confirmer",
        "label": "확인",
        "width": "14%"
      }
    ]
  },
  "groups": [
    {
      "major": "제조시설·설비",
      "minors": [
        {
          "name": "절단",
          "items": [
            {
              "key": "e01",
              "label": "절단·슬라이서 청결·보호덮개 (가동 전)",
              "freq": "D"
            }
          ]
        },
        {
          "name": "세척",
          "items": [
            {
              "key": "e02",
              "label": "세척기·펌프·호스 누수·오염 없음 (연결부)",
              "freq": "D"
            }
          ]
        },
        {
          "name": "소독",
          "items": [
            {
              "key": "e03",
              "label": "소독조·희석설비 정상 (농도계 연계)",
              "freq": "D"
            }
          ]
        },
        {
          "name": "컨베이어",
          "items": [
            {
              "key": "e04",
              "label": "벨트·롤러·가드 정상 (이물·마모)",
              "freq": "D"
            }
          ]
        },
        {
          "name": "포장",
          "items": [
            {
              "key": "e05",
              "label": "포장기·실러 이상 없음 (실링·이물)",
              "freq": "D"
            }
          ]
        },
        {
          "name": "금속",
          "items": [
            {
              "key": "e06",
              "label": "금속검출기 외관·전원 정상 (CCP-2P 연계)",
              "freq": "D"
            }
          ]
        },
        {
          "name": "냉장",
          "items": [
            {
              "key": "e07",
              "label": "냉장고·냉동기 운전·결빙 이상 없음 (온도기록)",
              "freq": "D"
            }
          ]
        },
        {
          "name": "계측",
          "items": [
            {
              "key": "e08",
              "label": "온도계·저울 파손·교정 유효 (검교정 연계)",
              "freq": "D"
            }
          ]
        }
      ]
    }
  ]
});
})();
