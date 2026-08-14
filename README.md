# 동김제농협 산지유통센터 — 스마트 HACCP / FSSC22000 V6

현장 태블릿과 PC에서 쓰는 사내 웹앱입니다. 기록양식 작성·전자결재·문서 열람·기록
보관을 다룹니다.

**운영 사이트** → https://gohwansok-max.github.io/dkj-fssc22000/

## 무엇이 들어 있나

- **기록양식 74종** — 작성·저장·정본 인쇄 (`records/`)
- **기록보관함** — 서식 구분 없이 통합 조회, 엑셀·CSV·PDF 내보내기, 백업·복원
- **문서센터** — 매뉴얼·절차서 143종 열람
- **문서관리대장(MDR-001)** — 문서 제목·개정번호의 정본
- **오프라인 지원** — 서비스워커로 현장에서 네트워크가 끊겨도 작성 가능

## 어떻게 돌아가나

서버가 없습니다. 순수 HTML/CSS/JS 를 정적으로 서빙하고, 데이터는 브라우저
`localStorage` 에 저장한 뒤 Firebase RTDB 로 기기 간 동기화합니다. 빌드·번들러·테스트
단계가 없습니다.

```bash
python -m http.server 5500      # → http://localhost:5500/index.html
```

배포는 `main` 에 push 하면 GitHub Actions 가 Pages 로 올립니다.

## 작업하기 전에

구조·규칙·주의사항은 **[CLAUDE.md](CLAUDE.md)** 에 정리돼 있습니다. 특히 아래는 모르면
데이터를 망가뜨릴 수 있으니 먼저 읽으세요.

- `data/*.json` 을 고쳤으면 `python scripts/build-catalog-bundles.py` 로 번들 재생성
- JS/CSS 를 고쳤으면 `?v=` 캐시 버전 올리기
- 기록 저장은 `js/dkj-record-store.js` 를 거칠 것 (최초작성 정보 보존 로직 포함)

---

저장소는 비공개입니다. Firebase 자격증명과 사업장 문서 정보가 들어 있습니다.
