/**
 * DKJ-S-02-32 — generated FR boot
 */
(function () {
  'use strict';
  DkjFrForm.mount({
  "code": "DKJ-S-02-32",
  "title": "음용수 잔류염소 점검일지",
  "pattern": "fr",
  "minChecks": 0,
  "titleKey": "measurePoint",
  "historyKeys": [
    "docDate",
    "chlorineValue"
  ],
  "fields": [
    {
      "id": "docDate",
      "label": "작성일자 *",
      "type": "date",
      "required": true
    },
    {
      "id": "checkTime",
      "label": "점검시각",
      "type": "time"
    },
    {
      "id": "measurePoint",
      "label": "측정지점 *",
      "type": "text",
      "required": true
    },
    {
      "id": "chlorineValue",
      "label": "잔류염소농도(mg/L) *",
      "type": "number",
      "required": true
    },
    {
      "id": "writer",
      "label": "작성자 *",
      "type": "text",
      "required": true
    },
    {
      "id": "reviewer",
      "label": "검토자",
      "type": "text"
    },
    {
      "id": "approver",
      "label": "승인자",
      "type": "text"
    }
  ],
  "items": [],
  "sections": [],
  "print": {
    "layout": "official-fr-generic",
    "orgName": "동김제농협 산지유통센터",
    "docNo": "DKJ-S-02-32",
    "title": "음용수 잔류염소 점검일지",
    "subtitle": "선행요건 · 매일",
    "rev": "0",
    "enactDate": "2026. 09. 04",
    "reviseDate": "-",
    "stdNote": "※ 관리기준 — 유리잔류염소 0.2 mg/L 이상 (현장 확정 CL 적용)",
    "metaFields": [
      {
        "key": "checkTime",
        "label": "점검시각"
      },
      {
        "key": "measurePoint",
        "label": "측정지점"
      },
      {
        "key": "chlorineValue",
        "label": "잔류염소농도(mg/L)"
      }
    ],
    "rows": [],
    "sections": []
  }
});
})();
