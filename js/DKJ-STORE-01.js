/**
 * DKJ-STORE-01 — generated boot (STORE / FR-014 link)
 */
(function () {
  'use strict';
  var SPEC = {
  "code": "DKJ-STORE-01",
  "title": "원료보관·선입선출 점검",
  "pattern": "ox",
  "minChecks": 4,
  "titleKey": "itemName",
  "historyKeys": [
    "itemName",
    "storeDate",
    "lot"
  ],
  "fields": [
    {
      "id": "storeDate",
      "label": "보관일 *",
      "type": "date"
    },
    {
      "id": "from014",
      "label": "FR-014 연계ID",
      "type": "text",
      "placeholder": "자동"
    },
    {
      "id": "itemName",
      "label": "품명 *",
      "type": "text"
    },
    {
      "id": "lot",
      "label": "LOT *",
      "type": "text"
    },
    {
      "id": "qty",
      "label": "수량",
      "type": "text"
    },
    {
      "id": "unit",
      "label": "단위",
      "type": "select",
      "options": [
        "kg",
        "박스",
        "EA"
      ],
      "default": "kg"
    },
    {
      "id": "supplier",
      "label": "공급처",
      "type": "text"
    },
    {
      "id": "receiveDate",
      "label": "입고일",
      "type": "date"
    },
    {
      "id": "location",
      "label": "보관장소",
      "type": "select",
      "options": [
        "원료냉장",
        "원료실온",
        "부자재창고"
      ],
      "default": "원료냉장"
    },
    {
      "id": "shelf",
      "label": "랙/위치",
      "type": "text"
    },
    {
      "id": "storeTemp",
      "label": "보관온도(℃)",
      "type": "text"
    },
    {
      "id": "expiry",
      "label": "유통기한/소비기한",
      "type": "text"
    }
  ],
  "items": [
    {
      "key": "c01",
      "group": "식별",
      "label": "품명·LOT 라벨 부착",
      "hint": "식별 가능하게 표시"
    },
    {
      "key": "c02",
      "group": "FIFO",
      "label": "선입선출 위치 지정",
      "hint": "오래된 LOT가 앞에"
    },
    {
      "key": "c03",
      "group": "온도",
      "label": "보관온도 기준 내",
      "hint": "냉장/상온 기준 준수"
    },
    {
      "key": "c04",
      "group": "위생",
      "label": "용기·파렛 청결",
      "hint": "이물·오염 없음"
    },
    {
      "key": "c05",
      "group": "격리",
      "label": "부적합·보류품과 분리",
      "hint": "교차취급 방지"
    },
    {
      "key": "c06",
      "group": "알레르겐",
      "label": "알레르겐 원료 구분 보관",
      "hint": "해당시"
    }
  ],
  "print": {
    "layout": "ox",
    "columnMode": "result",
    "orgName": "동김제농협 가공센터",
    "docNo": "DKJ-STORE-01",
    "title": "원료보관·선입선출 점검",
    "rev": "0",
    "enactDate": "2026.07.10",
    "reviseDate": "2026.07.10",
    "rows": [
      {
        "key": "c01",
        "group": "식별",
        "label": "품명·LOT 라벨 부착",
        "hint": "식별 가능하게 표시",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "c02",
        "group": "FIFO",
        "label": "선입선출 위치 지정",
        "hint": "오래된 LOT가 앞에",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "c03",
        "group": "온도",
        "label": "보관온도 기준 내",
        "hint": "냉장/상온 기준 준수",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "c04",
        "group": "위생",
        "label": "용기·파렛 청결",
        "hint": "이물·오염 없음",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "c05",
        "group": "격리",
        "label": "부적합·보류품과 분리",
        "hint": "교차취급 방지",
        "freq": "D",
        "ampm": false
      },
      {
        "key": "c06",
        "group": "알레르겐",
        "label": "알레르겐 원료 구분 보관",
        "hint": "해당시",
        "freq": "D",
        "ampm": false
      }
    ],
    "note": "※ 평가 — 양호: ○ , 부적합(시정조치 필요): × , 해당없음: —    ※ 주기 — D:매일 W:주간 M:월간"
  }
};
  SPEC.validateExtra = function (state) {
    if (!state.itemName) return '품목을 입력하세요.';
    if (!state.lot) return 'LOT를 입력하세요.';
    return '';
  };
  SPEC.onNew = function () {
    var b = document.getElementById('from014Banner');
    if (b) b.hidden = true;
  };
  SPEC.afterInit = function (api) {
    if (window.DkjMaster) DkjMaster.renderProcessBar('processBar', 'store1');
    var params = new URLSearchParams(location.search);
    var from014 = params.get('from014');
    if (from014) {
      var rec = DkjRecordStore.get('FR-014', from014);
      if (rec) {
        api.setState({
          from014: from014,
          itemName: rec.itemName || '',
          lot: rec.lot || '',
          qty: rec.qty || '',
          unit: rec.unit || 'kg',
          supplier: rec.supplier || '',
          receiveDate: rec.receiveDate || '',
          storeTemp: rec.temp || ''
        });
        var b = document.getElementById('from014Banner');
        if (b) b.hidden = false;
      }
    }
    ['itemName', 'lot', 'qty', 'unit', 'supplier', 'receiveDate'].forEach(function (k) {
      if (params.get(k)) api.getState()[k] = params.get(k);
    });
    if (params.get('itemName')) api.writeForm();
  };
  DkjOxForm.mount(SPEC);
})();
