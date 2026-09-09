window.DKJ_STAFF_ROLES={
  "_설명": [
    "직원별 기본 역할표입니다. 실제 운영 역할·표시이름은 system-settings.html(시스템 관리자 4343)에서 등록하는 계정 디렉터리가 정본이고, RTDB system/users 로 기기 간에 동기화됩니다.",
    "역할은 시스템 관리자, 책임자, 관리자, 작업자 4단계입니다.",
    "시스템 관리자(4343)는 사용자 권한을 설정할 수 있고 모든 결재 단계를 수행합니다.",
    "책임자는 작성·검토·승인, 관리자는 작성·검토, 작업자는 작성 단계만 수행합니다.",
    "이 파일은 GitHub Pages 로 공개 배포되므로 name 은 항상 빈 문자열로 둡니다. 실명을 적으면 사이트 주소만 아는 사람에게 직원 개인정보가 그대로 노출됩니다.",
    "2026-09-09 확인 — window.DKJ_STAFF_ROLES 는 현재 어느 화면에서도 읽지 않습니다(번들이 어떤 HTML 에도 실려 있지 않음). 지우는 것은 별건으로 분리했고, 우선 실명만 비웠습니다."
  ],
  "updatedAt": "2026-09-09",
  "roles": {
    "system_admin": {
      "label": "시스템 관리자",
      "stages": [
        "writer",
        "reviewer",
        "approver"
      ]
    },
    "responsible": {
      "label": "책임자",
      "stages": [
        "writer",
        "reviewer",
        "approver"
      ]
    },
    "manager": {
      "label": "관리자",
      "stages": [
        "writer",
        "reviewer"
      ]
    },
    "worker": {
      "label": "작업자",
      "stages": [
        "writer"
      ]
    }
  },
  "staff": {
    "0001": {
      "name": "",
      "role": "worker",
      "stages": [
        "writer"
      ]
    },
    "0002": {
      "name": "",
      "role": "manager",
      "stages": [
        "writer",
        "reviewer"
      ]
    },
    "0003": {
      "name": "",
      "role": "responsible",
      "stages": [
        "writer",
        "reviewer",
        "approver"
      ]
    },
    "0004": {
      "name": "",
      "role": "responsible",
      "stages": [
        "writer",
        "reviewer",
        "approver"
      ]
    },
    "4343": {
      "name": "",
      "role": "system_admin",
      "stages": [
        "writer",
        "reviewer",
        "approver"
      ],
      "admin": true
    }
  }
};
