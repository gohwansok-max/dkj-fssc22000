/**
 * DKJ-S-02-07 - ledger boot (SSOT: data/ledger-form-specs/DKJ-S-02-07.json)
 */
(function () {
  'use strict';
  DkjLedgerForm.mount({
  "rev": "1",
  "enactDate": "2026. 02. 13",
  "reviseDate": "-",
  "orgName": "동김제농협 산지유통센터",
  "pattern": "ledger",
  "code": "DKJ-S-02-07",
  "title": "방충방서 점검일지",
  "subtitle": "선행요건 · 설비별 포집 수량 계수",
  "docNo": "DKJ-S-02-07",
  "infoFields": [
    {
      "id": "checkDate",
      "label": "작성일자",
      "type": "date",
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
      "key": "device",
      "label": "설비명",
      "width": "12%",
      "readonly": true,
      "align": "left"
    },
    {
      "key": "zone",
      "label": "청정도 구분",
      "width": "7%",
      "readonly": true
    },
    {
      "key": "place",
      "label": "설치위치",
      "width": "11%",
      "readonly": true,
      "align": "left"
    },
    {
      "key": "fly",
      "label": "파리",
      "width": "4.6%",
      "type": "num",
      "group": "비래 해충"
    },
    {
      "key": "moth",
      "label": "나방",
      "width": "4.6%",
      "type": "num",
      "group": "비래 해충"
    },
    {
      "key": "mosq",
      "label": "모기",
      "width": "4.6%",
      "type": "num",
      "group": "비래 해충"
    },
    {
      "key": "fruitfly",
      "label": "날파리",
      "width": "4.6%",
      "type": "num",
      "group": "비래 해충"
    },
    {
      "key": "drain",
      "label": "나방파리",
      "width": "4.6%",
      "type": "num",
      "group": "비래 해충"
    },
    {
      "key": "etc1",
      "label": "기타",
      "width": "4.6%",
      "type": "num",
      "group": "비래 해충"
    },
    {
      "key": "sum1",
      "label": "합계",
      "width": "4.6%",
      "type": "num",
      "group": "비래 해충"
    },
    {
      "key": "roach",
      "label": "바퀴",
      "width": "4.6%",
      "type": "num",
      "group": "보행해충"
    },
    {
      "key": "spider",
      "label": "거미",
      "width": "4.6%",
      "type": "num",
      "group": "보행해충"
    },
    {
      "key": "ant",
      "label": "개미",
      "width": "4.6%",
      "type": "num",
      "group": "보행해충"
    },
    {
      "key": "etc2",
      "label": "기타",
      "width": "4.6%",
      "type": "num",
      "group": "보행해충"
    },
    {
      "key": "sum2",
      "label": "합계",
      "width": "4.6%",
      "type": "num",
      "group": "보행해충"
    },
    {
      "key": "rat",
      "label": "쥐",
      "width": "4.6%",
      "type": "num",
      "group": "설치류"
    },
    {
      "key": "etc3",
      "label": "기타",
      "width": "4.6%",
      "type": "num",
      "group": "설치류"
    },
    {
      "key": "sum3",
      "label": "합계",
      "width": "4.6%",
      "type": "num",
      "group": "설치류"
    }
  ],
  "defaultRows": [
    {
      "device": "포충등 1 (6)",
      "zone": "부대시설",
      "place": "위생전실"
    },
    {
      "device": "포충등 2 (7)",
      "zone": "일반구역",
      "place": "전처리실(1)"
    },
    {
      "device": "포충등 3 (8)",
      "zone": "일반구역",
      "place": "전처리실(2)"
    },
    {
      "device": "포충등 4 (9)",
      "zone": "일반구역",
      "place": "전처리실(3)"
    },
    {
      "device": "포충등 5 (10)",
      "zone": "청결구역",
      "place": "소독/헹굼실"
    },
    {
      "device": "포충등 6 (11)",
      "zone": "청결구역",
      "place": "내포장실"
    },
    {
      "device": "포충등 7 (12)",
      "zone": "일반구역",
      "place": "외포장실"
    },
    {
      "device": "포충등 8 (13)",
      "zone": "부대시설",
      "place": "입.출고전실"
    },
    {
      "device": "바퀴트랩 1 (3)",
      "zone": "부대시설",
      "place": "복도(1)"
    },
    {
      "device": "바퀴트랩 2 (4)",
      "zone": "부대시설",
      "place": "복도(2)"
    },
    {
      "device": "바퀴트랩 3 (5)",
      "zone": "부대시설",
      "place": "위생전실"
    },
    {
      "device": "바퀴트랩 4 (6)",
      "zone": "일반구역",
      "place": "전처리실(1)"
    },
    {
      "device": "바퀴트랩 5 (7)",
      "zone": "일반구역",
      "place": "전처리실(2)"
    },
    {
      "device": "바퀴트랩 6 (8)",
      "zone": "청결구역",
      "place": "내포장실"
    },
    {
      "device": "바퀴트랩 7 (9)",
      "zone": "일반구역",
      "place": "전실"
    },
    {
      "device": "바퀴트랩 8 (10)",
      "zone": "일반구역",
      "place": "외포장실"
    },
    {
      "device": "쥐트랩 1",
      "zone": "",
      "place": "1층 탈의실 앞"
    },
    {
      "device": "쥐트랩 2",
      "zone": "",
      "place": "1층 계단 앞"
    },
    {
      "device": "쥐트랩 3",
      "zone": "",
      "place": "1층 화장실 앞"
    },
    {
      "device": "쥐트랩 4",
      "zone": "",
      "place": "입.출고전실 앞"
    },
    {
      "device": "쥐트랩 5",
      "zone": "",
      "place": "기계실 앞"
    },
    {
      "device": "쥐트랩 6",
      "zone": "",
      "place": "1층 소분작업장 앞"
    },
    {
      "device": "쥐트랩 7",
      "zone": "",
      "place": "1층 외포장실 앞 1"
    },
    {
      "device": "쥐트랩 8",
      "zone": "",
      "place": "1층 외포장실 앞 2"
    },
    {
      "device": "쥐트랩 9",
      "zone": "",
      "place": "1층 소독/헹굼실 앞"
    }
  ],
  "infoNote": "[방충방서 모니터링 주기] *하계(하절기) : 5월~10월 – 1회/주 (월 4회 이상) *동계(동절기) : 11월~4월 – 1회/2주 (월 2회 이상)   [방충방서 관리 계절구분] 하계(하절기) / 동계(동절기) 구분에 따라 점검 주기를 달리한다. ※ 작업장 특성 및 보행해충 트랩 유입경로를 고려해 설치위치를 조정한다.",
  "legend": "※ 포집 수량이 관리기준을 초과하면 방제업체에 연락하고 개선조치 내역을 기록한다."
});
})();
