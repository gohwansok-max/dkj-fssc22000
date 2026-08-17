# 종합 품질 대시보드 실시간 알림 운영 절차

## 1. 적용 범위

`quality-dashboard.html`은 대시보드를 열어 둔 상태에서 아래 경보를 즉시 표시하고, 사용자가 허용한 경우 브라우저 알림도 표시한다.

| 경보 | 판정 기준 | 우선순위 |
|---|---|---|
| CAPA 기한 초과 | 미종결 CAPA의 `dueDate`가 당일 이전 | 긴급 |
| 미종결 CAPA | CAPA가 종결·잠금되지 않음 | 주의 |
| 모의회수 2시간 목표 미달 | `withinTwoHours=false` 또는 소요시간 120분 초과 | 긴급 |
| 모의회수 수량대조 이슈 | 회수·확보율 100% 미만 또는 위치별 수량차이 존재 | 주의 또는 긴급 |
| 제품회수·추적성 후속 확인 | FR-016 또는 FR-040이 미종결 | 주의 |

같은 기기에서 기록을 저장하면 즉시 갱신한다. 다른 기기에서 저장된 기록은 현재 Firebase 동기화 주기(30초) 안에 반영된다.

> 브라우저 알림은 대시보드가 열린 상태에서만 보조적으로 작동한다. 화면을 닫아도 이메일·카카오톡·문자를 발송하려면 아래의 Firebase 이벤트 기반 자동 발송을 배포해야 한다.

## 2. 외부 자동 발송 구조

```text
Realtime Database records_v2 변경
        ↓
Firebase Cloud Function: dispatchQualityAlert
        ↓  HMAC 서명 웹훅
Make 시나리오
   ├─ Gmail: 이메일 발송
   ├─ 카카오 알림톡: 승인 템플릿 발송
   └─ SMS/LMS: 카카오 실패 또는 긴급 보조 발송
        ↓
Realtime Database alert_dispatches에 발송 이력 저장
```

함수는 기록별·경보유형별 `fingerprint`를 남긴다. 같은 내용이 반복 동기화되더라도 같은 경보를 중복 발송하지 않는다. 수신자 전화번호, 발송 API 키, 웹훅 URL, 공유 비밀은 모두 서버 또는 발송 서비스에만 저장하며 GitHub Pages 코드에 넣지 않는다.

## 3. 배포 전 필수 조건

| 항목 | 현재 상태 | 필요한 조치 |
|---|---|---|
| Firebase V2 데이터 구조 | 전환 준비 완료, 운영 전환 미완료 | `database.rules.json` 게시 후 `sync_meta/schemaVersion=2`로 변경 |
| Firebase Cloud Functions | 저장소에 함수 코드 포함 | Firebase 프로젝트를 Blaze 요금제로 전환하고 Functions 배포 권한 확인 |
| Gmail | Make Gmail 연결 확인 | 품질 경보 시나리오에서 수신자와 제목·본문 설정 |
| Make 시나리오 | 무료 플랜의 2개 시나리오가 이미 사용 중 | 신규 시나리오 공간 확보 또는 플랜 조정. 기존 비활성 Gmail 시나리오는 승인 없이 변경하지 않음 |
| 카카오 알림톡 | 미설정 | 카카오톡 비즈니스 채널, 공식 딜러사 계약, 정보성 템플릿 승인 필요 |
| 문자 | 미설정 | 솔라피·알리고 등 발송 서비스 계정, 발신번호 등록, API 연결 필요 |

카카오 알림톡은 정보성 메시지에 한해 승인된 템플릿으로만 발송할 수 있으며, 카카오 공식 딜러사를 통해 이용한다.[^1] 솔라피는 카카오 알림톡과 SMS를 함께 제공하며, 알림톡 실패 시 문자 대체 발송을 지원한다.[^2]

## 4. Firebase 함수 배포

PC에서 저장소 루트로 이동한 뒤 다음 절차를 실행한다. 기존 GitHub Pages 배포와 별도로 Firebase에 **함수만** 배포한다.

