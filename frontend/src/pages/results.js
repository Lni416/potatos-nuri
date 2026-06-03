/**
 * 결과 페이지 — 음성 온보딩 디자인 완전 계승.
 * 완료 배너(그린 칩) → 섹션(인디고 칩) → 카드 목록 → ob-link 뒤로가기
 */

import { createCard } from "../components/card.js";

const PAGE_SIZE = 8;

function mountPaginatedSection(container, { title, icon, cards, layout, userProfile }) {
  // 섹션 레이블 — step-chip 스타일
  const labelRow = document.createElement("div");
  labelRow.className = "results-section-label";
  labelRow.innerHTML = `
    <span class="step-chip">${icon} ${title}</span>
    <span class="results-section-count">${cards.length}건</span>
  `;
  container.appendChild(labelRow);

  const grid = document.createElement("div");
  grid.className = layout === "feed"
    ? "results-grid results-grid--feed"
    : "results-grid results-grid--list";

  let visible = Math.min(PAGE_SIZE, cards.length);

  const appendRange = (end) => {
    const start = grid.children.length;
    for (let i = start; i < end; i++) {
      grid.appendChild(createCard(cards[i], i, userProfile, { layout }));
    }
  };

  appendRange(visible);
  container.appendChild(grid);

  if (cards.length <= visible) return;

  const wrap = document.createElement("div");
  wrap.className = "results-load-more-wrap";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-secondary results-load-more";
  const remaining = () => cards.length - visible;
  btn.textContent = `더보기 (${remaining()}개 더)`;

  btn.addEventListener("click", () => {
    const next = Math.min(visible + PAGE_SIZE, cards.length);
    appendRange(next);
    visible = next;
    if (visible >= cards.length) { wrap.remove(); return; }
    btn.textContent = `더보기 (${remaining()}개 더)`;
  });

  wrap.appendChild(btn);
  container.appendChild(wrap);
}

/**
 * @param {Object}   data        - SearchResponse
 * @param {Object}   userProfile - 검색에 사용된 사용자 정보 (개인화 요약용)
 * @param {Function} onBack      - 뒤로가기 콜백
 */
export function createResultsPage(data, userProfile, onBack) {
  const page = document.createElement("main");
  page.className = "page-content results-page-enter";

  const container = document.createElement("div");
  container.className = "container";

  const hasCards = data.cards && data.cards.length > 0;

  // ── 상단 완료 배너 ──
  const banner = document.createElement("div");
  banner.className = "results-header";

  if (hasCards) {
    banner.innerHTML = `
      <div class="results-complete-banner">
        <span class="results-complete-chip">
          <span class="results-complete-dot"></span>
          맞춤 정보 ${data.total_count}건 준비됐어요
        </span>
        <h2 class="results-hero-title">맞춤 정보를 찾았어요!</h2>
        ${data.message
          ? `<p class="results-hero-subtitle">${data.message}</p>`
          : ""}
      </div>
    `;
  } else {
    banner.innerHTML = `
      <div class="results-empty-wrap">
        <span class="results-empty-icon">🔍</span>
        <p class="results-empty-title">조건에 맞는 정보를 찾지 못했어요</p>
        <p class="results-empty-desc">${data.message || "검색 조건을 바꿔서 다시 시도해 보세요."}</p>
      </div>
    `;
  }
  container.appendChild(banner);

  // ── 카드 섹션 ──
  if (hasCards) {
    const welfare = data.cards.filter((c) => c.category === "복지");
    const events  = data.cards.filter((c) => c.category === "행사");

    if (welfare.length > 0) {
      mountPaginatedSection(container, {
        title: "복지 정보", icon: "🏛️", cards: welfare, layout: "feed", userProfile,
      });
    }
    if (events.length > 0) {
      mountPaginatedSection(container, {
        title: "행사·축제 정보", icon: "🎪", cards: events, layout: "list", userProfile,
      });
    }
  }

  // ── 뒤로가기 ──
  const backSection = document.createElement("div");
  backSection.className = "results-back-section";
  backSection.innerHTML = `
    <button class="ob-link results-back-link" id="results-back-btn">
      ← 처음으로 돌아가기
    </button>
  `;
  container.appendChild(backSection);

  page.appendChild(container);
  page.querySelector("#results-back-btn").addEventListener("click", onBack);

  return page;
}
