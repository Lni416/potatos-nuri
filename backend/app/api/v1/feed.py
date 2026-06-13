"""개인화 피드 엔드포인트."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.middleware.auth import verify_firebase_token
from app.middleware.limiter import limiter
from app.services.firestore import get_active_welfare_items, get_user, get_welfare_item
from app.services.recommendation import rank_items

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/feed", tags=["feed"])


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
        # 프로필 없는 경우 최신 아이템 반환
        items = get_active_welfare_items(limit=limit)
        return {
            "cards": items,
            "total_count": len(items),
            "message": "프로필을 설정하면 더 정확한 추천을 받을 수 있어요!",
            "profile_complete": False,
        }

    raw_items = get_active_welfare_items(limit=100)
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
