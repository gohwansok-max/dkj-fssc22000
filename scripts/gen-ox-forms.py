#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate O/X and monitoring daily forms from specs."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPEC_DIR = ROOT / "data" / "ox-form-specs"
REC_DIR = ROOT / "records"
JS_DIR = ROOT / "js"

COMMON_OX_FIELDS = [
    {"id": "checkDate", "label": "점검일자 *", "type": "date", "required": True},
    {
        "id": "shift",
        "label": "근무조",
        "type": "select",
        "options": ["주간", "야간", "기타"],
        "default": "주간",
    },
]

AREA_FIELD = {
    "id": "area",
    "label": "점검구역",
    "type": "select",
    "options": ["전처리", "소독헹굼", "포장", "냉장", "전체"],
    "optionLabels": {
        "전처리": "전처리실",
        "소독헹굼": "소독·헹굼실",
        "포장": "포장실",
        "냉장": "냉장창고",
        "전체": "작업장 전체",
    },
    "default": "전체",
}


def link(label: str, href: str) -> dict:
    return {"label": label, "href": href}


# ---------------------------------------------------------------------------
# Specs
# ---------------------------------------------------------------------------

SPECS: list[dict] = [
    {
        "code": "DKJ-S-02-01",
        "title": "작업장 위생점검일지",
        "subtitle": "선행요건 · 매일 · PRP-001/002 연계 · O/X 터치",
        "pattern": "ox",
        "frequency": "매일",
        "sectionOxTitle": "위생점검 O/X",
        "minChecks": 5,
        "titleKey": "area",
        "historyKeys": ["checkDate", "area"],
        "relatedProcedures": ["DKJ-P-02", "PRP-001", "PRP-002"],
        "mdrCode": "DKJ-S-02-01",
        "headerLinks": [
            link("← 기록목록", "../records-center.html?cat=daily"),
            link("PRP-001", "../doc-viewer.html?id=PRP-001"),
        ],
        "footerLinks": [
            link("일지 정본", "../doc-viewer.html?id=DKJ-S-02-01"),
            link("PRP-001 영업장", "../doc-viewer.html?id=PRP-001"),
            link("PRP-002 위생", "../doc-viewer.html?id=PRP-002"),
            link("CCP-1BC →", "DKJ-H-01-01.html"),
        ],
        "fields": COMMON_OX_FIELDS
        + [
            AREA_FIELD,
            {"id": "weather", "label": "날씨·특이사항", "type": "text", "placeholder": "맑음 / 특이사항 없으면 공란"},
        ],
        "items": [
            {"key": "f01", "group": "바닥", "label": "바닥 파손·고인물", "hint": "파손·물고임 없음"},
            {"key": "f02", "group": "바닥", "label": "바닥 청결", "hint": "잔사·흙·이물 없음"},
            {"key": "w01", "group": "벽", "label": "벽면 상태", "hint": "구멍·균열·곰팡이 없음"},
            {"key": "c01", "group": "천장", "label": "천장·덕트", "hint": "파손·결로·거미줄 없음"},
            {"key": "d01", "group": "배수", "label": "배수로 역류·악취", "hint": "역류·악취 없음"},
            {"key": "d02", "group": "배수", "label": "배수로 청결", "hint": "퇴적물 제거·커버 정상"},
            {"key": "e01", "group": "출입", "label": "출입구·방충", "hint": "문닫힘·방충망 파손 없음"},
            {"key": "e02", "group": "창·조명", "label": "창·조명커버", "hint": "비산방지·파손 없음"},
            {"key": "v01", "group": "환기", "label": "환기·급배기", "hint": "필터·덕트 잔사 없음"},
            {"key": "eq1", "group": "설비", "label": "작업대·컨베이어", "hint": "청소상태·이물 없음"},
            {"key": "eq2", "group": "설비", "label": "칼·도마·용기", "hint": "세척·소독 후 보관상태"},
            {"key": "eq3", "group": "세척", "label": "세척소독대·호스", "hint": "정리·교차오염 방지"},
            {"key": "wst", "group": "폐기물", "label": "폐기물통", "hint": "뚜껑·분리수거·넘침 없음"},
            {"key": "pst", "group": "해충", "label": "해충·쥐 흔적", "hint": "사체·배설물·유입 흔적 없음"},
            {"key": "chm", "group": "약품", "label": "세척·소독제 관리", "hint": "지정장소·라벨·희석 표기"},
        ],
    },
    {
        "code": "DKJ-S-02-02",
        "title": "조도점검일지",
        "subtitle": "선행요건 · 월간 · 작업장 조도(lx) 측정",
        "pattern": "mon",
        "monMode": "lux",
        "frequency": "월간",
        "relatedProcedures": ["PRP-001"],
        "mdrCode": "DKJ-S-02-02",
        "notice": "관리기준(임시) — 작업구역 일반조명 ≥200 lx · 검사·정밀작업 ≥500 lx (현장기준서로 확정)",
        "headerLinks": [
            link("← 기록목록", "../records-center.html?cat=daily"),
            link("PRP-001", "../doc-viewer.html?id=PRP-001"),
        ],
        "footerLinks": [
            link("일지 정본", "../doc-viewer.html?id=DKJ-S-02-02"),
            link("PRP-001", "../doc-viewer.html?id=PRP-001"),
        ],
        "fields": [
            {"id": "checkDate", "label": "점검일자 *", "type": "date"},
            {"id": "inspector", "label": "점검자 *", "type": "text"},
            {"id": "confirmer", "label": "확인자", "type": "text"},
            {
                "id": "instrument",
                "label": "조도계",
                "type": "text",
                "placeholder": "기기번호·교정일",
            },
        ],
        "zones": [
            {"id": "prep", "name": "전처리실", "luxMin": 200, "luxMax": 2000},
            {"id": "wash", "name": "소독·헹굼실", "luxMin": 200, "luxMax": 2000},
            {"id": "pack", "name": "포장실", "luxMin": 200, "luxMax": 2000},
            {"id": "inspect", "name": "검사·이물선별", "luxMin": 500, "luxMax": 3000},
            {"id": "cold", "name": "냉장창고", "luxMin": 100, "luxMax": 1000},
        ],
    },
    {
        "code": "DKJ-S-02-03",
        "title": "개인위생점검일지",
        "subtitle": "선행요건 · 매일 · 작업 전·중·후 O/X",
        "pattern": "ox",
        "frequency": "매일",
        "sectionOxTitle": "개인위생 O/X",
        "minChecks": 5,
        "titleKey": "team",
        "historyKeys": ["checkDate", "team"],
        "relatedProcedures": ["PRP-002"],
        "mdrCode": "DKJ-S-02-03",
        "headerLinks": [
            link("← 기록목록", "../records-center.html?cat=daily"),
            link("작업장 위생", "DKJ-S-02-01.html"),
        ],
        "footerLinks": [
            link("일지 정본", "../doc-viewer.html?id=DKJ-S-02-03"),
            link("PRP-002 위생", "../doc-viewer.html?id=PRP-002"),
            link("작업장 위생", "DKJ-S-02-01.html"),
            link("종사자건강", "DKJ-S-02-29.html"),
        ],
        "fields": COMMON_OX_FIELDS
        + [
            {"id": "team", "label": "작업팀/라인", "type": "text", "placeholder": "예: 전처리·포장"},
            {"id": "headcount", "label": "점검 인원(명)", "type": "number", "default": 1},
        ],
        "items": [
            {"key": "h01", "group": "건강", "label": "상처·화농·설사·복통 없음", "hint": "유증상자 작업 배제"},
            {"key": "h02", "group": "건강", "label": "피부질환·전염성질환 이상 없음", "hint": "건강진단·보고 기준"},
            {"key": "b01", "group": "복장", "label": "위생복·모·화 착용기준 준수", "hint": "작업 전"},
            {"key": "b02", "group": "복장", "label": "위생복장 청결", "hint": "오염·파손 없음"},
            {"key": "b03", "group": "복장", "label": "장신구 미착용", "hint": "반지·시계·팔찌 등"},
            {"key": "b04", "group": "위생", "label": "손톱·수염·화장 기준 준수", "hint": "손·머리 위생"},
            {"key": "w01", "group": "작업중", "label": "손·장갑 세척소독·교체", "hint": "수시 실시"},
            {"key": "w02", "group": "작업중", "label": "비위생 행위 없음", "hint": "껌·흡연·음식물 금지"},
            {"key": "w03", "group": "작업중", "label": "교차오염 방지 행동", "hint": "구역·동선 준수"},
            {"key": "a01", "group": "작업후", "label": "보호구 지정장소 보관", "hint": "앞치마·토시 등"},
        ],
    },
    {
        "code": "DKJ-S-02-04",
        "title": "이물관리점검일지",
        "subtitle": "선행요건 · 매일 · 이물유입·제거 상태 O/X",
        "pattern": "ox",
        "frequency": "매일",
        "sectionOxTitle": "이물관리 O/X",
        "minChecks": 5,
        "titleKey": "area",
        "historyKeys": ["checkDate", "area"],
        "relatedProcedures": ["PRP-001", "PRP-003"],
        "mdrCode": "DKJ-S-02-04",
        "headerLinks": [
            link("← 기록목록", "../records-center.html?cat=daily"),
            link("이물대장", "../doc-viewer.html?id=DKJ-S-02-31"),
        ],
        "footerLinks": [
            link("일지 정본", "../doc-viewer.html?id=DKJ-S-02-04"),
            link("이물 관리 대장", "../doc-viewer.html?id=DKJ-S-02-31"),
            link("CCP-2P", "DKJ-H-01-02.html"),
        ],
        "fields": COMMON_OX_FIELDS + [AREA_FIELD],
        "items": [
            {"key": "i01", "group": "원료", "label": "원료 이물·이취·변질 이상 없음", "hint": "입고·투입 전"},
            {"key": "i02", "group": "선별", "label": "이물선별대·조명 정상", "hint": "작업 시작 전"},
            {"key": "i03", "group": "설비", "label": "설비·벨트 잔사·금속·유리 없음", "hint": "가동 전후"},
            {"key": "i04", "group": "공구", "label": "칼·가위·집게 파손·분실 없음", "hint": "수량 확인"},
            {"key": "i05", "group": "포장", "label": "포장재 파손·이물 혼입 없음", "hint": "포장 전"},
            {"key": "i06", "group": "바닥", "label": "바닥·배수로 이물·잔사 없음", "hint": "청소 후"},
            {"key": "i07", "group": "조명", "label": "조명커버·방폭커버 파손 없음", "hint": "비산방지"},
            {"key": "i08", "group": "기록", "label": "이물 발견 시 즉시 보고·격리", "hint": "해당시"},
        ],
    },
    {
        "code": "DKJ-S-02-05",
        "title": "온습도점검일지",
        "subtitle": "작업장·냉장 · 매일 · 기준이탈 시 즉시조치",
        "pattern": "mon",
        "monMode": "th",
        "frequency": "매일",
        "relatedProcedures": ["PRP-001", "PRP-004"],
        "mdrCode": "DKJ-S-02-05",
        "notice": "관리기준(임시) — 작업실 온도 15~25℃ · 습도 40~70% · 냉장창고 0~5℃",
        "headerLinks": [
            link("← 기록목록", "../records-center.html?cat=daily"),
            link("PRP-004", "../doc-viewer.html?id=PRP-004"),
        ],
        "footerLinks": [
            link("일지 정본", "../doc-viewer.html?id=DKJ-S-02-05"),
            link("PRP-001", "../doc-viewer.html?id=PRP-001"),
            link("PRP-004 냉장", "../doc-viewer.html?id=PRP-004"),
        ],
        "fields": [
            {"id": "checkDate", "label": "점검일자 *", "type": "date"},
            {"id": "inspector", "label": "점검자 *", "type": "text"},
            {"id": "confirmer", "label": "확인자", "type": "text"},
            {
                "id": "season",
                "label": "계절구분",
                "type": "select",
                "options": ["하절기", "동절기", "환절기"],
                "default": "하절기",
            },
        ],
        "zones": [
            {"id": "prep", "name": "전처리실", "tMin": 15, "tMax": 25, "hMin": 40, "hMax": 70},
            {"id": "wash", "name": "소독·헹굼실", "tMin": 15, "tMax": 25, "hMin": 40, "hMax": 70},
            {"id": "pack", "name": "포장실", "tMin": 15, "tMax": 25, "hMin": 40, "hMax": 70},
            {"id": "cold", "name": "냉장창고", "tMin": 0, "tMax": 5, "hMin": None, "hMax": None},
        ],
    },
    {
        "code": "DKJ-S-02-06",
        "title": "환기 및 급·배기시설점검표",
        "subtitle": "선행요건 · 월간 · 필터·덕트·운전상태 O/X",
        "pattern": "ox",
        "frequency": "월간",
        "sectionOxTitle": "환기·급배기 O/X",
        "minChecks": 4,
        "titleKey": "area",
        "historyKeys": ["checkDate", "area"],
        "relatedProcedures": ["PRP-001"],
        "mdrCode": "DKJ-S-02-06",
        "headerLinks": [
            link("← 기록목록", "../records-center.html?cat=daily"),
            link("온습도", "DKJ-S-02-05.html"),
        ],
        "footerLinks": [
            link("일지 정본", "../doc-viewer.html?id=DKJ-S-02-06"),
            link("PRP-001", "../doc-viewer.html?id=PRP-001"),
        ],
        "fields": COMMON_OX_FIELDS + [AREA_FIELD],
        "items": [
            {"key": "v01", "group": "필터", "label": "급기·배기 필터 오염·파손 없음", "hint": "교체주기 확인"},
            {"key": "v02", "group": "덕트", "label": "덕트·후드 결로·잔사 없음", "hint": "육안점검"},
            {"key": "v03", "group": "운전", "label": "팬·모터 이상음·진동 없음", "hint": "운전 중"},
            {"key": "v04", "group": "환기", "label": "작업장 환기량·공기흐름 적정", "hint": "냄새·습기"},
            {"key": "v05", "group": "방충", "label": "급배기구 방충망·방서 정상", "hint": "파손 없음"},
            {"key": "v06", "group": "청소", "label": "필터·후드 청소 실시", "hint": "계획 대비"},
        ],
    },
    {
        "code": "DKJ-S-02-07",
        "title": "방충방서관리점검일지",
        "subtitle": "선행요건 · 월간 · 트랩·차단·발생징후 O/X",
        "pattern": "ox",
        "frequency": "월간",
        "sectionOxTitle": "방충방서 O/X",
        "minChecks": 5,
        "titleKey": "area",
        "historyKeys": ["checkDate", "area"],
        "relatedProcedures": ["PRP-001"],
        "mdrCode": "DKJ-S-02-07",
        "headerLinks": [
            link("← 기록목록", "../records-center.html?cat=daily"),
            link("작업장 위생", "DKJ-S-02-01.html"),
        ],
        "footerLinks": [
            link("일지 정본", "../doc-viewer.html?id=DKJ-S-02-07"),
            link("PRP-001", "../doc-viewer.html?id=PRP-001"),
        ],
        "fields": COMMON_OX_FIELDS
        + [
            AREA_FIELD,
            {"id": "pestVendor", "label": "방제업체/담당", "type": "text", "placeholder": "해당시"},
        ],
        "items": [
            {"key": "p01", "group": "차단", "label": "출입문·방충망·에어커튼 정상", "hint": "밀착·파손 없음"},
            {"key": "p02", "group": "트랩", "label": "포충등·끈끈이트랩 정상 작동", "hint": "부착면·전원"},
            {"key": "p03", "group": "트랩", "label": "트랩 포획물·교체주기 관리", "hint": "기록 연계"},
            {"key": "p04", "group": "발생", "label": "파리·바퀴·쥐 흔적 없음", "hint": "배설물·사체"},
            {"key": "p05", "group": "외부", "label": "외부 쓰레기·고인물 관리", "hint": "유인원 제거"},
            {"key": "p06", "group": "약품", "label": "살충·살서제 지정장소 보관", "hint": "표시·격리"},
            {"key": "p07", "group": "보고", "label": "이상 발견 시 즉시 보고·조치", "hint": "해당시"},
        ],
    },
    {
        "code": "DKJ-S-02-12",
        "title": "제조시설·설비점검표",
        "subtitle": "선행요건 · 월간 · 주요 설비 상태 O/X",
        "pattern": "ox",
        "frequency": "월간",
        "sectionOxTitle": "설비점검 O/X",
        "minChecks": 5,
        "titleKey": "area",
        "historyKeys": ["checkDate", "area"],
        "relatedProcedures": ["DKJ-P-02", "PRP-001"],
        "mdrCode": "DKJ-S-02-12",
        "headerLinks": [
            link("← 기록목록", "../records-center.html?cat=daily"),
            link("설비이력", "../doc-viewer.html?id=DKJ-S-02-11"),
        ],
        "footerLinks": [
            link("일지 정본", "../doc-viewer.html?id=DKJ-S-02-12"),
            link("설비이력카드", "../doc-viewer.html?id=DKJ-S-02-11"),
        ],
        "fields": COMMON_OX_FIELDS + [AREA_FIELD],
        "items": [
            {"key": "e01", "group": "절단", "label": "절단·슬라이서 청결·보호덮개", "hint": "가동 전"},
            {"key": "e02", "group": "세척", "label": "세척기·펌프·호스 누수·오염 없음", "hint": "연결부"},
            {"key": "e03", "group": "소독", "label": "소독조·희석설비 정상", "hint": "농도계 연계"},
            {"key": "e04", "group": "컨베이어", "label": "벨트·롤러·가드 정상", "hint": "이물·마모"},
            {"key": "e05", "group": "포장", "label": "포장기·실러 이상 없음", "hint": "실링·이물"},
            {"key": "e06", "group": "금속", "label": "금속검출기 외관·전원 정상", "hint": "CCP-2P 연계"},
            {"key": "e07", "group": "냉장", "label": "냉장고·냉동기 운전·결빙 이상 없음", "hint": "온도기록"},
            {"key": "e08", "group": "계측", "label": "온도계·저울 파손·교정 유효", "hint": "검교정 연계"},
        ],
    },
    {
        "code": "DKJ-S-02-13",
        "title": "저수조 물탱크 위생점검일지",
        "subtitle": "선행요건 · 월간 · 용수·저수조 O/X",
        "pattern": "ox",
        "frequency": "월간",
        "sectionOxTitle": "저수조·용수 O/X",
        "minChecks": 4,
        "historyKeys": ["checkDate"],
        "relatedProcedures": ["PRP-005"],
        "mdrCode": "DKJ-S-02-13",
        "headerLinks": [
            link("← 기록목록", "../records-center.html?cat=daily"),
            link("PRP-005", "../doc-viewer.html?id=PRP-005"),
        ],
        "footerLinks": [
            link("일지 정본", "../doc-viewer.html?id=DKJ-S-02-13"),
            link("PRP-005 용수", "../doc-viewer.html?id=PRP-005"),
        ],
        "fields": COMMON_OX_FIELDS
        + [
            {"id": "tankId", "label": "탱크/구역", "type": "text", "placeholder": "예: 저수조1", "default": "저수조1"},
        ],
        "items": [
            {"key": "w01", "group": "외관", "label": "탱크 덮개·밀폐·잠금 정상", "hint": "이물유입 방지"},
            {"key": "w02", "group": "위생", "label": "탱크 내부·배관 이끼·스케일 이상 없음", "hint": "육안"},
            {"key": "w03", "group": "청소", "label": "청소·소독 실시(주기 내)", "hint": "계획 대비"},
            {"key": "w04", "group": "수질", "label": "탁도·이취·이물 없음", "hint": "취수·사용수"},
            {"key": "w05", "group": "잔류염소", "label": "잔류염소·수질기준 준수", "hint": "해당시 측정"},
            {"key": "w06", "group": "기록", "label": "수질검사·위생기록 보관", "hint": "성적서"},
        ],
    },
    {
        "code": "DKJ-S-02-18",
        "title": "운송차량 위생점검표",
        "subtitle": "선행요건 · 출하/회차 · 차량 위생 O/X",
        "pattern": "ox",
        "frequency": "발생시",
        "sectionOxTitle": "차량위생 O/X",
        "minChecks": 4,
        "titleKey": "vehicleNo",
        "historyKeys": ["checkDate", "vehicleNo"],
        "relatedProcedures": ["PRP-006"],
        "mdrCode": "DKJ-S-02-18",
        "headerLinks": [
            link("← 기록목록", "../records-center.html?cat=daily"),
            link("PRP-006", "../doc-viewer.html?id=PRP-006"),
        ],
        "footerLinks": [
            link("일지 정본", "../doc-viewer.html?id=DKJ-S-02-18"),
            link("PRP-006 보관·운송", "../doc-viewer.html?id=PRP-006"),
        ],
        "fields": [
            {"id": "checkDate", "label": "점검일자 *", "type": "date"},
            {"id": "vehicleNo", "label": "차량번호 *", "type": "text", "placeholder": "예: 전북12가3456"},
            {"id": "driver", "label": "운전자", "type": "text"},
            {"id": "destination", "label": "행선/용도", "type": "text", "placeholder": "출하·회수 등"},
            {
                "id": "shift",
                "label": "시점",
                "type": "select",
                "options": ["상차전", "하차후", "회차"],
                "default": "상차전",
            },
        ],
        "items": [
            {"key": "v01", "group": "청결", "label": "적재함 청결·이물·악취 없음", "hint": "세척 후"},
            {"key": "v02", "group": "온도", "label": "냉장/보냉 설정·온도 적정", "hint": "해당차량"},
            {"key": "v03", "group": "차단", "label": "문·패킹·방충 상태 정상", "hint": "밀폐"},
            {"key": "v04", "group": "교차", "label": "이전적재 오염·알레르겐 잔류 없음", "hint": "분리운송"},
            {"key": "v05", "group": "식별", "label": "제품·라벨·서류 일치", "hint": "상차 전"},
            {"key": "v06", "group": "위생", "label": "운전자 복장·손위생 기준 준수", "hint": "해당시"},
        ],
    },
    {
        "code": "DKJ-S-02-29",
        "title": "종사자건강상태확인",
        "subtitle": "선행요건 · 매일 · 출근 전 건강 O/X",
        "pattern": "ox",
        "frequency": "매일",
        "sectionOxTitle": "건강상태 O/X",
        "minChecks": 4,
        "titleKey": "team",
        "historyKeys": ["checkDate", "team"],
        "relatedProcedures": ["PRP-002"],
        "mdrCode": "DKJ-S-02-29",
        "headerLinks": [
            link("← 기록목록", "../records-center.html?cat=daily"),
            link("개인위생", "DKJ-S-02-03.html"),
        ],
        "footerLinks": [
            link("일지 정본", "../doc-viewer.html?id=DKJ-S-02-29"),
            link("개인위생", "DKJ-S-02-03.html"),
            link("PRP-002", "../doc-viewer.html?id=PRP-002"),
        ],
        "fields": COMMON_OX_FIELDS
        + [
            {"id": "team", "label": "작업팀/라인", "type": "text"},
            {"id": "headcount", "label": "출근 인원(명)", "type": "number", "default": 1},
            {"id": "excluded", "label": "작업배제 인원", "type": "text", "placeholder": "성명·사유 (없으면 공란)"},
        ],
        "items": [
            {"key": "h01", "group": "발열", "label": "발열·오한 증상 없음", "hint": "37.5℃ 이상 배제"},
            {"key": "h02", "group": "소화기", "label": "설사·구토·복통 없음", "hint": "유증상 배제"},
            {"key": "h03", "group": "호흡기", "label": "기침·인후통·호흡기증상 없음", "hint": "해당시 보고"},
            {"key": "h04", "group": "피부", "label": "화농성 상처·피부질환 없음", "hint": "또는 보호조치"},
            {"key": "h05", "group": "보고", "label": "증상 발생 시 즉시 보고", "hint": "관리자 연계"},
            {"key": "h06", "group": "복귀", "label": "배제자 복귀기준 준수", "hint": "해당시"},
        ],
    },
    {
        "code": "DKJ-STORE-01",
        "title": "원료보관·선입선출 점검",
        "subtitle": "입고 적합 후 · DKJ-W-002 · FIFO O/X",
        "pattern": "ox",
        "frequency": "매일",
        "sectionOxTitle": "보관·FIFO O/X",
        "minChecks": 4,
        "titleKey": "itemName",
        "historyKeys": ["itemName", "storeDate", "lot"],
        "relatedProcedures": ["DKJ-P-05", "DKJ-W-002"],
        "mdrCode": "DKJ-STORE-01",
        "customBoot": "store",
        "headerLinks": [
            link("← 기록목록", "../records-center.html?cat=inbound"),
            link("FR-014 입고", "FR-014.html"),
        ],
        "footerLinks": [
            link("FR-014", "FR-014.html"),
            link("DKJ-W-002", "../doc-viewer.html?id=DKJ-W-002"),
            link("온습도", "DKJ-S-02-05.html"),
        ],
        "fields": [
            {"id": "storeDate", "label": "보관일 *", "type": "date"},
            {"id": "from014", "label": "FR-014 연계ID", "type": "text", "placeholder": "자동"},
            {"id": "itemName", "label": "품명 *", "type": "text"},
            {"id": "lot", "label": "LOT *", "type": "text"},
            {"id": "qty", "label": "수량", "type": "text"},
            {
                "id": "unit",
                "label": "단위",
                "type": "select",
                "options": ["kg", "박스", "EA"],
                "default": "kg",
            },
            {"id": "supplier", "label": "공급처", "type": "text"},
            {"id": "receiveDate", "label": "입고일", "type": "date"},
            {
                "id": "location",
                "label": "보관장소",
                "type": "select",
                "options": ["원료냉장", "원료실온", "부자재창고"],
                "default": "원료냉장",
            },
            {"id": "shelf", "label": "랙/위치", "type": "text"},
            {"id": "storeTemp", "label": "보관온도(℃)", "type": "text"},
            {"id": "expiry", "label": "유통기한/소비기한", "type": "text"},
        ],
        "items": [
            {"key": "c01", "group": "식별", "label": "품명·LOT 라벨 부착", "hint": "식별 가능하게 표시"},
            {"key": "c02", "group": "FIFO", "label": "선입선출 위치 지정", "hint": "오래된 LOT가 앞에"},
            {"key": "c03", "group": "온도", "label": "보관온도 기준 내", "hint": "냉장/상온 기준 준수"},
            {"key": "c04", "group": "위생", "label": "용기·파렛 청결", "hint": "이물·오염 없음"},
            {"key": "c05", "group": "격리", "label": "부적합·보류품과 분리", "hint": "교차취급 방지"},
            {"key": "c06", "group": "알레르겐", "label": "알레르겐 원료 구분 보관", "hint": "해당시"},
        ],
    },
]


