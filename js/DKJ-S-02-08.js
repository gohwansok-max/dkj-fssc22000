/**
 * DKJ-S-02-08 - ledger boot (SSOT: data/ledger-form-specs/DKJ-S-02-08.json)
 */
(function () {
  'use strict';
  DkjLedgerForm.mount({
  "code": "DKJ-S-02-08",
  "title": "폐기물 관리대장",
  "subtitle": "선행요건 · 발생 시 · 건별 기록",
  "pattern": "ledger",
  "docNo": "DKJ-S-02-08",
  "rev": "0",
  "enactDate": "2026. 02. 13",
  "reviseDate": "-",
  "orgName": "동김제농협 산지유통센터",
  "rows": 14,
  "infoFields": [
    {
      "id": "period",
      "label": "점검 일시",
      "type": "text",
      "placeholder": "202 년 월 일 ~ 202 년 월 일",
      "required": true,
      "span": 3
    },
    {
      "id": "inspector",
      "label": "점 검 자",
      "type": "text",
      "required": true
    },
    {
      "id": "cycle",
      "label": "점검 주기",
      "type": "text",
      "default": "발 생 시"
    },
    {
      "id": "method",
      "label": "점검 방법",
      "type": "text",
      "default": "육안, 중량확인(용량 등)",
      "span": 3
    },
    {
      "id": "company",
      "label": "수거업체",
      "type": "text"
    }
  ],
  "columns": [
    {
      "key": "date",
      "label": "날짜",
      "width": "12%",
      "type": "date",
      "required": true
    },
    {
      "key": "name",
      "label": "폐기물명",
      "width": "22%",
      "align": "left",
      "required": true
    },
    {
      "key": "amount",
      "label": "폐기물량",
      "width": "16%"
    },
    {
      "key": "outAmount",
      "label": "반출량",
      "width": "16%"
    },
    {
      "key": "outBy",
      "label": "반출자명",
      "width": "16%"
    },
    {
      "key": "company",
      "label": "수거업체",
      "width": "18%",
      "align": "left"
    }
  ],
  "legend": "※ 폐기물은 지정 장소에 보관하고 반출 시 수거업체 인수인계를 확인한다."
});
})();
