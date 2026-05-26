"""API v1 라우터 — 검색 엔드포인트.

Gemini 기반 통합 검색·요약 서비스를 사용합니다.
공공데이터포털 API가 정상화되면 기존 방식으로 전환할 수 있습니다.
"""

import logging
import uuid

from fastapi import APIRouter

from app.schemas import SearchRequest, SearchResponse, SummaryCard
from app.services.gemini_search import search_and_summarize

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["v1"])


@router.get("/health")
async def health_check():
    """헬스 체크."""
    return {"status": "ok", "service": "NuRI API"}


@router.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    """
    사용자 조건 기반 복지+행사 정보를 Gemini로 조사·요약하여 카드 형태로 응답.
    """
    logger.info(
        "검색 요청: age=%d, region=%s, occupation=%s, interests=%s",
        request.age, request.region_name or request.region_code,
        request.occupation, request.interests,
    )

    # Gemini 통합 검색·요약
    results = await search_and_summarize(
        age=request.age,
        region_name=request.region_name or request.region_code,
        occupation=request.occupation,
        interests=request.interests,
    )

    if not results:
        return SearchResponse(
            cards=[],
            total_count=0,
            message="조건에 맞는 정보를 찾지 못했어요. 잠시 후 다시 시도해 주세요!",
        )

    # 카드 생성
    cards = []
    for item in results:
        card = SummaryCard(
            id=item.get("id") or str(uuid.uuid4())[:8],
            title=item.get("title", "정보"),
            category=item.get("category", "복지"),
            summary=item.get("summary", ""),
            original_text="",
            source_url=item.get("source_url", ""),
            source_name=item.get("source_name", ""),
        )
        cards.append(card)

    return SearchResponse(
        cards=cards,
        total_count=len(cards),
        message=f"총 {len(cards)}건의 맞춤 정보를 찾았어요! 🎉",
    )
