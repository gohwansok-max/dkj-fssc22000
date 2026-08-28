window.DKJ_PRODUCTION_MASTER={
  "updatedAt": "2026-08-27",
  "docCode": "DKJ-F-053",
  "site": "동김제농협 산지유통센터 가공공장",
  "note": "01_기준설정 시트 이식. 노란 채움 값 — 품질담당자가 관리. 현장에서는 바꾸지 않는다.",
  "contractYield": 0.75,
  "exemptionYield": 0.7,
  "k1": 0.5,
  "k2": 0.015,
  "k3": 0.05,
  "monthlyWorkDays": 22,
  "items": [
    { "name": "로메인", "group": "상추", "standardYield": 0.75, "standardWeightG": 450, "unitPrice": 0, "supplier": "미정", "activeByDefault": true },
    { "name": "프릴", "group": "상추", "standardYield": 0.75, "standardWeightG": 400, "unitPrice": 0, "supplier": "미정", "activeByDefault": true },
    { "name": "이퀄라", "group": "상추", "standardYield": 0.75, "standardWeightG": 400, "unitPrice": 0, "supplier": "미정", "activeByDefault": true },
    { "name": "카이피라", "group": "상추", "standardYield": 0.75, "standardWeightG": 400, "unitPrice": 0, "supplier": "미정", "activeByDefault": true },
    { "name": "라디치오", "group": "기타", "standardYield": 0.7, "standardWeightG": 300, "unitPrice": 0, "supplier": "미정", "activeByDefault": true },
    { "name": "케일", "group": "기타", "standardYield": 0.8, "standardWeightG": 250, "unitPrice": 0, "supplier": "미정", "activeByDefault": true },
    { "name": "치커리", "group": "기타", "standardYield": 0.8, "standardWeightG": 300, "unitPrice": 0, "supplier": "미정", "activeByDefault": true },
    { "name": "적근대", "group": "기타", "standardYield": 0.75, "standardWeightG": 200, "unitPrice": 0, "supplier": "미정", "activeByDefault": true },
    { "name": "적채", "group": "기타", "standardYield": 0.9, "standardWeightG": 1200, "unitPrice": 0, "supplier": "미정", "activeByDefault": true },
    { "name": "양배추", "group": "기타", "standardYield": 0.8, "standardWeightG": 1200, "unitPrice": 0, "supplier": "미정", "activeByDefault": true },
    { "name": "당근", "group": "기타", "standardYield": 0.85, "standardWeightG": 150, "unitPrice": 0, "supplier": "미정", "activeByDefault": true },
    { "name": "양상추(중국산)", "group": "양상추", "standardYield": 0.7, "standardWeightG": 600, "unitPrice": 0, "supplier": "미정", "activeByDefault": true }
  ],
  "wasteCodes": [
    { "code": "A", "label": "정상 제거분", "detail": "외엽·심지·밑동·규격 절단", "owner": "불가피", "improveOwner": "—", "claimable": false, "recoverRate": 0, "judgeCriteria": "표준 절단 위치 내에서 제거된 부위" },
    { "code": "B", "label": "원물 불량", "detail": "부패·변색·구중미달·이물혼입", "owner": "공급업체", "improveOwner": "구매/품질", "claimable": true, "recoverRate": 0, "judgeCriteria": "입고 시점에 이미 존재한 결함" },
    { "code": "C", "label": "저장 중 열화", "detail": "위조·갈변·수침", "owner": "자사 물류", "improveOwner": "저장/생산관리", "claimable": false, "recoverRate": 0.3, "judgeCriteria": "입고 시 정상 → 사용 시점 불량" },
    { "code": "D", "label": "작업 로스", "detail": "과잉절단·판정오류·낙하", "owner": "자사 작업", "improveOwner": "전처리팀", "claimable": false, "recoverRate": 0.7, "judgeCriteria": "표준 적용 시 양품으로 회수 가능한 것" },
    { "code": "E", "label": "이물·기타", "detail": "해충·협잡물·설비오염", "owner": "복합", "improveOwner": "품질/설비", "claimable": false, "recoverRate": 0, "judgeCriteria": "원인 개별 판정" }
  ],
  "improvementLevers": [
    {
      "id": "fifo",
      "label": "재고일수 단축 (선입선출 강제)",
      "defaultTargetDays": 2,
      "difficulty": "중 / 2주",
      "action": "저온창고 위치 재배치 + 로트별 소진순서 게시. 재고일수가 긴 로트가 최대 리스크."
    },
    {
      "id": "resort",
      "label": "폐기통 재선별 (작업 로스 회수)",
      "defaultTargetRatio": 1.0,
      "difficulty": "하 / 즉시",
      "action": "폐기통을 라인 끝에 1개 더 두고 D코드(작업로스) 분만 재투입. 원인분석의 D코드 회수 가능량과 연동."
    },
    {
      "id": "sizeCheck",
      "label": "구중 규격화 (수입검사 신설)",
      "defaultTargetRatio": 0.5,
      "difficulty": "중 / 1개월",
      "action": "입고 로트당 10개체 무작위 계량. 표준구중 미달 로트는 감량 청구 또는 반품."
    },
    {
      "id": "cutStd",
      "label": "절단 표준화 (한계견본·작업표준서)",
      "defaultTargetRatio": 0.03,
      "difficulty": "중 / 1개월",
      "action": "품목별 절단 위치·외엽 제거 매수를 사진 한계견본으로 고정. 작업자 간 편차 축소."
    },
    {
      "id": "washStd",
      "label": "세척·탈수 조건 표준화",
      "defaultTargetRatio": 0.005,
      "difficulty": "하 / 2주",
      "action": "탈수기 RPM×시간 품목별 고정. 과탈수는 중량 로스, 부족은 소비기한 단축."
    }
  ]
};
