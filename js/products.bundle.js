window.DKJ_PRODUCTS={
  "updatedAt": "2026-08-28",
  "site": "동김제농협 산지유통센터 가공공장",
  "bomSource": "별첨 4. 제품설명서 (동김제농협 HACCP 관리 기준서, ⑤ 성분배합비율) — 2026-02-13 작성분 기준. product-spec-to-bom.py 로 재추출 가능.",
  "bomNote": "[확인 필요] '상추' 항목은 제품설명서에 카이피라·프릴아이스·로메인 3종이 하나의 비율로 합산되어 있어, 세 품종은 균등 분배(3등분)로 추정했습니다 — 실제 내부 배합 비율로 교체 필요. DKJ-FG-07·08은 품종별 비율이 원문에 그대로 명시되어 있어 추정 없이 그대로 반영했습니다. DKJ-FG-06(NH닭가슴살샐러드)은 육류·소스 비중이 커서 BOM 원료수율 계산 대상에서 제외했습니다(bom 비움).",
  "finishedProducts": [
    { "code": "DKJ-FG-01", "name": "샐러디 채소믹스", "brand": "샐러디", "type": "채소믹스",
      "bomRaw": "상추(카이피라,크리스피아노(프릴아이스),로메인) 96%, 라디치오잎 4%",
      "bom": [
        { "material": "카이피라", "ratio": 0.32 }, { "material": "프릴", "ratio": 0.32 },
        { "material": "로메인", "ratio": 0.32 }, { "material": "라디치오", "ratio": 0.04 }
      ] },
    { "code": "DKJ-FG-02", "name": "농협 채소믹스", "brand": "농협", "type": "채소믹스",
      "bomRaw": "상추(카이피라,크리스피아노(프릴아이스),로메인) 85%, 라디치오잎 15%",
      "bom": [
        { "material": "카이피라", "ratio": 0.2833 }, { "material": "프릴", "ratio": 0.2833 },
        { "material": "로메인", "ratio": 0.2834 }, { "material": "라디치오", "ratio": 0.15 }
      ] },
    { "code": "DKJ-FG-03", "name": "슬로우캘리 채소믹스", "brand": "슬로우캘리", "type": "채소믹스",
      "bomRaw": "상추(카이피라,프릴아이스,로메인) 75%, 케일잎 25%",
      "bom": [
        { "material": "카이피라", "ratio": 0.25 }, { "material": "프릴", "ratio": 0.25 },
        { "material": "로메인", "ratio": 0.25 }, { "material": "케일", "ratio": 0.25 }
      ] },
    { "code": "DKJ-FG-04", "name": "포케올데이 채소믹스", "brand": "포케올데이", "type": "채소믹스",
      "bomRaw": "상추(카이피라,프릴아이스,로메인) 100%",
      "bom": [
        { "material": "카이피라", "ratio": 0.3333 }, { "material": "프릴", "ratio": 0.3333 },
        { "material": "로메인", "ratio": 0.3334 }
      ] },
    { "code": "DKJ-FG-05", "name": "샐러디아 채소믹스", "brand": "샐러디아", "type": "채소믹스",
      "bomRaw": "상추(카이피라,프릴아이스,로메인) 85%, 라디치오잎 15%",
      "bom": [
        { "material": "카이피라", "ratio": 0.2833 }, { "material": "프릴", "ratio": 0.2833 },
        { "material": "로메인", "ratio": 0.2834 }, { "material": "라디치오", "ratio": 0.15 }
      ] },
    { "code": "DKJ-FG-06", "name": "NH닭가슴살샐러드", "brand": "NH", "type": "단백질샐러드",
      "bomRaw": "햄(NH닭가슴살슬라이스) 44.84%, 상추(카이피라,크리스피아노(프릴아이스),로메인) 30.49%, 소스(발사믹소스-1) 15.7%, 라디치오잎 5.38%, 기타가공품(NH샐러드토핑) 3.59% — 육류·소스 비중이 커서 BOM 원료수율 대상에서 제외",
      "bom": [] },
    { "code": "DKJ-FG-07", "name": "슬로우캘리샐러드믹스", "brand": "슬로우캘리", "type": "샐러드믹스",
      "bomRaw": "양상추 40%, 상추(프릴아이스) 25%, 상추(로메인) 20%, 케일잎 15% — 원문에 품종별 비율 그대로 명시됨",
      "bom": [
        { "material": "양상추(중국산)", "ratio": 0.4 }, { "material": "프릴", "ratio": 0.25 },
        { "material": "로메인", "ratio": 0.2 }, { "material": "케일", "ratio": 0.15 }
      ] },
    { "code": "DKJ-FG-08", "name": "양상추샐러드", "brand": "동김제", "type": "단일채소",
      "bomRaw": "양상추 100% — 원문에 그대로 명시됨",
      "bom": [
        { "material": "양상추(중국산)", "ratio": 1.0 }
      ] }
  ],
  "rawMaterialPresets": [
    { "name": "양상추", "materialType": "원료", "unit": "kg", "products": ["DKJ-FG-08", "DKJ-FG-01", "DKJ-FG-02", "DKJ-FG-03", "DKJ-FG-04", "DKJ-FG-05", "DKJ-FG-07"] },
    { "name": "혼합채소(채소믹스용)", "materialType": "원료", "unit": "kg", "products": ["DKJ-FG-01", "DKJ-FG-02", "DKJ-FG-03", "DKJ-FG-04", "DKJ-FG-05", "DKJ-FG-07"] },
    { "name": "닭가슴살(원료)", "materialType": "원료", "unit": "kg", "products": ["DKJ-FG-06"] },
    { "name": "샐러드용 소스·부자재", "materialType": "부자재", "unit": "kg", "products": ["DKJ-FG-06", "DKJ-FG-07"] },
    { "name": "포장트레이", "materialType": "포장재", "unit": "EA", "products": [] },
    { "name": "필름·라벨", "materialType": "포장재", "unit": "EA", "products": [] },
    { "name": "소독·세척제", "materialType": "소독제", "unit": "L", "products": [] }
  ]
};
