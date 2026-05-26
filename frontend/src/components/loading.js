/**
 * 로딩 화면 — 음성 온보딩 디자인을 완전 계승.
 * 인디고 구체 + 인트로 칩 + voice-status-badge + 스텝 카드형 스켈레톤
 */

const SPHERE_SIZE = 200;
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

function startSphere(canvas) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = SPHERE_SIZE * dpr;
  canvas.height = SPHERE_SIZE * dpr;
  canvas.style.width  = SPHERE_SIZE + "px";
  canvas.style.height = SPHERE_SIZE + "px";

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const dots  = fibonacciSphere(DOT_COUNT);
  const BASE_R = 82;
  let displayR = BASE_R;
  let angle    = 0;
  let raf      = null;

  function draw(t) {
    ctx.clearRect(0, 0, SPHERE_SIZE, SPHERE_SIZE);
    // 천천히 숨쉬는 pulse
    const pulse   = Math.sin(t / 1400) * 0.055;
    const targetR = BASE_R * (1 + pulse);
    displayR += (targetR - displayR) * 0.07;

    angle += 0.0035;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const projected = dots
      .map(([x, y, z]) => ({
        px: x * cosA + z * sinA,
        py: y,
        pz: -x * sinA + z * cosA,
      }))
      .sort((a, b) => a.pz - b.pz);

    const cx = SPHERE_SIZE / 2;
    const cy = SPHERE_SIZE / 2;
    for (const { px, py, pz } of projected) {
      const depth = (pz + 1) / 2;
      ctx.beginPath();
      ctx.arc(
        cx + px * displayR,
        cy + py * displayR,
        1.0 + depth * 2.0,
        0, Math.PI * 2
      );
      ctx.fillStyle = `rgba(99,102,241,${(0.12 + depth * 0.72).toFixed(2)})`;
      ctx.fill();
    }
  }

  function loop(t) {
    // 캔버스가 DOM에서 떠나면 자동 종료
    if (!document.body.contains(canvas)) return;
    draw(t);
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  return () => { if (raf) cancelAnimationFrame(raf); };
}

function skeletonCards() {
  const labels = ["복지 서비스", "지역 행사", "생활 지원"];
  return labels.map((label, i) => `
    <div class="skeleton-card skeleton-card--ob" style="animation-delay:${i * 0.13}s">
      <div class="skeleton-line title" style="width:${45 + i * 10}%"></div>
      <div class="skeleton-line long"></div>
      <div class="skeleton-line long"></div>
      <div class="skeleton-line medium"></div>
      <div class="skeleton-line short" style="width:30%"></div>
    </div>
  `).join("");
}

export function createLoading() {
  const page = document.createElement("div");
  page.className = "loading-page";

  page.innerHTML = `
    <div class="loading-hero">
      <span class="loading-intro-chip">
        <span class="voice-pulse"></span> 정보 수집 중
      </span>

      <div class="loading-sphere-wrap">
        <canvas class="sphere-canvas" id="loading-sphere-canvas"></canvas>
      </div>

      <div class="voice-status-badge">
        <span class="voice-pulse"></span> AI가 맞춤 정보를 찾고 있어요
      </div>

      <p class="loading-title">정보를 쉬운 말로 정리하고 있어요</p>
      <p class="loading-sub">잠시만 기다려 주세요</p>
    </div>

    <div class="loading-skeleton-section">
      <div class="container">
        <p class="loading-skeleton-hint">곧 이런 정보들을 보여드릴게요</p>
        <div class="results-grid">
          ${skeletonCards()}
        </div>
      </div>
    </div>
  `;

  const canvas = page.querySelector("#loading-sphere-canvas");
  startSphere(canvas);

  return page;
}
