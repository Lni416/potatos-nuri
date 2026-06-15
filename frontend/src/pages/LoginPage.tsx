import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

type View = "login" | "signup" | "forgot";

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, loading } = useAuth();

  const [view, setView] = useState<View>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setError(null);
    setMessage(null);
    setPassword("");
    setConfirmPassword("");
  }

  function switchView(v: View) {
    reset();
    setView(v);
  }

  function friendlyError(code: string): string {
    switch (code) {
      case "auth/user-not-found":
      case "auth/invalid-credential":
        return "이메일 또는 비밀번호가 올바르지 않습니다.";
      case "auth/wrong-password":
        return "비밀번호가 올바르지 않습니다.";
      case "auth/email-already-in-use":
        return "이미 사용 중인 이메일입니다.";
      case "auth/weak-password":
        return "비밀번호는 6자 이상이어야 합니다.";
      case "auth/invalid-email":
        return "올바른 이메일 형식이 아닙니다.";
      case "auth/too-many-requests":
        return "시도 횟수가 너무 많습니다. 잠시 후 다시 시도해 주세요.";
      default:
        return "오류가 발생했습니다. 다시 시도해 주세요.";
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(friendlyError(code));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await signUpWithEmail(email, password, name);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(friendlyError(code));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await resetPassword(email);
      setMessage("재설정 링크를 이메일로 보냈어요. 받은 메일함을 확인해 주세요.");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(friendlyError(code));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code !== "auth/popup-closed-by-user") {
        setError(friendlyError(code));
      }
    }
  }

  const busy = submitting || loading;

  return (
    <div className="auth-bg">
      <div className="auth-card">

        {/* ── 퍼플 헤더 ── */}
        <div className="auth-header">
          <div className="auth-mascot">🐰</div>
          <p className="auth-brand">NuRI</p>
          <p className="auth-tagline">맞춤 복지·행사 정보</p>
        </div>

        {/* ── 탭 (login / signup) ── */}
        {view !== "forgot" && (
          <div className="auth-tabs">
            <button
              className={`auth-tab${view === "login" ? " active" : ""}`}
              onClick={() => switchView("login")}
            >
              로그인
            </button>
            <button
              className={`auth-tab${view === "signup" ? " active" : ""}`}
              onClick={() => switchView("signup")}
            >
              회원가입
            </button>
          </div>
        )}

        {/* ── 본문 ── */}
        <div className="auth-body">

          {/* 로그인 폼 */}
          {view === "login" && (
            <form onSubmit={handleEmailLogin} className="auth-form">
              <div className="auth-field">
                <span className="auth-field-icon">✉️</span>
                <input
                  type="email"
                  placeholder="이메일"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="auth-input"
                />
              </div>
              <div className="auth-field">
                <span className="auth-field-icon">🔒</span>
                <input
                  type="password"
                  placeholder="비밀번호"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="auth-input"
                />
              </div>

              <div className="auth-row">
                <button type="button" className="auth-link" onClick={() => switchView("forgot")}>
                  비밀번호 찾기
                </button>
              </div>

              {error && <p className="auth-error">{error}</p>}

              <button type="submit" className="auth-btn-primary" disabled={busy}>
                {submitting ? "로그인 중..." : "로그인"}
              </button>
            </form>
          )}

          {/* 회원가입 폼 */}
          {view === "signup" && (
            <form onSubmit={handleSignUp} className="auth-form">
              <div className="auth-field">
                <span className="auth-field-icon">👤</span>
                <input
                  type="text"
                  placeholder="이름 (선택)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="auth-input"
                />
              </div>
              <div className="auth-field">
                <span className="auth-field-icon">✉️</span>
                <input
                  type="email"
                  placeholder="이메일"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="auth-input"
                />
              </div>
              <div className="auth-field">
                <span className="auth-field-icon">🔒</span>
                <input
                  type="password"
                  placeholder="비밀번호 (6자 이상)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="auth-input"
                />
              </div>
              <div className="auth-field">
                <span className="auth-field-icon">🔒</span>
                <input
                  type="password"
                  placeholder="비밀번호 확인"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="auth-input"
                />
              </div>

              {error && <p className="auth-error">{error}</p>}

              <button type="submit" className="auth-btn-primary" disabled={busy}>
                {submitting ? "가입 중..." : "회원가입"}
              </button>
            </form>
          )}

          {/* 비밀번호 찾기 */}
          {view === "forgot" && (
            <form onSubmit={handleForgot} className="auth-form">
              <p className="auth-forgot-desc">
                가입한 이메일을 입력하면 재설정 링크를 보내드려요.
              </p>
              <div className="auth-field">
                <span className="auth-field-icon">✉️</span>
                <input
                  type="email"
                  placeholder="이메일"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="auth-input"
                />
              </div>

              {error && <p className="auth-error">{error}</p>}
              {message && <p className="auth-message">{message}</p>}

              <button type="submit" className="auth-btn-primary" disabled={busy}>
                {submitting ? "전송 중..." : "재설정 링크 보내기"}
              </button>
              <button
                type="button"
                className="auth-btn-ghost"
                onClick={() => switchView("login")}
              >
                ← 로그인으로 돌아가기
              </button>
            </form>
          )}

          {/* 소셜 로그인 구분선 */}
          {view !== "forgot" && (
            <>
              <div className="auth-divider">
                <span>또는</span>
              </div>

              <div className="auth-social">
                <button
                  className="auth-social-btn google"
                  onClick={handleGoogle}
                  disabled={busy}
                  type="button"
                >
                  <img
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                    alt="Google"
                    width={20}
                    height={20}
                  />
                  Google로 계속하기
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
