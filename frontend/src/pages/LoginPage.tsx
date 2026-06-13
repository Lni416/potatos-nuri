import React from "react";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { signInWithGoogle, loading } = useAuth();

  return (
    <div className="login-page">
      <div className="login-hero">
        <div className="login-logo">🐰</div>
        <h1 className="login-title">NuRI</h1>
        <p className="login-subtitle">
          나에게 맞는 복지 혜택과<br />지역 행사를 쉽게 찾아드려요
        </p>
        <ul className="login-features">
          <li>🎤 음성으로 간편하게 내 정보 설정</li>
          <li>🏛️ AI가 쉬운 말로 요약해 드려요</li>
          <li>📅 신청 마감일 알림 서비스</li>
        </ul>
        <button
          className="btn btn-google"
          onClick={signInWithGoogle}
          disabled={loading}
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            width={20}
            height={20}
          />
          Google로 시작하기
        </button>
        <p className="login-privacy">
          서비스 이용을 위해 Google 계정으로 로그인합니다.
        </p>
      </div>
    </div>
  );
}
