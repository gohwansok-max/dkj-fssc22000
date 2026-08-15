/**
 * DkjUtil — 여러 화면·엔진이 각자 복붙해 쓰던 최소 공용 함수.
 * 전역 함수로 노출한다(esc, today) — 각 파일이 지역 함수로 재정의하지 않으면
 * 이 파일의 것을 그대로 쓴다. 순서 요건은 하나뿐: 이 스크립트가 다른 것보다
 * 먼저 로드돼야 한다.
 */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  global.esc = esc;
})(window);
