/**
 * DKJ-S-02-13 - matrix boot (SSOT: data/matrix-form-specs/DKJ-S-02-13.json)
 */
(function () {
  'use strict';
  DkjMatrixForm.mount({
  "code": "DKJ-S-02-13",
  "title": "저수조관리 점검표",
  "subtitle": "선행요건 · 주간 점검 · 월 단위 시트 · 16항목 × 5주",
  "pattern": "matrix",
  "period": "month",
  "days": 5,
  "divLevels": 2,
  "dayMode": "week",
  "dayLabels": [
    "1주",
    "2주",
    "3주",
    "4주",
    "5주"
  ],
  "showFreq": false,
  "showNote": false,
  "itemHeader": "점검항목",
  "dayHeader": "점검일자 및 결과",
  "docNo": "DKJ-S-02-13",
  "rev": "0",
  "enactDate": "2026. 02. 13",
  "reviseDate": "-",
  "orgName": "동김제농협 가공센터",
  "pageBreakAfter": [],
  "legend": "양호 : ○, 불량 : X    /    점검주기 : 주간",
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
      "major": "용 수 저 장 탱 크",
      "minors": [
        {
          "name": "주변",
          "items": [
            {
              "key": "i01",
              "label": "쓰레기 등 불필요한 물건이 방치되어 있지 않은가?",
              "freq": "W"
            },
            {
              "key": "i02",
              "label": "청소상태는 깨끗한가?",
              "freq": "W"
            }
          ]
        },
        {
          "name": "상부",
          "items": [
            {
              "key": "i03",
              "label": "잠금장치는 제대로 설치되어 있는가?",
              "freq": "W"
            },
            {
              "key": "i04",
              "label": "오염원은 없는가?",
              "freq": "W"
            }
          ]
        },
        {
          "name": "내부",
          "items": [
            {
              "key": "i05",
              "label": "균열 혹은 누수는 없는가?",
              "freq": "W"
            },
            {
              "key": "i06",
              "label": "침전물은 없는가?",
              "freq": "W"
            },
            {
              "key": "i07",
              "label": "부유물질은 없는가?",
              "freq": "W"
            }
          ]
        }
      ]
    },
    {
      "major": "공 급 시 설",
      "minors": [
        {
          "name": "배관",
          "items": [
            {
              "key": "i08",
              "label": "균열 혹은 누수는 없는가?",
              "freq": "W"
            },
            {
              "key": "i09",
              "label": "접합부는 제대로 고정되어 있는가?",
              "freq": "W"
            },
            {
              "key": "i10",
              "label": "침전물 등의 발생은 없는가?",
              "freq": "W"
            }
          ]
        },
        {
          "name": "급수 펌프",
          "items": [
            {
              "key": "i11",
              "label": "정상적으로 작동하는가?",
              "freq": "W"
            },
            {
              "key": "i12",
              "label": "접합부는 제대로 고정되어 있는가?",
              "freq": "W"
            }
          ]
        }
      ]
    },
    {
      "major": "용수",
      "minors": [
        {
          "name": "냄새",
          "items": [
            {
              "key": "i13",
              "label": "물에 불쾌한 냄새가 나지 아니할 것",
              "freq": "W"
            }
          ]
        },
        {
          "name": "맛",
          "items": [
            {
              "key": "i14",
              "label": "물에 이상한 맛이 인지되지 아니할 것",
              "freq": "W"
            }
          ]
        },
        {
          "name": "색도",
          "items": [
            {
              "key": "i15",
              "label": "물에 이상한 색이 나타나지 아니할 것",
              "freq": "W"
            }
          ]
        },
        {
          "name": "탁도",
          "items": [
            {
              "key": "i16",
              "label": "물에 이상한 탁함이 나타나지 아니할 것",
              "freq": "W"
            }
          ]
        }
      ]
    }
  ]
});
})();
