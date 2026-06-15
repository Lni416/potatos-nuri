"""API v1 라우터 — 요약 + 헬스체크 엔드포인트."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from google import genai

from app.middleware.auth import verify_firebase_token
from app.middleware.limiter import limiter
from app.config import get_settings
from app.schemas import SummarizeRequest, SummarizeResponse
from app.services.gemini_search import _model_candidates
from app.services.summarizer import summarize_card

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["v1"])


@router.get("/health")
async def health_check():
    """헬스 체크."""
    return {"status": "ok", "service": "NuRI API"}


@router.post("/search")
async def search_gone():
    """이 엔드포인트는 제거되었습니다. /api/v1/feed 를 사용하세요."""
    raise HTTPException(status_code=410, detail="/api/v1/search 는 제거되었습니다. GET /api/v1/feed 를 사용하세요.")


@router.post("/internal/crawl")
async def trigger_crawl(user: dict = Depends(verify_firebase_token)):
    """관리자 전용: 크롤링 수동 트리거."""
    from app.middleware.auth import verify_admin_token
    from app.services.crawler.pipeline import run_crawl_pipeline
    settings = get_settings()
    if user.get("uid") not in (settings.ADMIN_UIDS or []):
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
    result = await run_crawl_pipeline()
    return result


@router.post("/summarize", response_model=SummarizeResponse)
@limiter.limit("20/minute")
async def summarize(
    request: Request,
    body: SummarizeRequest,
    user: dict = Depends(verify_firebase_token),
):
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
        title=body.title,
        raw_text=body.raw_text,
        age=body.age,
        region_name=body.region_name,
        occupation=body.occupation,
        interests=body.interests,
    )

    if not summary:
        raise HTTPException(status_code=500, detail="요약 생성에 실패했습니다.")

    return SummarizeResponse(summary=summary)
