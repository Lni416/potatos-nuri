/**
 * 결과 카드 상세 — 화면 중앙 팝업 (패널에서 마우스가 벗어나면 닫힘).
 */

const MODAL_ID = "nuri-card-modal";

/**
 * 현재 열려있는 모달의 본문을 교체합니다 (on-demand 요약 완료 시 호출).
 * @param {string} html
 */
export function updateModalBody(html) {
  const root = document.getElementById(MODAL_ID);
  if (!root || root.hidden) return;
  const bodyEl = root.querySelector(".card-modal__body");
  if (bodyEl) bodyEl.innerHTML = html;
}
const BODY_LOCK_ATTR = "data-nuri-modal-scroll-lock";
const BODY_SCROLL_Y_ATTR = "data-nuri-modal-scroll-y";

function lockBodyScroll() {
  if (document.body.getAttribute(BODY_LOCK_ATTR) === "1") return;
  document.body.setAttribute(BODY_LOCK_ATTR, "1");
  document.body.setAttribute(BODY_SCROLL_Y_ATTR, String(window.scrollY));
  document.body.style.position = "fixed";
  document.body.style.top = `-${window.scrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
  document.body.style.overflow = "hidden";
}

function unlockBodyScroll() {
  if (document.body.getAttribute(BODY_LOCK_ATTR) !== "1") return;
  const y = parseInt(document.body.getAttribute(BODY_SCROLL_Y_ATTR) || "0", 10);
  document.body.removeAttribute(BODY_LOCK_ATTR);
  document.body.removeAttribute(BODY_SCROLL_Y_ATTR);
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  document.body.style.overflow = "";
  window.scrollTo(0, y);
}

function ensureModalRoot() {
  let root = document.getElementById(MODAL_ID);
  if (root) return root;

  root = document.createElement("div");
  root.id = MODAL_ID;
  root.className = "nuri-card-modal";
  root.setAttribute("role", "presentation");
  root.innerHTML = `
    <div class="card-modal__panel" role="dialog" aria-modal="true" aria-labelledby="nuri-card-modal-title" tabindex="-1">
      <button type="button" class="card-modal__close btn btn-secondary" aria-label="닫기">닫기</button>
      <div class="card-modal__head">
        <span class="card-modal__category" id="nuri-card-modal-category"></span>
        <h2 class="card-modal__title" id="nuri-card-modal-title"></h2>
      </div>
      <div class="card-modal__body"></div>
      <div class="card-modal__foot"></div>
    </div>
  `;
  document.body.appendChild(root);
  root.hidden = true;
  return root;
}

/**
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string} opts.categoryLabel - HTML 배지
 * @param {string} opts.summaryHTML
 * @param {string} opts.sourceName
 * @param {string} [opts.sourceUrl]
 */
export function openCardModal(opts) {
  const root = ensureModalRoot();

  if (root._leaveTimer != null) {
    clearTimeout(root._leaveTimer);
    root._leaveTimer = null;
  }
  if (root._abort) {
    root._abort.abort();
    root._abort = null;
  }

  const panel = root.querySelector(".card-modal__panel");
  root.classList.remove("is-open");
  panel.classList.remove("is-visible");
  root.hidden = true;

  const titleEl = root.querySelector("#nuri-card-modal-title");
  const catEl = root.querySelector("#nuri-card-modal-category");
  const bodyEl = root.querySelector(".card-modal__body");
  const footEl = root.querySelector(".card-modal__foot");
  const closeBtn = root.querySelector(".card-modal__close");

  const ac = new AbortController();
  root._abort = ac;
  const { signal } = ac;

  titleEl.textContent = opts.title || "";
  catEl.innerHTML = opts.categoryLabel || "";
  bodyEl.innerHTML = opts.summaryHTML || "";

  footEl.textContent = "";
  const sourceP = document.createElement("p");
  sourceP.className = "card-modal__source";
  sourceP.textContent = `📌 ${opts.sourceName || "공공데이터포털"}`;
  footEl.appendChild(sourceP);

  const actions = document.createElement("div");
  actions.className = "card-modal__actions";
  if (opts.sourceUrl) {
    const a = document.createElement("a");
    a.href = opts.sourceUrl;
    a.target = "_blank";
    a.rel = "noopener";
    a.className = "card-toggle-btn card-modal__link";
    a.textContent = "🔗 여기서 더 알아볼 수 있어요";
    actions.appendChild(a);
  }
  footEl.appendChild(actions);

  const hint = document.createElement("p");
  hint.className = "card-modal__hint";
  hint.textContent = "마우스를 이 창 밖으로 옮기면 닫혀요.";
  footEl.appendChild(hint);

  const cancelScheduledClose = () => {
    if (root._leaveTimer != null) {
      clearTimeout(root._leaveTimer);
      root._leaveTimer = null;
    }
  };

  const shutdown = () => {
    cancelScheduledClose();
    ac.abort();
    if (root._abort === ac) root._abort = null;
    root.classList.remove("is-open");
    panel.classList.remove("is-visible");
    root.hidden = true;
    unlockBodyScroll();
  };

  const scheduleClose = () => {
    cancelScheduledClose();
    root._leaveTimer = setTimeout(() => {
      root._leaveTimer = null;
      shutdown();
    }, 320);
  };

  root.hidden = false;
  root.classList.add("is-open");
  panel.classList.add("is-visible");
  lockBodyScroll();
  panel.focus({ preventScroll: true });

  panel.addEventListener("mouseleave", scheduleClose, { signal });
  panel.addEventListener("mouseenter", cancelScheduledClose, { signal });
  closeBtn.addEventListener("click", shutdown, { signal });
}