def esc(s: str) -> str:
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def render_field(f: dict) -> str:
    fid = f["id"]
    label = esc(f["label"])
    typ = f.get("type", "text")
    ph = esc(f.get("placeholder", ""))
    if typ == "select":
        opts = []
        labels = f.get("optionLabels") or {}
        for o in f.get("options", []):
            lab = labels.get(o, o)
            opts.append(f'<option value="{esc(o)}">{esc(lab)}</option>')
        return (
            f'<div class="dkj-field"><label for="{fid}">{label}</label>'
            f'<select id="{fid}">{"".join(opts)}</select></div>'
        )
    if typ == "date":
        return f'<div class="dkj-field"><label for="{fid}">{label}</label><input type="date" id="{fid}"></div>'
    if typ == "number":
        val = f.get("default", "")
        return (
            f'<div class="dkj-field"><label for="{fid}">{label}</label>'
            f'<input type="number" id="{fid}" value="{esc(val)}"></div>'
        )
    if typ == "textarea":
        return (
            f'<div class="dkj-field full"><label for="{fid}">{label}</label>'
            f'<textarea id="{fid}" placeholder="{ph}"></textarea></div>'
        )
    return (
        f'<div class="dkj-field"><label for="{fid}">{label}</label>'
        f'<input type="text" id="{fid}" placeholder="{ph}"></div>'
    )


