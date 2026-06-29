"""API v1 라우터 — 요약 + 헬스체크 엔드포인트."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from google import genai

from app.middleware.auth import verify_firebase_token
from app.middleware.limiter import limiter
from app.config import get_settings
from app.schemas import SummarizeRequest, SummarizeResponse
from app.services.gemini_search import _model_candidates
from app.services.summarizer import summarize_card
from app.services.recommendation import eval_eligibility
from app.services.firestore import get_welfare_item, set_cached_summary

logger = logging.getLogger(__name__)

# 요약 캐시 신선도 (일)
_CACHE_TTL_DAYS = 7


def _cache_is_fresh(generated_at) -> bool:
    """summaryCache.generatedAt 이 TTL 이내인지."""
    if generated_at is None:
        return False
    if hasattr(generated_at, "tzinfo"):
        dt = generated_at if generated_at.tzinfo else generated_at.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - dt).days < _CACHE_TTL_DAYS
    return False

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
    단일 카드의 비개인화 사실 요약(캐시 우선) + 규칙 기반 자격 안내를 반환합니다.
    카드 클릭 시 프론트엔드에서 호출 (on-demand).
    """
    settings = get_settings()

    # 권위 데이터는 클라이언트 입력이 아니라 Firestore에서 직접 조회
    item = get_welfare_item(body.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="복지 정보를 찾을 수 없습니다.")

    official_url = item.get("sourceUrl", "") or item.get("source_url", "")

    # 1) 캐시 조회 — 신선하면 LLM 호출 없이 반환
    cache = item.get("summaryCache")
    if cache and _cache_is_fresh(cache.get("generatedAt")):
        markdown = cache.get("markdown", "")
        trust_level = cache.get("trustLevel", "medium")
        unverified = cache.get("unverified", [])
        logger.info("요약 캐시 히트: item=%s", body.item_id)
    else:
        # 2) 캐시 미스/만료 — grounding 1회 호출 후 저장
        if not settings.GEMINI_API_KEY:
            raise HTTPException(status_code=503, detail="GEMINI_API_KEY가 설정되지 않았습니다.")
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        models = _model_candidates(settings.GEMINI_SUMMARY_MODEL, [settings.GEMINI_MODEL])

        result = await summarize_card(
            client=client,
            models=models,
            title=item.get("title", ""),
            source_url=official_url,
            raw_text=item.get("rawText", "") or item.get("raw_text", ""),
        )
        markdown = result["markdown"]
        if not markdown:
            raise HTTPException(status_code=500, detail="요약 생성에 실패했습니다.")
        trust_level = result["trust_level"]
        unverified = result["unverified"]
        try:
            set_cached_summary(body.item_id, {
                "markdown": markdown,
                "trustLevel": trust_level,
                "unverified": unverified,
                "generatedAt": datetime.now(timezone.utc),
            })
        except Exception as e:
            logger.warning("요약 캐시 저장 실패: item=%s error=%s", body.item_id, e)

    # 3) 규칙 기반 자격 안내 (LLM 없이, 매 요청 사용자별)
    profile = {
        "age": body.age,
        "regionName": body.region_name,
        "regionCode": body.region_code,
        "occupation": body.occupation,
        "interests": body.interests,
    }
    eligibility = eval_eligibility(profile, item)

    return SummarizeResponse(
        summary=markdown,
        trust_level=trust_level,
        unverified_notes=unverified,
        official_url=official_url,
        eligibility_hint=eligibility,
    )
