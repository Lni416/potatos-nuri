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

  // 모드 전환 바 (상단)
  const modeBar = document.createElement('div');
  modeBar.className = 'ob-mode-bar';
  if (onBack) {
    modeBar.innerHTML = `
      <span class="ob-mode-current">🖱️ 버튼 선택 중</span>
      <button type="button" class="ob-mode-switch-btn">🎤 음성으로 선택</button>
    `;
    modeBar.querySelector('.ob-mode-switch-btn').addEventListener('click', onBack);
  } else {
    modeBar.innerHTML = `<span class="ob-mode-current">🖱️ 버튼으로 선택</span>`;
  }
  el.appendChild(modeBar);

  const guide = document.createElement('p');
  guide.className = 'text-ob-guide';
  guide.textContent = '항목을 눌러서 선택해 주세요.';
  el.appendChild(guide);

  const { el: stepEl } = createStepSelector({ mode: 'text', onComplete });
  el.appendChild(stepEl);

  return el;
}
