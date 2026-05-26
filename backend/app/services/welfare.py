"""공공데이터포털 — 한국사회보장정보원 중앙부처복지서비스 API 클라이언트."""

import logging
from typing import Any
from xml.etree import ElementTree as ET

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

BASE_URL = "http://apis.data.go.kr/B554287/NationalWelfareInformationsV001"

def _parse_xml_list(xml_text: str) -> list[dict[str, Any]]:
    """복지 API XML 응답에서 목록을 추출."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        logger.error("복지 API XML 파싱 실패: %s", e)
        return []

    result_code = (root.findtext("resultCode") or "").strip()
    result_message = (root.findtext("resultMessage") or "").strip()
    if result_code and result_code != "0":
        logger.error("복지 API 응답 오류: resultCode=%s, resultMessage=%s", result_code, result_message)
        return []

    items: list[dict[str, Any]] = []
    for node in root.findall("servList"):
        item = {
            child.tag: (child.text or "").strip()
            for child in list(node)
        }
        if item:
            items.append(item)
    return items


async def fetch_welfare_list(
    age: int,
    occupation: str = "기타",
    num_of_rows: int = 10,
    page_no: int = 1,
) -> list[dict[str, Any]]:
    """복지서비스 목록 조회."""
    settings = get_settings()
    if not settings.DATA_GO_KR_API_KEY:
        logger.warning("DATA_GO_KR_API_KEY가 설정되지 않았습니다.")
        return []

    params = {
        "serviceKey": settings.DATA_GO_KR_API_KEY,
        "callTp": "L",
        "pageNo": str(page_no),
        "numOfRows": str(num_of_rows),
        "srchKeyCode": "001",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{BASE_URL}/NationalWelfarelistV001",
                params=params,
            )
            resp.raise_for_status()
            content_type = (resp.headers.get("content-type") or "").lower()
            body_text = resp.text

        if "json" in content_type:
            data = resp.json()
            items = (
                data.get("welfareList", [])
                or data.get("response", {}).get("body", {}).get("items", {}).get("item", [])
                or []
            )
            if isinstance(items, dict):
                items = [items]
            return items

        return _parse_xml_list(body_text)

    except httpx.HTTPStatusError as e:
        logger.error("복지 API HTTP 오류: %s", e.response.status_code)
        return []
    except Exception as e:
        logger.error("복지 API 호출 실패: %s", e)
        return []

async def fetch_welfare_detail(service_id: str) -> dict[str, Any]:
    """복지서비스 상세 조회."""
    settings = get_settings()
    if not settings.DATA_GO_KR_API_KEY:
        return {}

    params = {
        "serviceKey": settings.DATA_GO_KR_API_KEY,
        "callTp": "D",
        "servId": service_id,
        "type": "json",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{BASE_URL}/NationalWelfaredetailedV001",
                params=params,
            )
            resp.raise_for_status()
            data = resp.json()

        detail = (
            data.get("welfareInfo", {})
            or data.get("response", {}).get("body", {}).get("items", {}).get("item", {})
            or {}
        )
        return detail if isinstance(detail, dict) else {}

    except Exception as e:
        logger.error("복지 상세 API 호출 실패: %s", e)
        return {}


def format_welfare_for_summary(items: list[dict]) -> list[dict[str, str]]:
    """API 응답 데이터를 요약용 텍스트로 가공."""
    results = []
    for item in items:
        # 다양한 응답 필드명에 대응
        title = (
            item.get("servNm")
            or item.get("wlfareInfoNm")
            or item.get("servDgst", "제목 없음")
        )
        raw_text_parts = []

        field_map = {
            "servDgst": "서비스 요약",
            "intrsThemaArray": "관심 주제",
            "trgterDtlCn": "지원 대상",
            "slctCritCn": "선정 기준",
            "alwServCn": "지원 내용",
            "aplyMtdCn": "신청 방법",
            "servDtlLink": "상세 링크",
            "lifeNmArray": "생애주기",
            "trgterIndvdlNmArray": "대상 특성",
            "jurMnofNm": "소관 부처",
            "jurOrgNm": "담당 기관",
            "bizChrDeptNm": "담당 부서",
            "rprsCtadr": "대표 문의처",
            "inqNum": "문의 전화",
        }

        for key, label in field_map.items():
            val = item.get(key, "")
            if val:
                raw_text_parts.append(f"{label}: {val}")

        raw_text = "\n".join(raw_text_parts) if raw_text_parts else title

        results.append({
            "id": item.get("servId", ""),
            "title": title,
            "raw_text": raw_text,
            "source_name": item.get("bizChrDeptNm", "공공데이터포털"),
            "source_url": item.get("servDtlLink", ""),
        })
    return results
