/**
 * 텍스트 온보딩 화면 — 클릭 기반 단계 선택 (음성 불가 시 대체 수단).
 */

import { createStepSelector } from './StepSelector.js';

/**
 * @param {{ onComplete: Function, onBack: Function | null }} params
 * @returns {HTMLElement}
 */
export function createTextOnboarding({ onComplete, onBack }) {
  const el = document.createElement('div');
  el.className = 'text-onboarding';

  const guide = document.createElement('p');
  guide.className = 'text-ob-guide';
  guide.textContent = '항목을 눌러서 선택해 주세요.';
  el.appendChild(guide);

  const { el: stepEl } = createStepSelector({ mode: 'text', onComplete });
  el.appendChild(stepEl);

  if (onBack) {
    const backBtn = document.createElement('button');
    backBtn.className = 'ob-link';
    backBtn.textContent = '← 음성으로 다시 선택';
    backBtn.addEventListener('click', onBack);
    el.appendChild(backBtn);
  }

  return el;
}