def render_links(links: list[dict], ghost: bool = False) -> str:
    parts = []
    for L in links or []:
        style = (
            ' style="background:rgba(255,255,255,.15);color:#fff;border-color:rgba(255,255,255,.3);"'
            if ghost
            else ""
        )
        cls = "pill-btn ghost" if ghost else "link-chip sm"
        parts.append(f'<a class="{cls}" href="{esc(L["href"])}"{style}>{esc(L["label"])}</a>')
    return "".join(parts)


def render_ox_html(spec: dict) -> str:
    code = spec["code"]
    fields_html = "".join(render_field(f) for f in spec.get("fields", []))
    # STORE and generic: judge panel always includes inspector if not in fields
    field_ids = {f["id"] for f in spec.get("fields", [])}
    judge_extra = ""
    if "inspector" not in field_ids:
        judge_extra += render_field({"id": "inspector", "label": "점검자 *", "type": "text"})
    if "confirmer" not in field_ids:
        judge_extra += render_field({"id": "confirmer", "label": "확인자", "type": "text"})

    banner = ""
    if spec.get("customBoot") == "store":
        banner = """
    <div class="viewer-notice" id="from014Banner" hidden style="margin-bottom:14px;background:#e8f5e9;border-color:#a5d6a7;color:#1b5e20;">
      ✓ FR-014 적합 입고에서 연계되었습니다. 보관 위치를 지정하고 FIFO 점검을 완료하세요.
    </div>
    <div class="process-bar-wrap" style="margin-bottom:14px;">
      <div id="processBar"></div>
    </div>"""

    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#008352">
  <title>{esc(code)} {esc(spec['title'])} | 동김제농협</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../css/dkj-portal.css">
  <link rel="stylesheet" href="../css/dkj-form.css">
  <link rel="stylesheet" href="../css/dkj-print.css">
