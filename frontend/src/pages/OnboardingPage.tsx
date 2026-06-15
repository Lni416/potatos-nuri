import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import VoiceOnboarding from "../components/onboarding/VoiceOnboarding";
import TextOnboarding from "../components/onboarding/TextOnboarding";
import { FormData } from "../components/onboarding/StepSelector";
import { updateProfile, UserProfile } from "../utils/api";
import { isSpeechSupported } from "../utils/speechRecognition";

type Mode = "voice" | "text";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("from") === "profile" ? "/profile" : "/feed";
  const [mode, setMode] = useState<Mode>(isSpeechSupported() ? "voice" : "text");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleComplete(data: FormData) {
    setSaving(true);
    setError(null);
    try {
      const profile: UserProfile = {
        age: data.age,
        regionCode: data.region_code,
        regionName: data.region_name,
        occupation: data.occupation,
        interests: data.interests,
      };
      await updateProfile(profile);
      navigate(returnTo, { replace: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
      setSaving(false);
    }
  }

  if (saving) {
    return (
      <div className="onboarding-saving">
        <div className="loading-spinner" />
        <p>정보를 저장하는 중...</p>
      </div>
    );
  }

  return (
    <div className="onboarding-page">
      {error && (
        <div className="onboarding-error" role="alert">
          {error}
          <button onClick={() => setError(null)}>닫기</button>
        </div>
      )}
      {mode === "voice" ? (
        <VoiceOnboarding onComplete={handleComplete} onFallback={() => setMode("text")} />
      ) : (
        <TextOnboarding
          onComplete={handleComplete}
          onBack={isSpeechSupported() ? () => setMode("voice") : null}
        />
      )}
    </div>
  );
}
