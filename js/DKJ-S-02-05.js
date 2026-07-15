/**
 * DKJ-S-02-05 — generated boot
 */
(function () {
  'use strict';
  DkjMonForm.mount({
  "code": "DKJ-S-02-05",
  "title": "온습도점검일지",
  "pattern": "mon",
  "monMode": "th",
  "fields": [
    {
      "id": "checkDate",
      "label": "점검일자 *",
      "type": "date"
    },
    {
      "id": "inspector",
      "label": "점검자 *",
      "type": "text"
    },
    {
      "id": "confirmer",
      "label": "확인자",
      "type": "text"
    },
    {
      "id": "season",
      "label": "계절구분",
      "type": "select",
      "options": [
        "하절기",
        "동절기",
        "환절기"
      ],
      "default": "하절기"
    }
  ],
  "zones": [
    {
      "id": "prep",
      "name": "전처리실",
      "tMin": 15,
      "tMax": 25,
      "hMin": 40,
      "hMax": 70
    },
    {
      "id": "wash",
      "name": "소독·헹굼실",
      "tMin": 15,
      "tMax": 25,
      "hMin": 40,
      "hMax": 70
    },
    {
      "id": "pack",
      "name": "포장실",
      "tMin": 15,
      "tMax": 25,
      "hMin": 40,
      "hMax": 70
    },
    {
      "id": "cold",
      "name": "냉장창고",
      "tMin": 0,
      "tMax": 5,
      "hMin": null,
      "hMax": null
    }
  ],
  "print": {
    "layout": "mon-th",
    "monMode": "th",
    "orgName": "동김제농협 가공센터",
    "docNo": "DKJ-S-02-05",
    "title": "온습도점검일지",
    "rev": "0",
    "enactDate": "2026.07.10",
    "reviseDate": "2026.07.10",
    "note": "※ 관리기준 이탈 시 즉시조치란에 기재한다. (현장 확정 CL 적용)"
  }
});
})();
