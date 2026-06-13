import React, { useEffect, useRef, useCallback } from "react";
import StepSelector, { FormData, StepSelectorHandle } from "./StepSelector";
import { isSpeechSupported, createRecognizer } from "../../utils/speechRecognition";
import { createAudioAnalyser } from "../../utils/audioAnalyser";

const SPHERE_SIZE = 160;
const DOT_COUNT = 160;

function fibonacciSphere(n: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    pts.push([Math.cos(theta) * r, y, Math.sin(theta) * r]);
  }
  return pts;
}

interface Props {
  onComplete: (data: FormData) => void;
  onFallback: () => void;
}

export default function VoiceOnboarding({ onComplete, onFallback }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const stepSelectorRef = useRef<StepSelectorHandle>(null);

  const setListening = useCallback((active: boolean) => {
    if (!statusRef.current) return;
    statusRef.current.className = "voice-status-badge" + (active ? " listening" : "");
    statusRef.current.innerHTML = active
      ? `<span class="voice-pulse"></span> 듣고 있어요`
      : `<span class="voice-pulse"></span> 잠시 멈춤`;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dots = fibonacciSphere(DOT_COUNT);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SPHERE_SIZE * dpr;
    canvas.height = SPHERE_SIZE * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    const BASE_R = 66;
    let angle = 0;
    let displayR = BASE_R;
    let volume = 0;
    let raf: number | null = null;

    function draw(t: number) {
      const pulse = Math.sin(t / 900) * 0.04;
      const targetR = BASE_R * (1 + pulse + volume * 0.9);
      displayR += (targetR - displayR) * 0.12;
      angle += 0.006;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      ctx.clearRect(0, 0, SPHERE_SIZE, SPHERE_SIZE);
      const cx = SPHERE_SIZE / 2;
      const cy = SPHERE_SIZE / 2;

      [...dots]
        .map(([x, y, z]) => ({ px: x * cosA + z * sinA, py: y, pz: -x * sinA + z * cosA }))
        .sort((a, b) => a.pz - b.pz)
        .forEach(({ px, py, pz }) => {
          const depth = (pz + 1) / 2;
          ctx.beginPath();
          ctx.arc(cx + px * displayR, cy + py * displayR, 1 + depth * 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(99,102,241,${(0.2 + depth * 0.8).toFixed(2)})`;
          ctx.fill();
        });
    }

    function loop(t: number) { draw(t); raf = requestAnimationFrame(loop); }
    raf = requestAnimationFrame(loop);

    let analyser: ReturnType<typeof createAudioAnalyser> extends Promise<infer T> ? T : never;
    let recognizer: ReturnType<typeof createRecognizer>;
    let volRaf: number | null = null;
    let restartTimer: ReturnType<typeof setTimeout>;

    async function init() {
      if (!isSpeechSupported()) {
        if (transcriptRef.current) transcriptRef.current.textContent = "이 브라우저는 음성 인식을 지원하지 않아요.";
        setTimeout(onFallback, 1800);
        return;
      }

      try {
        analyser = await createAudioAnalyser();
        function pollVol() {
          volume = analyser?.getVolume?.() ?? 0;
          volRaf = requestAnimationFrame(pollVol);
        }
        volRaf = requestAnimationFrame(pollVol);
      } catch {
        if (transcriptRef.current) transcriptRef.current.textContent = "마이크 권한이 필요해요. 버튼으로 선택하는 방식으로 전환합니다.";
        setTimeout(onFallback, 1800);
        return;
      }

      recognizer = createRecognizer({
        onInterim(text: string) {
          if (transcriptRef.current) transcriptRef.current.textContent = text || "말씀하시면 자동으로 선택됩니다";
          setListening(true);
        },
        onFinal(text: string) {
          if (transcriptRef.current) transcriptRef.current.textContent = text;
          stepSelectorRef.current?.handleTranscript(text);
        },
        onError(err: string) {
          if (err === "no-speech" || err === "audio-capture") return;
          if (transcriptRef.current) transcriptRef.current.textContent = "인식에 실패했어요. 다시 말씀해 주세요.";
        },
        onEnd() {
          setListening(false);
          clearTimeout(restartTimer);
          restartTimer = setTimeout(() => {
            if (transcriptRef.current) transcriptRef.current.textContent = "말씀하시면 자동으로 선택됩니다";
            setListening(true);
            recognizer?.start?.();
          }, 300);
        },
      });
      recognizer?.start?.();
      setListening(true);
    }

    init();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (volRaf) cancelAnimationFrame(volRaf);
      clearTimeout(restartTimer!);
      recognizer?.stop?.();
      recognizer?.abort?.();
      analyser?.stop?.();
    };
  }, [onFallback, setListening]);

  return (
    <div className="voice-onboarding">
      <div className="ob-mode-bar">
        <span className="ob-mode-current">🎤 음성 선택 중</span>
        <button type="button" className="ob-mode-switch-btn" onClick={onFallback}>
          📝 전체 폼으로 입력
        </button>
      </div>

      <p className="voice-onboarding-title">말씀해 주세요 🎤</p>

      <div className="sphere-wrap">
        <canvas ref={canvasRef} className="sphere-canvas" style={{ width: SPHERE_SIZE, height: SPHERE_SIZE }} />
      </div>

      <div ref={statusRef} className="voice-status-badge listening">
        <span className="voice-pulse" /> 듣고 있어요
      </div>

      <div ref={transcriptRef} className="voice-transcript" aria-live="polite">
        말씀하시면 자동으로 선택됩니다
      </div>

      <StepSelector ref={stepSelectorRef} mode="voice" onComplete={onComplete} />
    </div>
  );
}