```bash
npm install -g firebase-tools
firebase login
firebase use dkj-fssc22000
firebase functions:secrets:set DKJ_ALERT_WEBHOOK_URL
firebase functions:secrets:set DKJ_ALERT_WEBHOOK_SECRET
firebase deploy --only functions:dispatchQualityAlert
```

입력값은 아래 원칙을 따른다.

| Secret | 값 | 보관 위치 |
|---|---|---|
| `DKJ_ALERT_WEBHOOK_URL` | Make의 품질 경보 전용 Custom Webhook URL | Firebase Secret Manager |
| `DKJ_ALERT_WEBHOOK_SECRET` | 최소 32자 이상의 무작위 공유 비밀 | Firebase Secret Manager 및 Make의 서명 검증 설정 |

배포 위치는 현재 Realtime Database 위치인 `asia-southeast1`로 코드에 고정돼 있다. 다른 지역으로 바꾸지 않는다. Firebase 공식 문서도 Realtime Database 이벤트 함수와 데이터베이스의 지역을 맞추도록 안내한다.[^3]

## 5. Make 발송 시나리오 구성

Make에서 아래 순서로 **품질 경보 전용** 시나리오를 만든다.

1. **Custom Webhook** 모듈을 첫 단계로 추가하고 URL을 `DKJ_ALERT_WEBHOOK_URL` Secret에 저장한다.
2. 수신 헤더 `x-dkj-alert-signature`가 본문과 `DKJ_ALERT_WEBHOOK_SECRET`으로 계산한 HMAC-SHA256과 일치하는지 확인한다. 서명 검증에 실패한 요청은 중단한다.
3. `alerts[].level`이 `danger`인 건은 즉시 Gmail로 발송한다.
4. 카카오 알림톡 채널이 준비되면 승인 템플릿의 변수에 `title`, `summary`, `record.lot`, `record.dashboardUrl`을 매핑한다.
5. 카카오 발송 실패 또는 긴급 경보 시 SMS/LMS를 보조 채널로 사용한다.
6. 테스트 CAPA 1건과 2시간 초과 모의회수 1건으로 이메일·카카오·문자 도달, 중복 미발송, 수신 이력을 모두 확인한다.

> 기존의 `Integration Google Sheets, Google Gemini AI, Gmail` 시나리오는 현장진단 자동화 용도다. 품질 경보 전용으로 덮어쓰면 기존 Google Sheets 기반 업무가 사라질 수 있으므로, 별도 승인 없이 변경하지 않는다.

## 6. 권장 메시지 템플릿

### 이메일 제목

```text
[긴급][동김제농협 품질경보] {{title}} · LOT {{lot}}
```

### 카카오 알림톡·문자 본문

```text
[동김제농협 품질경보]
{{title}}
{{summary}}

대시보드에서 원본 기록과 조치기한을 확인해 주세요.
{{dashboardUrl}}
```

수신자 전화번호는 적법한 목적과 절차로 수집·관리된 번호만 등록한다.[^1]

## 7. 심사 대비 점검 기록

배포 후 아래 항목을 점검 기록 또는 CAPA 효과검증 증빙으로 남긴다.

| 점검 항목 | 확인 기준 |
|---|---|
| 경보 판정 | 5개 유형의 테스트 기록에서 의도한 경보만 생성 |
| 이메일 발송 | 수신자·제목·원본기록 링크·시각 확인 |
| 카카오 알림톡 | 승인 템플릿·변수 치환·수신 결과 확인 |
| 문자 보조 발송 | 카카오 실패 또는 긴급 조건에서만 발송 확인 |
| 중복 방지 | 동일 기록 재동기화 시 동일 경보가 재발송되지 않음 |
| 발송 감사이력 | `alert_dispatches`의 경보유형·시각·이벤트 ID 확인 |
| 권한 | 웹 코드·브라우저 저장소에 API 키·공유 비밀·수신자 명단이 없음 |

[^1]: [카카오비즈니스 알림톡 안내](https://kakaobusiness.gitbook.io/main/ad/infotalk)
[^2]: [SOLAPI 문자·알림톡 안내](https://solapi.com/msg)
[^3]: [Firebase Realtime Database triggers](https://firebase.google.com/docs/functions/database-events)
