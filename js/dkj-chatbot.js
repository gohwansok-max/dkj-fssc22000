/**
 * 동김제농협 스마트 HACCP · FSSC22000 — AI 도우미 & 실시간 텔레그램 불편접수 챗봇
 */
(function (global) {
  'use strict';

  var CHAT_STORAGE_KEY = 'dkj:chatbot:messages:v1';
  var OPEN_STORAGE_KEY = 'dkj:chatbot:is_open:v1';

  function getBaseHref() {
    var p = (global.location && global.location.pathname) || '';
    if (/\/records\/[^\/]+$/i.test(p) || p.indexOf('/records/') !== -1) {
      return '../';
    }
    return './';
  }

  function ensureStylesheet() {
    if (document.getElementById('dkj-chatbot-css')) return;
    var link = document.createElement('link');
    link.id = 'dkj-chatbot-css';
    link.rel = 'stylesheet';
    link.href = getBaseHref() + 'css/dkj-chatbot.css?v=66';
    document.head.appendChild(link);
  }

  function getUserInfo() {
    var u = (global.DkjAuth && global.DkjAuth.user && global.DkjAuth.user()) || null;
    if (u) return u;
    try {
      var raw = localStorage.getItem('dkj:auth:user:v2');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { empId: '미로그인', name: '현장직원', roleLabel: '작업자' };
  }

  function getSavedMessages() {
    try {
      var raw = sessionStorage.getItem(CHAT_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveMessages(msgs) {
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(msgs.slice(-40)));
    } catch (e) {}
  }

  function formatTime(isoOrNow) {
    var d = isoOrNow ? new Date(isoOrNow) : new Date();
    var h = d.getHours();
    var m = d.getMinutes();
    var ampm = h >= 12 ? '오후' : '오전';
    h = h % 12;
    h = h ? h : 12;
    return ampm + ' ' + h + ':' + (m < 10 ? '0' + m : m);
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 지능형 응답 지식 엔진
  var KnowledgeEngine = {
    answer: function (query) {
      var q = query.trim().toLowerCase();
      var base = getBaseHref();

      // 1. 불편 / 오류 / 접수 / 버그 / 에러 / 건의
      if (/불편|오류|에러|버그|장애|접수|신고|건의|안돼|안 돼|안됨|안 됨|먹통|멈춤|깨짐/.test(q)) {
        return {
          type: 'form',
          text: '시스템 사용 중 불편하신 점이나 발생한 오류를 아래 양식에 적어주시면, <strong>관리자의 텔레그램으로 즉시 전달</strong>됩니다. 상세히 적어주시면 빠른 해결에 큰 도움이 됩니다! 😊'
        };
      }

      // 2. 비밀번호 / 로그인 / 사번 / 계정 / 권한
      if (/비밀번호|비번|패스워드|로그인|사번|아이디|계정|권한|로그아웃/.test(q)) {
        return {
          type: 'text',
          text: '🔑 <strong>로그인 및 계정 안내:</strong><br>' +
            '• 모든 직원은 사번과 비밀번호로 로그인합니다.<br>' +
            '• 비밀번호 분실 또는 권한 변경이 필요한 경우 <strong>시스템 관리자(사번 4343)</strong>에게 문의하시거나, 아래 [불편/문의 접수]를 통해 요청해주세요.<br>' +
            '• 관리자는 <a href="' + base + 'system-settings.html" style="color:#009a44;font-weight:700;">[시스템 설정]</a> 화면에서 계정 추가 및 비밀번호 초기화가 가능합니다.'
        };
      }

      // 3. 서명 / 결재 / 승인 / 검토
      if (/서명|결재|승인|검토|작성자|도장/.test(q)) {
        return {
          type: 'text',
          text: '✍️ <strong>전자결재 및 서명 안내:</strong><br>' +
            '• 일지 하단의 결재란은 <strong>[작성자] → [검토자] → [승인자]</strong> 3단계로 구성됩니다.<br>' +
            '• 로그인한 사용자의 권한 역할(작업자/관리자/책임자)에 따라 본인 단계의 서명 버튼이 활성화됩니다.<br>' +
            '• 서명 버튼을 누르면 로그인한 성명과 일시가 기록되어 전자서명이 완료됩니다.'
        };
      }

      // 4. 서식 / 일지 작성 / 저장 / 인쇄
      if (/일지|서식|작성|저장|인쇄|출력|프린트|fr-|dkj-/.test(q)) {
        return {
          type: 'text',
          text: '📋 <strong>일지 작성 및 보관 안내:</strong><br>' +
            '• <a href="' + base + 'records-center.html" style="color:#009a44;font-weight:700;">[기록 검색(서식 센터)]</a>에서 74종 서식을 검색하고 즉시 작성할 수 있습니다.<br>' +
            '• 서식 작성 후 우측 상단 또는 하단의 <strong>[저장]</strong> 버튼을 누르면 기기 및 클라우드(Firebase)에 실시간 보관됩니다.<br>' +
            '• <strong>[정본 인쇄]</strong>를 누르면 A4 규격에 최적화된 PDF 또는 인쇄 출력이 지원됩니다.'
        };
      }

      // 5. 새로고침 / 캐시 / 업데이트 / 화면 안 바뀜
      if (/새로고침|캐시|업데이트|반영|안바뀜|안 바뀜|옛날/.test(q)) {
        return {
          type: 'text',
          text: '🔄 <strong>화면 갱신(강력 새로고침) 안내:</strong><br>' +
            '• 화면 오른쪽 아래의 <strong>새로고침(↻) 아이콘</strong>을 누르면 캐시를 완전히 비우고 최신 버전으로 즉시 업데이트됩니다.<br>' +
            '• 태블릿이나 스마트폰에서도 동일하게 적용됩니다.'
        };
      }

      // 6. 문서센터 / 매뉴얼 / 절차서 / 기준서 / MDR
      if (/문서|매뉴얼|절차서|지침서|mdr|규정|기준서|정본/.test(q)) {
        return {
          type: 'text',
          text: '📚 <strong>문서 열람 및 규정 안내:</strong><br>' +
            '• <a href="' + base + 'docs-center.html" style="color:#009a44;font-weight:700;">[문서센터]</a>: FSSC22000 및 스마트 HACCP 관리 매뉴얼·절차서·지침서 열람<br>' +
            '• <a href="' + base + 'official-documents.html" style="color:#009a44;font-weight:700;">[정본 열람실]</a>: 구글 드라이브 연동 정본 원본 PDF 및 문서 259건 검색<br>' +
            '• <a href="' + base + 'mdr-register.html" style="color:#009a44;font-weight:700;">[문서관리대장(MDR)]</a>: 제·개정 이력 및 배포 대장 확인'
        };
      }

      // 7. 모의회수 / 추적성 / 2시간 / CAPA / 이탈 / 부적합
      if (/추적|모의회수|회수|리콜|capa|이탈|부적합|시정조치/.test(q)) {
        return {
          type: 'text',
          text: '🛡️ <strong>추적성 & CAPA 관리 안내:</strong><br>' +
            '• <a href="' + base + 'traceability.html" style="color:#009a44;font-weight:700;">[추적성·모의회수]</a>: 원료 입고부터 완제품 출고까지 <strong>2시간 이내 100% 추적</strong> 훈련 및 기록 관리<br>' +
            '• <a href="' + base + 'capa-management.html" style="color:#009a44;font-weight:700;">[CAPA 관리]</a>: CCP 한계기준 이탈 및 부적합 발생 시 원인 분석과 시정조치 등록·종결 관리'
        };
      }

      // 8. 품질 경보 / 정기 알림 / 캘린더
      if (/품질|경보|알림|정기|달력|캘린더|일정/.test(q)) {
        return {
          type: 'text',
          text: '📊 <strong>품질 대시보드 및 알림 안내:</strong><br>' +
            '• <a href="' + base + 'quality-dashboard.html" style="color:#009a44;font-weight:700;">[품질 경보 대시보드]</a>: CAPA 초과, 검교정 주기, 모의회수 현황 실시간 감시<br>' +
            '• <a href="' + base + 'periodic-alerts.html" style="color:#009a44;font-weight:700;">[정기 관리 알림]</a>: 주간/월간/연간 점검 일정 및 미작성 현황 조회'
        };
      }

      // 9. 연락처 / 전화번호 / 담당자
      if (/연락처|전화|번호|센터장|팀장|담당자/.test(q)) {
        return {
          type: 'text',
          text: '📞 <strong>동김제농협 산지유통센터 연락망:</strong><br>' +
            '• 시스템 관리자: 사번 4343<br>' +
            '• 긴급 불편사항은 본 AI 챗봇의 <strong>[불편/오류 즉시 접수]</strong>를 이용하시면 관리자 텔레그램으로 1초 만에 알림이 전송됩니다!'
        };
      }

      // 10. 기본 안내
      return {
        type: 'text',
        text: '궁금하신 내용을 입력해주셔서 감사합니다. 😊<br>' +
          '시스템 사용법, 일지 작성, 전자결재, 문서 검색 등에 대해 물어보실 수 있습니다.<br><br>' +
          '사용 중 <strong>불편한 점이나 개선/오류 사항</strong>이 있다면 아래 <strong>[🚨 불편/오류 접수]</strong> 버튼을 눌러 관리자에게 직접 텔레그램으로 알려주세요!',
        showFormOption: true
      };
    }
  };

  // 챗봇 UI 렌더링 클래스
  function ChatbotWidget() {
    this.isOpen = false;
    this.messages = [];
    this.init();
  }

  ChatbotWidget.prototype.init = function () {
    ensureStylesheet();
    this.loadState();
    this.buildDom();
    this.bindEvents();
    this.renderHistory();

    // 초기 환영 메시지가 없으면 추가
    if (!this.messages.length) {
      var user = getUserInfo();
      this.addBotMessage(
        '안녕하세요, <strong>' + escapeHtml(user.name || '동김제농협 직원') + '</strong>님! 🌾<br>' +
        '스마트 HACCP · FSSC22000 AI 도우미입니다.<br>' +
        '사용 중 불편한 점이나 질문이 있으시면 언제든지 말씀해주세요.<br>' +
        '<strong>불편사항은 관리자 텔레그램으로 즉시 전달됩니다!</strong>',
        true
      );
    }
  };

  ChatbotWidget.prototype.loadState = function () {
    this.messages = getSavedMessages();
    try {
      this.isOpen = sessionStorage.getItem(OPEN_STORAGE_KEY) === '1';
    } catch (e) {
      this.isOpen = false;
    }
  };

  ChatbotWidget.prototype.saveState = function () {
    saveMessages(this.messages);
    try {
      sessionStorage.setItem(OPEN_STORAGE_KEY, this.isOpen ? '1' : '0');
    } catch (e) {}
  };

  ChatbotWidget.prototype.buildDom = function () {
    if (document.getElementById('dkjChatbotContainer')) return;

    var container = document.createElement('div');
    container.id = 'dkjChatbotContainer';
    container.innerHTML =
      '<!-- 플로팅 트리거 버튼 -->' +
      '<button type="button" class="dkj-chatbot-trigger" id="dkjChatbotTrigger" aria-label="AI 도우미 및 불편접수 열기">' +
        '<div class="dkj-chatbot-trigger__icon">' +
          '<svg viewBox="0 0 24 24">' +
            '<path d="M12 2C6.477 2 2 6.477 2 12c0 1.821.487 3.53 1.338 5L2.5 21.5l4.632-.821A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/>' +
          '</svg>' +
          '<span class="dkj-chatbot-trigger__badge"></span>' +
        '</div>' +
        '<span class="dkj-chatbot-trigger__text">AI 도우미 &amp; 불편접수</span>' +
      '</button>' +

      '<!-- 챗봇 대화 패널 -->' +
      '<aside class="dkj-chatbot-panel' + (this.isOpen ? ' is-open' : '') + '" id="dkjChatbotPanel" aria-label="AI 도우미 대화창" aria-hidden="' + (!this.isOpen) + '">' +
        '<div class="dkj-chatbot-header">' +
          '<div class="dkj-chatbot-header__info">' +
            '<div class="dkj-chatbot-header__avatar">' +
              '<img src="' + getBaseHref() + 'assets/brand/nh-symbol.svg" alt="NH">' +
            '</div>' +
            '<div>' +
              '<h3 class="dkj-chatbot-header__title">동김제 스마트 AI 도우미</h3>' +
              '<div class="dkj-chatbot-header__status">' +
                '<span class="dkj-chatbot-header__dot"></span>' +
                '<span>실시간 텔레그램 알림 연동 중</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="dkj-chatbot-header__actions">' +
            '<button type="button" class="dkj-chatbot-header__btn" id="dkjChatbotClose" title="닫기" aria-label="대화창 닫기">×</button>' +
          '</div>' +
        '</div>' +

        '<div class="dkj-chatbot-body" id="dkjChatbotBody" role="log" aria-live="polite"></div>' +

        '<div class="dkj-chatbot-footer">' +
          '<div class="dkj-chatbot-input-wrap">' +
            '<input type="text" class="dkj-chatbot-input" id="dkjChatbotInput" placeholder="불편사항이나 궁금한 점을 입력하세요..." autocomplete="off" aria-label="메시지 입력">' +
          '</div>' +
          '<button type="button" class="dkj-chatbot-send-btn" id="dkjChatbotSend" aria-label="전송" title="전송">' +
            '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>' +
          '</button>' +
        '</div>' +
      '</aside>';

    document.body.appendChild(container);
    this.elTrigger = document.getElementById('dkjChatbotTrigger');
    this.elPanel = document.getElementById('dkjChatbotPanel');
    this.elBody = document.getElementById('dkjChatbotBody');
    this.elInput = document.getElementById('dkjChatbotInput');
    this.elSend = document.getElementById('dkjChatbotSend');
    this.elClose = document.getElementById('dkjChatbotClose');
  };

  ChatbotWidget.prototype.bindEvents = function () {
    var self = this;

    this.elTrigger.addEventListener('click', function () {
      self.toggle();
    });

    this.elClose.addEventListener('click', function () {
      self.close();
    });

    this.elSend.addEventListener('click', function () {
      self.handleSend();
    });

    this.elInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        self.handleSend();
      }
    });

    // ESC 키로 닫기
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && self.isOpen) {
        self.close();
      }
    });
  };

  ChatbotWidget.prototype.toggle = function () {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  };

  ChatbotWidget.prototype.open = function () {
    this.isOpen = true;
    this.elPanel.classList.add('is-open');
    this.elPanel.setAttribute('aria-hidden', 'false');
    this.saveState();
    this.scrollToBottom();
    setTimeout(function () {
      var input = document.getElementById('dkjChatbotInput');
      if (input) input.focus();
    }, 150);
  };

  ChatbotWidget.prototype.close = function () {
    this.isOpen = false;
    this.elPanel.classList.remove('is-open');
    this.elPanel.setAttribute('aria-hidden', 'true');
    this.saveState();
  };

  ChatbotWidget.prototype.scrollToBottom = function () {
    var self = this;
    setTimeout(function () {
      if (self.elBody) {
        self.elBody.scrollTop = self.elBody.scrollHeight;
      }
    }, 50);
  };

  ChatbotWidget.prototype.renderHistory = function () {
    var self = this;
    this.elBody.innerHTML = '';
    this.messages.forEach(function (msg) {
      self.renderMessageItem(msg);
    });
    this.scrollToBottom();
  };

  ChatbotWidget.prototype.renderMessageItem = function (msg) {
    var item = document.createElement('div');
    item.className = 'dkj-cb-msg dkj-cb-msg--' + (msg.sender === 'user' ? 'user' : 'bot');

    var avatarHtml = msg.sender === 'bot'
      ? '<div class="dkj-cb-msg__avatar">NH</div>'
      : '';

    var chipsHtml = '';
    if (msg.chips && msg.chips.length) {
      chipsHtml = '<div class="dkj-cb-chips">' +
        msg.chips.map(function (chip) {
          var isDanger = chip.action === 'open_form' || chip.label.indexOf('🚨') !== -1;
          return '<button type="button" class="dkj-cb-chip' + (isDanger ? ' danger' : '') + '" data-action="' + chip.action + '" data-payload="' + escapeHtml(chip.payload || chip.label) + '">' +
            chip.label +
          '</button>';
        }).join('') +
      '</div>';
    }

    var formHtml = '';
    if (msg.showForm) {
      formHtml = this.createFormHtml(msg.formCategory || '화면/기능 오류');
    }

    item.innerHTML = avatarHtml +
      '<div class="dkj-cb-msg__content">' +
        '<div>' + msg.text + '</div>' +
        chipsHtml +
        formHtml +
        '<div class="dkj-cb-msg__time">' + formatTime(msg.timestamp) + '</div>' +
      '</div>';

    this.elBody.appendChild(item);
    this.bindMessageEvents(item);
  };

  ChatbotWidget.prototype.createFormHtml = function (defaultCat) {
    var user = getUserInfo();
    var pageTitle = document.title || '업무 콘솔';

    return '<div class="dkj-cb-form-card">' +
      '<h4>🚨 불편·오류 실시간 접수 (텔레그램 전송)</h4>' +
      '<div class="dkj-cb-meta-preview">' +
        '📍 현재 화면: ' + escapeHtml(pageTitle) + '<br>' +
        '👤 접수자: ' + escapeHtml(user.name || user.empId) + ' (' + escapeHtml(user.empId) + ')' +
      '</div>' +
      '<div class="dkj-cb-form-group">' +
        '<label>접수 분류</label>' +
        '<select class="dkj-cb-form-category">' +
          '<option value="화면/기능 오류"' + (defaultCat === '화면/기능 오류' ? ' selected' : '') + '>⚠️ 화면/기능 오류 발생</option>' +
          '<option value="일지 작성 불편"' + (defaultCat === '일지 작성 불편' ? ' selected' : '') + '>📝 일지 작성/저장 불편</option>' +
          '<option value="기능 개선 건의"' + (defaultCat === '기능 개선 건의' ? ' selected' : '') + '>💡 기능 개선/요청 건의</option>' +
          '<option value="로그인/비밀번호 문의"' + (defaultCat === '로그인/비밀번호 문의' ? ' selected' : '') + '>🔑 로그인/비밀번호 문의</option>' +
          '<option value="기타 긴급 문의"' + (defaultCat === '기타 긴급 문의' ? ' selected' : '') + '>⚡ 기타 긴급 문의</option>' +
        '</select>' +
      '</div>' +
      '<div class="dkj-cb-form-group">' +
        '<label>불편 및 문의 상세 내용</label>' +
        '<textarea class="dkj-cb-form-text" placeholder="예: 소독일지에서 측정치 입력 후 저장이 안 됩니다."></textarea>' +
      '</div>' +
      '<button type="button" class="dkj-cb-btn-submit dkj-cb-form-submit">' +
        '<span>🚨 관리자 텔레그램으로 접수하기</span>' +
      '</button>' +
    '</div>';
  };

  ChatbotWidget.prototype.bindMessageEvents = function (item) {
    var self = this;

    // 칩 버튼 클릭
    var chips = item.querySelectorAll('.dkj-cb-chip');
    Array.prototype.forEach.call(chips, function (chip) {
      chip.addEventListener('click', function () {
        var action = chip.getAttribute('data-action');
        var payload = chip.getAttribute('data-payload');
        self.handleChipAction(action, payload);
      });
    });

    // 폼 제출 버튼 클릭
    var submitBtn = item.querySelector('.dkj-cb-form-submit');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        var formCard = item.querySelector('.dkj-cb-form-card');
        var catSelect = formCard.querySelector('.dkj-cb-form-category');
        var textarea = formCard.querySelector('.dkj-cb-form-text');
        var category = catSelect ? catSelect.value : '불편사항 접수';
        var message = textarea ? textarea.value.trim() : '';

        if (!message) {
          alert('불편하시거나 문의하실 내용을 입력해주세요.');
          if (textarea) textarea.focus();
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>⏳ 텔레그램으로 전송 중...</span>';

        self.submitToTelegram(category, message, formCard);
      });
    }
  };

  ChatbotWidget.prototype.handleChipAction = function (action, payload) {
    if (action === 'open_form') {
      this.addUserMessage('불편사항을 접수하고 싶어요.');
      this.addBotMessage(
        '불편사항 접수 양식을 열어드렸습니다. 아래 양식에 내용을 적고 <strong>[텔레그램으로 접수하기]</strong>를 눌러주세요!',
        false,
        null,
        true,
        payload || '화면/기능 오류'
      );
    } else if (action === 'send_text') {
      this.addUserMessage(payload);
      this.processQuery(payload);
    } else if (action === 'hard_reload') {
      this.addUserMessage('화면 새로고침(캐시 삭제)');
      this.addBotMessage('기기 캐시를 삭제하고 강력 새로고침을 실행합니다... 🔄');
      setTimeout(function () {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(function (registrations) {
            return Promise.all(registrations.map(function (r) { return r.unregister(); }));
          }).then(function () {
            if ('caches' in window) {
              return caches.keys().then(function (names) {
                return Promise.all(names.map(function (n) { return caches.delete(n); }));
              });
            }
          }).finally(function () {
            window.location.reload();
          });
        } else {
          window.location.reload();
        }
      }, 800);
    }
  };

  ChatbotWidget.prototype.addUserMessage = function (text) {
    var msg = {
      sender: 'user',
      text: escapeHtml(text),
      timestamp: new Date().toISOString()
    };
    this.messages.push(msg);
    this.saveState();
    this.renderMessageItem(msg);
    this.scrollToBottom();
  };

  ChatbotWidget.prototype.addBotMessage = function (htmlText, withDefaultChips, customChips, showForm, formCategory) {
    var chips = customChips || [];
    if (withDefaultChips) {
      chips = [
        { label: '🚨 불편/오류 즉시 접수', action: 'open_form', payload: '화면/기능 오류' },
        { label: '📝 일지 작성 & 서명', action: 'send_text', payload: '일지 작성과 전자결재 서명 방법 알려줘' },
        { label: '🔍 문서·정본 찾는 법', action: 'send_text', payload: '문서센터와 정본 열람실 어떻게 찾나요?' },
        { label: '🔄 화면 새로고침(캐시삭제)', action: 'hard_reload', payload: '화면 새로고침' },
        { label: '📞 관리자 연락처', action: 'send_text', payload: '관리자 연락처 알려줘' }
      ];
    }

    var msg = {
      sender: 'bot',
      text: htmlText,
      chips: chips,
      showForm: !!showForm,
      formCategory: formCategory || '화면/기능 오류',
      timestamp: new Date().toISOString()
    };

    this.messages.push(msg);
    this.saveState();
    this.renderMessageItem(msg);
    this.scrollToBottom();
  };

  ChatbotWidget.prototype.handleSend = function () {
    var text = this.elInput.value.trim();
    if (!text) return;
    this.elInput.value = '';
    this.addUserMessage(text);
    this.processQuery(text);
  };

  ChatbotWidget.prototype.processQuery = function (query) {
    var self = this;
    var res = KnowledgeEngine.answer(query);

    if (res.type === 'form') {
      setTimeout(function () {
        self.addBotMessage(res.text, false, null, true, '화면/기능 오류');
      }, 300);
    } else {
      setTimeout(function () {
        var chips = null;
        if (res.showFormOption) {
          chips = [
            { label: '🚨 불편/오류 접수하기', action: 'open_form', payload: '기타 긴급 문의' },
            { label: '🔄 화면 새로고침', action: 'hard_reload' }
          ];
        }
        self.addBotMessage(res.text, false, chips);
      }, 300);
    }
  };

  ChatbotWidget.prototype.submitToTelegram = function (category, message, formCard) {
    var self = this;
    var user = getUserInfo();

    if (!global.DkjTelegram || !global.DkjTelegram.sendMessage) {
      alert('텔레그램 전송 모듈이 로드되지 않았습니다.');
      return;
    }

    global.DkjTelegram.sendMessage({
      category: category,
      message: message,
      user: user,
      pageTitle: document.title,
      pageUrl: window.location.href
    }).then(function (result) {
      if (result.success) {
        if (formCard) {
          formCard.innerHTML =
            '<div class="dkj-cb-success-card">' +
              '<b>✅ 관리자에게 텔레그램으로 전송 완료!</b>' +
              '접수하신 내용이 관리자에게 실시간 알림으로 발송되었습니다.<br>' +
              '신속하게 확인하여 조치하겠습니다. 감사합니다.' +
            '</div>';
        }
        self.addBotMessage(
          '불편사항이 성공적으로 접수되었습니다. 추가로 궁금하신 점이나 다른 문의가 있으시면 언제든지 말씀해주세요!',
          true
        );
      } else {
        if (formCard) {
          var submitBtn = formCard.querySelector('.dkj-cb-form-submit');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>🚨 재시도: 관리자 텔레그램으로 접수하기</span>';
          }
        }
        self.addBotMessage(
          '⚠️ <strong>텔레그램 전송 안내:</strong><br>' +
          result.message + '<br><br>' +
          '<em>(관리자 안내: [시스템 설정] 화면에서 텔레그램 봇 토큰과 Chat ID를 설정해두시면 실시간 알림을 정상 수신할 수 있습니다.)</em>'
        );
      }
    });
  };

  // 인스턴스 자동 초기화
  function boot() {
    if (global.__dkjChatbotInstance) return;
    global.__dkjChatbotInstance = new ChatbotWidget();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.DkjChatbot = {
    open: function () {
      if (global.__dkjChatbotInstance) global.__dkjChatbotInstance.open();
    },
    close: function () {
      if (global.__dkjChatbotInstance) global.__dkjChatbotInstance.close();
    }
  };

})(typeof window !== 'undefined' ? window : this);
