"""Firestore 클라이언트 및 CRUD 헬퍼."""

import logging
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_db() -> firestore.Client:
    """Firestore 클라이언트 싱글턴."""
    from app.config import get_settings
    settings = get_settings()
    return firestore.Client(project=settings.FIREBASE_PROJECT_ID)


# ── 사용자 ──────────────────────────────────────────────────────────────────


def get_user(uid: str) -> dict | None:
    db = get_db()
    doc = db.collection("users").document(uid).get()
    return doc.to_dict() if doc.exists else None


def upsert_user(uid: str, data: dict) -> None:
    """사용자 문서를 생성하거나 부분 업데이트합니다."""
    db = get_db()
    db.collection("users").document(uid).set(data, merge=True)


def update_user_profile(uid: str, profile: dict) -> None:
    db = get_db()
    db.collection("users").document(uid).update({
        "profile": profile,
        "profile.profileCompletedAt": firestore.SERVER_TIMESTAMP,
        "lastLoginAt": firestore.SERVER_TIMESTAMP,
    })


# ── 복지 아이템 ────────────────────────────────────────────────────────────


def get_active_welfare_items(limit: int = 100) -> list[dict]:
    """활성 복지 아이템을 최근 순으로 최대 limit개 가져옵니다."""
    db = get_db()
    docs = (
        db.collection("welfare_items")
        .where(filter=FieldFilter("isActive", "==", True))
        .order_by("crawledAt", direction=firestore.Query.DESCENDING)
        .limit(limit)
        .stream()
    )
    return [{"id": d.id, **d.to_dict()} for d in docs]


def get_welfare_item(item_id: str) -> dict | None:
    db = get_db()
    doc = db.collection("welfare_items").document(item_id).get()
    return {"id": doc.id, **doc.to_dict()} if doc.exists else None


def upsert_welfare_item(item_id: str, data: dict) -> None:
    db = get_db()
    db.collection("welfare_items").document(item_id).set(data, merge=True)


def deactivate_expired_items() -> int:
    """만료된 아이템을 비활성화. 비활성화된 건수 반환."""
    db = get_db()
    now = datetime.now(timezone.utc)
    expired = (
        db.collection("welfare_items")
        .where(filter=FieldFilter("isActive", "==", True))
        .where(filter=FieldFilter("expiresAt", "<=", now))
        .stream()
    )
    count = 0
    for doc in expired:
        doc.reference.update({"isActive": False})
        count += 1
    return count


# ── 알림 ───────────────────────────────────────────────────────────────────


def get_user_notifications(uid: str, limit: int = 50) -> list[dict]:
    db = get_db()
    docs = (
        db.collection("user_notifications")
        .where(filter=FieldFilter("userId", "==", uid))
        .order_by("createdAt", direction=firestore.Query.DESCENDING)
        .limit(limit)
        .stream()
    )
    return [{"id": d.id, **d.to_dict()} for d in docs]


def mark_notification_read(notif_id: str, uid: str) -> bool:
    """알림을 읽음 처리. uid 불일치 시 False 반환."""
    db = get_db()
    doc_ref = db.collection("user_notifications").document(notif_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("userId") != uid:
        return False
    doc_ref.update({"isRead": True})
    return True


def write_notification(data: dict) -> str:
    """알림 문서 생성. 생성된 문서 ID 반환."""
    db = get_db()
    _, doc_ref = db.collection("user_notifications").add({
        **data,
        "createdAt": firestore.SERVER_TIMESTAMP,
    })
    return doc_ref.id


def notification_exists(uid: str, welfare_item_id: str, notif_type: str) -> bool:
    """동일한 알림이 이미 존재하는지 확인 (중복 방지)."""
    db = get_db()
    docs = (
        db.collection("user_notifications")
        .where(filter=FieldFilter("userId", "==", uid))
        .where(filter=FieldFilter("welfareItemId", "==", welfare_item_id))
        .where(filter=FieldFilter("type", "==", notif_type))
        .limit(1)
        .stream()
    )
    return any(True for _ in docs)


def get_users_with_interests(interests: list[str]) -> list[dict]:
    """특정 관심분야를 가진 사용자 목록."""
    if not interests:
        return []
    db = get_db()
    docs = (
        db.collection("users")
        .where(filter=FieldFilter("profile.interests", "array_contains_any", interests))
        .stream()
    )
    return [{"uid": d.id, **d.to_dict()} for d in docs]
