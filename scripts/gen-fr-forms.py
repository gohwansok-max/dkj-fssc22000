#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate HTML/JS for FR-001~047 (excluding FR-014/015 already hand-built)."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPEC_DIR = ROOT / "data" / "fr-form-specs"
REC_DIR = ROOT / "records"
JS_DIR = ROOT / "js"
PRINT_DIR = ROOT / "data" / "print-templates"
CATALOG = ROOT / "data" / "record-catalog.json"

SKIP = {"FR-014", "FR-015"}


def f(id_, label, type_="text", **kw):
    d = {"id": id_, "label": label, "type": type_}
    d.update(kw)
    return d


def sec(id_, label, placeholder=""):
    return {"id": id_, "label": label, "placeholder": placeholder}


def item(key, label, group="항목", hint=""):
    return {"key": key, "group": group, "label": label, "hint": hint}


def link(label, href):
    return {"label": label, "href": href}


DATE = f("docDate", "작성일자 *", "date", required=True)
WRITER_FIELDS = [
    f("writer", "작성자 *", required=True),
    f("reviewer", "검토자"),
    f("approver", "승인자"),
]


def base(code, title, freq, procs, cat, **extra):
    subtitle = extra.pop("subtitle", f"FSSC22000 · {freq}")
    fields = extra.pop("fields", None) or [DATE] + extra.pop("extra_fields", []) + WRITER_FIELDS
    sections = extra.pop("sections", [])
    items = extra.pop("items", [])
    title_key = extra.pop("titleKey", "subject")
    history_keys = extra.pop("historyKeys", ["docDate", title_key])
    min_checks = extra.pop("minChecks", 1 if items else 0)
    mdr = extra.pop("mdrCode", code.replace("FR-", "DKJ-F-"))
    return {
        "code": code,
        "title": title,
        "subtitle": subtitle,
        "pattern": "fr",
        "frequency": freq,
        "category": cat,
        "relatedProcedures": procs,
        "mdrCode": mdr,
        "titleKey": title_key,
        "historyKeys": history_keys,
        "minChecks": min_checks,
        "headerLinks": [
            link("← 기록목록", f"../records-center.html?cat={cat}"),
        ]
        + ([link(procs[0], f"../doc-viewer.html?id={procs[0]}")] if procs else []),
        "footerLinks": [
            link("문서센터", f"../doc-viewer.html?id={code}"),
        ]
        + ([link(p, f"../doc-viewer.html?id={p}") for p in procs[:2]]),
        "fields": fields,
        "sections": sections,
        "items": items,
        **extra,
    }


