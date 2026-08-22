window.DKJ_STAFF_ROLES={
  "_설명": [
    "직원별 기본 역할표입니다. 실제 운영 역할은 Firebase RTDB의 system/users에 저장되며, 이 파일은 최초 로그인과 오프라인 결재 화면을 위한 기본값입니다.",
    "역할은 시스템 관리자, 책임자, 관리자, 작업자 4단계입니다.",
    "시스템 관리자(emp4343)는 사용자 권한을 설정할 수 있고 모든 결재 단계를 수행합니다.",
    "책임자는 작성·검토·승인, 관리자는 작성·검토, 작업자는 작성 단계만 수행합니다.",
    "이 파일은 공개 배포되므로 실명은 넣지 않습니다. 이름은 Firebase Authentication의 표시이름 또는 시스템 관리자 화면에서 관리합니다."
  ],
  "updatedAt": "2026-08-16",
  "roles": {
    "system_admin": { "label": "시스템 관리자", "stages": ["writer", "reviewer", "approver"] },
    "responsible": { "label": "책임자", "stages": ["writer", "reviewer", "approver"] },
    "manager": { "label": "관리자", "stages": ["writer", "reviewer"] },
    "worker": { "label": "작업자", "stages": ["writer"] }
  },
  "staff": {
    "0001": { "name": "이다은", "role": "worker", "stages": ["writer"] },
    "0002": { "name": "권화선", "role": "manager", "stages": ["writer", "reviewer"] },
    "0003": { "name": "최민재", "role": "responsible", "stages": ["writer", "reviewer", "approver"] },
    "0004": { "name": "", "role": "responsible", "stages": ["writer", "reviewer", "approver"] },
    "0005": { "name": "", "role": "responsible", "stages": ["writer", "reviewer", "approver"] },
    "4343": { "name": "관리자", "role": "system_admin", "stages": ["writer", "reviewer", "approver"], "admin": true }
  }
};
