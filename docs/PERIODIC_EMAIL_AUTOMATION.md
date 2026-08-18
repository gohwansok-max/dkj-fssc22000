# 정기 관리 이메일 자동 발송 운영 절차

## 1. 동작 방식

정기 관리 알림 화면에서 수신 이메일, 매일 발송 시각, 발송 대상을 저장하면 해당 설정은 전자기록으로 동기화된다. 서버 예약 함수는 한국 표준시 기준 15분마다 실행되며, 지정 시각에 기한 경과·당일 실시·사전 알림 항목을 집계하여 이메일 발송 흐름으로 전달한다.

| 구분 | 기준 |
|---|---|
| 시간대 | Asia/Seoul (KST) |
| 실행 간격 | 15분 |
| 발송 시각 | 화면에서 15분 단위로 설정 |
| 발송 대상 | 기한 경과, 오늘 실시, 사전 알림을 각각 선택 |
| 중복 방지 | 동일 날짜·동일 발송 시각은 1회만 전달 |
| 수신자 | 최대 20개 이메일 주소 |

> 수신 이메일 주소와 웹훅 비밀값은 GitHub Pages 코드에 저장하지 않는다. 화면 설정은 인증된 전자기록으로 동기화하고, 웹훅 URL·비밀값은 Firebase Secret Manager에만 저장한다.

## 2. Make 이메일 시나리오 구성

새로운 정기 관리 이메일 전용 시나리오를 별도로 만들고, 기존 현장진단·Telegram 시나리오는 수정하지 않는다. 시나리오는 Firebase에서 전달한 JSON의 `recipients`, `alerts`, `dashboardUrl`을 사용해 Gmail 발송 모듈로 이메일을 발송한다.

| 단계 | 구성 |
|---|---|
| 1 | Custom Webhook으로 Firebase 예약 함수 요청 수신 |
| 2 | `x-dkj-alert-signature` HMAC-SHA256 서명 검증 |
| 3 | `recipients`별 Gmail 이메일 발송 |
| 4 | 제목에 기한 경과·오늘 실시·사전 알림 건수를 표시 |
| 5 | 본문에 관리 항목, 예정일, 대상·담당자, 정기 관리 알림 화면 링크 표시 |

## 3. Firebase Secret 및 함수 배포

Firebase CLI 로그인이 필요한 환경에서 저장소 루트에서 실행한다. 웹훅 주소와 공유 비밀은 Make 시나리오 구성 후 발급·생성한다.

```bash
npx --yes firebase-tools login
npx --yes firebase-tools functions:secrets:set DKJ_PERIODIC_ALERT_WEBHOOK_URL --project dkj-fssc22000
npx --yes firebase-tools functions:secrets:set DKJ_PERIODIC_ALERT_WEBHOOK_SECRET --project dkj-fssc22000
npx --yes firebase-tools deploy --only functions:dispatchPeriodicEmailAlert --project dkj-fssc22000
```

배포 후 정기 관리 알림 화면에서 수신 이메일과 발송 시각을 저장하고, 예정일이 7일 이내인 시험 항목으로 이메일 수신과 중복 방지를 확인한다.

## 4. 카카오 알림톡 확장

동일한 Firebase 예약 함수의 웹훅 payload를 Make에서 카카오 알림톡 모듈로 분기하면 된다. 다만 카카오 비즈니스 채널, 발신 프로필, 정보성 알림톡 템플릿 승인과 대행사 계정 연결이 선행되어야 한다. 이메일 발송 검증이 끝난 뒤 같은 제목·본문 구조로 승인 템플릿을 준비하면 된다.
