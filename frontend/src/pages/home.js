/**
 * 홈 페이지 — 사용자 정보 입력 폼.
 */

import { createForm } from "../components/form.js";

export function createHomePage(onSearch) {
  const page = document.createElement("main");
  page.className = "page-content fade-in";

  const hero = document.createElement("section");
  hero.className = "hero";
  hero.innerHTML = `
    <div class="container">
      <div class="hero-badge">
        🎤 음성으로 쉽게 찾아요
      </div>
      <h1>
        받을 수 있는<br/>
        <span class="highlight">복지와 행사 정보</span>를<br/>
        쉽게 찾아요
      </h1>
      <p class="hero-desc">
        어려운 공고문을 읽지 않아도 괜찮아요.<br/>
        필요한 정보만 골라 큰 글씨로 쉽게 알려 드릴게요.
      </p>
    </div>
  `;
  page.appendChild(hero);

  const formContainer = document.createElement("div");
  formContainer.className = "container";
  const form = createForm(onSearch);
  formContainer.appendChild(form);
  page.appendChild(formContainer);

  return page;
}