SPECS: list[dict] = [
    # --- 문서·기록관리 ---
    base(
        "FR-001", "문서 제·개정 요청서", "이슈", ["DKJ-P-01"], "document",
        extra_fields=[
            f("subject", "문서명 *", required=True),
            f("docCode", "문서번호"),
            f("reqType", "요청구분", "select", options=["제정", "개정", "폐지"], default="개정"),
            f("reason", "요청사유", "text", placeholder="개정 사유 요약"),
        ],
        sections=[
            sec("changeSummary", "변경 내용 요약", "주요 변경점"),
            sec("impact", "영향 범위", "관련 절차·양식·교육"),
        ],
        titleKey="subject",
    ),
    base(
        "FR-002", "문서배포대장", "이슈", ["DKJ-P-01"], "document",
        extra_fields=[
            f("subject", "문서명 *", required=True),
            f("docCode", "문서번호"),
            f("rev", "개정번호", default="0"),
            f("recipient", "배포처 *", required=True),
            f("copies", "부수", "number", default=1),
            f("method", "배포방법", "select", options=["인쇄", "전자", "게시"], default="전자"),
        ],
        sections=[sec("noteDetail", "배포 특이사항")],
        titleKey="subject",
    ),
    base(
        "FR-003", "문서회수대장", "이슈", ["DKJ-P-01"], "document",
        extra_fields=[
            f("subject", "문서명 *", required=True),
            f("docCode", "문서번호"),
            f("rev", "회수 개정번호"),
            f("fromDept", "회수처 *", required=True),
            f("qty", "회수부수", "number", default=1),
            f("dispose", "처리방법", "select", options=["폐기", "보관", "개정본 교체"], default="폐기"),
        ],
        sections=[sec("noteDetail", "회수·폐기 확인")],
        titleKey="subject",
    ),
    base(
        "FR-004", "외부문서관리대장", "월간", ["DKJ-P-01"], "document",
        extra_fields=[
            f("subject", "외부문서명 *", required=True),
            f("issuer", "발행기관"),
            f("extNo", "문서번호/고시번호"),
            f("recvDate", "입수일", "date"),
            f("owner", "관리책임자"),
            f("location", "보관위치"),
        ],
        sections=[sec("noteDetail", "적용범위·비고")],
        titleKey="subject",
    ),
    base(
        "FR-005", "폐기문서관리대장", "이슈", ["DKJ-P-01"], "document",
        extra_fields=[
            f("subject", "문서명 *", required=True),
            f("docCode", "문서번호"),
            f("rev", "개정번호"),
            f("disposeDate", "폐기일", "date"),
            f("method", "폐기방법", "select", options=["파쇄", "소각", "전자삭제"], default="파쇄"),
            f("witness", "입회자"),
        ],
        sections=[sec("noteDetail", "폐기 사유")],
        titleKey="subject",
    ),
    base(
        "FR-006", "기록관리대장", "월간", ["DKJ-P-02", "DKJ-P-01"], "document",
        extra_fields=[
            f("subject", "기록명 *", required=True),
            f("formCode", "양식번호"),
            f("period", "기록기간"),
            f("keeper", "보관부서"),
            f("retention", "보존기간", default="3년"),
            f("location", "보관위치"),
        ],
        sections=[sec("noteDetail", "이관·폐기 계획")],
        titleKey="subject",
    ),
    base(
        "FR-007", "기록폐기대장", "이슈", ["DKJ-P-02"], "document",
        extra_fields=[
            f("subject", "기록명 *", required=True),
            f("formCode", "양식번호"),
            f("period", "해당기간"),
            f("disposeDate", "폐기일", "date"),
            f("method", "폐기방법", "select", options=["파쇄", "전자삭제"], default="파쇄"),
            f("witness", "입회자"),
        ],
        sections=[sec("noteDetail", "폐기 사유·확인")],
        titleKey="subject",
    ),
    # --- 교육 ---
    base(
        "FR-008", "연간 교육훈련 계획서", "연간", ["DKJ-P-03"], "education",
        extra_fields=[
            f("subject", "계획연도 *", required=True, placeholder="2026"),
            f("owner", "교육책임자"),
            f("scope", "대상부서"),
        ],
        sections=[
            sec("planSummary", "연간 교육 계획 요약", "월별·주제·대상·시간"),
            sec("budget", "예산·외부강사"),
        ],
        titleKey="subject",
    ),
    base(
        "FR-009", "교육훈련 실시 및 평가 기록", "이슈", ["DKJ-P-03"], "education",
        extra_fields=[
            f("subject", "교육주제 *", required=True),
            f("eduDate", "교육일", "date"),
            f("hours", "교육시간(h)", "number", default=1),
            f("trainer", "강사"),
            f("attendees", "참석인원", "number"),
            f("place", "장소"),
        ],
        sections=[
            sec("content", "교육내용"),
            sec("evaluation", "평가결과·이해도"),
            sec("followup", "추가교육·개선사항"),
        ],
        items=[
            item("e01", "출석 확인 완료", "출석"),
            item("e02", "교육자료 배포", "자료"),
            item("e03", "평가 실시", "평가"),
            item("e04", "기록 보관", "기록"),
        ],
        titleKey="subject",
        minChecks=2,
    ),
    base(
        "FR-010", "개인별 역량평가표", "연간", ["DKJ-P-03"], "education",
        extra_fields=[
            f("subject", "성명 *", required=True),
            f("dept", "부서/직무"),
            f("evalYear", "평가연도", placeholder="2026"),
            f("evaluator", "평가자"),
        ],
        sections=[
            sec("competence", "역량 요구사항·평가결과"),
            sec("gap", "갭·교육필요"),
            sec("plan", "개인 개발계획"),
        ],
        items=[
            item("c01", "직무지식", "역량"),
            item("c02", "HACCP/위생", "역량"),
            item("c03", "작업숙련도", "역량"),
            item("c04", "법규·절차 준수", "역량"),
        ],
        titleKey="subject",
        minChecks=3,
    ),
    # --- 공급업체 ---
    base(
        "FR-011", "공급업체 승인평가표", "이슈", ["DKJ-P-04"], "supplier",
        extra_fields=[
            f("subject", "업체명 *", required=True),
            f("item", "공급품목"),
            f("evalType", "평가구분", "select", options=["신규", "정기", "특별"], default="신규"),
            f("result", "승인결과", "select", options=["승인", "조건부승인", "반려"], default="승인"),
        ],
        sections=[sec("evalDetail", "평가내용·증빙"), sec("condition", "조건부 시 조치")],
        items=[
            item("s01", "영업허가·인허가", "자격"),
            item("s02", "HACCP/인증 보유", "자격"),
            item("s03", "품질·위생 수준", "품질"),
            item("s04", "납기·대응력", "공급"),
            item("s05", "원산지·표시 적정", "표시"),
        ],
        titleKey="subject",
        minChecks=3,
    ),
    base(
        "FR-012", "승인공급업체 목록", "월간", ["DKJ-P-04"], "supplier",
        extra_fields=[
            f("subject", "업체명 *", required=True),
            f("item", "공급품목 *", required=True),
            f("contact", "담당자/연락처"),
            f("approvedDate", "승인일", "date"),
            f("nextEval", "차기평가일", "date"),
            f("status", "상태", "select", options=["승인", "정지", "제외"], default="승인"),
        ],
        sections=[sec("noteDetail", "비고·제한조건")],
        titleKey="subject",
    ),
    base(
        "FR-013", "구매 발주 및 검토 기록", "이슈", ["DKJ-P-04"], "supplier",
        extra_fields=[
            f("subject", "품명 *", required=True),
            f("supplier", "공급업체"),
            f("qty", "발주수량"),
            f("unit", "단위", "select", options=["kg", "박스", "EA"], default="kg"),
            f("needDate", "납기요청일", "date"),
            f("poNo", "발주번호"),
        ],
        sections=[sec("spec", "규격·품질요건"), sec("review", "구매검토 의견")],
        items=[
            item("p01", "승인업체 여부", "검토"),
            item("p02", "규격·사양 명확", "검토"),
            item("p03", "납기 가능", "검토"),
        ],
        titleKey="subject",
        minChecks=2,
    ),
    # --- 회수 ---
    base(
        "FR-016", "제품회수 보고서 및 기록", "이슈", ["DKJ-P-06"], "recall",
        extra_fields=[
            f("subject", "제품명 *", required=True),
            f("lot", "LOT"),
            f("recallClass", "회수등급", "select", options=["1등급", "2등급", "3등급"], default="2등급"),
            f("startDate", "개시일", "date"),
            f("qty", "회수대상량"),
        ],
        sections=[
            sec("reason", "회수 사유"),
            sec("scope", "유통·회수 범위"),
            sec("action", "조치·폐기·재작업"),
            sec("result", "결과·종료 확인"),
        ],
        titleKey="subject",
    ),
    base(
        "FR-017", "모의회수 훈련 결과보고서", "연간", ["DKJ-P-06"], "recall",
        extra_fields=[
            f("subject", "훈련명 *", required=True),
            f("drillDate", "실시일", "date"),
            f("scenario", "시나리오"),
            f("participants", "참석인원", "number"),
        ],
        sections=[
            sec("process", "훈련 진행 내용"),
            sec("findings", "발견사항·개선점"),
            sec("followup", "후속조치"),
        ],
        items=[
            item("d01", "연락체계 작동", "훈련"),
            item("d02", "추적성 확인", "훈련"),
            item("d03", "회수결정·기록", "훈련"),
            item("d04", "소요시간 목표 내", "훈련"),
        ],
        titleKey="subject",
        minChecks=3,
    ),
    # --- 내부심사 ---
    base(
        "FR-018", "내부심사 실시계획서", "연간", ["DKJ-P-07"], "audit",
        extra_fields=[
            f("subject", "심사명/연도 *", required=True),
            f("period", "계획기간"),
            f("leadAuditor", "심사팀장"),
            f("scope", "심사범위"),
        ],
        sections=[sec("schedule", "일정·부서별 계획"), sec("criteria", "심사기준·체크리스트")],
        titleKey="subject",
    ),
    base(
        "FR-019", "내부심사 체크리스트", "이슈", ["DKJ-P-07"], "audit",
        extra_fields=[
            f("subject", "심사대상 *", required=True),
            f("auditDate", "심사일", "date"),
            f("auditor", "심사원"),
            f("clause", "조항/영역"),
        ],
        sections=[sec("finding", "관찰·부적합 요약"), sec("evidence", "증빙·면담")],
        items=[
            item("a01", "문서·기록 적절", "문서"),
            item("a02", "현장 실행 일치", "실행"),
            item("a03", "교육·역량", "인력"),
            item("a04", "CCP/PRP 운영", "HACCP"),
            item("a05", "시정조치 유효", "개선"),
        ],
        titleKey="subject",
        minChecks=3,
    ),
    base(
        "FR-020", "내부심사 결과보고서", "이슈", ["DKJ-P-07"], "audit",
        extra_fields=[
            f("subject", "심사명 *", required=True),
            f("auditDate", "심사일", "date"),
            f("leadAuditor", "심사팀장"),
            f("ncCount", "부적합건수", "number", default=0),
        ],
        sections=[
            sec("summary", "종합 결과"),
            sec("ncList", "부적합·관찰사항"),
            sec("conclusion", "결론·권고"),
        ],
        titleKey="subject",
    ),
    # --- CAR ---
    base(
        "FR-021", "시정조치 요구서(CAR)", "이슈", ["DKJ-P-09"], "car",
        extra_fields=[
            f("subject", "제목 *", required=True),
            f("source", "발생원", "select", options=["내부심사", "이탈", "고객불만", "기타"], default="이탈"),
            f("dueDate", "조치기한", "date"),
            f("owner", "조치책임자"),
            f("status", "상태", "select", options=["접수", "조치중", "완료", "유효성확인"], default="접수"),
        ],
        sections=[
            sec("problem", "문제·부적합 내용"),
            sec("rootCause", "원인분석"),
            sec("correctivePlan", "시정·예방조치"),
            sec("effectiveness", "유효성 확인"),
        ],
        titleKey="subject",
    ),
    base(
        "FR-022", "시정조치 관리대장", "월간", ["DKJ-P-09"], "car",
        extra_fields=[
            f("subject", "CAR번호/제목 *", required=True),
            f("openDate", "발행일", "date"),
            f("owner", "책임자"),
            f("dueDate", "기한", "date"),
            f("status", "상태", "select", options=["진행", "완료", "지연"], default="진행"),
            f("closeDate", "완료일", "date"),
        ],
        sections=[sec("noteDetail", "진행 현황·비고")],
        titleKey="subject",
    ),
    # --- 경영검토 ---
    base(
        "FR-023", "경영검토 입력자료", "연간", ["DKJ-P-08"], "mgmt",
        extra_fields=[
            f("subject", "검토연도/회차 *", required=True),
            f("period", "대상기간"),
            f("preparedBy", "자료작성"),
        ],
        sections=[
            sec("kpi", "목표·KPI·부적합 현황"),
            sec("audit", "내·외부심사·고객피드백"),
            sec("resource", "자원·변경·개선 필요"),
        ],
        titleKey="subject",
    ),
    base(
        "FR-024", "경영검토 회의록", "연간", ["DKJ-P-08"], "mgmt",
        extra_fields=[
            f("subject", "회의명 *", required=True),
            f("meetDate", "회의일", "date"),
            f("chair", "주재자"),
            f("attendees", "참석자"),
        ],
        sections=[
            sec("agenda", "안건"),
            sec("discussion", "논의내용"),
            sec("decision", "결정·지시사항"),
        ],
        titleKey="subject",
    ),
    base(
        "FR-025", "경영검토 후속조치표", "이슈", ["DKJ-P-08"], "mgmt",
        extra_fields=[
            f("subject", "조치항목 *", required=True),
            f("owner", "책임자"),
            f("dueDate", "기한", "date"),
            f("status", "상태", "select", options=["진행", "완료"], default="진행"),
        ],
        sections=[sec("action", "조치내용"), sec("result", "완료확인")],
        titleKey="subject",
    ),
    # --- 계측 ---
    base(
        "FR-026", "계측기 관리대장", "월간", ["DKJ-P-10"], "calibration",
        extra_fields=[
            f("subject", "계측기명 *", required=True),
            f("assetNo", "관리번호"),
            f("location", "설치위치"),
            f("range", "측정범위"),
            f("calCycle", "교정주기", default="1년"),
            f("nextCal", "차기교정일", "date"),
        ],
        sections=[sec("noteDetail", "상태·비고")],
        titleKey="subject",
    ),
    base(
        "FR-027", "검교정 계획 및 결과표", "이슈", ["DKJ-P-10"], "calibration",
        extra_fields=[
            f("subject", "계측기명 *", required=True),
            f("assetNo", "관리번호"),
            f("calDate", "교정일", "date"),
            f("agency", "교정기관"),
            f("result", "결과", "select", options=["합격", "조정후합격", "불합격"], default="합격"),
            f("certNo", "성적서번호"),
        ],
        sections=[sec("noteDetail", "불확도·조치")],
        items=[
            item("k01", "교정성적서 수령", "결과"),
            item("k02", "라벨 부착", "결과"),
            item("k03", "대장 반영", "결과"),
        ],
        titleKey="subject",
        minChecks=2,
    ),
    # --- 변경·의사소통 ---
    base(
        "FR-028", "변경관리 신청서", "이슈", ["DKJ-P-11"], "change",
        extra_fields=[
            f("subject", "변경제목 *", required=True),
            f("changeType", "변경유형", "select", options=["설비", "원료", "공정", "문서", "기타"], default="공정"),
            f("requestor", "신청자"),
            f("targetDate", "희망시행일", "date"),
        ],
        sections=[sec("current", "현황"), sec("proposed", "변경안"), sec("reason", "사유")],
        titleKey="subject",
    ),
    base(
        "FR-029", "변경 영향평가표", "이슈", ["DKJ-P-11"], "change",
        extra_fields=[
            f("subject", "변경제목 *", required=True),
            f("linkedFr028", "FR-028 연계"),
            f("risk", "리스크등급", "select", options=["낮음", "중간", "높음"], default="중간"),
            f("decision", "판정", "select", options=["승인", "조건부", "반려"], default="승인"),
        ],
        sections=[
            sec("impactHaccp", "HACCP·위생 영향"),
            sec("impactLegal", "법규·고객 영향"),
            sec("mitigation", "완화조치"),
        ],
        items=[
            item("i01", "CCP/한계기준 영향", "영향"),
            item("i02", "알레르겐 영향", "영향"),
            item("i03", "교육·문서 개정 필요", "영향"),
            item("i04", "검증·시험 필요", "영향"),
        ],
        titleKey="subject",
        minChecks=2,
    ),
    base(
        "FR-030", "의사소통 기록대장", "이슈", ["DKJ-P-12"], "communication",
        extra_fields=[
            f("subject", "주제 *", required=True),
            f("channel", "경로", "select", options=["내부", "고객", "관할관청", "공급업체", "기타"], default="내부"),
            f("fromTo", "발신/수신"),
            f("commDate", "일시", "date"),
        ],
        sections=[sec("content", "소통내용"), sec("action", "후속조치")],
        titleKey="subject",
    ),
    # --- 식품방어·사기 ---
    base(
        "FR-031", "식품방어 취약성 평가표", "연간", [], "defense",
        extra_fields=[
            f("subject", "평가대상/연도 *", required=True),
            f("evalDate", "평가일", "date"),
            f("team", "평가팀"),
        ],
        sections=[sec("vuln", "취약점 요약"), sec("priority", "우선순위·조치계획")],
        items=[
            item("d01", "출입통제", "방어"),
            item("d02", "원료·제품 보안", "방어"),
            item("d03", "용수·유틸리티", "방어"),
            item("d04", "IT·기록 보안", "방어"),
            item("d05", "외부인·방문객", "방어"),
        ],
        titleKey="subject",
        minChecks=3,
    ),
    base(
        "FR-032", "식품방어 실행계획서", "연간", [], "defense",
        extra_fields=[
            f("subject", "계획연도 *", required=True),
            f("owner", "책임자"),
        ],
        sections=[sec("plan", "실행계획"), sec("drill", "훈련·점검 일정"), sec("budget", "자원")],
        titleKey="subject",
    ),
    base(
        "FR-033", "식품사기 취약성 평가표", "연간", [], "defense",
        extra_fields=[
            f("subject", "평가대상/연도 *", required=True),
            f("evalDate", "평가일", "date"),
            f("team", "평가팀"),
        ],
        sections=[sec("vuln", "사기 취약점"), sec("mitigation", "완화전략")],
        items=[
            item("f01", "원료 진위·원산지", "사기"),
            item("f02", "공급망 투명성", "사기"),
            item("f03", "시험·성적서 신뢰", "사기"),
            item("f04", "가격·시장 이상신호", "사기"),
        ],
        titleKey="subject",
        minChecks=3,
    ),
    base(
        "FR-034", "식품사기 예방 실행계획서", "연간", [], "defense",
        extra_fields=[
            f("subject", "계획연도 *", required=True),
            f("owner", "책임자"),
        ],
        sections=[sec("plan", "예방·모니터링 계획"), sec("response", "의심시 대응절차")],
        titleKey="subject",
    ),
    # --- 알레르겐 ---
    base(
        "FR-035", "알레르겐 원료 평가표", "이슈", [], "allergen",
        extra_fields=[
            f("subject", "원료/제품명 *", required=True),
            f("allergen", "알레르겐 종류"),
            f("supplier", "공급처"),
            f("risk", "교차오염 위험", "select", options=["낮음", "중간", "높음"], default="중간"),
        ],
        sections=[sec("control", "관리방법"), sec("label", "표시·취급 주의")],
        items=[
            item("al1", "원료 알레르겐 확인", "평가"),
            item("al2", "교차오염 경로 파악", "평가"),
            item("al3", "보관·동선 분리", "평가"),
            item("al4", "표시 적정", "평가"),
        ],
        titleKey="subject",
        minChecks=3,
    ),
    base(
        "FR-036", "알레르겐 전환 세척 점검기록", "이슈", [], "allergen",
        relatedSops=["DKJ-WI-001"],
        extra_fields=[
            f("subject", "전환 품목 *", required=True),
            f("fromTo", "이전→이후 품목"),
            f("line", "라인/구역"),
            f("washDate", "세척일", "date"),
        ],
        sections=[sec("method", "세척·검증 방법"), sec("result", "검증결과")],
        items=[
            item("w01", "잔사 제거 육안", "세척"),
            item("w02", "지정세제·농도", "세척"),
            item("w03", "헹굼 완료", "세척"),
            item("w04", "스왑/검증 적합", "검증"),
        ],
        titleKey="subject",
        minChecks=3,
    ),
    # --- 환경모니터링 ---
    base(
        "FR-037", "환경모니터링 계획서", "연간", ["DKJ-P-16"], "env",
        extra_fields=[
            f("subject", "계획연도 *", required=True),
            f("owner", "책임자"),
            f("lab", "시험기관"),
        ],
        sections=[sec("sites", "채취지점·주기"), sec("criteria", "판정기준·조치")],
        titleKey="subject",
    ),
    base(
        "FR-038", "환경모니터링 결과 및 Trend표", "주간", ["DKJ-P-16"], "env",
        extra_fields=[
            f("subject", "시료/지점 *", required=True),
            f("sampleDate", "채취일", "date"),
            f("zone", "Zone", "select", options=["Zone1", "Zone2", "Zone3", "Zone4"], default="Zone2"),
            f("result", "결과", "select", options=["음성", "양성", "재검"], default="음성"),
            f("value", "수치/균종"),
        ],
        sections=[sec("trend", "Trend·해석"), sec("action", "양성 시 조치")],
        titleKey="subject",
    ),
    # --- 부적합·추적 ---
    base(
        "FR-039", "부적합품관리 기록양식 세트", "이슈", ["DKJ-P-17"], "nonconform",
        extra_fields=[
            f("subject", "품명 *", required=True),
            f("lot", "LOT"),
            f("qty", "수량"),
            f("ncType", "부적합유형"),
            f("disposition", "처리", "select", options=["격리", "재작업", "용도변경", "폐기", "반품"], default="격리"),
        ],
        sections=[sec("detail", "발생내용"), sec("dispose", "처리결과·확인")],
        titleKey="subject",
    ),
    base(
        "FR-040", "추적성 점검 및 모의추적 기록", "연간", ["DKJ-P-18"], "traceability",
        extra_fields=[
            f("subject", "추적대상 *", required=True),
            f("lot", "LOT"),
            f("drillDate", "실시일", "date"),
            f("direction", "방향", "select", options=["전진", "후진", "양방향"], default="양방향"),
            f("minutes", "소요(분)", "number"),
        ],
        sections=[sec("path", "추적 경로·기록"), sec("gap", "갭·개선")],
        items=[
            item("t01", "원료→완제품 연결", "추적"),
            item("t02", "입고·출하 기록", "추적"),
            item("t03", "시간 목표 내 완료", "추적"),
        ],
        titleKey="subject",
        minChecks=2,
    ),
    # --- daily extras FR-041~047 ---
    base(
        "FR-041", "비상상황 발생보고서", "이슈", [], "daily",
        extra_fields=[
            f("subject", "비상유형 *", required=True),
            f("occurDate", "발생일시", "date"),
            f("location", "장소"),
            f("severity", "심각도", "select", options=["낮음", "중간", "높음"], default="중간"),
        ],
        sections=[sec("situation", "상황 설명"), sec("response", "초기대응"), sec("recovery", "복구·재발방지")],
        titleKey="subject",
    ),
    base(
        "FR-042", "고객불만 접수 및 처리기록", "이슈", [], "daily",
        extra_fields=[
            f("subject", "불만요지 *", required=True),
            f("customer", "고객/거래처"),
            f("product", "관련제품·LOT"),
            f("recvDate", "접수일", "date"),
            f("status", "처리상태", "select", options=["접수", "조사중", "완료"], default="접수"),
        ],
        sections=[sec("detail", "불만내용"), sec("investigation", "조사결과"), sec("reply", "회신·보상·시정")],
        titleKey="subject",
    ),
    base(
        "FR-043", "제품 미생물검사 기록지", "이슈", [], "daily",
        extra_fields=[
            f("subject", "제품명 *", required=True),
            f("lot", "LOT"),
            f("testDate", "시험일", "date"),
            f("lab", "시험기관"),
            f("result", "판정", "select", options=["적합", "부적합"], default="적합"),
        ],
        sections=[sec("items", "시험항목·결과수치"), sec("action", "부적합 시 조치")],
        titleKey="subject",
    ),
    base(
        "FR-044", "작업자 위생검사 기록지", "주간", [], "daily",
        extra_fields=[
            f("subject", "성명/조 *", required=True),
            f("testDate", "검사일", "date"),
            f("method", "방법", "select", options=["손스왑", "기타"], default="손스왑"),
            f("result", "결과", "select", options=["적합", "부적합"], default="적합"),
        ],
        sections=[sec("noteDetail", "수치·조치")],
        items=[
            item("h01", "채취 전 손세척", "위생"),
            item("h02", "기준 이내", "위생"),
            item("h03", "부적합 시 재교육", "위생"),
        ],
        titleKey="subject",
        minChecks=2,
    ),
    base(
        "FR-045", "Loss & Waste 관리표", "월간", [], "daily",
        extra_fields=[
            f("subject", "품목/공정 *", required=True),
            f("period", "대상기간"),
            f("lossQty", "Loss량"),
            f("wasteQty", "Waste량"),
            f("unit", "단위", default="kg"),
        ],
        sections=[sec("cause", "원인분석"), sec("improve", "개선대책")],
        titleKey="subject",
    ),
    base(
        "FR-046", "설비 예방보전 계획 및 기록", "월간", [], "daily",
        extra_fields=[
            f("subject", "설비명 *", required=True),
            f("assetNo", "관리번호"),
            f("pmDate", "보전일", "date"),
            f("pmType", "구분", "select", options=["일상", "정기", "긴급"], default="정기"),
            f("result", "결과", "select", options=["정상", "수리필요", "수리완료"], default="정상"),
        ],
        sections=[sec("work", "작업내용"), sec("parts", "부품·소모품")],
        items=[
            item("m01", "외관·이상음", "PM"),
            item("m02", "윤활·체결", "PM"),
            item("m03", "안전장치", "PM"),
            item("m04", "위생상태", "PM"),
        ],
        titleKey="subject",
        minChecks=2,
    ),
    base(
        "FR-047", "식품안전문화 평가표", "연간", [], "daily",
        extra_fields=[
            f("subject", "평가연도 *", required=True),
            f("evalDate", "평가일", "date"),
            f("team", "평가팀"),
        ],
        sections=[sec("summary", "종합의견"), sec("improve", "개선과제")],
        items=[
            item("c01", "리더십·비전 공유", "문화"),
            item("c02", "의사소통·보고 문화", "문화"),
            item("c03", "교육·참여", "문화"),
            item("c04", "현장 실행력", "문화"),
            item("c05", "인정·보상", "문화"),
        ],
        titleKey="subject",
        minChecks=3,
    ),
]


