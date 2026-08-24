/* 동김제농협 스마트 HACCP — 초보·다국적 사용자용 보조 도구 */
(function(){
  'use strict';
  var KEY='dkj:ui:large-text:v1';
  function root(){
    var scripts=document.getElementsByTagName('script');
    for(var i=scripts.length-1;i>=0;i--){var s=scripts[i].src||'',m='/js/dkj-accessibility.js',n=s.indexOf(m);if(n>-1)return s.slice(0,n+1);}
    return '';
  }
  function applyLarge(on){document.body.classList.toggle('dkj-large-text',!!on);try{localStorage.setItem(KEY,on?'1':'0');}catch(e){}}
  function close(){var d=document.getElementById('dkjHelpDialog');if(d&&d.open)d.close();}
  function render(){
    if(document.getElementById('dkjAssist'))return;
    var saved=false;try{saved=localStorage.getItem(KEY)==='1';}catch(e){} applyLarge(saved);
    var bar=document.createElement('div');bar.id='dkjAssist';bar.className='dkj-assist';bar.setAttribute('aria-label','화면 사용 보조');
    bar.innerHTML='<button type="button" class="dkj-assist-font" aria-pressed="'+(saved?'true':'false')+'">가 크게</button><button type="button" class="dkj-assist-help" aria-haspopup="dialog">쉬운 도움</button>';
    document.body.appendChild(bar);
    var dialog=document.createElement('dialog');dialog.id='dkjHelpDialog';dialog.className='dkj-help-dialog';
    dialog.innerHTML='<div class="dkj-help-inner"><div class="dkj-help-head"><div><h2>쉬운 사용 안내</h2><p>Easy guide · 简易指南 · Hướng dẫn nhanh</p></div><button class="dkj-help-close" type="button" aria-label="안내 닫기">×</button></div><div class="dkj-help-grid"><div class="dkj-help-box"><b>한국어</b><p>위 메뉴에서 업무를 고르고, 화면의 녹색 버튼을 누르면 다음 단계로 이동합니다. 왼쪽 아래 <strong>가 크게</strong>로 글자를 키울 수 있습니다.</p></div><div class="dkj-help-box"><b>English</b><p>Choose a task from the top menu. Green buttons move to the next step. Use <strong>Large text</strong> at the lower left for easier reading.</p></div><div class="dkj-help-box"><b>中文</b><p>请从顶部菜单选择工作。绿色按钮可进入下一步。使用左下角的<strong>大字</strong>按钮可放大文字。</p></div><div class="dkj-help-box"><b>Tiếng Việt</b><p>Chọn công việc ở menu trên cùng. Nút màu xanh lá sẽ chuyển sang bước tiếp theo. Dùng nút <strong>chữ lớn</strong> ở góc trái dưới.</p></div></div><p class="dkj-help-tip">도움이 필요하면 화면 오른쪽 아래의 <strong>홈</strong>으로 돌아가거나, 담당자에게 화면 제목·기록번호를 알려 주세요.</p><a class="dkj-help-link" href="'+root()+'index.html">업무 콘솔(홈)으로 이동</a></div>';
    document.body.appendChild(dialog);
    bar.querySelector('.dkj-assist-font').addEventListener('click',function(){var next=!document.body.classList.contains('dkj-large-text');applyLarge(next);this.setAttribute('aria-pressed',next?'true':'false');});
    bar.querySelector('.dkj-assist-help').addEventListener('click',function(){dialog.showModal();});
    dialog.querySelector('.dkj-help-close').addEventListener('click',close);
    dialog.addEventListener('click',function(e){if(e.target===dialog)close();});
    
    // AI 챗봇 및 텔레그램 모듈 자동 연동 확인
    ensureChatbot(root());
  }

  function ensureChatbot(base) {
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
