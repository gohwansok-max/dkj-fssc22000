(function () {
  'use strict';

  var button = document.getElementById('shareLinkButton');
  var status = document.getElementById('shareStatus');
  if (!button) return;

  var shareUrl = new URL('company-profile.html', window.location.href).href;
  var shareData = {
    title: '동김제농협 산지가공센터 회사소개서·제안서',
    text: '동김제농협 산지가공센터 회사소개서·제안서입니다.',
    url: shareUrl
  };

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  async function copyLink() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        var textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.setAttribute('readonly', '');
        textArea.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setStatus('회사소개서 링크를 복사했습니다. 카카오톡 대화창에 붙여넣어 보내세요.');
    } catch (error) {
      setStatus('링크 복사에 실패했습니다. 주소창의 링크를 복사해 공유해 주세요.');
    }
  }

  button.addEventListener('click', async function () {
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setStatus('공유 메뉴를 열었습니다. 카카오톡을 선택해 고객에게 보내세요.');
        return;
      } catch (error) {
        if (error && error.name === 'AbortError') return;
      }
    }
    await copyLink();
  });
})();
