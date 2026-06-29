"""개인화 피드 엔드포인트."""

import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request

from app.middleware.auth import verify_firebase_token
from app.middleware.limiter import limiter
from app.services.firestore import get_active_welfare_items, get_user, get_welfare_item
from app.services.recommendation import rank_items

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/feed", tags=["feed"])


def _not_expired(item: dict) -> bool:
    """신청 마감이 지나지 않은 아이템만 통과. 마감일 없으면 항상 통과."""
    deadline = item.get("applyDeadline")
    if not deadline or not hasattr(deadline, "tzinfo"):
        return True
    dt = deadline if deadline.tzinfo else deadline.replace(tzinfo=timezone.utc)
    return dt > datetime.now(timezone.utc)


@router.get("")
@limiter.limit("60/minute")
async def get_feed(
    request: Request,
    limit: int = Query(20, ge=1, le=50),
    user: dict = Depends(verify_firebase_token),
):
    """
    사용자 프로필 기반 개인화 피드.
    Firestore에서 최대 100개 아이템을 불러와 추천 점수로 정렬 후 반환.
    """
    uid = user["uid"]
    user_data = get_user(uid)
    profile = (user_data or {}).get("profile", {})

    if not profile:
        # 프로필 없는 경우 최신 아이템 반환 (만료 공고 제외)
        items = [it for it in get_active_welfare_items(limit=100) if _not_expired(it)][:limit]
        return {
            "cards": items,
            "total_count": len(items),
            "message": "프로필을 설정하면 더 정확한 추천을 받을 수 있어요!",
            "profile_complete": False,
        }

    # 만료 공고는 랭킹·카운트 전에 제외 → 메시지 개수와 실제 카드 수 일치
    raw_items = [it for it in get_active_welfare_items(limit=100) if _not_expired(it)]
    if not raw_items:
        return {
            "cards": [],
            "total_count": 0,
            "message": "현재 표시할 복지 정보를 준비 중이에요. 잠시 후 다시 확인해 주세요.",
            "profile_complete": True,
        }

    ranked = rank_items(raw_items, profile, top_n=limit)
    welfare = [c for c in ranked if c.get("category") == "복지"]
    events = [c for c in ranked if c.get("category") == "행사"]

    logger.info("피드 반환: uid=%s 복지=%d 행사=%d", uid, len(welfare), len(events))

    return {
        "cards": ranked,
        "welfare_count": len(welfare),
        "event_count": len(events),
        "total_count": len(ranked),
        "message": f"총 {len(ranked)}건의 맞춤 정보를 찾았어요! 🎉",
        "profile_complete": True,
    }


async def _crawl_background() -> None:
    """백그라운드 크롤링 실행 (응답 반환 후 실행)."""
    try:
        from app.services.crawler.pipeline import run_crawl_pipeline
        result = await run_crawl_pipeline()
        logger.info("백그라운드 크롤링 완료: %s", result)
    except Exception as e:
        logger.error("백그라운드 크롤링 실패: %s", e)


@router.post("/refresh")
@limiter.limit("2/hour")
async def refresh_feed(
    request: Request,
    background_tasks: BackgroundTasks,
    user: dict = Depends(verify_firebase_token),
):
    """피드가 비어있을 때 데이터 수집 수동 트리거. 즉시 반환 후 백그라운드에서 크롤링."""
    background_tasks.add_task(_crawl_background)
    return {
        "status": "collecting",
        "message": "데이터를 수집 중이에요. 1~2분 후 새로고침해 주세요.",
    }


@router.get("/{item_id}")
async def get_feed_item(
    item_id: str,
    user: dict = Depends(verify_firebase_token),
):
    """단일 복지 아이템 상세 조회."""
    item = get_welfare_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="해당 복지 정보를 찾을 수 없습니다.")
    return item
