"""사용자 프로필 엔드포인트."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.middleware.auth import verify_firebase_token
from app.services.firestore import get_user, update_user_profile, upsert_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/users", tags=["users"])


class UserProfile(BaseModel):
    age: int = Field(..., ge=0, le=120)
    regionCode: str = Field("", description="지역 코드 (예: 서울, 경기)")
    regionName: str = Field("", description="상세 지역명 (예: 서울특별시 강남구)")
    occupation: str = Field("other")
    interests: list[str] = Field(default_factory=list)


@router.get("/me")
async def get_my_profile(user: dict = Depends(verify_firebase_token)):
    """내 프로필 조회."""
    data = get_user(user["uid"])
    if not data:
        return {"uid": user["uid"], "profile": None}
    return {"uid": user["uid"], **data}


@router.put("/me/profile")
async def update_my_profile(
    profile: UserProfile,
    user: dict = Depends(verify_firebase_token),
):
    """프로필 수정. 최초 저장 시 profileCompletedAt이 설정됩니다."""
    uid = user["uid"]
    from google.cloud import firestore as fs

    profile_dict = profile.model_dump()

    existing = get_user(uid)
    if existing and existing.get("profile", {}).get("profileCompletedAt"):
        # 이미 완성된 프로필 업데이트
        from app.services.firestore import get_db
        db = get_db()
        db.collection("users").document(uid).update({
            "profile": {**profile_dict, "profileCompletedAt": existing["profile"]["profileCompletedAt"]},
        })
    else:
        # 최초 프로필 완성
        profile_dict["profileCompletedAt"] = fs.SERVER_TIMESTAMP
        upsert_user(uid, {"profile": profile_dict})

    logger.info("프로필 업데이트: uid=%s age=%d region=%s", uid, profile.age, profile.regionName)
    return {"status": "ok", "profile": profile.model_dump()}
