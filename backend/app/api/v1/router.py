"""API v1 라우터 — 검색 + 개인화 요약 엔드포인트."""

import logging
import uuid

from fastapi import APIRouter, HTTPException
from google import genai

from app.config import get_settings
from app.schemas import (
    SearchRequest,
    SearchResponse,
    SummaryCard,
    SummarizeRequest,
    SummarizeResponse,
)
from app.services.gemini_search import search_and_summarize, _model_candidates
from app.services.summarizer import summarize_card

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["v1"])


@router.get("/health")
async def health_check():
    """헬스 체크."""
    return {"status": "ok", "service": "NuRI API"}


@router.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    """
    사용자 조건 기반 복지+행사 정보를 Gemini Google Search grounding으로 수집.
    raw_text를 카드에 포함해 반환합니다 (요약은 /summarize에서 on-demand로 처리).
    """
    logger.info(
        "검색 요청: age=%d, region=%s, occupation=%s, interests=%s",
        request.age,
        request.region_name or request.region_code,
        request.occupation,
        request.interests,
    )

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

    cards = [
        SummaryCard(
            id=item.get("id") or str(uuid.uuid4())[:8],
            title=item.get("title", "정보"),
            category=item.get("category", "복지"),
            summary="",
            raw_text=item.get("raw_text", ""),
            source_url=item.get("source_url", ""),
            source_name=item.get("source_name", ""),
            search_region=item.get("search_region", ""),
            is_region_expanded=item.get("is_region_expanded", False),
        )
        for item in results
    ]

    return SearchResponse(
        cards=cards,
        total_count=len(cards),
        message=f"총 {len(cards)}건의 맞춤 정보를 찾았어요! 🎉",
    )


@router.post("/summarize", response_model=SummarizeResponse)
async def summarize(request: SummarizeRequest):
    """
    단일 카드를 사용자 프로필에 맞게 개인화 요약합니다.
    카드 클릭 시 프론트엔드에서 호출 (on-demand).
    """
    settings = get_settings()
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY가 설정되지 않았습니다.")

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    # 요약은 빠른 모델 우선, 실패 시 메인 모델로 폴백
    models = _model_candidates(settings.GEMINI_SUMMARY_MODEL, [settings.GEMINI_MODEL])

    summary = await summarize_card(
        client=client,
        models=models,
        title=request.title,
        raw_text=request.raw_text,
        age=request.age,
        region_name=request.region_name,
        occupation=request.occupation,
        interests=request.interests,
    )

    if not summary:
        raise HTTPException(status_code=500, detail="요약 생성에 실패했습니다.")

    return SummarizeResponse(summary=summary)
