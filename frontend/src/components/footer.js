/**
 * 푸터 컴포넌트.
 */

export function createFooter() {
  const footer = document.createElement("footer");
  footer.className = "app-footer";

  footer.innerHTML = `
    <div class="container">
      <p class="footer-text">
        🐰 <strong>NuRI</strong> — 복잡한 정보를 쉬운 말로<br/>
        <a href="https://data.go.kr" target="_blank" rel="noopener">공공데이터포털</a> ·
        Google Gemini AI 기반
      </p>
    </div>
  `;

  return footer;
}
