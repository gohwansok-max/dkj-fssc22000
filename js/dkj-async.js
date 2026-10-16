/** 순서를 유지하는 비동기 배열 연산. 콜백의 Promise를 결과값으로 오인하지 않는다. */
(function (global) {
  'use strict';
  async function walk(input, callback, thisArg, mode, initial, hasInitial) {
    var list = Array.from(input), out = [], accumulator = initial, started = hasInitial;
    for (var i = 0; i < list.length; i++) {
      if (mode === 'reduce') {
        if (!started) { accumulator = list[i]; started = true; }
        else accumulator = await callback(accumulator, list[i], i, list);
        continue;
      }
      var value = await callback.call(thisArg, list[i], i, list);
      if (mode === 'map') out.push(value);
      if (mode === 'filter' && value) out.push(list[i]);
      if (mode === 'some' && value) return true;
      if (mode === 'every' && !value) return false;
      if (mode === 'find' && value) return list[i];
    }
    if (mode === 'reduce') { if (!started) throw new TypeError('빈 배열의 reduce 초기값이 없습니다.'); return accumulator; }
    if (mode === 'some') return false;
    if (mode === 'every') return true;
    if (mode === 'find' || mode === 'forEach') return undefined;
    return out;
  }
  global.DkjAsync = {};
  global.DkjAsync.action = function (callback) {
    var running = false;
    return async function () {
      if (running) return;
      running = true;
      try { return await callback.apply(this, arguments); }
      finally { running = false; }
    };
  };
  ['forEach', 'map', 'filter', 'some', 'every', 'find'].forEach(function (name) {
    global.DkjAsync[name] = function (input, callback, thisArg) { return walk(input, callback, thisArg, name); };
  });
  global.DkjAsync.reduce = function (input, callback, initial) { return walk(input, callback, null, 'reduce', initial, arguments.length > 2); };
})(window);
