/**
 * 동김제농협 스마트 HACCP · FSSC22000 — 텔레그램 알림 설정 및 전송 모듈
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'dkj:telegram:config:v1';
  var RTDB_PATH = 'system/settings/telegram';

  // 기본 설정 (관리자가 시스템 설정에서 변경 가능)
  var defaultConfig = {
    enabled: true,
    botToken: '', // 예: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ (사용자가 시스템 설정에서 입력)
    chatId: '',   // 예: -100123456789 또는 사용자/그룹 chat_id
    notifyOnIssue: true,
    notifyOnCapa: false,
    siteTitle: '동김제농협 산지유통센터 (스마트 HACCP/FSSC22000)'
  };

  function getStorageConfig() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        return Object.assign({}, defaultConfig, parsed);
      }
    } catch (e) {}
    return Object.assign({}, defaultConfig);
  }

  function saveConfig(cfg) {
    try {
      var current = getStorageConfig();
      var merged = Object.assign({}, current, cfg);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));

      // Firebase RTDB에도 동기화
      if (global.DkjAuth && global.DkjAuth.configured && global.DkjAuth.configured() && global.DkjAuth.token && global.DkjAuth.token()) {
        global.DkjAuth.request(RTDB_PATH, 'PUT', merged).catch(function () {});
      }
      return merged;
    } catch (e) {
      return cfg;
    }
  }

  // Firebase RTDB에서 설정 로드
  function syncFromCloud() {
    if (global.DkjAuth && global.DkjAuth.configured && global.DkjAuth.configured() && global.DkjAuth.token && global.DkjAuth.token()) {
      return global.DkjAuth.request(RTDB_PATH, 'GET').then(function (remoteCfg) {
        if (remoteCfg && typeof remoteCfg === 'object') {
          var current = getStorageConfig();
          var merged = Object.assign({}, current, remoteCfg);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          return merged;
        }
        return getStorageConfig();
      }).catch(function () {
        return getStorageConfig();
      });
    }
    return Promise.resolve(getStorageConfig());
  }

  /**
   * 텔레그램 메시지 전송 함수
   * @param {Object} options
   * @param {string} options.category - 접수 분류 (예: 불편사항 접수, 오류 보고, 건의사항 등)
   * @param {string} options.message - 사용자가 입력한 내용
   * @param {Object} [options.user] - 사용자 정보 { empId, name, role }
   * @param {string} [options.pageTitle] - 페이지 제목
   * @param {string} [options.pageUrl] - 페이지 URL
   * @param {string} [options.botToken] - 오버라이드할 봇 토큰
   * @param {string} [options.chatId] - 오버라이드할 챗 ID
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async function sendMessage(options) {
    var cfg = getStorageConfig();
    var botToken = (options && options.botToken) || cfg.botToken;
    var chatId = (options && options.chatId) || cfg.chatId;

    if (!botToken || !chatId) {
      return {
        success: false,
        error: 'NO_CONFIG',
        message: '텔레그램 봇 토큰(Bot Token) 또는 Chat ID가 설정되지 않았습니다.\n[시스템 설정] 화면에서 텔레그램 설정을 등록해주세요.'
      };
    }

    var now = new Date();
    var timeStr = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0') + ':' +
      String(now.getSeconds()).padStart(2, '0');

    var user = (options && options.user) || (global.DkjAuth && global.DkjAuth.user ? global.DkjAuth.user() : null) || { empId: '미로그인', name: '방문자', roleLabel: '작업자' };
    var pageTitle = (options && options.pageTitle) || document.title || '업무 화면';
    var pageUrl = (options && options.pageUrl) || window.location.href;
    var category = (options && options.category) || '불편사항 접수';
    var content = (options && (options.message || options.text)) || '(내용 없음)';

    // 기기 환경 정보
    var ua = navigator.userAgent;
    var isMobile = /Mobile|Android|iP(hone|od|ad)/i.test(ua);
    var platform = isMobile ? '📱 모바일/태블릿' : '💻 PC';

    // HTML 포맷의 텔레그램 메시지 조립
    var text = '🚨 <b>[동김제농협 스마트 HACCP] ' + escapeHtml(category) + '</b>\n' +
      '━━━━━━━━━━━━━━━━━━━━\n' +
      '👤 <b>접수자:</b> ' + escapeHtml(user.name || user.empId) + ' (사번: ' + escapeHtml(user.empId) + ' / ' + escapeHtml(user.roleLabel || user.role || '작업자') + ')\n' +
      '📍 <b>발생화면:</b> ' + escapeHtml(pageTitle) + '\n' +
      '🔗 <b>페이지 URL:</b> ' + escapeHtml(pageUrl) + '\n' +
      '🕒 <b>접수시각:</b> ' + timeStr + '\n' +
      '📱 <b>기기환경:</b> ' + platform + ' (' + (navigator.onLine ? '온라인' : '오프라인') + ')\n' +
      '━━━━━━━━━━━━━━━━━━━━\n' +
      '📝 <b>[상세 내용]</b>\n' +
      escapeHtml(content) + '\n' +
      '━━━━━━━━━━━━━━━━━━━━';

    var apiUrl = 'https://api.telegram.org/bot' + encodeURIComponent(botToken.trim()) + '/sendMessage';
    var functionUrl = 'https://asia-southeast1-dkj-fssc22000.cloudfunctions.net/sendTelegramAlert';

    // 1. Cloud Function 안전 전송 시도 (토큰 은닉)
    try {
      var fnRes = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: category,
          message: content,
          user: user,
          pageTitle: pageTitle,
          pageUrl: pageUrl
        })
      });
      if (fnRes.ok) {
        var fnData = await fnRes.json();
        if (fnData.ok) return { success: true, message: '텔레그램으로 성공적으로 전송되었습니다.' };
      }
    } catch (e) {
      // Cloud Function 미배포 또는 네트워크 문제 시 아래 클라이언트 직접 전송으로 fallback
    }

    // 2. 클라이언트 직접 발송 Fallback
    try {
      var response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text: text,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
      });

      var result = await response.json();
      if (result.ok) {
        return { success: true, message: '텔레그램으로 성공적으로 전송되었습니다.' };
      } else {
        return {
          success: false,
          error: result.description || 'TELEGRAM_API_ERROR',
          message: '텔레그램 전송 실패: ' + (result.description || '오류가 발생했습니다.')
        };
      }
    } catch (err) {
      return {
        success: false,
        error: err.message,
        message: '네트워크 오류로 텔레그램 전송에 실패했습니다. (' + err.message + ')'
      };
    }
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // 전역 노출
  global.DkjTelegram = {
    getConfig: getStorageConfig,
    saveConfig: saveConfig,
    syncFromCloud: syncFromCloud,
    sendMessage: sendMessage
  };

  // 클라우드 동기화 이벤트 리스닝
  document.addEventListener('dkj:auth-ready', function () {
    syncFromCloud();
  });
})(typeof window !== 'undefined' ? window : this);
