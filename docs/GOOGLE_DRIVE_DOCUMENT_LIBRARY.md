# Google Drive 정본 문서 열람실 운영 안내

## 목적

정본 문서 열람실은 동김제농협 FSSC 22000 운영체계구축 최종본 폴더의 원본 문서와 PDF 변환본을 웹사이트에서 검색·열람·다운로드·인쇄하도록 연결합니다. 파일은 GitHub Pages에 복사하지 않고 Google Drive에서 보관하므로, 대용량 HWP·Word·PowerPoint·Excel 파일도 원본 품질로 유지됩니다.

| 구분 | 현재 구성 |
|---|---|
| Drive 원본 루트 | `0) 동김제농협_FSSC22000_V6_운영체계구축_최종본260714` |
| 공개 권한 | 링크가 있는 사용자: **뷰어** |
| 웹 열람 대상 | PDF 58개, 원본 Word·PowerPoint·Excel·HWP 포함 259개 |
| 웹 페이지 | `official-documents.html` |
| 정본 인쇄 원칙 | PDF 변환본 우선 |

## 현장 사용 방법

정본 문서 열람실에서 문서번호, 제목 또는 폴더명을 검색합니다. PDF가 연결된 HWP·Office 원본에는 `PDF 정본` 버튼이 표시됩니다. 심사·현장 출력은 이 PDF 정본 버튼을 눌러 Drive 미리보기에서 인쇄합니다. 원본 양식 수정 또는 편집이 필요한 경우 `원본 다운로드`를 사용합니다.

| 버튼 | 용도 |
|---|---|
| PDF 정본 / PDF 열람 | 변환된 PDF를 새 탭에서 열람 |
| 원본 열람 | PDF가 없는 원본의 Drive 미리보기 |
| 원본 다운로드 | HWP·Word·PowerPoint·Excel 원본 내려받기 |
| 인쇄 | PDF 정본 또는 원본 Drive 미리보기를 새 탭에서 열어 인쇄 |

## 새 문서 추가 순서

1. Google Drive 원본 폴더의 올바른 분류 폴더에 원본 파일을 올립니다.
2. HWP, Word, PowerPoint, Excel 문서는 가능하면 PDF로 변환하여 원본 루트의 `pdf` 폴더에 같은 문서번호 또는 같은 파일명으로 올립니다.
3. 문서 담당자는 Manus 작업에서 `scripts/inventory_drive_tree.py`를 실행해 Drive 목록을 갱신합니다.
4. 이어 `scripts/build_drive_document_manifest.py`를 실행하면 `data/drive-document-manifest.json`과 `js/drive-document-manifest.bundle.js`가 갱신됩니다.
5. 변경된 매니페스트와 웹 파일을 GitHub main 브랜치에 배포합니다.

> 문서번호가 있는 파일은 `DKJ-P-01`, `DKJ-S-02-03`, `DKJ-H-01-01`처럼 원본과 PDF에 같은 문서번호를 유지해야 자동 연결됩니다. 문서번호가 없는 별첨은 원본과 PDF의 파일명을 같게 유지합니다.

## 보안 원칙

Drive 원본 폴더는 **편집자 공개 권한을 사용하면 안 됩니다.** 현재 링크가 있는 사용자는 읽기만 가능한 뷰어 권한입니다. 문서 개정·업로드는 고환석님 또는 문서관리 담당자가 Google Drive에서 직접 수행합니다.

웹 페이지는 로그인 화면을 제공하지만 GitHub Pages의 정적 매니페스트 자체는 서버에서 사용자별로 숨길 수 없습니다. 외부 공개가 부적합한 문서가 있다면 Drive 공유 대상을 직원 Google 계정으로 제한한 뒤, 웹 링크는 유지하는 방식으로 운영합니다. 이 경우 허가되지 않은 Google 계정에서는 Drive 문서가 열리지 않습니다.

## 개정 시 확인

문서를 개정할 때는 원본 파일만 바꾸지 말고 PDF 정본도 같은 개정본으로 바꿉니다. 열람실의 PDF는 인쇄용 정본이므로, 원본과 PDF의 개정번호·개정일·문서번호가 일치하는지 확인합니다.
