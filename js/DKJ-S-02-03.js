/**
 * DKJ-S-02-03 — generated boot
 */
(function () {
  'use strict';
  DkjOxForm.mount({
  "code": "DKJ-S-02-03",
  "title": "개인위생점검일지",
  "pattern": "ox",
  "minChecks": 5,
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
      "type": "text",
      "placeholder": "예: 전처리·포장"
    },
    {
      "id": "headcount",
      "label": "점검 인원(명)",
      "type": "number",
      "default": 1
    }
  ],
  "items": [
    {
      "key": "h01",
      "group": "건강",
      "label": "상처·화농·설사·복통 없음",
      "hint": "유증상자 작업 배제"
    },
    {
      "key": "h02",
      "group": "건강",
      "label": "피부질환·전염성질환 이상 없음",
      "hint": "건강진단·보고 기준"
    },
    {
      "key": "b01",
      "group": "복장",
      "label": "위생복·모·화 착용기준 준수",
      "hint": "작업 전"
    },
    {
      "key": "b02",
      "group": "복장",
      "label": "위생복장 청결",
      "hint": "오염·파손 없음"
    },
    {
      "key": "b03",
      "group": "복장",
      "label": "장신구 미착용",
      "hint": "반지·시계·팔찌 등"
    },
    {
      "key": "b04",
      "group": "위생",
      "label": "손톱·수염·화장 기준 준수",
      "hint": "손·머리 위생"
    },
    {
      "key": "w01",
      "group": "작업중",
      "label": "손·장갑 세척소독·교체",
      "hint": "수시 실시"
    },
    {
      "key": "w02",
      "group": "작업중",
      "label": "비위생 행위 없음",
      "hint": "껌·흡연·음식물 금지"
    },
    {
      "key": "w03",
      "group": "작업중",
      "label": "교차오염 방지 행동",
      "hint": "구역·동선 준수"
    },
    {
      "key": "a01",
      "group": "작업후",
      "label": "보호구 지정장소 보관",
      "hint": "앞치마·토시 등"
    }
  ],
  "print": {
    "layout": "ox",
    "columnMode": "ampm",
    "orgName": "동김제농협 가공센터",
    "docNo": "DKJ-S-02-03",
    "title": "개인위생점검일지",
    "rev": "0",
    "enactDate": "2026.07.10",
    "reviseDate": "2026.07.10",
    "rows": [
      {
        "key": "h01",
        "group": "건강",
        "label": "상처·화농·설사·복통 없음",
        "hint": "유증상자 작업 배제",
        "freq": "D",
        "ampm": true
      },
      {
        "key": "h02",
        "group": "건강",
        "label": "피부질환·전염성질환 이상 없음",
        "hint": "건강진단·보고 기준",
        "freq": "D",
        "ampm": true
      },
      {
        "key": "b01",
        "group": "복장",
        "label": "위생복·모·화 착용기준 준수",
        "hint": "작업 전",
        "freq": "D",
        "ampm": true
      },
      {
        "key": "b02",
        "group": "복장",
        "label": "위생복장 청결",
        "hint": "오염·파손 없음",
        "freq": "D",
        "ampm": true
      },
      {
        "key": "b03",
        "group": "복장",
        "label": "장신구 미착용",
        "hint": "반지·시계·팔찌 등",
        "freq": "D",
        "ampm": true
      },
      {
        "key": "b04",
        "group": "위생",
        "label": "손톱·수염·화장 기준 준수",
        "hint": "손·머리 위생",
        "freq": "D",
        "ampm": true
      },
      {
        "key": "w01",
        "group": "작업중",
        "label": "손·장갑 세척소독·교체",
        "hint": "수시 실시",
        "freq": "D",
        "ampm": true
      },
      {
        "key": "w02",
        "group": "작업중",
        "label": "비위생 행위 없음",
        "hint": "껌·흡연·음식물 금지",
        "freq": "D",
        "ampm": true
      },
      {
        "key": "w03",
        "group": "작업중",
        "label": "교차오염 방지 행동",
        "hint": "구역·동선 준수",
        "freq": "D",
        "ampm": true
      },
      {
        "key": "a01",
        "group": "작업후",
        "label": "보호구 지정장소 보관",
        "hint": "앞치마·토시 등",
        "freq": "D",
        "ampm": true
      }
    ],
    "note": "※ 평가 — 양호: ○ , 부적합(시정조치 필요): × , 해당없음: —    ※ 주기 — D:매일 W:주간 M:월간"
  }
});
})();
