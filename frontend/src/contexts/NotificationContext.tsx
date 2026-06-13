import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { useAuth } from "./AuthContext";
import { Notification, markNotificationRead } from "../utils/api";

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, "user_notifications"),
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifs = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Notification, "id">),
        }));
        setNotifications(notifs);
      },
      (err) => {
        console.warn("Notification listener error:", err);
      }
    );

    return unsubscribe;
  }, [currentUser]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  async function markRead(id: string) {
    try {
      await markNotificationRead(id);
    } catch (e) {
      console.warn("markRead 실패:", e);
    }
  }

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