</head>
<body class="dkj-form-page">
  <div class="screen-only">
  <header class="dkj-form-header">
    <div class="container">
      <div>
        <h1>{esc(code)} {esc(spec['title'])}</h1>
        <p>{esc(spec.get('subtitle', ''))}</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        {render_links(spec.get('headerLinks'), ghost=True)}
      </div>
    </div>
  </header>
  <main class="container dkj-form-body">
    <div class="dkj-form-toolbar">
      <div class="dkj-status" id="saveStatus"><span class="dot"></span> 준비</div>
      <button type="button" class="pill-btn green" id="btnSave">저장</button>
      <button type="button" class="pill-btn blue" id="btnLock">작성완료</button>
      <button type="button" class="pill-btn ghost" id="btnNew">새 일보</button>
      <button type="button" class="pill-btn ghost" id="btnPrint">인쇄(정본)</button>
    </div>
    {banner}
    <section class="dkj-panel">
      <h2>① 점검 기본정보</h2>
      <div class="dkj-field-grid">
        {fields_html}
      </div>
    </section>
    <section class="dkj-panel">
      <h2>② {esc(spec.get('sectionOxTitle', '점검 O/X'))} <span style="font-weight:500;color:#888;font-size:12px;">(O 적합 · X 부적합 · - 해당없음)</span></h2>
      <div class="ox-grid" id="oxGrid"></div>
    </section>
    <section class="dkj-panel">
      <h2>③ 판정·시정</h2>
      <div class="dkj-field-grid">
        <div class="dkj-field full"><label>종합판정 *</label>
          <div class="judge-row">
            <button type="button" class="judge-btn ok" id="judgeOk" data-judge="적합">✓ 적합</button>
            <button type="button" class="judge-btn ng" id="judgeNg" data-judge="부적합">✕ 부적합</button>
          </div>
        </div>
        <div class="dkj-field full"><label for="corrective">부적합 시 즉시조치</label>
          <textarea id="corrective" placeholder="내용·조치자·완료시각"></textarea></div>
        {judge_extra}
        <div class="dkj-field full"><label for="remark">비고</label><textarea id="remark"></textarea></div>
      </div>
      <div class="dkj-link-bar">
        {render_links(spec.get('footerLinks'))}
      </div>
    </section>
    <section class="dkj-panel history"><h2>④ 최근 저장</h2><div id="historyList"></div></section>
  </main>
  </div>
  <div id="printSheet" class="print-sheet" aria-hidden="true"></div>
  <script src="../js/dkj-record-store.js"></script>
  {"<script src=\"../js/dkj-master-data.js\"></script>" if spec.get("customBoot") == "store" else ""}
  <script src="../js/dkj-print-form.js"></script>
  <script src="../js/dkj-ox-form.js"></script>
  <script src="../js/{esc(code)}.js"></script>
