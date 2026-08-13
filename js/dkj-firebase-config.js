/**
 * 동김제농협 클라우드 동기화 접속 정보.
 *
 * 여기 들어가는 값은 전부 "공개돼도 되는 식별자"다 — Firebase 웹 apiKey 는 비밀키가
 * 아니라 프로젝트를 가리키는 주소에 가깝고, 실제 접근 통제는 아래 두 가지가 한다:
 *   (1) 직원별 로그인 계정 (js/dkj-auth.js) — 비밀번호는 절대 이 파일에 넣지 않는다
 *   (2) Realtime Database 보안 규칙
 *
 * ▶ 설정 절차 (Firebase 콘솔, 최초 1회)
 *   1. 프로젝트 + Realtime Database 생성 (위치: asia-southeast1 권장)
 *   2. Authentication > 로그인 방법 > '이메일/비밀번호' 사용 설정
 *   3. Authentication > 설정 > '사용자 가입 사용 중지' 체크
 *      → 아무나 계정을 만들어 기록을 들여다보는 걸 막는다. 직원 계정은 콘솔에서
 *        직접 추가한다(이메일 형식: emp<사번>@dkj-fssc.internal).
 *   4. Realtime Database > 규칙을 아래로 저장:
 *        {
 *          "rules": {
 *            "dkj-fssc22000": {
 *              ".read": "auth != null",
 *              ".write": "auth != null"
 *            }
 *          }
 *        }
 *   5. 아래 값들을 콘솔의 '웹 앱 구성'에서 복사해 채운다.
 */
window.DKJ_FIREBASE = {
  apiKey: '',
  authDomain: '',
  databaseURL: '',
  projectId: '',

  // 이 사업장의 데이터 루트 — 다른 사업장과 절대 겹치면 안 된다
  root: 'dkj-fssc22000',

  // 직원 계정 이메일 도메인 (실제 메일 주소가 아니라 계정 식별용)
  emailDomain: '@dkj-fssc.internal'
};
