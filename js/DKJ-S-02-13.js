/**
 * DKJ-S-02-13 — generated boot
 */
(function () {
  'use strict';
  DkjOxForm.mount({
  "code": "DKJ-S-02-13",
  "title": "저수조 물탱크 위생점검일지",
  "pattern": "ox",
  "minChecks": 4,
  "historyKeys": [
    "checkDate"
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
      "id": "tankId",
      "label": "탱크/구역",
      "type": "text",
      "placeholder": "예: 저수조1",
      "default": "저수조1"
    }
  ],
  "items": [
    {
      "key": "w01",
      "group": "외관",
      "label": "탱크 덮개·밀폐·잠금 정상",
      "hint": "이물유입 방지"
    },
    {
      "key": "w02",
      "group": "위생",
      "label": "탱크 내부·배관 이끼·스케일 이상 없음",
      "hint": "육안"
    },
    {
      "key": "w03",
      "group": "청소",
      "label": "청소·소독 실시(주기 내)",
      "hint": "계획 대비"
    },
    {
      "key": "w04",
      "group": "수질",
      "label": "탁도·이취·이물 없음",
      "hint": "취수·사용수"
    },
    {
      "key": "w05",
      "group": "잔류염소",
      "label": "잔류염소·수질기준 준수",
      "hint": "해당시 측정"
    },
    {
      "key": "w06",
      "group": "기록",
      "label": "수질검사·위생기록 보관",
      "hint": "성적서"
    }
  ],
  "print": {
    "layout": "ox",
    "columnMode": "result",
    "orgName": "동김제농협 가공센터",
    "docNo": "DKJ-S-02-13",
    "title": "저수조 물탱크 위생점검일지",
    "rev": "0",
    "enactDate": "2026.07.10",
    "reviseDate": "2026.07.10",
    "rows": [
      {
        "key": "w01",
        "group": "외관",
        "label": "탱크 덮개·밀폐·잠금 정상",
        "hint": "이물유입 방지",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "w02",
        "group": "위생",
        "label": "탱크 내부·배관 이끼·스케일 이상 없음",
        "hint": "육안",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "w03",
        "group": "청소",
        "label": "청소·소독 실시(주기 내)",
        "hint": "계획 대비",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "w04",
        "group": "수질",
        "label": "탁도·이취·이물 없음",
        "hint": "취수·사용수",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "w05",
        "group": "잔류염소",
        "label": "잔류염소·수질기준 준수",
        "hint": "해당시 측정",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "w06",
        "group": "기록",
        "label": "수질검사·위생기록 보관",
        "hint": "성적서",
        "freq": "M",
        "ampm": false
      }
    ],
    "note": "※ 평가 — 양호: ○ , 부적합(시정조치 필요): × , 해당없음: —    ※ 주기 — D:매일 W:주간 M:월간"
  }
});
})();
