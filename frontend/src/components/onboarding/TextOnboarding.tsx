import React from "react";
import StepSelector, { FormData } from "./StepSelector";

interface Props {
  onComplete: (data: FormData) => void;
  onBack: (() => void) | null;
}

export default function TextOnboarding({ onComplete, onBack }: Props) {
  return (
    <div className="text-onboarding">
      <div className="ob-mode-bar">
        <span className="ob-mode-current">🖱️ 버튼 선택 중</span>
        {onBack && (
          <button type="button" className="ob-mode-switch-btn" onClick={onBack}>
            🎤 음성으로 선택
          </button>
        )}
      </div>
      <p className="text-ob-guide">항목을 눌러서 선택해 주세요.</p>
      <StepSelector mode="text" onComplete={onComplete} />
    </div>
  );
}
