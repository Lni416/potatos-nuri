import React, { useEffect, useRef } from "react";
import { useNotifications } from "../../contexts/NotificationContext";

interface Props {
  onClose: () => void;
}

export default function NotificationPanel({ onClose }: Props) {
  const { notifications, markRead } = useNotifications();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  function formatTime(ts: { seconds: number }) {
    const date = new Date(ts.seconds * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffH = Math.floor(diffMs / 3600000);
    if (diffH < 1) return "방금 전";
    if (diffH < 24) return `${diffH}시간 전`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}일 전`;
    return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  }

  return (
    <div className="notif-panel" ref={panelRef} role="dialog" aria-label="알림">
      <div className="notif-panel-header">
        <span className="notif-panel-title">알림</span>
        <button className="notif-panel-close" onClick={onClose} aria-label="닫기">✕</button>
      </div>
      <div className="notif-panel-body">
        {notifications.length === 0 ? (
          <p className="notif-empty">새 알림이 없습니다</p>
        ) : (
          <ul className="notif-list">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`notif-item${n.isRead ? " notif-item--read" : ""}`}
                onClick={() => !n.isRead && markRead(n.id)}
              >
                <div className="notif-item-content">
                  <span className="notif-item-title">{n.title}</span>
                  <span className="notif-item-body">{n.body}</span>
                  <span className="notif-item-time">{formatTime(n.createdAt)}</span>
                </div>
                {!n.isRead && <span className="notif-item-dot" aria-hidden="true" />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