def esc(s: str) -> str:
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def render_field(fld: dict) -> str:
    fid = fld["id"]
    label = esc(fld["label"])
    typ = fld.get("type", "text")
    if typ == "select":
        opts = ""
        for o in fld.get("options", []):
            sel = " selected" if o == fld.get("default") else ""
            opts += f'<option value="{esc(o)}"{sel}>{esc(o)}</option>'
        return f'<div class="dkj-field"><label for="{fid}">{label}</label><select id="{fid}">{opts}</select></div>'
    if typ == "textarea":
        return f'<div class="dkj-field full"><label for="{fid}">{label}</label><textarea id="{fid}" placeholder="{esc(fld.get("placeholder", ""))}"></textarea></div>'
    ph = esc(fld.get("placeholder", ""))
    return f'<div class="dkj-field"><label for="{fid}">{label}</label><input type="{typ}" id="{fid}" placeholder="{ph}"></div>'


def build_print(spec: dict) -> dict:
    meta = []
    for fld in spec.get("fields", []):
        if fld["id"] in ("docDate", "writer", "reviewer", "approver"):
            continue
        meta.append({"key": fld["id"], "label": fld["label"].replace(" *", "")})
    rows = [
        {
            "key": it["key"],
            "group": it.get("group", ""),
            "label": it["label"],
            "hint": it.get("hint", ""),
            "freq": "D",
        }
        for it in spec.get("items", [])
    ]
    sections = [{"id": s["id"], "label": s["label"]} for s in spec.get("sections", [])]
    return {
        "layout": "official-fr-generic",
        "orgName": "동김제농협 가공센터",
        "docNo": spec["code"],
        "title": spec["title"],
        "subtitle": spec.get("subtitle", "FSSC22000 기록양식"),
        "rev": "0",
        "enactDate": "2024. 02. 13",
        "reviseDate": "-",
        "metaFields": meta,
        "rows": rows,
        "sections": sections,
    }


