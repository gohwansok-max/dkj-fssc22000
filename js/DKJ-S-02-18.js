/**
 * DKJ-S-02-18 — generated boot
 */
(function () {
  'use strict';

  /* 차량번호 등록형 드롭다운 — 서식 엔진(dkj-ox-form.js)은 id 로 값만 읽고 쓰므로
     <select id="vehicleNo"> 의 옵션 목록만 별도로 관리한다. 과거 저장 기록에 있던
     번호는 자동으로 등록 목록에 편입해, 처음부터 옵션이 비어 있지 않게 한다. */
  var VEHICLE_KEY = 'dkj:vehicles:DKJ-S-02-18:v1';
  function loadVehicles() {
    try { return JSON.parse(localStorage.getItem(VEHICLE_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveVehicles(list) {
    try { localStorage.setItem(VEHICLE_KEY, JSON.stringify(list)); } catch (e) {}
  }
  function seedVehiclesFromHistory() {
    try {
      var raw = localStorage.getItem('dkj:records:DKJ-S-02-18:list:v1');
      var recs = raw ? JSON.parse(raw) : [];
      var known = loadVehicles();
      var changed = false;
      recs.forEach(function (r) {
        if (r.vehicleNo && known.indexOf(r.vehicleNo) === -1) { known.push(r.vehicleNo); changed = true; }
      });
      if (changed) saveVehicles(known);
    } catch (e) {}
  }
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function renderVehicleOptions(selected) {
    var sel = document.getElementById('vehicleNo');
    if (!sel) return;
    var list = loadVehicles();
    var opts = '<option value="">-- 차량번호 선택 --</option>';
    list.forEach(function (v) {
      opts += '<option value="' + escHtml(v) + '"' + (v === selected ? ' selected' : '') + '>' + escHtml(v) + '</option>';
    });
    if (selected && list.indexOf(selected) === -1) {
      opts += '<option value="' + escHtml(selected) + '" selected>' + escHtml(selected) + '</option>';
    }
    opts += '<option value="__register__">+ 새 차량번호 등록</option>';
    sel.innerHTML = opts;
  }
  seedVehiclesFromHistory();
  renderVehicleOptions('');

  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'vehicleNo' && e.target.value === '__register__') {
      var plate = prompt('새 차량번호를 입력하세요 (예: 전북12가3456)');
      var sel = e.target;
      if (plate && plate.trim()) {
        plate = plate.trim();
        var list = loadVehicles();
        if (list.indexOf(plate) === -1) { list.push(plate); saveVehicles(list); }
        renderVehicleOptions(plate);
        sel.value = plate;
        sel.dispatchEvent(new Event('input', { bubbles: true }));
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        renderVehicleOptions('');
      }
    }
  });

  DkjOxForm.mount({
  "code": "DKJ-S-02-18",
  "title": "운송차량 위생점검표",
  "pattern": "ox",
  "minChecks": 4,
  "titleKey": "vehicleNo",
  "historyKeys": [
    "checkDate",
    "vehicleNo"
  ],
  "fields": [
    {
      "id": "checkDate",
      "label": "점검일자 *",
      "type": "date"
    },
    {
      "id": "vehicleNo",
      "label": "차량번호 *",
      "type": "select"
    },
    {
      "id": "destination",
      "label": "행선/용도",
      "type": "select",
      "options": ["출하", "회수"]
    },
    {
      "id": "arrivalPlace",
      "label": "도착지",
      "type": "select",
      "options": ["양산", "오산"]
    },
    {
      "id": "departTime",
      "label": "출발시간",
      "type": "time"
    },
    {
      "id": "arriveTime",
      "label": "도착시간",
      "type": "time"
    }
  ],
  "items": [
    {
      "key": "v01",
      "group": "청결",
      "label": "적재함 청결·이물·악취 없음",
      "hint": "세척 후"
    },
    {
      "key": "v02",
      "group": "온도",
      "label": "냉장/보냉 설정·온도 적정",
      "hint": "해당차량"
    },
    {
      "key": "v03",
      "group": "차단",
      "label": "문·패킹·방충 상태 정상",
      "hint": "밀폐"
    },
    {
      "key": "v04",
      "group": "교차",
      "label": "이전적재 오염·알레르겐 잔류 없음",
      "hint": "분리운송"
    },
    {
      "key": "v05",
      "group": "식별",
      "label": "제품·라벨·서류 일치",
      "hint": "상차 전"
    },
    {
      "key": "v06",
      "group": "위생",
      "label": "운전자 복장·손위생 기준 준수",
      "hint": "해당시"
    }
  ],
  "print": {
    "layout": "official-prp-ox",
    "columnMode": "result",
    "orgName": "동김제농협 산지유통센터",
    "docNo": "DKJ-S-02-18",
    "title": "운송차량 위생점검표",
    "rev": "0",
    "enactDate": "2024. 02. 13",
    "reviseDate": "-",
    "rows": [
      {
        "key": "v01",
        "group": "청결",
        "label": "적재함 청결·이물·악취 없음",
        "hint": "세척 후",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "v02",
        "group": "온도",
        "label": "냉장/보냉 설정·온도 적정",
        "hint": "해당차량",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "v03",
        "group": "차단",
        "label": "문·패킹·방충 상태 정상",
        "hint": "밀폐",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "v04",
        "group": "교차",
        "label": "이전적재 오염·알레르겐 잔류 없음",
        "hint": "분리운송",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "v05",
        "group": "식별",
        "label": "제품·라벨·서류 일치",
        "hint": "상차 전",
        "freq": "M",
        "ampm": false
      },
      {
        "key": "v06",
        "group": "위생",
        "label": "운전자 복장·손위생 기준 준수",
        "hint": "해당시",
        "freq": "M",
        "ampm": false
      }
    ],
    "note": "※ 평가 — 양호: ○ , 부적합(시정조치 필요): × , 해당없음: —    ※ 주기 — D:매일 W:주간 M:월간",
    "subtitle": "선행요건 · 출하/회차",
    "sectionTitle": "● 운송차량 위생점검 결과 ●",
    "showMeta": [
      "vehicleNo",
      "destination",
      "arrivalPlace",
      "departTime",
      "arriveTime"
    ],
    "metaFields": [
      {
        "key": "vehicleNo",
        "label": "차량번호"
      },
      {
        "key": "destination",
        "label": "행선/용도"
      },
      {
        "key": "arrivalPlace",
        "label": "도착지"
      },
      {
        "key": "departTime",
        "label": "출발시간"
      },
      {
        "key": "arriveTime",
        "label": "도착시간"
      }
    ]
  }
});
})();