</body>
</html>
"""


def render_mon_html(spec: dict) -> str:
    code = spec["code"]
    mode = spec.get("monMode", "th")
    fields_html = "".join(render_field(f) for f in spec.get("fields", []))
    notice = ""
    if spec.get("notice"):
        notice = f'<div class="viewer-notice" style="margin-bottom:14px;"><strong>안내</strong> — {esc(spec["notice"])}</div>'

    if mode == "lux":
        thead = """
            <tr>
              <th>구역</th>
              <th>기준(lx)</th>
              <th>오전</th>
              <th>오후</th>
              <th>판정</th>
            </tr>"""
        section_title = "구역별 조도 측정"
    else:
        thead = """
            <tr>
              <th>구역</th>
              <th>기준℃</th>
              <th>기준%</th>
              <th>오전℃</th>
              <th>오전%</th>
              <th>오후℃</th>
              <th>오후%</th>
              <th>판정</th>
            </tr>"""
        section_title = "구역별 측정"

    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#008352">
  <title>{esc(code)} {esc(spec['title'])} | 동김제농협</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../css/dkj-portal.css">
  <link rel="stylesheet" href="../css/dkj-form.css">
  <link rel="stylesheet" href="../css/dkj-print.css">
</head>
<body class="dkj-form-page">
  <div class="screen-only">
  <header class="dkj-form-header">
    <div class="container">
      <div>
        <h1>{esc(code)} {esc(spec['title'])}</h1>
        <p>{esc(spec.get('subtitle', ''))}</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        {render_links(spec.get('headerLinks'), ghost=True)}
      </div>
    </div>
  </header>
  <main class="container dkj-form-body">
    <div class="dkj-form-toolbar">
      <div class="dkj-status" id="saveStatus"><span class="dot"></span> 준비</div>
      <button type="button" class="pill-btn green" id="btnSave">저장</button>
      <button type="button" class="pill-btn blue" id="btnLock">작성완료</button>
      <button type="button" class="pill-btn ghost" id="btnNew">새 일보</button>
      <button type="button" class="pill-btn ghost" id="btnPrint">인쇄(정본)</button>
    </div>
    {notice}
    <section class="dkj-panel">
      <h2>① 점검 기본정보</h2>
      <div class="dkj-field-grid">
        {fields_html}
      </div>
    </section>
    <section class="dkj-panel">
      <h2>② {section_title}</h2>
      <div class="mon-table-wrap">
        <table class="mon-table">
          <thead>{thead}</thead>
          <tbody id="monBody"></tbody>
        </table>
      </div>
      <p id="deviationBanner" class="viewer-notice" hidden style="margin-top:12px;background:#ffebee;border-color:#ef9a9a;color:#b71c1c;">기준 이탈 — 즉시조치를 기록하세요.</p>
    </section>
    <section class="dkj-panel">
      <h2>③ 이탈조치·비고</h2>
      <div class="dkj-field-grid">
        <div class="dkj-field full"><label for="corrective">이탈 시 즉시조치</label>
          <textarea id="corrective" placeholder="조치 내용"></textarea></div>
        <div class="dkj-field full"><label for="remark">비고</label><textarea id="remark"></textarea></div>
      </div>
      <div class="dkj-link-bar">
        {render_links(spec.get('footerLinks'))}
      </div>
    </section>
    <section class="dkj-panel history"><h2>④ 최근 저장</h2><div id="historyList"></div></section>
  </main>
  </div>
  <div id="printSheet" class="print-sheet" aria-hidden="true"></div>
  <script src="../js/dkj-record-store.js"></script>
  <script src="../js/dkj-print-form.js"></script>
  <script src="../js/dkj-mon-form.js"></script>
  <script src="../js/{esc(code)}.js"></script>
</body>
</html>
"""


