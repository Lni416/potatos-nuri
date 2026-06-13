import React, { useState } from "react";
import { useNotifications } from "../../contexts/NotificationContext";
import NotificationPanel from "./NotificationPanel";

export default function NotificationBell() {
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="notif-bell"
        aria-label={`알림 ${unreadCount > 0 ? `${unreadCount}개 읽지 않음` : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        🔔
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>
      {open && <NotificationPanel onClose={() => setOpen(false)} />}
    </>
  );
}
