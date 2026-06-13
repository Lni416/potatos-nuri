"""인앱 알림 엔드포인트."""

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth import verify_firebase_token
from app.services.firestore import get_user_notifications, mark_notification_read

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(user: dict = Depends(verify_firebase_token)):
    """내 알림 목록 (최근 50건)."""
    uid = user["uid"]
    notifs = get_user_notifications(uid, limit=50)
    unread = sum(1 for n in notifs if not n.get("isRead"))
    return {"notifications": notifs, "unread_count": unread}


@router.patch("/{notif_id}/read")
async def read_notification(
    notif_id: str,
    user: dict = Depends(verify_firebase_token),
):
    """알림 읽음 처리."""
    uid = user["uid"]
    success = mark_notification_read(notif_id, uid)
    if not success:
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없거나 권한이 없습니다.")
    return {"status": "ok"}
