/**
 * DKJ-S-02-29 — generated boot
 */
(function () {
  'use strict';
  DkjOxForm.mount({
  "code": "DKJ-S-02-29",
  "title": "종사자건강상태확인",
  "pattern": "ox",
  "minChecks": 4,
  "titleKey": "team",
  "historyKeys": [
    "checkDate",
    "team"
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
      "id": "team",
      "label": "작업팀/라인",
      "type": "text"
    },
    {
      "id": "headcount",
      "label": "출근 인원(명)",
      "type": "number",
      "default": 1
    },
    {
      "id": "excluded",
      "label": "작업배제 인원",
      "type": "text",
      "placeholder": "성명·사유 (없으면 공란)"
    }
  ],
  "items": [
    {
      "key": "h01",
      "group": "발열",
      "label": "발열·오한 증상 없음",
      "hint": "37.5℃ 이상 배제"
    },
   {
      "key": "h02",
      "group": "소화기",
      "label": "설사·구토·복통 없음",
      "hint": "유증상 배제"
    },
    {
      "key": "h03",
      "group": "호흡기",
      "label": "기침·인후통·호흡기증상 없음",
      "hint": "해당시 보고"
    },
    {
      "key": "h04",
      "group": "피부",
      "label": "화농성 상처·피부질환 없음",
      "hint": "또는 보호조치"
    },
    {
      "key": "h05",
      "group": "보고",
      "label": "증상 발생 시 즉시 보고",
      "hint": "관리자 연계"
    },
    {
      "key": "h06",
      "group": "복귀",
      "label": "배제자 복귀기준 준수",
      "hint": "해당시"
    }
  ],
  "print": {
    "layout": "ox",
    "columnMode": "ampm",
    "orgName": "동김제농협 가공센터",
    "docNo": "DKJ-S-02-29",
    "title": "종사자건강상태확인",
    "rev": "0",
    "enactDate": "2026.07.10",
    "reviseDate": "2026.07.10",
    "rows": [
      {
        "key": "h01",
        "group": "발열",
        "label": "발열·오한 증상 없음",
        "hint": "37.5℃ 이상 배제",
        "freq": "D",
        "ampm": true
      },
      {
        "key": "h02",
        "group": "소화기",
        "label": "설사·구토·복통 없음",
        "hint": "유증상 배제",
        "freq": "D",
        "ampm": true
      },
      {
        "key": "h03",
        "group": "호흡기",
        "label": "기침·인후통·호흡기증상 없음",
        "hint": "해당시 보고",
        "freq": "D",
        "ampm": true
      },
      {
        "key": "h04",
        "group": "피부",
        "label": "화농성 상처·피부질환 없음",
        "hint": "또는 보호조치",
        "freq": "D",
        "ampm": true
      },
      {
        "key": "h05",
        "group": "보고",
        "label": "증상 발생 시 즉시 보고",
        "hint": "관리자 연계",
        "freq": "D",
        "ampm": true
      },
      {
        "key": "h06",
        "group": "복귀",
        "label": "배제자 복귀기준 준수",
        "hint": "해당시",
        "freq": "D",
        "ampm": true
      }
    ],
    "note": "※ 평가 — 양호: ○ , 부적합(시정조치 필요): × , 해당없음: —    ※ 주기 — D:매일 W:주간 M:월간"
  }
});
})();
