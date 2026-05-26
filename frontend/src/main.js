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
    this.showOnboarding();
  }

  setPage(pageElement) {
    this.pageContainer.innerHTML = "";
    this.pageContainer.appendChild(pageElement);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  showHome() {
    const page = createHomePage((formData) => this.handleSearch(formData));
    this.setPage(page);
  }

  /**
   * 온보딩 오버레이 — 음성인식이 지원되면 바로 음성 모드로 시작.
   * 음성 불가 시 텍스트(클릭) 모드로 자동 전환.
   */
  showOnboarding() {
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

    const showText = () => {
      const voiceAvailable = isSpeechSupported();
      const el = createTextOnboarding({
        onComplete: (formData) => close(formData),
        onBack: voiceAvailable ? showVoice : null,
      });
      showPage(el);
    };

    const showVoice = () => {
      const el = createVoiceOnboarding({
        onComplete: (formData) => close(formData),
        onFallback: showText,
      });
      showPage(el);
    };

    // 음성인식 지원 시 바로 음성 모드로 시작 (주된 인터랙션)
    if (isSpeechSupported()) {
      showVoice();
    } else {
      showText();
    }

    document.body.appendChild(overlay);
  }

  async handleSearch(formData) {
    const loading = createLoading();
    this.setPage(loading);

    try {
      const result = await searchInfo(formData);
      const resultsPage = createResultsPage(result, () => this.showHome());
      this.setPage(resultsPage);
    } catch (error) {
      console.error("검색 실패:", error);
      const errorPage = createResultsPage(
        {
          cards: [],
          total_count: 0,
          message: `⚠️ 오류가 발생했어요: ${error.message}. 잠시 후 다시 시도해 주세요.`,
        },
        () => this.showHome()
      );
      this.setPage(errorPage);
    }
  }
}

new NuriApp();
