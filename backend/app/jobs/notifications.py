"""마감 알림 dispatch 잡 — Cloud Run Job 또는 로컬 실행."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

import firebase_admin
from firebase_admin import credentials
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

DEADLINE_DAYS = [1, 3, 7]  # D-1, D-3, D-7 알림


def dispatch_deadline_notifications() -> int:
    """마감이 임박한 복지 서비스에 대해 관련 사용자에게 알림을 생성합니다."""
    from app.services.firestore import (
        get_db,
        get_users_with_interests,
        notification_exists,
        write_notification,
    )

    db = get_db()
    now = datetime.now(timezone.utc)
    total_written = 0

    for days_left in DEADLINE_DAYS:
        target_date = now + timedelta(days=days_left)
        day_start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)

        try:
            items = (
                db.collection("welfare_items")
                .where(filter=FieldFilter("isActive", "==", True))
                .where(filter=FieldFilter("applyDeadline", ">=", day_start))
                .where(filter=FieldFilter("applyDeadline", "<=", day_end))
                .stream()
            )

            for item_doc in items:
                item = item_doc.to_dict()
                item_id = item_doc.id
                item_interests = item.get("targetInterests", [])

                if not item_interests:
                    continue

                # 관심분야 일치 사용자 조회
                users = get_users_with_interests(item_interests)
                for user in users:
                    uid = user["uid"]
                    notif_type = f"deadline_d{days_left}"

                    if notification_exists(uid, item_id, notif_type):
                        continue

                    expiry = now + timedelta(days=30)
                    write_notification({
                        "userId": uid,
                        "type": "deadline_reminder",
                        "welfareItemId": item_id,
                        "title": f"📅 마감 D-{days_left}: {item.get('title', '')}",
                        "body": f"신청 마감이 {days_left}일 남았어요. 지금 확인해 보세요!",
                        "isRead": False,
                        "expiresAt": expiry,
                        "_notifType": notif_type,
                    })
                    total_written += 1
                    logger.debug("알림 생성: uid=%s item=%s D-%d", uid, item_id, days_left)

        except Exception as e:
            logger.error("D-%d 알림 dispatch 오류: %s", days_left, e)

    logger.info("알림 dispatch 완료: %d건 생성", total_written)
    return total_written


async def main() -> None:
    if not firebase_admin._apps:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin 초기화 완료")

    logger.info("=== 마감 알림 dispatch 시작 ===")
    count = dispatch_deadline_notifications()
    logger.info("=== dispatch 완료: %d건 ===", count)


if __name__ == "__main__":
    asyncio.run(main())
