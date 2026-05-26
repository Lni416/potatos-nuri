/**
 * Web Speech API 래퍼 — SpeechRecognition 생성/제어.
 */

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

export function isSpeechSupported() {
  return !!SR;
}

/**
 * @param {{ onInterim, onFinal, onError, onEnd }} handlers
 * @returns {{ start, stop, abort } | null}
 */
export function createRecognizer({ onInterim, onFinal, onError, onEnd } = {}) {
  if (!SR) return null;

  const rec = new SR();
  rec.lang = 'ko-KR';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  rec.onresult = (e) => {
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

  rec.onerror = (e) => onError?.(e.error);
  rec.onend = () => onEnd?.();

  return {
    start() { try { rec.start(); } catch (_) {} },
    stop()  { try { rec.stop();  } catch (_) {} },
    abort() { try { rec.abort(); } catch (_) {} },
  };
}