def build_print(spec: dict) -> dict:
    """정본형 인쇄 템플릿 — 화면 items를 인쇄 행으로 매핑."""
    code = spec["code"]
    ampm = code in ("DKJ-S-02-03", "DKJ-S-02-29")
    note = (
        "※ 평가 — 양호: ○ , 부적합(시정조치 필요): × , 해당없음: —    "
        "※ 주기 — D:매일 W:주간 M:월간"
    )
    if spec.get("pattern") == "mon":
        return {
            "layout": "mon-lux" if spec.get("monMode") == "lux" else "mon-th",
            "monMode": spec.get("monMode") or "th",
            "orgName": "동김제농협 가공센터",
            "docNo": code,
            "title": spec["title"],
            "rev": "0",
            "enactDate": "2026.07.10",
            "reviseDate": "2026.07.10",
            "note": "※ 관리기준 이탈 시 즉시조치란에 기재한다. (현장 확정 CL 적용)",
        }
    rows = []
    for it in spec.get("items") or []:
        rows.append(
            {
                "key": it["key"],
                "group": it.get("group", ""),
                "label": it["label"],
                "hint": it.get("hint", ""),
                "freq": "D" if spec.get("frequency") == "매일" else (
                    "W" if "주" in str(spec.get("frequency", "")) else "M"
                ),
                "ampm": ampm,
            }
        )
    return {
        "layout": "ox",
        "columnMode": "ampm" if ampm else "result",
        "orgName": "동김제농협 가공센터",
        "docNo": code,
        "title": spec["title"],
        "rev": "0",
        "enactDate": "2026.07.10",
        "reviseDate": "2026.07.10",
        "rows": rows,
        "note": note,
    }


