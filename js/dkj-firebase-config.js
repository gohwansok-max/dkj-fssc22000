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
 *   3. Authentication > 설정 > 사용자 작업 > '생성 사용 설정(가입)' 체크 해제
 *      (콘솔 문구가 2026년 개편으로 뒤집혔다 — 예전의 '사용자 가입 사용 중지' 체크와
 *       같은 뜻이다. '삭제 사용 설정'도 함께 해제해 두면 계정 자폭을 막는다.)
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
 *
 * ▶ 설정 완료 (2026-08-14)
 *   위 1~5 단계를 모두 마쳤다. 실제 게시된 DB 규칙은 루트 전체에 건 형태다:
 *        { "rules": { ".read": "auth != null", ".write": "auth != null" } }
 *   이 앱은 /dkj-fssc22000/records/... 아래만 쓰므로 동작에는 차이가 없다. 나중에 같은
 *   Firebase 프로젝트에 다른 사업장을 얹게 되면 그때 위 주석의 루트별 규칙으로 좁힌다.
 */
window.DKJ_FIREBASE = {
  apiKey: 'AIzaSyCHZQfusI2LjBM_9YcrGEYITDtCKTrwgsM',
  authDomain: 'dkj-fssc22000.firebaseapp.com',
  databaseURL: 'https://dkj-fssc22000-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'dkj-fssc22000',

  // 이 사업장의 데이터 루트 — 다른 사업장과 절대 겹치면 안 된다
  root: 'dkj-fssc22000',

  // 직원 계정 이메일 도메인 (실제 메일 주소가 아니라 계정 식별용)
  emailDomain: '@dkj-fssc.internal'
};
