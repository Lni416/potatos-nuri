/**
 * AudioContext + AnalyserNode로 실시간 마이크 볼륨(0~1) 제공.
 */

export async function createAudioAnalyser() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;
  source.connect(analyser);

  const data = new Uint8Array(analyser.frequencyBinCount);

  return {
    getVolume() {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      return sum / data.length / 255;
    },
    stop() {
      stream.getTracks().forEach((t) => t.stop());
      ctx.close();
    },
  };
}
