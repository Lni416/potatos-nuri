/**
 * 결과 카드 컴포넌트 (클릭 시 중앙 팝업으로 상세 표시).
 */

import { openCardModal } from "./cardModal.js";

/**
 * @param {Object} card - SummaryCard 데이터
 * @param {number} index - 카드 인덱스 (애니메이션 딜레이용)
 * @param {{ layout?: "list"|"feed" }} [options]
 */
export function createCard(card, index = 0, options = {}) {
  const layout = options.layout === "feed" ? "feed" : "list";
  const isWelfare = card.category === "복지";
  const categoryClass = isWelfare ? "welfare" : "event";
  const categoryIcon = isWelfare ? "🏛️" : "🎪";
  const categoryLabel = isWelfare ? "복지 혜택" : "행사·축제";

  const el = document.createElement("article");
  el.className = `result-card category-${isWelfare ? "welfare" : "event"} slide-up${
    layout === "feed" ? " result-card--feed" : ""
  }`;
  el.style.animationDelay = `${index * 0.1}s`;
  el.id = `card-${card.id}`;

  const preview = document.createElement("button");
  preview.type = "button";
  preview.className = "card-preview";
  preview.setAttribute(
    "aria-label",
    `${card.title || "정보"}, 클릭하면 크게 볼 수 있어요`
  );

  const feedArtSrc = isWelfare ? "/illustrations/welfare-feed.svg" : "/illustrations/event-feed.svg";
  const inner =
    layout === "feed"
      ? `
    <span class="card-preview-inner">
      <span class="card-feed-art" aria-hidden="true">
        <img src="${feedArtSrc}" alt="" width="120" height="120" decoding="async" />
      </span>
      <span class="card-list-main">
        <span class="card-title">${escapeHtml(card.title)}</span>
        <span class="card-category ${categoryClass}">
          ${categoryIcon} ${categoryLabel}
        </span>
      </span>
      <span class="card-expand-text">크게 보기</span>
    </span>
  `
      : `
    <span class="card-preview-inner">
      <span class="card-list-main">
        <span class="card-title">${escapeHtml(card.title)}</span>
        <span class="card-category ${categoryClass}">
          ${categoryIcon} ${categoryLabel}
        </span>
      </span>
      <span class="card-expand-text">크게 보기</span>
    </span>
  `;
  preview.innerHTML = inner;

  preview.addEventListener("click", () => {
    const summaryHTML = formatSummary(card.summary);
    const categoryBadge = `<span class="card-category ${categoryClass}">${categoryIcon} ${categoryLabel}</span>`;
    openCardModal({
      title: card.title || "정보",
      categoryLabel: categoryBadge,
      summaryHTML,
      sourceName: card.source_name || "",
      sourceUrl: card.source_url || "",
    });
  });

  el.appendChild(preview);
  return el;
}

function formatSummary(text) {
  if (!text) return "<p>요약 내용이 없습니다.</p>";

  const lines = text.split(/\r?\n/);
  const html = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) { closeList(); return; }

    if (line === "---") { closeList(); html.push("<hr/>"); return; }

    const heading = line.match(/^###\s+(.+)$/);
    if (heading) { closeList(); html.push(`<h3>${formatInline(heading[1])}</h3>`); return; }

    const listItem = line.match(/^-\s+(.+)$/);
    if (listItem) {
      if (!inList) { html.push("<ul>"); inList = true; }
      html.push(`<li>${formatInline(listItem[1])}</li>`);
      return;
    }

    closeList();
    html.push(`<p>${formatInline(line)}</p>`);
  });

  closeList();
  return html.join("");
}

function formatInline(text) {
  const escaped = escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return addGlossaryTooltips(escaped);
}

const GLOSSARY = {
  개발제한구역: "도시가 너무 넓게 퍼지는 것을 막기 위해 건축이나 개발을 제한한 지역입니다. 그린벨트라고도 합니다.",
  그린벨트: "도시 주변의 자연환경을 지키기 위해 건축이나 개발을 제한한 지역입니다.",
  기초생활수급자: "생활비가 부족해 나라에서 생계, 의료, 주거 같은 도움을 받는 분입니다.",
  차상위계층: "기초생활수급자는 아니지만 소득이 낮아 일부 복지 지원을 받을 수 있는 분입니다.",
  소득인정액: "월 소득과 재산을 함께 계산해 복지 대상인지 판단하는 금액입니다.",
  "기준 중위소득": "우리나라 가구 소득을 순서대로 세웠을 때 가운데에 있는 소득입니다. 복지 대상 기준으로 자주 씁니다.",
  주민센터: "사는 곳 가까이에 있는 행정복지센터입니다. 복지 신청과 상담을 할 수 있습니다.",
  행정복지센터: "예전의 동주민센터와 비슷한 곳입니다. 복지 신청과 상담을 할 수 있습니다.",
  읍면동: "읍, 면, 동을 함께 부르는 말입니다. 보통 가까운 주민센터를 뜻합니다.",
  중증질환: "치료가 오래 걸리거나 병원비 부담이 큰 심한 질병입니다.",
  희귀질환: "환자 수가 적어 보기 드문 질병입니다.",
  난치질환: "치료가 어렵거나 오래 관리해야 하는 질병입니다.",
  자산형성: "저축이나 지원금을 통해 목돈을 만들 수 있도록 돕는 것입니다.",
  현금지급: "물건이나 서비스가 아니라 돈으로 지원한다는 뜻입니다.",
  바우처: "정해진 곳에서 서비스나 물건을 살 수 있는 이용권입니다.",
};

function addGlossaryTooltips(html) {
  const terms = Object.keys(GLOSSARY)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
  const termPattern = new RegExp(`(^|[^\\w가-힣])(${terms})(?=$|[^\\w가-힣])`, "g");

  return html
    .split(/(<[^>]+>)/g)
    .map((part) => {
      if (part.startsWith("<")) return part;
      return part.replace(termPattern, (match, prefix, term) => {
        const description = GLOSSARY[term];
        return `${prefix}<button type="button" class="term-help" aria-label="${term} 설명: ${escapeHtml(description)}" data-tooltip="${escapeHtml(description)}">${term}</button>`;
      });
    })
    .join("");
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}
