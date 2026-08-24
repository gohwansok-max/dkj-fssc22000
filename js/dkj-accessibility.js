/* 동김제농협 스마트 HACCP — 초보·다국적 사용자용 보조 도구 */
(function(){
  'use strict';
  var KEY_FONT = 'dkj:ui:font-level:v2';
  var KEY_TABLET = 'dkj:ui:tablet-mode:v1';

  function root(){
    var scripts=document.getElementsByTagName('script');
    for(var i=scripts.length-1;i>=0;i--){var s=scripts[i].src||'',m='/js/dkj-accessibility.js',n=s.indexOf(m);if(n>-1)return s.slice(0,n+1);}
    return '';
  }

  function applyFontLevel(level){
    document.body.classList.remove('dkj-font-size-2', 'dkj-font-size-3', 'dkj-large-text');
    if (level === 2) document.body.classList.add('dkj-font-size-2');
    else if (level === 3) document.body.classList.add('dkj-font-size-3', 'dkj-large-text');
    try{localStorage.setItem(KEY_FONT, String(level));}catch(e){}
  }

  function applyTabletMode(on){
    document.body.classList.toggle('dkj-tablet-mode', !!on);
    try{localStorage.setItem(KEY_TABLET, on ? '1' : '0');}catch(e){}
  }

  function close(){var d=document.getElementById('dkjHelpDialog');if(d&&d.open)d.close();}

  function render(){
    if(document.getElementById('dkjAssist'))return;
    var fontLevel = 1;
    try { fontLevel = Number(localStorage.getItem(KEY_FONT)) || (localStorage.getItem('dkj:ui:large-text:v1')==='1'?3:1); } catch(e){}
    applyFontLevel(fontLevel);

    var isTablet = false;
    try { isTablet = localStorage.getItem(KEY_TABLET) === '1'; } c    var currentLang = (window.DkjI18n ? window.DkjI18n.getLanguage() : (localStorage.getItem('dkj:ui:lang:v1') || 'ko'));
    var isVi = (currentLang === 'vi');

    var bar=document.createElement('div');bar.id='dkjAssist';bar.className='dkj-assist';bar.setAttribute('aria-label','화면 사용 보조');
    var fontLabels = { 1: '글자 보통', 2: '글자 크게', 3: '글자 아주크게' };
    
    bar.innerHTML=
      '<button type="button" class="dkj-assist-lang' + (isVi ? ' is-active' : '') + '" title="언어 전환 (Tiếng Việt / 한국어)">' + (isVi ? '🇰🇷 KO' : '🇻🇳 VN') + '</button>' +
      '<button type="button" class="dkj-assist-font" title="글자 크기 조절 (보통/크게/아주크게)">' + (fontLabels[fontLevel] || '글자 크기') + '</button>' +
      '<button type="button" class="dkj-assist-tablet' + (isTablet ? ' is-active' : '') + '" title="태블릿 현장 최적화 (선명한 테두리 & 터치 확대)">📱 태블릿</button>' +
      '<button type="button" class="dkj-assist-help" aria-haspopup="dialog">쉬운 도움</button>';
    document.body.appendChild(bar);

    var dialog=document.createElement('dialog');dialog.id='dkjHelpDialog';dialog.className='dkj-help-dialog';
    dialog.innerHTML='<div class="dkj-help-inner"><div class="dkj-help-head"><div><h2>쉬운 사용 안내</h2><p>Easy guide · 简易指南 · Hướng dẫn nhanh</p></div><button class="dkj-help-close" type="button" aria-label="안내 닫기">×</button></div><div class="dkj-help-grid"><div class="dkj-help-box"><b>한국어</b><p>위 메뉴에서 업무를 고르고, 화면의 녹색 버튼을 누르면 다음 단계로 이동합니다. 왼쪽 아래 <strong>🇻🇳 VN</strong> 버튼으로 베트남어로 전환하거나, <strong>글자 크기</strong>·<strong>📱 태블릿</strong>으로 시원하게 볼 수 있습니다.</p></div><div class="dkj-help-box"><b>Tiếng Việt</b><p>Chọn công việc ở menu trên cùng. Nhấn nút <strong>🇻🇳 VN</strong> ở góc trái dưới để chuyển ngôn ngữ. Dùng nút <strong>Cỡ chữ</strong> hoặc <strong>📱 Máy tính bảng</strong> để dễ đọc hơn.</p></div><div class="dkj-help-box"><b>English</b><p>Choose a task from the top menu. Green buttons move to the next step. Use <strong>Font size</strong> or <strong>📱 Tablet mode</strong> at lower left.</p></div><div class="dkj-help-box"><b>中文</b><p>请从顶部菜单选择工作。使用左下角的<strong>字号</strong>或<strong>📱 平板模式</strong>放大文字。</p></div></div><p class="dkj-help-tip">도움이 필요하면 화면 오른쪽 아래의 <strong>홈</strong>으로 돌아가거나, 담당자에게 화면 제목·기록번호를 알려 주세요.</p><a class="dkj-help-link" href="'+root()+'index.html">업무 콘솔(홈)으로 이동</a></div>';
    document.body.appendChild(dialog);

    var btnLang = bar.querySelector('.dkj-assist-lang');
    btnLang.addEventListener('click', function(){
      var nowLang = (window.DkjI18n ? window.DkjI18n.getLanguage() : (localStorage.getItem('dkj:ui:lang:v1') || 'ko'));
      var target = (nowLang === 'vi') ? 'ko' : 'vi';
      if (window.DkjI18n) {
        window.DkjI18n.setLanguage(target);
      } else {
        localStorage.setItem('dkj:ui:lang:v1', target);
        location.reload();
      }
      this.textContent = (target === 'vi') ? '🇰🇷 KO' : '🇻🇳 VN';
      this.classList.toggle('is-active', target === 'vi');
    });

    var btnFont = bar.querySelector('.dkj-assist-font');
    btnFont.addEventListener('click', function(){
      fontLevel = (fontLevel % 3) + 1;
      applyFontLevel(fontLevel);
      this.textContent = fontLabels[fontLevel] || '글자 크기';
    });

    var btnTablet = bar.querySelector('.dkj-assist-tablet');
    btnTablet.addEventListener('click', function(){
      isTablet = !document.body.classList.contains('dkj-tablet-mode');
      applyTabletMode(isTablet);
      this.classList.toggle('is-active', isTablet);
    });

    bar.querySelector('.dkj-assist-help').addEventListener('click',function(){dialog.showModal();});
    dialog.querySelector('.dkj-help-close').addEventListener('click',close);
    dialog.addEventListener('click',function(e){if(e.target===dialog)close();});
    
    // i18n, AI 챗봇 및 텔레그램 모듈 자동 연동 확인
    ensureModules(root());

    // 📱 태블릿/모바일 숫자 입력 최적화 (숫자 키패드 자동 팝업)
    optimizeNumericInputs();
  }

  function optimizeNumericInputs() {
    try {
      var inputs = document.querySelectorAll('input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="hidden"])');
      var numRe = /temp|ppm|weight|qty|count|minute|hour|time|num|val|온도|수량|농도|중량|시간|분|kg|g|℃|%/i;
      inputs.forEach(function (inp) {
        if (inp.type === 'number' || numRe.test(inp.id || '') || numRe.test(inp.name || '') || numRe.test(inp.placeholder || '') || numRe.test(inp.className || '')) {
          if (!inp.getAttribute('inputmode')) {
            inp.setAttribute('inputmode', 'decimal');
          }
        }
      });
    } catch (e) {}
  }

  function ensureModules(base) {
    if (!window.DkjI18n && !document.getElementById('dkj-i18n-script')) {
      var s0 = document.createElement('script');
      s0.id = 'dkj-i18n-script';
      s0.src = (base || '') + 'js/dkj-i18n.js?v=55';
      document.body.appendChild(s0);
    }
    if (!window.DkjTelegram && !document.getElementById('dkj-telegram-script')) {
      var s1 = document.createElement('script');
      s1.id = 'dkj-telegram-script';
      s1.src = (base || '') + 'js/dkj-telegram-config.js?v=55';
      document.body.appendChild(s1);
    }
    if (!window.DkjChatbot && !document.getElementById('dkj-chatbot-script')) {
      var s2 = document.createElement('script');
      s2.id = 'dkj-chatbot-script';
      s2.src = (base || '') + 'js/dkj-chatbot.js?v=55';
      document.body.appendChild(s2);
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
})();
