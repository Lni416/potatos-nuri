/**
 * 음성 온보딩 화면 — 점 구체 애니메이션 + SpeechRecognition + StepSelector.
 * 음성인식이 UI 인터랙션의 주된 방식이며, 클릭은 보조 수단.
 */

import { createRecognizer, isSpeechSupported } from '../utils/speechRecognition.js';
import { createAudioAnalyser } from '../utils/audioAnalyser.js';
import { createStepSelector } from './StepSelector.js';

const SPHERE_SIZE = 160;
const DOT_COUNT = 160;

function fibonacciSphere(n) {
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    pts.push([Math.cos(theta) * r, y, Math.sin(theta) * r]);
  }
  return pts;
}

function createDotSphere(canvas) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = SPHERE_SIZE * dpr;
  canvas.height = SPHERE_SIZE * dpr;
  canvas.style.width = SPHERE_SIZE + 'px';
  canvas.style.height = SPHERE_SIZE + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const dots = fibonacciSphere(DOT_COUNT);
  const BASE_R = 66;
  let angle = 0;
  let displayR = BASE_R;
  let volume = 0;
  let raf = null;

  // 라이트 배경에서 보이도록 인디고 계열 색상 사용
  function dotColor(alpha) {
    return `rgba(99,102,241,${alpha.toFixed(2)})`;
  }

  function draw(t) {
    const W = SPHERE_SIZE;
    const H = SPHERE_SIZE;
    ctx.clearRect(0, 0, W, H);

    const pulse = Math.sin(t / 900) * 0.04;
    const targetR = BASE_R * (1 + pulse + volume * 0.9);
    displayR += (targetR - displayR) * 0.12;

    angle += 0.006;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const projected = dots
      .map(([x, y, z]) => ({
        px: x * cosA + z * sinA,
        py: y,
        pz: -x * sinA + z * cosA,
      }))
      .sort((a, b) => a.pz - b.pz);

    const cx = W / 2;
    const cy = H / 2;

    for (const { px, py, pz } of projected) {
      const sx = cx + px * displayR;
      const sy = cy + py * displayR;
      const depth = (pz + 1) / 2;
      const size = 1.0 + depth * 2.0;
      const alpha = 0.2 + depth * 0.8;

      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fillStyle = dotColor(alpha);
      ctx.fill();
    }
  }

  function loop(t) {
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  return {
    start() { raf = requestAnimationFrame(loop); },
    stop()  { if (raf) { cancelAnimationFrame(raf); raf = null; } },
    setVolume(v) { volume = v; },
  };
}

/**
 * @param {{ onComplete: Function, onFallback: Function }} params
 * @returns {HTMLElement}
 */
export function createVoiceOnboarding({ onComplete, onFallback }) {
  const el = document.createElement('div');
  el.className = 'voice-onboarding';

  // 모드 전환 바 (상단)
  const modeBar = document.createElement('div');
  modeBar.className = 'ob-mode-bar';
  modeBar.innerHTML = `
    <span class="ob-mode-current">🎤 음성 선택 중</span>
    <button type="button" class="ob-mode-switch-btn">📝 전체 폼으로 입력</button>
  `;
  modeBar.querySelector('.ob-mode-switch-btn').addEventListener('click', onFallback);
  el.appendChild(modeBar);

  // 제목
  const titleEl = document.createElement('p');
  titleEl.className = 'voice-onboarding-title';
  titleEl.textContent = '말씀해 주세요 🎤';
  el.appendChild(titleEl);

  // 구 캔버스
  const canvas = document.createElement('canvas');
  canvas.className = 'sphere-canvas';
  const sphereWrap = document.createElement('div');
  sphereWrap.className = 'sphere-wrap';
  sphereWrap.appendChild(canvas);
  el.appendChild(sphereWrap);

  // 상태 뱃지
  const statusBadge = document.createElement('div');
  statusBadge.className = 'voice-status-badge';
  statusBadge.innerHTML = `<span class="voice-pulse"></span> 듣고 있어요`;
  el.appendChild(statusBadge);

  // 인식 텍스트
  const transcriptEl = document.createElement('div');
  transcriptEl.className = 'voice-transcript';
  transcriptEl.setAttribute('aria-live', 'polite');
  transcriptEl.textContent = '말씀하시면 자동으로 선택됩니다';
  el.appendChild(transcriptEl);

  // 단계 선택기
  const { el: stepEl, handleTranscript } = createStepSelector({
    mode: 'voice',
    onComplete,
  });
  el.appendChild(stepEl);


  // 상태
  let sphere = null;
  let analyser = null;
  let recognizer = null;
  let volRaf = null;
  let restartTimer = null;

  function setListening(active) {
    statusBadge.className = 'voice-status-badge' + (active ? ' listening' : '');
    statusBadge.innerHTML = active
      ? `<span class="voice-pulse"></span> 듣고 있어요`
      : `<span class="voice-pulse"></span> 잠시 멈춤`;
  }

  function startVolumePoll() {
    function poll() {
      if (analyser) sphere?.setVolume(analyser.getVolume());
      volRaf = requestAnimationFrame(poll);
    }
    volRaf = requestAnimationFrame(poll);
  }

  function startRecognition() {
    recognizer = createRecognizer({
      onInterim(text) {
        transcriptEl.textContent = text || '말씀하시면 자동으로 선택됩니다';
        setListening(true);
      },
      onFinal(text) {
        transcriptEl.textContent = text;
        handleTranscript(text);
      },
      onError(err) {
        if (err === 'no-speech' || err === 'audio-capture') return;
        transcriptEl.textContent = '인식에 실패했어요. 다시 말씀해 주세요.';
      },
      onEnd() {
        setListening(false);
        clearTimeout(restartTimer);
        restartTimer = setTimeout(() => {
          transcriptEl.textContent = '말씀하시면 자동으로 선택됩니다';
          setListening(true);
          recognizer?.start();
        }, 300);
      },
    });
    recognizer?.start();
    setListening(true);
  }

  async function init() {
    if (!isSpeechSupported()) {
      transcriptEl.textContent = '이 브라우저는 음성 인식을 지원하지 않아요.';
      setTimeout(onFallback, 1800);
      return;
    }

    sphere = createDotSphere(canvas);
    sphere.start();

    try {
      analyser = await createAudioAnalyser();
      startVolumePoll();
    } catch {
      transcriptEl.textContent = '마이크 권한이 필요해요. 버튼으로 선택하는 방식으로 전환합니다.';
      setTimeout(onFallback, 1800);
      return;
    }

    startRecognition();
  }

  function destroy() {
    clearTimeout(restartTimer);
    recognizer?.stop();
    recognizer?.abort();
    if (volRaf) cancelAnimationFrame(volRaf);
    sphere?.stop();
    analyser?.stop();
  }

  el._destroy = destroy;
  init();
  return el;
}
