/**
 * DKJ-S-02-15 - ledger boot (SSOT: data/ledger-form-specs/DKJ-S-02-15.json)
 */
(function () {
  'use strict';
  DkjLedgerForm.mount({
  "code": "DKJ-S-02-15",
  "title": "부자재(포장재) 입고검사일지",
  "subtitle": "선행요건 · 입고 시마다 · 건별 기록",
  "pattern": "ledger",
  "docNo": "DKJ-S-02-15",
  "rev": "0",
  "enactDate": "2026. 02. 13",
  "reviseDate": "-",
  "orgName": "동김제농협 가공센터",
  "rows": 10,
  "infoFields": [
    {
      "id": "period",
      "label": "점검기간",
      "type": "text",
      "placeholder": "20 . . . ~ . .",
      "required": true
    },
    {
      "id": "inspector",
      "label": "점검자",
      "type": "text",
      "required": true,
      "span": 3
    }
  ],
  "columns": [
    {
      "key": "inDate",
      "label": "입고일자",
      "width": "8%",
      "type": "date",
      "required": true
    },
    {
      "key": "vendor",
      "label": "업 체 명",
      "width": "10%",
      "align": "left",
      "required": true
    },
    {
      "key": "item",
      "label": "품 목 명",
      "width": "12%",
      "align": "left",
      "required": true
    },
    {
      "key": "lot",
      "label": "로트번호 (입고일자)",
      "width": "10%",
      "align": "left"
    },
    {
      "key": "qty",
      "label": "수량 (EA)",
      "width": "7%",
      "type": "num"
    },
    {
      "key": "mark",
      "label": "표기사항",
      "width": "7%",
      "type": "choice",
      "choices": [
        "적",
        "부"
      ],
      "group": "점검사항"
    },
    {
      "key": "printState",
      "label": "인쇄상태",
      "width": "7%",
      "type": "choice",
      "choices": [
        "적",
        "부"
      ],
      "group": "점검사항"
    },
    {
      "key": "pack",
      "label": "포장상태",
      "width": "7%",
      "type": "choice",
      "choices": [
        "적",
        "부"
      ],
      "group": "점검사항"
    },
    {
      "key": "dirty",
      "label": "오염상태",
      "width": "7%",
      "type": "choice",
      "choices": [
        "적",
        "부"
      ],
      "group": "점검사항"
    },
    {
      "key": "seal",
      "label": "씰링상태",
      "width": "7%",
      "type": "choice",
      "choices": [
        "적",
        "부"
      ],
      "group": "점검사항"
    },
    {
      "key": "doc",
      "label": "서류검토",
      "width": "7%",
      "type": "choice",
      "choices": [
        "유",
        "무"
      ]
    },
    {
      "key": "judge",
      "label": "판정여부",
      "width": "5%",
      "type": "choice",
      "choices": [
        "적",
        "부"
      ],
      "required": true
    },
    {
      "key": "result",
      "label": "점검결과",
      "width": "6%",
      "type": "choice",
      "choices": [
        "입고",
        "반품"
      ],
      "required": true
    }
  ],
  "legend": "※ 판정 부적합 시 반품 처리하고 부적합품 처리 보고서(DKJ-S-02-19)를 작성한다."
});
})();
