/**
 * DKJ-S-02-01 — generated boot
 */
(function () {
  'use strict';
  DkjOxForm.mount({
  "code": "DKJ-S-02-01",
  "title": "작업장 위생점검일지",
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
      "id": "weather",
      "label": "날씨·특이사항",
      "type": "text",
      "placeholder": "맑음 / 특이사항 없으면 공란"
    }
  ],
  "items": [
    {
      "key": "f01",
      "group": "바닥",
      "label": "바닥 파손·고인물",
      "hint": "파손·물고임 없음"
    },
    {
      "key": "f02",
      "group": "바닥",
      "label": "바닥 청결",
      "hint": "잔사·흙·이물 없음"
    },
    {
      "key": "w01",
      "group": "벽",
      "label": "벽면 상태",
      "hint": "구멍·균열·곰팡이 없음"
    },
    {
      "key": "c01",
      "group": "천장",
      "label": "천장·덕트",
      "hint": "파손·결로·거미줄 없음"
    },
    {
      "key": "d01",
      "group": "배수",
      "label": "배수로 역류·악취",
      "hint": "역류·악취 없음"
    },
    {
      "key": "d02",
      "group": "배수",
      "label": "배수로 청결",
      "hint": "퇴적물 제거·커버 정상"
    },
    {
      "key": "e01",
      "group": "출입",
      "label": "출입구·방충",
      "hint": "문닫힘·방충망 파손 없음"
    },
    {
      "key": "e02",
      "group": "창·조명",
      "label": "창·조명커버",
      "hint": "비산방지·파손 없음"
    },
    {
      "key": "v01",
      "group": "환기",
      "label": "환기·급배기",
      "hint": "필터·덕트 잔사 없음"
    },
    {
      "key": "eq1",
      "group": "설비",
      "label": "작업대·컨베이어",
      "hint": "청소상태·이물 없음"
    },
    {
      "key": "eq2",
      "group": "설비",
      "label": "칼·도마·용기",
      "hint": "세척·소독 후 보관상태"
    },
    {
      "key": "eq3",
      "group": "세척",
      "label": "세척소독대·호스",
      "hint": "정리·교차오염 방지"
    },
    {
      "key": "wst",
      "group": "폐기물",
      "label": "폐기물통",
      "hint": "뚜껑·분리수거·넘침 없음"
    },
    {
      "key": "pst",
      "group": "해충",
      "label": "해충·쥐 흔적",
      "hint": "사체·배설물·유입 흔적 없음"
    },
    {
      "key": "chm",
      "group": "약품",
      "label": "세척·소독제 관리",
      "hint": "지정장소·라벨·희석 표기"
    }
  ],
  "print": {
    "layout": "ox",
    "columnMode": "result",
    "orgName": "동김제농협 가공센터",
    "docNo": "DKJ-S-02-01",
    "title": "작업장 위생점검일지",
    "rev": "0",
    "enactDate": "2026.07.10",
    "reviseDate": "2026.07.10",
    "rows": [
      {
        "key": "f01",
        "group": "바닥",
        "label": "바닥 파손·고인물",
        "hint": "파손·물고임 없음",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "f02",
        "group": "바닥",
        "label": "바닥 청결",
        "hint": "잔사·흙·이물 없음",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "w01",
        "group": "벽",
        "label": "벽면 상태",
        "hint": "구멍·균열·곰팡이 없음",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "c01",
        "group": "천장",
        "label": "천장·덕트",
        "hint": "소독·결로·거미줄 없음",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "d01",
        "group": "배수",
        "label": "배수로 역류·악취",
        "hint": "역류·악취 없음",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "d02",
        "group": "배수",
        "label": "배수로 청결",
        "hint": "퇴적물 제거·커버 정상",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "e01",
        "group": "출입",
        "label": "출입구·방충",
        "hint": "문닫힘·방충망 파손 없음",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "e02",
        "group": "창·조명",
        "label": "창·조명커버",
        "hint": "비산방지·파손 없음",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "v01",
        "group": "환기",
        "label": "환기·급배기",
        "hint": "필터·덕트 잔사 없음",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "eq1",
        "group": "설비",
        "label": "작업대·컨베이어",
        "hint": "청소상태·이물 없음",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "eq2",
        "group": "설비",
        "label": "칼·도마·용기",
        "hint": "세척·소독 후 보관상태",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "eq3",
        "group": "세척",
        "label": "세척소독대·호스",
        "hint": "정리·교차오염 방지",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "wst",
        "group": "폐기물",
        "label": "폐기물통",
        "hint": "뚜껑·분리수거·넘침 없음",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "pst",
        "group": "해충",
        "label": "해충·쥐 흔적",
        "hint": "사체·배설물·유입 흔적 없음",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "chm",
        "group": "약품",
        "label": "세척·소독제 관리",
        "hint": "지정장소·라벨·희석 표기",
        "freq": "D",
        "ampm": false
      }
    ],
    "note": "※ 평가 — 양호: ○ , 부적합(시정조치 필요): × , 해당없음: —    ※ 주기 — D:매일 W:주간 M:월간"
  }
});
})();
