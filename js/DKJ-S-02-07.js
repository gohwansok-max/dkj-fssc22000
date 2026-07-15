/**
 * DKJ-S-02-07 — generated boot
 */
(function () {
  'use strict';
  DkjOxForm.mount({
  "code": "DKJ-S-02-07",
  "title": "방충방서관리점검일지",
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
    },
    {
      "id": "pestVendor",
      "label": "방제업체/담당",
      "type": "text",
      "placeholder": "해당시"
    }
  ],
  "items": [
    {
      "key": "p01",
      "group": "차단",
      "label": "출입문·방충망·에어커튼 정상",
      "hint": "밀착·파손 없음"
    },
    {
      "key": "p02",
      "group": "트랩",
      "label": "포충등·끈끈이트랩 정상 작동",
      "hint": "부착면·전원"
    },
    {
      "key": "p03",
      "group": "트랩",
      "label": "트랩 포획물·교체주기 관리",
      "hint": "기록 연계"
    },
    {
      "key": "p04",
      "group": "발생",
      "label": "파리·바퀴·쥐 흔적 없음",
      "hint": "배설물·사체"
    },
    {
      "key": "p05",
      "group": "외부",
      "label": "외부 쓰레기·고인물 관리",
      "hint": "유인원 제거"
    },
    {
      "key": "p06",
      "group": "약품",
      "label": "살충·살서제 지정장소 보관",
      "hint": "표시·격리"
    },
    {
      "key": "p07",
      "group": "보고",
      "label": "이상 발견 시 즉시 보고·조치",
      "hint": "해당시"
    }
  ],
  "print": {
    "layout": "ox",
    "columnMode": "result",
    "orgName": "동김제농협 가공센터",
    "docNo": "DKJ-S-02-07",
    "title": "방충방서관리점검일지",
    "rev": "0",
    "enactDate": "2026.07.10",
    "reviseDate": "2026.07.10",
    "rows": [
      {
        "key": "p01",
        "group": "차단",
        "label": "출입문·방충망·에어커튼 정상",
        "hint": "밀착·파손 없음",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "p02",
        "group": "금속",
        "label": "포충등·끈끈이트랩 정상 작동",
        "hint": "부착면·전원",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "p03",
        "group": "트랩",
        "label": "트랩 포획물·교체주기 관리",
        "hint": "기록 연계",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "p04",
        "group": "발생",
        "label": "파리·바퀴·쥐 흔적 없음",
        "hint": "배설물·사체",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "p05",
        "group": "외부",
        "label": "외부 쓰레기·고인물 관리",
        "hint": "유인원 제거",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "p06",
        "group": "약품",
        "label": "살충·살서제 지정장소 보관",
        "hint": "표시·격리",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "p07",
        "group": "보고",
        "label": "이상 발견 시 즉시 보고·조치",
        "hint": "해당시",
        "freq": "M",
        "ampm": false
      }
    ],
    "note": "※ 평가 — 양호: ○ , 부적합(시정조치 필요): × , 해당없음: —    ※ 주기 — D:매일 W:주간 M:월간"
  }
});
})();