def render_html(spec: dict) -> str:
    code = spec["code"]
    fields_html = "".join(render_field(f) for f in spec.get("fields", []))
    sections_html = ""
    n = 2
    if spec.get("items"):
        sections_html += f"""
    <section class="dkj-panel">
      <h2>② 점검·평가 O/X <span style="font-weight:500;color:#888;font-size:12px;">(O 적합 · X 부적합 · - 해당없음)</span></h2>
      <div class="ox-grid" id="oxGrid"></div>
    </section>"""
        n = 3
    if spec.get("sections"):
        sec_fields = ""
        for s in spec["sections"]:
            sec_fields += (
                f'<div class="dkj-field full"><label for="{s["id"]}">{esc(s["label"])}</label>'
                f'<textarea id="{s["id"]}" placeholder="{esc(s.get("placeholder", ""))}"></textarea></div>'
            )
        sections_html += f"""
    <section class="dkj-panel">
      <h2>{"②" if n == 2 else "③"} 상세 내용</h2>
      <div class="dkj-field-grid">{sec_fields}</div>
    </section>"""
        n += 1
    judge_n = "②" if n == 2 else ("③" if n == 3 else "④")
    hist_n = "③" if n == 2 else ("④" if n == 3 else "⑤")
    footer = "".join(
        f'<a class="link-chip sm" href="{esc(l["href"])}">{esc(l["label"])}</a>'
        for l in spec.get("footerLinks", [])
    )
    header = "".join(
        f'<a class="pill-btn ghost" href="{esc(l["href"])}" style="background:rgba(255,255,255,.15);color:#fff;border-color:rgba(255,255,255,.3);">{esc(l["label"])}</a>'
        for l in spec.get("headerLinks", [])
    )
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#008352">
  <title>{esc(code)} {esc(spec["title"])} | 동김제농협</title>
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
        <h1>{esc(code)} {esc(spec["title"])}</h1>
        <p>{esc(spec.get("subtitle", ""))}</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">{header}</div>
    </div>
  </header>
  <main class="container dkj-form-body">
    <div class="dkj-form-toolbar">
      <div class="dkj-status" id="saveStatus"><span class="dot"></span> 준비</div>
      <button type="button" class="pill-btn green" id="btnSave">저장</button>
      <button type="button" class="pill-btn blue" id="btnLock">작성완료</button>
      <button type="button" class="pill-btn ghost" id="btnNew">새 기록</button>
      <button type="button" class="pill-btn ghost" id="btnPrint">인쇄(정본)</button>
    </div>
    <section class="dkj-panel">
      <h2>① 기본정보</h2>
      <div class="dkj-field-grid">{fields_html}</div>
    </section>
    {sections_html}
    <section class="dkj-panel">
      <h2>{judge_n} 판정·결재</h2>
      <div class="dkj-field-grid">
        <div class="dkj-field full"><label>종합판정</label>
          <div class="judge-row">
            <button type="button" class="judge-btn ok" id="judgeOk" data-judge="적합">✓ 적합/승인</button>
            <button type="button" class="judge-btn ng" id="judgeNg" data-judge="부적합">✕ 부적합/반려</button>
          </div>
        </div>
        <div class="dkj-field full"><label for="corrective">조치·후속</label>
          <textarea id="corrective" placeholder="필요 시 기재"></textarea></div>
        <div class="dkj-field full"><label for="remark">비고</label><textarea id="remark"></textarea></div>
      </div>
      <div class="dkj-link-bar">{footer}</div>
    </section>
    <section class="dkj-panel history"><h2>{hist_n} 최근 저장</h2><div id="historyList"></div></section>
  </main>
  </div>
  <div id="printSheet" class="print-sheet" aria-hidden="true"></div>
  <script src="../js/dkj-record-store.js"></script>
  <script src="../js/dkj-print-official.js"></script>
  <script src="../js/dkj-print-form.js"></script>
  <script src="../js/dkj-fr-form.js"></script>
  <script src="../js/{esc(code)}.js"></script>
