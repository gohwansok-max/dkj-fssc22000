/**
 * DKJ-S-02-02 - ledger boot (SSOT: data/ledger-form-specs/DKJ-S-02-02.json)
 */
(function () {
  'use strict';
  DkjLedgerForm.mount({
  "rev": "0",
  "enactDate": "2026. 02. 13",
  "reviseDate": "-",
  "orgName": "동김제농협 가공센터",
  "pattern": "ledger",
  "code": "DKJ-S-02-02",
  "title": "조도 점검일지",
  "subtitle": "선행요건 · 측정위치별 조도 측정 · 고정 항목",
  "docNo": "DKJ-S-02-02",
  "infoFields": [
    {
      "id": "checkDate",
      "label": "점검일자",
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
      "key": "zone",
      "label": "구 분",
      "width": "10%",
      "readonly": true
    },
    {
      "key": "place",
      "label": "측정 위치",
      "width": "22%",
      "readonly": true,
      "align": "left"
    },
    {
      "key": "point",
      "label": "측정 지점",
      "width": "14%",
      "readonly": true,
      "align": "left"
    },
    {
      "key": "std1",
      "label": "해썹고시 기준치 (Lux)",
      "width": "11%",
      "readonly": true
    },
    {
      "key": "std2",
      "label": "사내 기준치 (Lux)",
      "width": "10%",
      "readonly": true
    },
    {
      "key": "value",
      "label": "측정치 (Lux)",
      "width": "10%",
      "type": "num"
    },
    {
      "key": "offCnt",
      "label": "미점등 개소",
      "width": "8%",
      "type": "num"
    },
    {
      "key": "judge",
      "label": "점검결과",
      "width": "7%",
      "type": "choice",
      "choices": [
        "적합",
        "부적합"
      ]
    },
    {
      "key": "remark",
      "label": "비 고",
      "width": "8%",
      "align": "left"
    }
  ],
  "defaultRows": [
    {
      "zone": "일반 구역",
      "place": "전처리실 1 (절단공정구역)",
      "point": "지상으로부터 1M 지점",
      "std1": "540↑",
      "std2": "700↑"
    },
    {
      "zone": "일반 구역",
      "place": "전처리실 2 (절단공정구역)",
      "point": "지상으로부터 1M 지점",
      "std1": "540↑",
      "std2": "700↑"
    },
    {
      "zone": "일반 구역",
      "place": "소분작업장",
      "point": "지상으로부터 1M 지점",
      "std1": "220↑",
      "std2": ""
    },
    {
      "zone": "청결 구역",
      "place": "소독/헹굼실 1 (소독공정)",
      "point": "지상으로부터 1M 지점",
      "std1": "540↑",
      "std2": "700↑"
    },
    {
      "zone": "청결 구역",
      "place": "소독/헹굼실 2 (1차 헹굼공정)",
      "point": "지상으로부터 1M 지점",
      "std1": "540↑",
      "std2": "700↑"
    },
    {
      "zone": "청결 구역",
      "place": "소독/헹굼실 3 (2차 헹굼공정)",
      "point": "지상으로부터 1M 지점",
      "std1": "540↑",
      "std2": "700↑"
    },
    {
      "zone": "청결 구역",
      "place": "내포장실 1 (선별공정구역)",
      "point": "지상으로부터 1M 지점",
      "std1": "540↑",
      "std2": "700↑"
    },
    {
      "zone": "청결 구역",
      "place": "내포장실 2 (금속검출공정구역)",
      "point": "지상으로부터 1M 지점",
      "std1": "540↑",
      "std2": "700↑"
    },
    {
      "zone": "부대 시설",
      "place": "위생전실",
      "point": "지상으로부터 1M 지점",
      "std1": "220↑",
      "std2": ""
    },
    {
      "zone": "부대 시설",
      "place": "입.출고전실",
      "point": "지상으로부터 1M 지점",
      "std1": "110↑",
      "std2": ""
    },
    {
      "zone": "부대 시설",
      "place": "자재창고",
      "point": "지상으로부터 1M 지점",
      "std1": "110↑",
      "std2": ""
    },
    {
      "zone": "부대 시설",
      "place": "원재료 냉장창고",
      "point": "지상으로부터 1M 지점",
      "std1": "110↑",
      "std2": ""
    },
    {
      "zone": "부대 시설",
      "place": "완제품 냉장창고",
      "point": "지상으로부터 1M 지점",
      "std1": "110↑",
      "std2": ""
    },
    {
      "zone": "부대 시설",
      "place": "남자탈의실",
      "point": "지상으로부터 1M 지점",
      "std1": "110↑",
      "std2": ""
    },
    {
      "zone": "부대 시설",
      "place": "여자탈의실",
      "point": "지상으로부터 1M 지점",
      "std1": "110↑",
      "std2": ""
    },
    {
      "zone": "부대 시설",
      "place": "남자화장실",
      "point": "지상으로부터 1M 지점",
      "std1": "110↑",
      "std2": ""
    },
    {
      "zone": "부대 시설",
      "place": "여자화장실",
      "point": "지상으로부터 1M 지점",
      "std1": "110↑",
      "std2": ""
    },
    {
      "zone": "구분",
      "place": "발생장소",
      "point": "이상발생내역",
      "std1": "조치내역 및 결과",
      "std2": "완료일시"
    }
  ],
  "legend": "※ 측정치가 기준치 미만이면 부적합으로 판정하고 조명 교체·보수 후 재측정한다."
});
})();
