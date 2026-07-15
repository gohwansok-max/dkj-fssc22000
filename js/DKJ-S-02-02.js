/**
 * DKJ-S-02-02 — generated boot
 */
(function () {
  'use strict';
  DkjMonForm.mount({
  "code": "DKJ-S-02-02",
  "title": "조도점검일지",
  "pattern": "mon",
  "monMode": "lux",
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
      "id": "instrument",
      "label": "조도계",
      "type": "text",
      "placeholder": "기기번호·교정일"
    }
  ],
  "zones": [
    {
      "id": "prep",
      "name": "전처리실",
      "luxMin": 200,
      "luxMax": 2000
    },
    {
      "id": "wash",
      "name": "소독·헹굼실",
      "luxMin": 200,
      "luxMax": 2000
    },
    {
      "id": "pack",
      "name": "포장실",
      "luxMin": 200,
      "luxMax": 2000
    },
    {
      "id": "inspect",
      "name": "검사·이물선별",
      "luxMin": 500,
      "luxMax": 3000
    },
    {
      "id": "cold",
      "name": "냉장창고",
      "luxMin": 100,
      "luxMax": 1000
    }
  ],
  "print": {
    "layout": "mon-lux",
    "monMode": "lux",
    "orgName": "동김제농협 가공센터",
    "docNo": "DKJ-S-02-02",
    "title": "조도점검일지",
    "rev": "0",
    "enactDate": "2026.07.10",
    "reviseDate": "2026.07.10",
    "note": "※ 관리기준 이탈 시 즉시조치란에 기재한다. (현장 확정 CL 적용)"
  }
});
})();
