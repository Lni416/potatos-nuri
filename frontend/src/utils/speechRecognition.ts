interface SpeechRecognitionHandlers {
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

interface Recognizer {
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;

export function isSpeechSupported(): boolean {
  return !!SR;
}

export function createRecognizer(handlers: SpeechRecognitionHandlers = {}): Recognizer | null {
  if (!SR) return null;

  const { onInterim, onFinal, onError, onEnd } = handlers;
  const rec = new SR();
  rec.lang = 'ko-KR';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  rec.onresult = (e: SpeechRecognitionEvent) => {
    let interim = '';
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t;
      else interim += t;
    }
    if (interim) onInterim?.(interim);
    if (final) onFinal?.(final);
  };

  rec.onerror = (e: SpeechRecognitionErrorEvent) => onError?.(e.error);
  rec.onend = () => onEnd?.();

  return {
    start() { try { rec.start(); } catch (_) {} },
    stop()  { try { rec.stop();  } catch (_) {} },
    abort() { try { rec.abort(); } catch (_) {} },
  };
}
