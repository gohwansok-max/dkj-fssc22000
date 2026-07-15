/**
 * DKJ-S-02-18 — generated boot
 */
(function () {
  'use strict';
  DkjOxForm.mount({
  "code": "DKJ-S-02-18",
  "title": "운송차량 위생점검표",
  "pattern": "ox",
  "minChecks": 4,
  "titleKey": "vehicleNo",
  "historyKeys": [
    "checkDate",
    "vehicleNo"
  ],
  "fields": [
    {
      "id": "checkDate",
      "label": "점검일자 *",
      "type": "date"
    },
    {
      "id": "vehicleNo",
      "label": "차량번호 *",
      "type": "text",
      "placeholder": "예: 전북12가3456"
    },
    {
      "id": "driver",
      "label": "운전자",
      "type": "text"
    },
    {
      "id": "destination",
      "label": "행선/용도",
      "type": "text",
      "placeholder": "출하·회수 등"
    },
    {
      "id": "shift",
      "label": "시점",
      "type": "select",
      "options": [
        "상차전",
        "하차후",
        "회차"
      ],
      "default": "상차전"
    }
  ],
  "items": [
    {
      "key": "v01",
      "group": "청결",
      "label": "적재함 청결·이물·악취 없음",
      "hint": "세척 후"
    },
    {
      "key": "v02",
      "group": "온도",
      "label": "냉장/보냉 설정·온도 적정",
      "hint": "해당차량"
    },
    {
      "key": "v03",
      "group": "차단",
      "label": "문·패킹·방충 상태 정상",
      "hint": "밀폐"
    },
    {
      "key": "v04",
      "group": "교차",
      "label": "이전적재 오염·알레르겐 잔류 없음",
      "hint": "분리운송"
    },
    {
      "key": "v05",
      "group": "식별",
      "label": "제품·라벨·서류 일치",
      "hint": "상차 전"
    },
    {
      "key": "v06",
      "group": "위생",
      "label": "운전자 복장·손위생 기준 준수",
      "hint": "해당시"
    }
  ],
  "print": {
    "layout": "ox",
    "columnMode": "result",
    "orgName": "동김제농협 가공센터",
    "docNo": "DKJ-S-02-18",
    "title": "운송차량 위생점검표",
    "rev": "0",
    "enactDate": "2026.07.10",
    "reviseDate": "2026.07.10",
    "rows": [
      {
        "key": "v01",
        "group": "청결",
        "label": "적재함 청결·이물·악취 없음",
        "hint": "세척 후",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "v02",
        "group": "온도",
        "label": "냉장/보냉 설정·온도 적정",
        "hint": "해당차량",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "v03",
        "group": "차단",
        "label": "문·패킹·방충 상태 정상",
        "hint": "밀폐",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "v04",
        "group": "교차",
        "label": "이전적재 오염·알레르겐 잔류 없음",
        "hint": "분리운송",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "v05",
        "group": "식별",
        "label": "제품·라벨·서류 일치",
        "hint": "상차 전",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "v06",
        "group": "위생",
        "label": "운전자 복장·손위생 기준 준수",
        "hint": "해당시",
        "freq": "M",
        "ampm": false
      }
    ],
    "note": "※ 평가 — 양호: ○ , 부적합(시정조치 필요): × , 해당없음: —    ※ 주기 — D:매일 W:주간 M:월간"
  }
});
})();
