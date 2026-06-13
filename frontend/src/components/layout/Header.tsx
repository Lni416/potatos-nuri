import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import NotificationBell from "./NotificationBell";

export default function Header() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  return (
    <header className="app-header">
      <button className="header-logo" onClick={() => navigate("/feed")} aria-label="홈">
        <span className="header-logo-icon">🐰</span>
        <span className="header-logo-text">NuRI</span>
      </button>
      <div className="header-actions">
        <NotificationBell />
        <button
          className="header-profile"
          onClick={() => navigate("/profile")}
          aria-label="프로필"
        >
          {currentUser?.photoURL ? (
            <img
              src={currentUser.photoURL}
              alt={currentUser.displayName ?? "프로필"}
              className="header-profile-img"
              width={32}
              height={32}
            />
          ) : (
            <span className="header-profile-fallback">👤</span>
          )}
        </button>
      </div>
    </header>
  );
}
