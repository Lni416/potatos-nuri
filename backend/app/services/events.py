"""공공데이터포털 — 한국관광공사 TourAPI 지역 행사/축제 정보 클라이언트."""

import logging
from datetime import datetime
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

BASE_URL = "https://apis.data.go.kr/B551011/KorService2"

# ── 시/도 → TourAPI areaCode 매핑 ──
AREA_CODE_MAP: dict[str, str] = {
    "서울": "1",
    "인천": "2",
    "대전": "3",
    "대구": "4",
    "광주": "5",
    "부산": "6",
    "울산": "7",
    "세종": "8",
    "경기": "31",
    "강원": "32",
    "충북": "33",
    "충남": "34",
    "경북": "35",
    "경남": "36",
    "전북": "37",
    "전남": "38",
    "제주": "39",
}

def _resolve_area_code(region_code: str) -> str:
    """사용자 입력 지역명 또는 코드를 TourAPI areaCode로 변환."""
    # 이미 숫자형 코드인 경우
    if region_code.isdigit():
        return region_code
    # 지역명 매칭
    for name, code in AREA_CODE_MAP.items():
        if name in region_code:
            return code
    return "1"  # 기본: 서울


async def fetch_events(
    region_code: str,
    num_of_rows: int = 10,
    page_no: int = 1,
) -> list[dict[str, Any]]:
    """지역 행사/축제 정보 목록 조회."""
    settings = get_settings()
    if not settings.DATA_GO_KR_API_KEY:
        logger.warning("DATA_GO_KR_API_KEY가 설정되지 않았습니다.")
        return []

    area_code = _resolve_area_code(region_code)
    def _build_params(event_start_date: str) -> dict[str, str]:
        return {
            "serviceKey": settings.DATA_GO_KR_API_KEY,
            "numOfRows": str(num_of_rows),
            "pageNo": str(page_no),
            "MobileOS": "ETC",
            "MobileApp": "NuRI",
            "areaCode": area_code,
            "eventStartDate": event_start_date,
            "arrange": "C",  # 수정일순
            "_type": "json",
        }

    async def _request_with_date(event_start_date: str) -> list[dict[str, Any]]:
        params = _build_params(event_start_date)
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{BASE_URL}/searchFestival2",
                params=params,
            )
        resp.raise_for_status()
        data = resp.json()

        response_data = data.get("response", {})
        header = response_data.get("header", {})
        result_code = str(header.get("resultCode", ""))
        if result_code and result_code != "0000":
            logger.error(
                "행사 API 응답 오류: resultCode=%s, resultMsg=%s",
                result_code,
                header.get("resultMsg", ""),
            )
            return []

        body = response_data.get("body", {})
        items = body.get("items", {})
        if not items or items == "":
            return []

        item_list = items.get("item", [])
        if isinstance(item_list, dict):
            item_list = [item_list]
        return item_list

    def _filter_not_ended(items: list[dict[str, Any]], today_yyyymmdd: str) -> list[dict[str, Any]]:
        filtered: list[dict[str, Any]] = []
        for item in items:
            end_date = str(item.get("eventenddate", "")).strip()
            if end_date and end_date >= today_yyyymmdd:
                filtered.append(item)
        return filtered

    try:
        today = datetime.now().strftime("%Y%m%d")
        item_list = _filter_not_ended(await _request_with_date(today), today)
        if item_list:
            return item_list

        # 오늘 시작 기준으로 비어있을 때만 넓은 기간으로 재조회하되,
        # 종료된 축제(이미 지난 행사)는 반드시 제외한다.
        fallback_items = await _request_with_date("20240101")
        return _filter_not_ended(fallback_items, today)

    except httpx.HTTPStatusError as e:
        logger.error("행사 API HTTP 오류: %s", e.response.status_code)
        return []
    except Exception as e:
        logger.error("행사 API 호출 실패: %s", e)
        return []


def format_events_for_summary(items: list[dict]) -> list[dict[str, str]]:
    """행사 API 응답을 요약용 텍스트로 가공."""
    results = []
    for item in items:
        title = item.get("title", "행사 정보")
        raw_parts = []

        field_map = {
            "title": "행사명",
            "addr1": "장소",
            "addr2": "상세주소",
            "tel": "연락처",
            "eventstartdate": "시작일",
            "eventenddate": "종료일",
            "overview": "개요",
            "sponsor1": "주최",
            "sponsor2": "주관",
            "subevent": "부대행사",
            "usetimefestival": "이용시간",
            "playtime": "공연시간",
            "program": "프로그램",
        }

        for key, label in field_map.items():
            val = item.get(key, "")
            if val:
                raw_parts.append(f"{label}: {val}")

        raw_text = "\n".join(raw_parts) if raw_parts else str(item)

        results.append({
            "id": item.get("contentid", ""),
            "title": title,
            "raw_text": raw_text,
            "source_name": "한국관광공사",
            "source_url": f"https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid={item.get('contentid', '')}",
        })
    return results
