헤더 로고(워드마크)에 쓰이는 파일들입니다.

지금 헤더는 '흰 타일 + 녹색 심볼 + 사업장명 두 줄' 락업입니다. 사업장명은 이미지가
아니라 HTML 텍스트입니다 — <img> 로 불러오는 SVG 는 페이지 웹폰트(Noto Sans KR)를
물려받지 못해 기기마다 글꼴이 튀기 때문입니다. 그래서 이 폴더에는 심볼만 있습니다.
락업 구조는 각 HTML 의 .ck-wordmark, 모양은 css/dkj-tokens.css 를 보세요.

  nh-symbol-green.svg  헤더 워드마크에 실제로 쓰는 녹색 심볼 (30x30 으로 표시)
  nh-symbol.svg        같은 심볼의 노랑(브랜드 원색) 버전. 지금 참조하는 곳은 없지만
                       원색 원본으로 남겨 둡니다.
  dkj-wordmark.png     가로형 워드마크 이미지 (필요 시 — 현재 참조하는 곳 없음)

두 SVG 는 같은 path 를 복제하고 있습니다(<img> 로 쓰면 currentColor 로 색을 바꿀 수
없어 파일을 나눴습니다). 도형을 고칠 때는 반드시 두 파일을 함께 고치세요.

주의 — 두 심볼 모두 원본 로고를 보고 기하학적으로 재현한 것이지 공식 파일이 아닙니다.
화면용으로는 충분하지만 대외로 나가는 인쇄물·문서에는 정식 로고를 쓰세요.

정식 심볼로 교체하려면
  · SVG 를 받으셨다면 nh-symbol-green.svg 를 덮어쓰면 그대로 반영됩니다.
    (녹색이 아니라면 흰 타일 위에서 읽히는 색인지 확인하세요.)
  · PNG 를 받으셨다면 파일을 넣고, HTML 7곳의
    <img class="ck-wordmark-symbol" src="assets/brand/nh-symbol-green.svg"> 의 src 를
    그 파일로 바꾸세요 (doc-viewer / docs-center / index / mdr-register /
    record-viewer / records-archive / records-center).
    정사각형에 가까운 PNG(권장 160x160 이상, 배경 투명)면 가장 깔끔합니다.

심볼 파일이 없어도 사업장명은 텍스트라 그대로 보입니다(헤더가 깨지지 않음).
