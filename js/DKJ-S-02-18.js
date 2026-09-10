/**
 * DKJ-S-02-18 - ox boot (SSOT: data/ox-form-specs/DKJ-S-02-18.json)
 */
(function () {
  'use strict';
  DkjOxForm.mount({
  "code": "DKJ-S-02-18",
  "title": "운송차량 위생점검표",
  "pattern": "ox",
  "minChecks": 8,
  "titleKey": "vehicleNo1",
  "historyKeys": [
    "checkDate",
    "vehicleNo1",
    "vehicleNo2"
  ],
  "fields": [
    {
      "id": "checkDate",
      "label": "점검일자 *",
      "type": "date"
    },
    {
      "id": "div1",
      "type": "divider",
      "label": "🚚 차량 1"
    },
    {
      "id": "vehicleNo1",
      "label": "차량1 번호 *",
      "type": "select",
      "registryKey": "dkj:registry:DKJ-S-02-18:vehicleNo:v1",
      "options": [
        {
          "value": "",
          "label": "-- 차량번호 선택 --"
        },
        {
          "value": "__register__",
          "label": "+ 새 차량번호 등록"
        }
      ]
    },
    {
      "id": "destination1",
      "label": "차량1 행선/용도",
      "type": "select",
      "options": [
        {
          "value": "",
          "label": "선택"
        },
        "출하",
        "회수"
      ]
    },
    {
      "id": "arrivalPlace1",
      "label": "차량1 도착지",
      "type": "select",
      "options": [
        {
          "value": "",
          "label": "선택"
        },
        "양산",
        "오산"
      ]
    },
    {
      "id": "departTime1",
      "label": "차량1 출발시간",
      "type": "time"
    },
    {
      "id": "arriveTime1",
      "label": "차량1 도착시간",
      "type": "time"
    },
    {
      "id": "div2",
      "type": "divider",
      "label": "🚚 차량 2"
    },
    {
      "id": "vehicleNo2",
      "label": "차량2 번호 *",
      "type": "select",
      "registryKey": "dkj:registry:DKJ-S-02-18:vehicleNo:v1",
      "options": [
        {
          "value": "",
          "label": "-- 차량번호 선택 --"
        },
        {
          "value": "__register__",
          "label": "+ 새 차량번호 등록"
        }
      ]
    },
    {
      "id": "destination2",
      "label": "차량2 행선/용도",
      "type": "select",
      "options": [
        {
          "value": "",
          "label": "선택"
        },
        "출하",
        "회수"
      ]
    },
    {
      "id": "arrivalPlace2",
      "label": "차량2 도착지",
      "type": "select",
      "options": [
        {
          "value": "",
          "label": "선택"
        },
        "양산",
        "오산"
      ]
    },
    {
      "id": "departTime2",
      "label": "차량2 출발시간",
      "type": "time"
    },
    {
      "id": "arriveTime2",
      "label": "차량2 도착시간",
      "type": "time"
    }
  ],
  "items": [
    {
      "key": "t1_01",
      "group": "차량1 · 청결",
      "label": "적재함 청결·이물·악취 없음",
      "hint": "세척 후"
    },
    {
      "key": "t1_02",
      "group": "차량1 · 온도",
      "label": "냉장/보냉 설정·온도 적정",
      "hint": "해당차량"
    },
    {
      "key": "t1_03",
      "group": "차량1 · 차단",
      "label": "문·패킹·방충 상태 정상",
      "hint": "밀폐"
    },
    {
      "key": "t1_04",
      "group": "차량1 · 교차",
      "label": "이전적재 오염·알레르겐 잔류 없음",
      "hint": "분리운송"
    },
    {
      "key": "t1_05",
      "group": "차량1 · 식별",
      "label": "제품·라벨·서류 일치",
      "hint": "상차 전"
    },
    {
      "key": "t1_06",
      "group": "차량1 · 위생",
      "label": "운전자 복장·손위생 기준 준수",
      "hint": "해당시"
    },
    {
      "key": "t2_01",
      "group": "차량2 · 청결",
      "label": "적재함 청결·이물·악취 없음",
      "hint": "세척 후"
    },
    {
      "key": "t2_02",
      "group": "차량2 · 온도",
      "label": "냉장/보냉 설정·온도 적정",
      "hint": "해당차량"
    },
    {
      "key": "t2_03",
      "group": "차량2 · 차단",
      "label": "문·패킹·방충 상태 정상",
      "hint": "밀폐"
    },
    {
      "key": "t2_04",
      "group": "차량2 · 교차",
      "label": "이전적재 오염·알레르겐 잔류 없음",
      "hint": "분리운송"
    },
    {
      "key": "t2_05",
      "group": "차량2 · 식별",
      "label": "제품·라벨·서류 일치",
      "hint": "상차 전"
    },
    {
      "key": "t2_06",
      "group": "차량2 · 위생",
      "label": "운전자 복장·손위생 기준 준수",
      "hint": "해당시"
    }
  ],
  "print": {
    "layout": "official-prp-ox",
    "columnMode": "result",
    "orgName": "동김제농협 산지유통센터",
    "docNo": "DKJ-S-02-18",
    "title": "운송차량 위생점검표",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "rows": [
      {
        "key": "t1_01",
        "group": "차량1 · 청결",
        "label": "적재함 청결·이물·악취 없음",
        "hint": "세척 후",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "t1_02",
        "group": "차량1 · 온도",
        "label": "냉장/보냉 설정·온도 적정",
        "hint": "해당차량",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "t1_03",
        "group": "차량1 · 차단",
        "label": "문·패킹·방충 상태 정상",
        "hint": "밀폐",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "t1_04",
        "group": "차량1 · 교차",
        "label": "이전적재 오염·알레르겐 잔류 없음",
        "hint": "분리운송",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "t1_05",
        "group": "차량1 · 식별",
        "label": "제품·라벨·서류 일치",
        "hint": "상차 전",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "t1_06",
        "group": "차량1 · 위생",
        "label": "운전자 복장·손위생 기준 준수",
        "hint": "해당시",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "t2_01",
        "group": "차량2 · 청결",
        "label": "적재함 청결·이물·악취 없음",
        "hint": "세척 후",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "t2_02",
        "group": "차량2 · 온도",
        "label": "냉장/보냉 설정·온도 적정",
        "hint": "해당차량",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "t2_03",
        "group": "차량2 · 차단",
        "label": "문·패킹·방충 상태 정상",
        "hint": "밀폐",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "t2_04",
        "group": "차량2 · 교차",
        "label": "이전적재 오염·알레르겐 잔류 없음",
        "hint": "분리운송",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "t2_05",
        "group": "차량2 · 식별",
        "label": "제품·라벨·서류 일치",
        "hint": "상차 전",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "t2_06",
        "group": "차량2 · 위생",
        "label": "운전자 복장·손위생 기준 준수",
        "hint": "해당시",
        "freq": "M",
        "ampm": false
      }
    ],
    "note": "※ 평가 — 양호: ○ , 부적합(시정조치 필요): × , 해당없음: —    ※ 주기 — D:매일 W:주간 M:월간    ※ 하루 2대 운행 기준 — 차량1·차량2 각각 기록",
    "subtitle": "선행요건 · 출하/회차 · 1일 2대",
    "sectionTitle": "● 운송차량 위생점검 결과 (차량 1 · 차량 2) ●",
    "showMeta": [
      "vehicleNo1",
      "destination1",
      "arrivalPlace1",
      "departTime1",
      "arriveTime1",
      "vehicleNo2",
      "destination2",
      "arrivalPlace2",
      "departTime2",
      "arriveTime2"
    ],
    "metaFields": [
      {
        "key": "vehicleNo1",
        "label": "차량1 번호"
      },
      {
        "key": "vehicleNo2",
        "label": "차량2 번호"
      },
      {
        "key": "destination1",
        "label": "차량1 행선/용도"
      },
      {
        "key": "destination2",
        "label": "차량2 행선/용도"
      },
      {
        "key": "arrivalPlace1",
        "label": "차량1 도착지"
      },
      {
        "key": "arrivalPlace2",
        "label": "차량2 도착지"
      },
      {
        "key": "departTime1",
        "label": "차량1 출발시간"
      },
      {
        "key": "departTime2",
        "label": "차량2 출발시간"
      },
      {
        "key": "arriveTime1",
        "label": "차량1 도착시간"
      },
      {
        "key": "arriveTime2",
        "label": "차량2 도착시간"
      }
    ]
  }
});
})();