</body>
</html>
"""


def render_js(spec: dict) -> str:
    boot = {
        "code": spec["code"],
        "title": spec["title"],
        "pattern": "fr",
        "minChecks": spec.get("minChecks", 0),
        "titleKey": spec.get("titleKey"),
        "historyKeys": spec.get("historyKeys"),
        "fields": spec.get("fields"),
        "items": spec.get("items"),
        "sections": spec.get("sections"),
        "print": spec["print"],
    }
    body = json.dumps(boot, ensure_ascii=False, indent=2)
    return f"""/**
 * {spec["code"]} — generated FR boot
 */
(function () {{
  'use strict';
  DkjFrForm.mount({body});
}})();
"""


def upsert_catalog(spec: dict) -> None:
    cat = json.loads(CATALOG.read_text(encoding="utf-8"))
    code = spec["code"]
    found = False
    for rec in cat.get("records", []):
        if rec.get("code") == code:
            rec["htmlReady"] = True
            rec["htmlPath"] = f"records/{code}.html"
            rec["fileType"] = "html"
            rec["title"] = spec["title"]
            rec["frequency"] = spec.get("frequency", rec.get("frequency"))
            rec["relatedProcedures"] = spec.get("relatedProcedures", [])
            rec["mdrCode"] = spec.get("mdrCode", rec.get("mdrCode"))
            rec["rev"] = "Rev0"
            found = True
            break
    if not found:
        cat.setdefault("records", []).append(
            {
                "id": code,
                "code": code,
                "title": spec["title"],
                "rev": "Rev0",
                "fileType": "html",
                "frequency": spec.get("frequency", "이슈"),
                "relatedProcedures": spec.get("relatedProcedures", []),
                "htmlReady": True,
                "htmlPath": f"records/{code}.html",
                "mdrCode": spec.get("mdrCode", code),
                "sourcePath": "",
            }
        )
    CATALOG.write_text(json.dumps(cat, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    SPEC_DIR.mkdir(parents=True, exist_ok=True)
    PRINT_DIR.mkdir(parents=True, exist_ok=True)
    REC_DIR.mkdir(parents=True, exist_ok=True)
    n = 0
    for spec in SPECS:
        if spec["code"] in SKIP:
            continue
        spec["print"] = build_print(spec)
        (SPEC_DIR / f"{spec['code']}.json").write_text(
            json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        (PRINT_DIR / f"{spec['code']}.json").write_text(
            json.dumps(spec["print"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        (REC_DIR / f"{spec['code']}.html").write_text(render_html(spec), encoding="utf-8")
        (JS_DIR / f"{spec['code']}.js").write_text(render_js(spec), encoding="utf-8")
        upsert_catalog(spec)
        n += 1
        print("OK", spec["code"])
    print(f"DONE {n} FR forms")
    # rebuild bundles
    import subprocess

    subprocess.check_call(["python", str(ROOT / "scripts" / "build-catalog-bundles.py")])


if __name__ == "__main__":
    main()
