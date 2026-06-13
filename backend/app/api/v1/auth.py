"""인증 관련 엔드포인트."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from google.cloud import firestore as fs

from app.middleware.auth import verify_firebase_token
from app.services.firestore import get_db, upsert_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/sync")
async def sync_user(user: dict = Depends(verify_firebase_token)):
    """
    Google 로그인 후 Firestore users 문서를 생성/업데이트합니다.
    프론트엔드는 로그인 직후 이 엔드포인트를 호출합니다.
    """
    uid = user["uid"]
    upsert_user(uid, {
        "email": user.get("email", ""),
        "displayName": user.get("name", ""),
        "photoURL": user.get("picture", ""),
        "lastLoginAt": fs.SERVER_TIMESTAMP,
    })
    # 신규 사용자면 createdAt 설정
    from app.services.firestore import get_user
    existing = get_user(uid)
    if not existing or "createdAt" not in existing:
        upsert_user(uid, {"createdAt": fs.SERVER_TIMESTAMP})

    logger.info("사용자 동기화 완료: uid=%s", uid)
    return {"status": "ok", "uid": uid}
