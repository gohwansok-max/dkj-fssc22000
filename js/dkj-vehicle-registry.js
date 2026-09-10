/**

 * DkjVehicleRegistry — 운송차량 위생점검표의 공용 차량번호 목록.

 *

 * 별도 설정 키가 아니라 내부 기록으로 저장해 기존 DkjCloudSync의 기록 단위 동기화와

 * 전체 백업에 자연스럽게 포함된다. `_internal` 표식은 기록보관함·일반 내보내기에서만

 * 숨기며, 이력·백업·기기 간 동기화 대상에서는 제외하지 않는다.

 */

(function (global) {
  
  'use strict';
  
  if (global.DkjVehicleRegistry) return;
  

  
  var FORM_ID = 'DKJ-MASTER-VEHICLE';
  
  var listeners = [];
  

  
  function clean(value) {
    
    return String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
    
  }
  

  
  function keyOf(value) {
    
    return clean(value).replace(/\s/g, '').toLocaleUpperCase('ko-KR');
    
  }
  

  
  function valid(value) {
    
    var compact = keyOf(value);
    
    return compact.length >= 5 && compact.length <= 20 && /\d/.test(compact) && /[가-힣A-Z]/.test(compact);
    
  }
  

  
  function list() {
    
    if (!global.DkjRecordStore || typeof global.DkjRecordStore.list !== 'function') return [];
    
    var seen = {};
    
    return global.DkjRecordStore.list(FORM_ID).map(function (record) {
      
      return clean(record && record.vehicleNo);
      
    }).filter(function (value) {
      
      var key = keyOf(value);
      
      if (!valid(value) || seen[key]) return false;
      
      seen[key] = true;
      
      return true;
      
    }).sort(function (a, b) { return a.localeCompare(b, 'ko-KR', { numeric: true }); });
 * DkjVehicleRegistry — 운송차량 위생점검표의 공용 차량번호 목록.
 *
 * 별도 설정 키가 아니라 내부 기록으로 저장해 기존 DkjCloudSync의 기록 단위 동기화와
 * 전체 백업에 자연스럽게 포함된다. `_internal` 표식은 기록보관함·일반 내보내기에서만
 * 숨기며, 이력·백업·기기 간 동기화 대상에서는 제외하지 않는다.
 */
(function (global) {
  'use strict';
  if (global.DkjVehicleRegistry) return;

  var FORM_ID = 'DKJ-MASTER-VEHICLE';
  var listeners = [];

  function clean(value) {
    return String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
  }

  function keyOf(value) {
    return clean(value).replace(/\s/g, '').toLocaleUpperCase('ko-KR');
  }

  function valid(value) {
    var compact = keyOf(value);
    return compact.length >= 5 && compact.length <= 20 && /\d/.test(compact) && /[가-힣A-Z]/.test(compact);
  }

  function list() {
    if (!global.DkjRecordStore || typeof global.DkjRecordStore.list !== 'function') return [];
    var seen = {};
    return global.DkjRecordStore.list(FORM_ID).map(function (record) {
      return clean(record && record.vehicleNo);
    }).filter(function (value) {
      var key = keyOf(value);
      if (!valid(value) || seen[key]) return false;
      seen[key] = true;
      return true;
    }).sort(function (a, b) { return a.localeCompare(b, 'ko-KR', { numeric: true }); });
  }

  function notify() {
    var vehicles = list();
    listeners.slice().forEach(function (listener) {
      try { listener(vehicles); } catch (e) {}
    });
  }

  function register(value) {
    var vehicleNo = clean(value);
    if (!valid(vehicleNo)) {
      return { ok: false, message: '차량번호는 숫자와 한글 또는 영문을 포함해 5~20자로 입력하세요.' };
    }
    var duplicate = list().find(function (item) { return keyOf(item) === keyOf(vehicleNo); });
    if (duplicate) return { ok: true, vehicleNo: duplicate, duplicate: true };
    if (!global.DkjRecordStore || typeof global.DkjRecordStore.save !== 'function') {
      return { ok: false, message: '차량번호 저장 기능을 불러오지 못했습니다. 새로고침 후 다시 시도하세요.' };
    }
    try {
      global.DkjRecordStore.save(FORM_ID, {
        title: vehicleNo,
        vehicleNo: vehicleNo,
        masterType: 'vehicle',
        _internal: true,
        locked: true
      });
      notify();
      return { ok: true, vehicleNo: vehicleNo, duplicate: false };
    } catch (e) {
      return { ok: false, message: '차량번호를 저장하지 못했습니다. 브라우저 저장공간을 확인하세요.' };
    }
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return function () {};
    listeners.push(listener);
    return function () {
      var index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    };
  }

  global.addEventListener('dkj:records-changed', function (event) {
    var detail = (event && event.detail) || {};
    var key = String(detail.key || '');
    if (detail.source === 'cloud' || key === 'dkj:records:' + FORM_ID + ':list:v1') notify();
  });

  global.DkjVehicleRegistry = {
    list: list,
    register: register,
    subscribe: subscribe,
    normalize: clean,
    formId: FORM_ID
  };
})(window);
