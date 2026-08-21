/**
 * DKJ-S-02-05 - ledger boot (SSOT: data/ledger-form-specs/DKJ-S-02-05.json)
 */
(function () {
  'use strict';
  DkjLedgerForm.mount({
  "rev": "0",
  "enactDate": "2026. 02. 13",
  "reviseDate": "-",
  "orgName": "동김제농협 산지유통센터",
  "pattern": "ledger",
  "code": "DKJ-S-02-05",
  "title": "작업장 온도 점검일지",
  "subtitle": "선행요건 · 일자별 냉장창고 1차·2차·3차 온도 · 월 단위 시트",
  "docNo": "DKJ-S-02-05",
  "bulkChoiceKeys": [
    "z6_amj",
    "z6_pmj",
    "z6_3j",
    "z7_amj",
    "z7_pmj",
    "z7_3j"
  ],
  "infoFields": [
    {
      "id": "month",
      "label": "점검 월",
      "type": "text",
      "placeholder": "2026년 8월",
      "required": true
    },
    {
      "id": "inspector",
      "label": "점검자",
      "type": "text",
      "required": true,
      "span": 3
    }
  ],
  "columns": [
    {
      "key": "day",
      "label": "점검 일자",
      "width": "6%",
      "readonly": true,
      "repeatOnPages": true
    },
    {
      "key": "dow",
      "label": "점검 요일",
      "width": "6%",
      "readonly": true,
      "repeatOnPages": true
    },
    {
      "key": "z1_am",
      "label": "오전",
      "width": "5%",
      "type": "num",
      "unit": "℃",
      "group": "전처리실 ( 10 ~ 20℃ )"
    },
    {
      "key": "z1_amj",
      "label": "적/부",
      "width": "4%",
      "type": "choice",
      "choices": [
        "적",
        "부"
      ],
      "group": "전처리실 ( 10 ~ 20℃ )"
    },
    {
      "key": "z1_pm",
      "label": "오후",
      "width": "5%",
      "type": "num",
      "unit": "℃",
      "group": "전처리실 ( 10 ~ 20℃ )"
    },
    {
      "key": "z1_pmj",
      "label": "적/부",
      "width": "4%",
      "type": "choice",
      "choices": [
        "적",
        "부"
      ],
      "group": "전처리실 ( 10 ~ 20℃ )"
    },
    {
      "key": "z2_am",
      "label": "오전",
      "width": "5%",
      "type": "num",
      "unit": "℃",
      "group": "소독/헹굼실 ( 10 ~ 20℃ )"
    },
    {
      "key": "z2_amj",
      "label": "적/부",
      "width": "4%",
      "type": "choice",
      "choices": [
        "적",
        "부"
      ],
      "group": "소독/헹굼실 ( 10 ~ 20℃ )"
    },
    {
      "key": "z2_pm",
      "label": "오후",
      "width": "5%",
      "type": "num",
      "unit": "℃",
      "group": "소독/헹굼실 ( 10 ~ 20℃ )"
    },
    {
      "key": "z2_pmj",
      "label": "적/부",
      "width": "4%",
      "type": "choice",
      "choices": [
        "적",
        "부"
      ],
      "group": "소독/헹굼실 ( 10 ~ 20℃ )"
    },
    {
      "key": "z3_am",
      "label": "오전",
      "width": "5%",
      "type": "num",
      "unit": "℃",
      "group": "내포장실 ( 10 ~ 20℃ )"
    },
    {
      "key": "z3_amj",
      "label": "적/부",
      "width": "4%",
      "type": "choice",
      "choices": [
        "적",
        "부"
      ],
      "group": "내포장실 ( 10 ~ 20℃ )"
    },
    {
      "key": "z3_pm",
      "label": "오후",
      "width": "5%",
      "type": "num",
      "unit": "℃",
      "group": "내포장실 ( 10 ~ 20℃ )"
    },
    {
      "key": "z3_pmj",
      "label": "적/부",
      "width": "4%",
      "type": "choice",
      "choices": [
        "적",
        "부"
      ],
      "group": "내포장실 ( 10 ~ 20℃ )"
    },
    {
      "key": "z4_am",
      "label": "오전",
      "width": "5%",
      "type": "num",
      "unit": "℃",
      "group": "외포장실 ( 10 ~ 20℃ )"
    },
    {
      "key": "z4_amj",
      "label": "적/부",
      "width": "4%",
      "type": "choice",
      "choices": [
        "적",
        "부"
      ],
      "group": "외포장실 ( 10 ~ 20℃ )"
    },
    {
      "key": "z4_pm",
      "label": "오후",
      "width": "5%",
      "type": "num",
      "unit": "℃",
      "group": "외포장실 ( 10 ~ 20℃ )"
    },
    {
      "key": "z4_pmj",
      "label": "적/부",
      "width": "4%",
      "type": "choice",
      "choices": [
        "적",
        "부"
      ],
      "group": "외포장실 ( 10 ~ 20℃ )"
    },
    {
      "key": "z5_am",
      "label": "오전",
      "width": "5%",
      "type": "num",
      "unit": "℃",
      "group": "소분작업장 ( 10 ~ 20℃ )"
    },
    {
      "key": "z5_amj",
      "label": "적/부",
      "width": "4%",
      "type": "choice",
      "choices": [
        "적",
        "부"
      ],
      "group": "소분작업장 ( 10 ~ 20℃ )"
    },
    {
      "key": "z5_pm",
      "label": "오후",
      "width": "5%",
      "type": "num",
      "unit": "℃",
      "group": "소분작업장 ( 10 ~ 20℃ )"
    },
    {
      "key": "z5_pmj",
      "label": "적/부",
      "width": "4%",
      "type": "choice",
      "choices": [
        "적",
        "부"
      ],
      "group": "소분작업장 ( 10 ~ 20℃ )"
    },
    {
      "key": "z6_am",
      "label": "1차",
      "width": "5%",
      "type": "num",
      "unit": "℃",
      "group": "원재료 냉장창고 ( 0 ~ 5℃ )"
    },
    {
      "key": "z6_amj",
      "label": "적/부",
      "width": "4%",
      "type": "choice",
      "choices": [
        "적",
        "부"
      ],
      "group": "원재료 냉장창고 ( 0 ~ 5℃ )"
    },
    {
      "key": "z6_pm",
      "label": "2차",
      "width": "5%",
      "type": "num",
      "unit": "℃",
      "group": "원재료 냉장창고 ( 0 ~ 5℃ )"
    },
    {
      "key": "z6_pmj",
      "label": "적/부",
      "width": "4%",
      "type": "choice",
      "choices": [
        "적",
        "부"
      ],
      "group": "원재료 냉장창고 ( 0 ~ 5℃ )"
    },
    {
      "key": "z6_3",
      "label": "3차",
      "width": "5%",
      "type": "num",
      "unit": "℃",
      "group": "원재료 냉장창고 ( 0 ~ 5℃ )"
    },
    {
      "key": "z6_3j",
      "label": "적/부",
      "width": "4%",
      "type": "choice",
      "choices": [
        "적",
        "부"
      ],
      "group": "원재료 냉장창고 ( 0 ~ 5℃ )"
    },
    {
      "key": "z7_am",
      "label": "1차",
      "width": "5%",
      "type": "num",
      "unit": "℃",
      "group": "완제품 냉장창고 ( 0 ~ 5℃ )"
    },
    {
      "key": "z7_amj",
      "label": "적/부",
      "width": "4%",
      "type": "choice",
      "choices": [
        "적",
        "부"
      ],
      "group": "완제품 냉장창고 ( 0 ~ 5℃ )"
    },
    {
      "key": "z7_pm",
      "label": "2차",
      "width": "5%",
      "type": "num",
      "unit": "℃",
      "group": "완제품 냉장창고 ( 0 ~ 5℃ )"
    },
    {
      "key": "z7_pmj",
      "label": "적/부",
      "width": "4%",
      "type": "choice",
      "choices": [
        "적",
        "부"
      ],
      "group": "완제품 냉장창고 ( 0 ~ 5℃ )"
    },
    {
      "key": "z7_3",
      "label": "3차",
      "width": "5%",
      "type": "num",
      "unit": "℃",
      "group": "완제품 냉장창고 ( 0 ~ 5℃ )"
    },
    {
      "key": "z7_3j",
      "label": "적/부",
      "width": "4%",
      "type": "choice",
      "choices": [
        "적",
        "부"
      ],
      "group": "완제품 냉장창고 ( 0 ~ 5℃ )"
    },
    {
      "key": "remark",
      "label": "비고",
      "width": "10%",
      "align": "left"
    }
  ],
  "columnPages": [
    [
      "z1_am",
      "z1_amj",
      "z1_pm",
      "z1_pmj",
      "z2_am",
      "z2_amj",
      "z2_pm",
      "z2_pmj",
      "z3_am",
      "z3_amj",
      "z3_pm",
      "z3_pmj",
      "z4_am",
      "z4_amj",
      "z4_pm",
      "z4_pmj"
    ],
    [
      "z5_am",
      "z5_amj",
      "z5_pm",
      "z5_pmj",
      "z6_am",
      "z6_amj",
      "z6_pm",
      "z6_pmj",
      "z6_3",
      "z6_3j"
    ],
    [
      "z7_am",
      "z7_amj",
      "z7_pm",
      "z7_pmj",
      "z7_3",
      "z7_3j",
      "remark"
    ]
  ],
  "defaultRows": [
    {
      "day": "1",
      "dow": ""
    },
    {
      "day": "2",
      "dow": ""
    },
    {
      "day": "3",
      "dow": ""
    },
    {
      "day": "4",
      "dow": ""
    },
    {
      "day": "5",
      "dow": ""
    },
    {
      "day": "6",
      "dow": ""
    },
    {
      "day": "7",
      "dow": ""
    },
    {
      "day": "8",
      "dow": ""
    },
    {
      "day": "9",
      "dow": ""
    },
    {
      "day": "10",
      "dow": ""
    },
    {
      "day": "11",
      "dow": ""
    },
    {
      "day": "12",
      "dow": ""
    },
    {
      "day": "13",
      "dow": ""
    },
    {
      "day": "14",
      "dow": ""
    },
    {
      "day": "15",
      "dow": ""
    },
    {
      "day": "16",
      "dow": ""
    },
    {
      "day": "17",
      "dow": ""
    },
    {
      "day": "18",
      "dow": ""
    },
    {
      "day": "19",
      "dow": ""
    },
    {
      "day": "20",
      "dow": ""
    },
    {
      "day": "21",
      "dow": ""
    },
    {
      "day": "22",
      "dow": ""
    },
    {
      "day": "23",
      "dow": ""
    },
    {
      "day": "24",
      "dow": ""
    },
    {
      "day": "25",
      "dow": ""
    },
    {
      "day": "26",
      "dow": ""
    },
    {
      "day": "27",
      "dow": ""
    },
    {
      "day": "28",
      "dow": ""
    },
    {
      "day": "29",
      "dow": ""
    },
    {
      "day": "30",
      "dow": ""
    },
    {
      "day": "31",
      "dow": ""
    }
  ],
  "autoWeekday": {
    "monthField": "month",
    "dayKey": "day",
    "weekdayKey": "dow"
  },
  "legend": "※ 관리기준 이탈 시 즉시 조치하고 비고란에 기록한다.  적합 : 적 / 부적합 : 부"
});
})();