def runtime_spec(spec: dict) -> dict:
    """Strip catalog-only keys for client mount (keep print)."""
    skip = {
        "relatedProcedures",
        "mdrCode",
        "sourcePath",
        "headerLinks",
        "footerLinks",
        "notice",
        "subtitle",
        "sectionOxTitle",
        "customBoot",
        "frequency",
    }
    out = {k: v for k, v in spec.items() if k not in skip}
    if "print" not in out:
        out["print"] = build_print(spec)
    return out


def render_js(spec: dict) -> str:
    code = spec["code"]
    rs = runtime_spec(spec)
    payload = json.dumps(rs, ensure_ascii=False, indent=2)
    if spec.get("customBoot") == "store":
        return f"""/**
 * {code} — generated boot (STORE / FR-014 link)
 */
(function () {{
  'use strict';
  var SPEC = {payload};
  SPEC.validateExtra = function (state) {{
    if (!state.itemName) return '품목을 입력하세요.';
    if (!state.lot) return 'LOT를 입력하세요.';
    return '';
  }};
  SPEC.onNew = function () {{
    var b = document.getElementById('from014Banner');
    if (b) b.hidden = true;
  }};
  SPEC.afterInit = function (api) {{
    if (window.DkjMaster) DkjMaster.renderProcessBar('processBar', 'store1');
    var params = new URLSearchParams(location.search);
    var from014 = params.get('from014');
    if (from014) {{
      var rec = DkjRecordStore.get('FR-014', from014);
      if (rec) {{
        api.setState({{
          from014: from014,
          itemName: rec.itemName || '',
          lot: rec.lot || '',
          qty: rec.qty || '',
          unit: rec.unit || 'kg',
          supplier: rec.supplier || '',
          receiveDate: rec.receiveDate || '',
          storeTemp: rec.temp || ''
        }});
        var b = document.getElementById('from014Banner');
        if (b) b.hidden = false;
      }}
    }}
    ['itemName', 'lot', 'qty', 'unit', 'supplier', 'receiveDate'].forEach(function (k) {{
      if (params.get(k)) api.getState()[k] = params.get(k);
    }});
    if (params.get('itemName')) api.writeForm();
  }};
  DkjOxForm.mount(SPEC);
}})();
"""
    engine = "DkjMonForm" if spec.get("pattern") == "mon" else "DkjOxForm"
    return f"""/**
 * {code} — generated boot
 */
(function () {{
  'use strict';
  {engine}.mount({payload});
}})();
"""


