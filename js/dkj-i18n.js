/**
 * 동김제농협 스마트 HACCP · FSSC22000 다국어(i18n) 모듈
 * 
 * 외국인(베트남) 근로자 및 현장 작업자를 위한 핵심 UI/서식 다국어 지원
 * - 한국어 (ko, 기본)
 * - 베트남어 (vi, Tiếng Việt)
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'dkj:ui:lang:v1';
  var currentLang = 'ko';

  // 핵심 UI 및 일지 작성 사전
  var DICTIONARY = {
    vi: {
      // 빠른 이동 & GNB
      '홈': 'Trang chủ',
      '이전': 'Trước',
      '새로고침': 'Tải lại',
      '닫기': 'Đóng',
      '확인': 'Xác nhận',
      '취소': 'Hủy',
      '저장': 'Lưu',
      '임시저장': 'Lưu tạm',
      '작성완료': 'Hoàn thành',
      '서명하기': 'Ký tên',
      '인쇄': 'In',
      '초기화': 'Làm mới',
      '검색': 'Tìm kiếm',
      '목록': 'Danh sách',
      '상세보기': 'Xem chi tiết',
      
      // 로그인 & 인증
      '사번': 'Mã NV',
      '사번(숫자 4자리)': 'Mã NV (4 số)',
      '비밀번호': 'Mật khẩu',
      '비밀번호 입력': 'Nhập mật khẩu',
      '로그인': 'Đăng nhập',
      '로그아웃': 'Đăng xuất',
      '작업자': 'Công nhân',
      '관리자': 'Quản trị viên',
      '품질관리자': 'QL Chất lượng',
      '생산관리자': 'QL Sản xuất',
      '책임자': 'Người phụ trách',
      
      // 서식 상태 & 결재
      '작성 중': 'Đang soạn',
      '검토대기': 'Chờ kiểm tra',
      '검토완료': 'Đã kiểm tra',
      '승인완료': 'Đã phê duyệt',
      '결재완료': 'Đã duyệt',
      '미작성': 'Chưa viết',
      '완료': 'Hoàn thành',
      '잠금': 'Đã khóa',
      
      // 점검 판정 & 기본 항목
      '적합': 'Đạt',
      '부적합': 'Không đạt',
      '양호': 'Tốt',
      '불량': 'Hỏng',
      '정상': 'Bình thường',
      '이상': 'Bất thường',
      '점검': 'Kiểm tra',
      '온도': 'Nhiệt độ',
      '농도': 'Nồng độ',
      '중량': 'Trọng lượng',
      '수량': 'Số lượng',
      '시간': 'Thời gian',
      '일자': 'Ngày',
      '기록일자': 'Ngày ghi',
      '작성자': 'Người lập',
      '확인자': 'Người kiểm',
      '승인자': 'Người duyệt',
      '비고': 'Ghi chú',
      '특이사항': 'Đặc điểm',
      '조치사항': 'Biện pháp xử lý',
      
      // 보조 위젯 & 챗봇
      '글자 보통': 'Cỡ chữ chuẩn',
      '글자 크게': 'Cỡ chữ lớn',
      '글자 아주크게': 'Cỡ chữ rất lớn',
      '📱 태블릿': '📱 Máy tính bảng',
      '쉬운 도움': 'Hướng dẫn',
      '💬 AI 도우미 & 불편접수': '💬 Trợ lý AI & Báo lỗi',
      '불편사항 접수': 'Báo lỗi / Ý kiến',
      '문의하기': 'Gửi câu hỏi',
      '전송': 'Gửi',
      '최신 업데이트가 배포되었습니다.': 'Đã có bản cập nhật mới.',
      '지금 반영하기': 'Cập nhật ngay',
      '오프라인 — 기록은 태블릿에 저장되고, 연결되면 자동으로 동기화됩니다.': 'Ngoại tuyến — Dữ liệu lưu trên máy và tự đồng bộ khi có mạng.'
    }
  };

  function getSavedLang() {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'ko';
    } catch (e) {
      return 'ko';
    }
  }

  function setLanguage(lang) {
    currentLang = (lang === 'vi') ? 'vi' : 'ko';
    try {
      localStorage.setItem(STORAGE_KEY, currentLang);
    } catch (e) {}

    document.documentElement.lang = currentLang;
    document.body.classList.toggle('dkj-lang-vi', currentLang === 'vi');
    
    translatePage();
    
    try {
      document.dispatchEvent(new CustomEvent('dkj:lang-changed', { detail: { lang: currentLang } }));
    } catch (e) {}
  }

  function t(text) {
    if (!text || currentLang === 'ko') return text;
    var dict = DICTIONARY[currentLang] || {};
    var clean = String(text).trim();
    return dict[clean] || text;
  }

  function translatePage() {
    var dict = DICTIONARY[currentLang] || {};
    var isVi = (currentLang === 'vi');

    // 1. 버튼 및 링크 번역
    var elements = document.querySelectorAll('button, a, label, th, .badge, .status, .pill-btn, .tab-btn, .ck-chip, .gnb-btn');
    elements.forEach(function (el) {
      if (!el.getAttribute('data-original-ko')) {
        el.setAttribute('data-original-ko', el.textContent.trim());
      }
      var orig = el.getAttribute('data-original-ko');
      if (isVi && dict[orig]) {
        el.textContent = dict[orig];
      } else if (!isVi && orig) {
        el.textContent = orig;
      }
    });

    // 2. Placeholder 번역
    var inputs = document.querySelectorAll('input[placeholder], textarea[placeholder]');
    inputs.forEach(function (inp) {
      if (!inp.getAttribute('data-original-placeholder')) {
        inp.setAttribute('data-original-placeholder', inp.getAttribute('placeholder') || '');
      }
      var orig = inp.getAttribute('data-original-placeholder');
      if (isVi && dict[orig]) {
        inp.setAttribute('placeholder', dict[orig]);
      } else if (!isVi && orig) {
        inp.setAttribute('placeholder', orig);
      }
    });
  }

  function init() {
    currentLang = getSavedLang();
    if (currentLang === 'vi') {
      setLanguage('vi');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.DkjI18n = {
    getLanguage: function () { return currentLang; },
    setLanguage: setLanguage,
    t: t,
    translatePage: translatePage
  };
})(typeof window !== 'undefined' ? window : this);