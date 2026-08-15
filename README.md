# 동김제농협 스마트 HACCP · FSSC22000

현장 태블릿과 PC에서 사용하는 사내 웹앱입니다. HACCP 기록양식 작성, 전자결재, 문서 열람, 기록보관과 정본 인쇄를 지원합니다.

**운영 사이트**: https://gohwansok-max.github.io/dkj-fssc22000/

## 주요 기능

| 구분 | 내용 |
|---|---|
| 기록양식 | 74종의 현장 기록 작성, 저장, 전자결재 및 정본 인쇄 |
| 기록보관함 | 통합 조회, 엑셀·CSV·PDF 내보내기, JSON 백업·복원 |
| 문서센터 | 매뉴얼·절차서 등 143종 문서 열람 |
| MDR | 문서 제목·개정번호의 정본 관리 |
| 오프라인 | 서비스워커 캐시를 통한 현장 오프라인 작성 지원 |

## 운영 구조

앱은 순수 HTML/CSS/JS 정적 사이트입니다. 현장 화면의 정본은 브라우저 `localStorage`이며, Firebase Realtime Database는 인증된 사용자 간 기기 동기화를 담당합니다.

Firebase 설정은 2026-08-14에 완료되어 있습니다. `records/` 아래 서식을 열 때 사번·비밀번호 로그인이 필요하며, 작성자·결재자 정보는 로그인 세션을 기준으로 남습니다. 직원 계정은 Firebase Authentication 콘솔에서 관리하고 공개 가입·삭제는 사용하지 않습니다.

현재 운영 중인 동기화는 V1 배열 구조입니다. 레코드 단위 권한·잠금·감사이력을 Firebase 규칙으로 검증하는 V2 전환 코드는 별도 검토 중이며, 실제 전환은 전체 백업·UID 매핑·오프라인 시험을 마친 뒤 `docs/RTDB_V2_MIGRATION.md` 절차에 따라 수행합니다. 전환 전에는 `sync_meta/schemaVersion`을 2로 바꾸지 마십시오.

> GitHub Pages는 저장소가 비공개여도 정적 화면과 정적 파일을 공개합니다. 비밀번호, 실명, 연락처, Firebase 서비스 계정 키, 실제 기록 데이터는 저장소·정적 파일에 넣지 마십시오.

## 개발·배포

```bash
# 정적 화면 확인
python3 -m http.server 5500
# http://localhost:5500/index.html

# data/*.json을 수정한 경우
python3 scripts/build-catalog-bundles.py

# 정적 자원을 수정한 경우
python3 scripts/build-sw-precache.py
```

`main` 브랜치에 병합·push하면 GitHub Actions가 GitHub Pages에 배포합니다. 작업은 새 브랜치에서 하고, 완료 후에는 `main` 대상 draft PR로 검토를 요청합니다.

## 운영 점검

| 주기 | 점검 내용 | 증빙 |
|---|---|---|
| 매일 | 동기화 실패·미승인 기록·CCP 이탈 확인 | 업무 콘솔, 기록보관함 |
| 매주 | JSON 전체 백업 보관 및 백업 파일 열람 확인 | 백업 파일명·일시 기록 |
| 매월 | 별도 테스트 기기에서 복구시험 | 복구시험 체크리스트·결과 |
| 수시 | 퇴사·직무변경 계정 비활성화와 결재 권한 점검 | Firebase 사용자 목록·권한표 |

## 작업 전 확인

프로젝트 구조와 캐시·인쇄·카탈로그 규칙은 [`CLAUDE.md`](CLAUDE.md)를 먼저 읽으십시오. 특히 `data/*.json`을 변경한 경우 카탈로그 번들 재생성, JS/CSS를 변경한 경우 캐시 버전 갱신과 서비스워커 프리캐시 재생성이 필요합니다.
