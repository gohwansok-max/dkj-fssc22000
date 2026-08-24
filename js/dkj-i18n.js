/**
 * 동김제농협 스마트 HACCP · FSSC22000 다국어(i18n) 통합 엔진
 * 
 * PC 및 모바일/태블릿 전 화면 실시간 베트남어(Tiếng Việt) 다국어 변환 지원
 * - 한국어 (ko, 기본)
 * - 베트남어 (vi, Tiếng Việt)
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'dkj:ui:lang:v1';
  var currentLang = 'ko';

  // 광범위한 UI 및 서식 번역 딕셔너리
  var DICTIONARY = {
    vi: {
      // 1. 헤더 & GNB 메뉴
      '오늘 할 일': 'Việc hôm nay',
      '기록 검색': 'Tìm hồ sơ',
      '품질 경보': 'Cảnh báo chất lượng',
      '기록보관함': 'Lưu trữ hồ sơ',
      '문서센터': 'Trung tâm tài liệu',
      '전체 메뉴': 'Tất cả menu',
      '핵심 업무': 'Nghiệp vụ chính',
      '업무 콘솔': 'Bảng điều khiển',
      '기록양식 작성': 'Lập biểu mẫu',
      '품질 경보 현황': 'Tình trạng cảnh báo',
      '정기 알림 관리': 'Quản lý thông báo định kỳ',
      '문서 & 관리': 'Tài liệu & Quản lý',
      '정본 열람실': 'Phòng đọc bản gốc',
      '문서관리대장': 'Sổ quản lý tài liệu',
      'CAPA 관리': 'Quản lý CAPA',
      '품질 & 인증': 'Chất lượng & Chứng nhận',
      '추적성·모의회수': 'Truy xuất & Thu hồi thử',
      'FSSC 심사준비': 'Chuẩn bị đánh giá FSSC',
      '경영검토·식품안전문화': 'Xem xét lãnh đạo & Văn hóa ATTP',
      '설정 & 시스템': 'Cài đặt & Hệ thống',
      'HACCP팀 설정': 'Thiết lập đội HACCP',
      '임원 통합 현황': 'Báo cáo ban giám đốc',
      '시스템 설정': 'Cài đặt hệ thống',
      '회사소개서': 'Giới thiệu công ty',

      // 2. 메인 화면 섹션 & 위젯
      '오늘 작성할 일지': 'Nhật ký cần viết hôm nay',
      '생산일 기준으로 작성 의무가 자동 계산됩니다': 'Tự động tính toán theo ngày sản xuất',
      '작성 현황': 'Tình trạng lập nhật ký',
      '저장된 기록에서 자동으로 계산합니다': 'Tự động tính từ hồ sơ đã lưu',
      '주간 · 월간 점검': 'Kiểm tra tuần · tháng',
      '주기가 긴 서식입니다': 'Các biểu mẫu có chu kỳ dài',
      '발생 시 작성': 'Viết khi phát sinh',
      '입고·부적합·불만 등 사건이 생겼을 때 작성합니다': 'Viết khi nhập kho, có lỗi hoặc khiếu nại',
      '최근 저장된 기록': 'Hồ sơ lưu gần đây',
      '최근 저장 기록을 검색·필터링합니다': 'Tìm kiếm & lọc hồ sơ gần đây',
      '서식명·문서번호·내용 검색': 'Tìm theo tên, mã số, nội dung',
      '전체 기록': 'Tất cả hồ sơ',
      '오늘 저장': 'Lưu hôm nay',
      '부적합만': 'Chỉ lỗi/không đạt',
      '비생산일': 'Ngày không sản xuất',
      '생산일': 'Ngày sản xuất',
      '정상가동': 'Hoạt động bình thường',
      '휴무/미가동': 'Nghỉ / Không chạy',

      // 3. 버튼 및 공통 네비게이션
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
      '인쇄하기': 'In hồ sơ',
      '초기화': 'Làm mới',
      '검색': 'Tìm kiếm',
      '목록': 'Danh sách',
      '상세보기': 'Xem chi tiết',
      '수정': 'Sửa',
      '삭제': 'Xóa',
      '추가': 'Thêm',
      '다운로드': 'Tải xuống',
      '본문으로 바로가기': 'Đến nội dung chính',

      // 4. 로그인 & 인증
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
      '대표자': 'Đại diện',

      // 5. 서식 결재 상태 & 판정
      '작성 중': 'Đang soạn',
      '작성중': 'Đang soạn',
      '검토대기': 'Chờ kiểm tra',
      '검토완료': 'Đã kiểm tra',
      '승인완료': 'Đã phê duyệt',
      '결재완료': 'Đã duyệt',
      '미작성': 'Chưa viết',
      '완료': 'Hoàn thành',
      '잠금': 'Đã khóa',
      '적합': 'Đạt (OK)',
      '부적합': 'Không đạt (NG)',
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
      '작성자 서명': 'Ký tên người lập',
      '확인자': 'Người kiểm',
      '확인자 서명': 'Ký tên người kiểm',
      '승인자': 'Người duyệt',
      '승인자 서명': 'Ký tên người duyệt',
      '비고': 'Ghi chú',
      '특이사항': 'Đặc điểm',
      '조치사항': 'Biện pháp xử lý',
      '조치내역': 'Nội dung xử lý',

      // 6. 보조 위젯 & 챗봇
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

  function translateElement(el, dict, isVi) {
    if (!el || el.nodeType !== 1) return;

    // 텍스트 변환 대상 (자식 텍스트가 1개인 경우)
    if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
      var text = el.childNodes[0].nodeValue.trim();
      if (!text) return;
      if (!el.getAttribute('data-original-ko')) {
        el.setAttribute('data-original-ko', text);
      }
      var orig = el.getAttribute('data-original-ko');
      if (isVi && dict[orig]) {
        el.childNodes[0].nodeValue = dict[orig];
      } else if (!isVi && orig) {
        el.childNodes[0].nodeValue = orig;
      }
    }

    // Placeholder 변환
    if (el.placeholder) {
      if (!el.getAttribute('data-original-placeholder')) {
        el.setAttribute('data-original-placeholder', el.placeholder);
      }
      var origP = el.getAttribute('data-original-placeholder');
      if (isVi && dict[origP]) {
        el.placeholder = dict[origP];
      } else if (!isVi && origP) {
        el.placeholder = origP;
      }
    }

    // Option 텍스트 변환
    if (el.tagName === 'OPTION') {
      var optText = el.textContent.trim();
      if (!el.getAttribute('data-original-ko')) {
        el.setAttribute('data-original-ko', optText);
      }
      var origO = el.getAttribute('data-original-ko');
      if (isVi && dict[origO]) {
        el.textContent = dict[origO];
      } else if (!isVi && origO) {
        el.textContent = origO;
      }
    }
  }

  function translatePage() {
    var dict = DICTIONARY[currentLang] || {};
    var isVi = (currentLang === 'vi');

    // 화면 내의 모든 주요 텍스트 태그 검색
    var targets = document.querySelectorAll(
      'button, a, h1, h2, h3, h4, label, th, td, p, span, .badge, .status, .pill-btn, .tab-btn, .ck-chip, .gnb-btn, .ck-hbtn, .ck-count, option, input[placeholder], textarea[placeholder]'
    );

    targets.forEach(function (el) {
      translateElement(el, dict, isVi);
    });
  }

  function setupObserver() {
    // 동적으로 생성되는 카드/타일/모달 감시 및 자동 번역
    if (!window.MutationObserver) return;
    var observer = new MutationObserver(function (mutations) {
      if (currentLang === 'vi') {
        var dict = DICTIONARY['vi'] || {};
        mutations.forEach(function (m) {
          if (m.addedNodes && m.addedNodes.length) {
            m.addedNodes.forEach(function (node) {
              if (node.nodeType === 1) {
                translateElement(node, dict, true);
                var children = node.querySelectorAll('button, a, h1, h2, h3, h4, label, th, td, p, span, .badge, .status, .pill-btn, .tab-btn, .ck-chip, .ck-hbtn, option, input[placeholder], textarea[placeholder]');
                children.forEach(function (c) { translateElement(c, dict, true); });
              }
            });
          }
        });
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    currentLang = getSavedLang();
    setupObserver();
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