def upsert_record_catalog(specs: list[dict]) -> None:
    path = ROOT / "data" / "record-catalog.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    by_code = {r["code"]: r for r in data["records"]}
    for spec in specs:
        code = spec["code"]
        html_path = f"records/{code}.html"
        entry = {
            "id": code,
            "code": code,
            "title": spec["title"],
            "rev": "Rev0",
            "fileType": "html",
            "frequency": spec.get("frequency", "매일"),
            "relatedProcedures": spec.get("relatedProcedures", []),
            "htmlReady": True,
            "htmlPath": html_path,
            "mdrCode": spec.get("mdrCode", code),
        }
        if code in by_code:
            by_code[code].update(entry)
        else:
            data["records"].append(entry)
            by_code[code] = entry

    # daily category codes
    for cat in data.get("categories", []):
        if cat.get("id") == "daily":
            codes = list(cat.get("codes", []))
            for spec in specs:
                if spec["code"] not in codes and spec["code"] != "DKJ-STORE-01":
                    # insert before FR-
                    i = next((i for i, c in enumerate(codes) if c.startswith("FR-")), len(codes))
                    codes.insert(i, spec["code"])
            # unique preserve order
            seen = set()
            cat["codes"] = [c for c in codes if not (c in seen or seen.add(c))]
        if cat.get("id") == "inbound":
            codes = list(cat.get("codes", []))
            if "DKJ-STORE-01" not in codes:
                codes.append("DKJ-STORE-01")
            cat["codes"] = codes

    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("updated record-catalog.json")


def update_menu(specs: list[dict]) -> None:
    path = ROOT / "data" / "menu-catalog.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    href_map = {s["code"]: f"records/{s['code']}.html" for s in specs}

    def walk(obj):
        if isinstance(obj, dict):
            lab = obj.get("label", "")
            href = obj.get("href", "")
            for code, new_href in href_map.items():
                if code in lab or (isinstance(href, str) and f"id={code}" in href):
                    obj["href"] = new_href
            for v in obj.values():
                walk(v)
        elif isinstance(obj, list):
            for v in obj:
                walk(v)

    walk(data)

    # ensure quick links for key forms
    ql = data.get("quickLinks", [])
    have = {q.get("href") for q in ql}
    extras = [
        {"label": "이물점검", "href": "records/DKJ-S-02-04.html"},
        {"label": "방충방서", "href": "records/DKJ-S-02-07.html"},
        {"label": "종사자건강", "href": "records/DKJ-S-02-29.html"},
        {"label": "조도", "href": "records/DKJ-S-02-02.html"},
    ]
    for e in extras:
        if e["href"] not in have:
            ql.insert(0, e)
    data["quickLinks"] = ql[:12]
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("updated menu-catalog.json")


def update_mdr_portal() -> None:
    """Ensure html form map exists in portalLink; skip if already present."""
    path = ROOT / "js" / "mdr-register.js"
    text = path.read_text(encoding="utf-8")
    if "DKJ-S-02-29" in text and "htmlForms" in text:
        print("mdr-register.js portalLink already wired")
        return
    print("WARN: re-run manual portalLink patch if forms missing in mdr-register.js")


def main() -> None:
    SPEC_DIR.mkdir(parents=True, exist_ok=True)
    REC_DIR.mkdir(parents=True, exist_ok=True)
    print_dir = ROOT / "data" / "print-templates"
    print_dir.mkdir(parents=True, exist_ok=True)

    for spec in SPECS:
        code = spec["code"]
        if "print" not in spec:
            spec["print"] = build_print(spec)
        # write JSON spec (serializable)
        SPEC_DIR.joinpath(f"{code}.json").write_text(
            json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print_dir.joinpath(f"{code}.json").write_text(
            json.dumps(spec["print"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        if spec["pattern"] == "ox":
            html = render_ox_html(spec)
        else:
            html = render_mon_html(spec)
        REC_DIR.joinpath(f"{code}.html").write_text(html, encoding="utf-8")
        JS_DIR.joinpath(f"{code}.js").write_text(render_js(spec), encoding="utf-8")
        print(f"OK {code}")

    upsert_record_catalog(SPECS)
    update_menu(SPECS)
    update_mdr_portal()

    # rebuild bundles
    import subprocess
    import sys

    subprocess.check_call([sys.executable, str(ROOT / "scripts" / "build-catalog-bundles.py")])
    print("done")


if __name__ == "__main__":
    main()
