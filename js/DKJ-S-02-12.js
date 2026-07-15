/**
 * DKJ-S-02-12 — generated boot
 */
(function () {
  'use strict';
  DkjOxForm.mount({
  "code": "DKJ-S-02-12",
  "title": "제조시설·설비점검표",
  "pattern": "ox",
  "minChecks": 5,
  "titleKey": "area",
  "historyKeys": [
    "checkDate",
    "area"
  ],
  "fields": [
    {
      "id": "checkDate",
      "label": "점검일자 *",
      "type": "date",
      "required": true
    },
    {
      "id": "shift",
      "label": "근무조",
      "type": "select",
      "options": [
        "주간",
        "야간",
        "기타"
      ],
      "default": "주간"
    },
    {
      "id": "area",
      "label": "점검구역",
      "type": "select",
      "options": [
        "전처리",
        "소독헹굼",
        "포장",
        "냉장",
        "전체"
      ],
      "optionLabels": {
        "전처리": "전처리실",
        "소독헹굼": "소독·헹굼실",
        "포장": "포장실",
        "냉장": "냉장창고",
        "전체": "작업장 전체"
      },
      "default": "전체"
    }
  ],
  "items": [
    {
      "key": "e01",
      "group": "절단",
      "label": "절단·슬라이서 청결·보호덮개",
      "hint": "가동 전"
    },
    {
      "key": "e02",
      "group": "세척",
      "label": "세척기·펌프·호스 누수·오염 없음",
      "hint": "연결부"
    },
    {
      "key": "e03",
      "group": "소독",
      "label": "소독조·희석설비 정상",
      "hint": "농도계 연계"
    },
    {
      "key": "e04",
      "group": "컨베이어",
      "label": "벨트·롤러·가드 정상",
      "hint": "이물·마모"
    },
    {
      "key": "e05",
      "group": "포장",
      "label": "포장기·실러 이상 없음",
      "hint": "실링·이물"
    },
    {
      "key": "e06",
      "group": "금속",
      "label": "금속검출기 외관·전원 정상",
      "hint": "CCP-2P 연계"
    },
    {
      "key": "e07",
      "group": "냉장",
      "label": "냉장고·냉동기 운전·결빙 이상 없음",
      "hint": "온도기록"
    },
    {
      "key": "e08",
      "group": "계측",
      "label": "온도계·저울 파손·교정 유효",
      "hint": "검교정 연계"
    }
  ],
  "print": {
    "layout": "ox",
    "columnMode": "result",
    "orgName": "동김제농협 가공센터",
    "docNo": "DKJ-S-02-12",
    "title": "제조시설·설비점검표",
    "rev": "0",
    "enactDate": "2026.07.10",
    "reviseDate": "2026.07.10",
    "rows": [
      {
        "key": "e01",
        "group": "절단",
        "label": "절단·슬라이서 청결·보호덮개",
        "hint": "가동 전",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "e02",
        "group": "세척",
        "label": "세척기·펌프·호스 누수·오염 없음",
        "hint": "연결부",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "e03",
        "group": "소독",
        "label": "소독조·희석설비 정상",
        "hint": "농도계 연계",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "e04",
        "group": "컨베이어",
        "label": "벨트·롤러·가드 정상",
        "hint": "이물·마모",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "e05",
        "group": "포장",
        "label": "포장기·실러 이상 없음",
        "hint": "실링·이물",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "e06",
        "group": "금속",
        "label": "금속검출기 외관·전원 정상",
        "hint": "CCP-2P 연계",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "e07",
        "group": "냉장",
        "label": "냉장고·냉동기 운전·결빙 이상 없음",
        "hint": "온도기록",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "e08",
        "group": "계측",
        "label": "온도계·저울 파손·교정 유효",
        "hint": "검교정 연계",
        "freq": "M",
        "ampm": false
      }
    ],
    "note": "※ 평가 — 양호: ○ , 부적합(시정조치 필요): × , 해당없음: —    ※ 주기 — D:매일 W:주간 M:월간"
  }
});
})();
