"""인앱 알림 엔드포인트."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request

from app.middleware.auth import verify_firebase_token
from app.middleware.limiter import limiter
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


@router.post("/dispatch")
async def dispatch_notifications(request: Request):
    """
    Cloud Scheduler 전용: 마감 D-1/3/7 알림 자동 발송.
    OIDC 토큰으로 Cloud Scheduler가 호출 (일반 사용자 접근 불가).
    """
    from app.jobs.notifications import dispatch_deadline_notifications
    try:
        count = dispatch_deadline_notifications()
        return {"status": "ok", "notifications_created": count}
    except Exception as e:
        logger.error("알림 dispatch 오류: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
