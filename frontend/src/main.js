/**
 * potatos-nuri — 메인 애플리케이션 엔트리포인트.
 * 음성인식이 UI의 주된 인터랙션 방식이며, 클릭은 보조 수단.
 */

import "./styles/index.css";
import "./styles/onboarding.css";
import { createHeader } from "./components/header.js";
import { createFooter } from "./components/footer.js";
import { createLoading } from "./components/loading.js";
import { createHomePage } from "./pages/home.js";
import { createResultsPage } from "./pages/results.js";
import { searchInfo } from "./utils/api.js";
import { createVoiceOnboarding } from "./pages/VoiceOnboarding.js";
import { createTextOnboarding } from "./pages/TextOnboarding.js";
import { isSpeechSupported } from "./utils/speechRecognition.js";

class NuriApp {
  constructor() {
    this.app = document.getElementById("app");
    this.init();
  }

  init() {
    this.header = createHeader();
    this.footer = createFooter();

    this.pageContainer = document.createElement("div");
    this.pageContainer.id = "page-container";

    this.app.appendChild(this.header);
    this.app.appendChild(this.pageContainer);
    this.app.appendChild(this.footer);

    window.addEventListener("navigate", (e) => {
      if (e.detail === "home") this.showHome();
    });

    this.showHome();
    this.showVoiceOverlay();
  }

  setPage(pageElement) {
    this.pageContainer.innerHTML = "";
    this.pageContainer.appendChild(pageElement);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  showHome() {
    // 음성 지원 시 홈 폼에 "음성으로 선택" 버튼 제공
    const onVoice = isSpeechSupported() ? () => this.showVoiceOverlay() : null;
    const page = createHomePage((formData) => this.handleSearch(formData), onVoice);
    this.setPage(page);
  }

  /**
   * 음성 온보딩 오버레이.
   * - 완료 시 검색 실행
   * - 폼으로 전환 버튼 클릭 시 오버레이만 닫고 홈 폼 노출
   * - 음성 불가 시 텍스트 스텝 선택기로 자동 전환
   */
  showVoiceOverlay() {
    // 이미 열려있으면 중복 방지
    if (document.querySelector('.onboarding-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';

    const close = (formData) => {
      overlay.classList.add('is-hiding');
      overlay.addEventListener('transitionend', () => {
        overlay._currentPage?._destroy?.();
        overlay.remove();
      }, { once: true });
      if (formData) this.handleSearch(formData);
    };

    const showPage = (pageEl) => {
      overlay._currentPage?._destroy?.();
      overlay._currentPage = pageEl;
      overlay.innerHTML = '';
      overlay.appendChild(pageEl);
    };

    if (isSpeechSupported()) {
      const el = createVoiceOnboarding({
        onComplete: (formData) => close(formData),
        onFallback: () => close(null), // 오버레이 닫기 → 홈 폼 노출
      });
      showPage(el);
    } else {
      // 음성 불가 시 텍스트 스텝 선택기 (폴백)
      const el = createTextOnboarding({
        onComplete: (formData) => close(formData),
        onBack: null,
      });
      showPage(el);
    }

    document.body.appendChild(overlay);
  }

  /** @deprecated showVoiceOverlay로 대체 */
  showOnboarding() { this.showVoiceOverlay(); }

  async handleSearch(formData) {
    const loading = createLoading();
    this.setPage(loading);

    try {
      const result = await searchInfo(formData);
      const resultsPage = createResultsPage(result, formData, () => this.showHome());
      this.setPage(resultsPage);
    } catch (error) {
      console.error("검색 실패:", error);
      const errorPage = createResultsPage(
        {
          cards: [],
          total_count: 0,
          message: `⚠️ 오류가 발생했어요: ${error.message}. 잠시 후 다시 시도해 주세요.`,
        },
        formData,
        () => this.showHome()
      );
      this.setPage(errorPage);
    }
  }
}

new NuriApp();
