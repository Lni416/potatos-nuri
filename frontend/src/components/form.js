/**
 * 사용자 정보 입력 폼 컴포넌트.
 */

import { createNaverRegionPicker } from "./naverRegionPicker.js";
import {
  loadNaverMapsWithGeocoder,
  reverseGeocodeCoordString,
  reverseGeocodeServiceToRegion,
} from "../lib/naverMapsGeocode.js";

const REGIONS = [
  { code: "서울", name: "서울특별시" },
  { code: "부산", name: "부산광역시" },
  { code: "대구", name: "대구광역시" },
  { code: "인천", name: "인천광역시" },
  { code: "광주", name: "광주광역시" },
  { code: "대전", name: "대전광역시" },
  { code: "울산", name: "울산광역시" },
  { code: "세종", name: "세종특별자치시" },
  { code: "경기", name: "경기도" },
  { code: "강원", name: "강원특별자치도" },
  { code: "충북", name: "충청북도" },
  { code: "충남", name: "충청남도" },
  { code: "전북", name: "전라북도" },
  { code: "전남", name: "전라남도" },
  { code: "경북", name: "경상북도" },
  { code: "경남", name: "경상남도" },
  { code: "제주", name: "제주특별자치도" },
];

const REGION_CITIES = {
  서울: ["종로구","중구","용산구","성동구","광진구","동대문구","중랑구","성북구","강북구","도봉구","노원구","은평구","서대문구","마포구","양천구","강서구","구로구","금천구","영등포구","동작구","관악구","서초구","강남구","송파구","강동구"],
  부산: ["중구","서구","동구","영도구","부산진구","동래구","남구","북구","해운대구","사하구","금정구","강서구","연제구","수영구","사상구","기장군"],
  대구: ["중구","동구","서구","남구","북구","수성구","달서구","달성군","군위군"],
  인천: ["중구","동구","미추홀구","연수구","남동구","부평구","계양구","서구","강화군","옹진군"],
  광주: ["동구","서구","남구","북구","광산구"],
  대전: ["동구","중구","서구","유성구","대덕구"],
  울산: ["중구","남구","동구","북구","울주군"],
  세종: [],
  경기: ["수원시","성남시","의정부시","안양시","부천시","광명시","평택시","동두천시","안산시","고양시","과천시","구리시","남양주시","오산시","시흥시","군포시","의왕시","하남시","용인시","파주시","이천시","안성시","김포시","화성시","광주시","양주시","포천시","여주시","연천군","가평군","양평군"],
  강원: ["춘천시","원주시","강릉시","동해시","태백시","속초시","삼척시","홍천군","횡성군","영월군","평창군","정선군","철원군","화천군","양구군","인제군","고성군","양양군"],
  충북: ["청주시","충주시","제천시","보은군","옥천군","영동군","증평군","진천군","괴산군","음성군","단양군"],
  충남: ["천안시","공주시","보령시","아산시","서산시","논산시","계룡시","당진시","금산군","부여군","서천군","청양군","홍성군","예산군","태안군"],
  경북: ["포항시","경주시","김천시","안동시","구미시","영주시","영천시","상주시","문경시","경산시","의성군","청송군","영양군","영덕군","청도군","고령군","성주군","칠곡군","예천군","봉화군","울진군","울릉군"],
  경남: ["창원시","진주시","통영시","사천시","김해시","밀양시","거제시","양산시","의령군","함안군","창녕군","고성군","남해군","하동군","산청군","함양군","거창군","합천군"],
  전북: ["전주시","군산시","익산시","정읍시","남원시","김제시","완주군","진안군","무주군","장수군","임실군","순창군","고창군","부안군"],
  전남: ["목포시","여수시","순천시","나주시","광양시","담양군","곡성군","구례군","고흥군","보성군","화순군","장흥군","강진군","해남군","영암군","무안군","함평군","영광군","장성군","완도군","진도군","신안군"],
  제주: ["제주시","서귀포시"],
};

const OCCUPATIONS = [
  { value: "학생", label: "📚 학생", id: "occ-student" },
  { value: "직장인", label: "💼 직장인", id: "occ-worker" },
  { value: "구직자", label: "🔍 구직자", id: "occ-seeker" },
  { value: "자영업", label: "🏪 자영업", id: "occ-self" },
  { value: "은퇴", label: "🌅 은퇴", id: "occ-retired" },
  { value: "기타", label: "✨ 기타", id: "occ-other" },
];

const INTERESTS = [
  { value: "생활지원", label: "🛒 생활·복지",  id: "int-living" },
  { value: "의료건강", label: "🏥 의료·건강",  id: "int-medical" },
  { value: "주거",    label: "🏠 주거·임대",  id: "int-housing" },
  { value: "취업고용", label: "💼 취업·일자리", id: "int-employment" },
  { value: "교육장학", label: "🎓 교육·장학",  id: "int-education" },
  { value: "임신육아", label: "👶 임신·육아",  id: "int-childcare" },
  { value: "노인돌봄", label: "👴 노인·돌봄",  id: "int-elderly" },
  { value: "문화여가", label: "🎭 문화·여가",  id: "int-culture" },
  { value: "법률인권", label: "⚖️ 법률·인권", id: "int-legal" },
  { value: "장애지원", label: "♿ 장애 지원",  id: "int-disability" },
];

export function createForm(onSubmit) {
  const section = document.createElement("div");
  section.className = "form-section slide-up";

  section.innerHTML = `
    <h2>내 정보를 선택해 주세요</h2>
    <form id="search-form" novalidate>
      <!-- 나이 -->
      <div class="form-group">
        <label class="form-label">
          <span class="label-icon">🎂</span> 나이
        </label>
        <div class="age-input-group">
          <input
            type="range"
            id="age-slider"
            class="age-slider"
            min="0"
            max="100"
            value="30"
            step="1"
          />
          <div class="age-display" id="age-display">30세</div>
        </div>
        <p class="form-hint">동그란 버튼을 움직여 나이를 맞춰 주세요.</p>
      </div>

      <!-- 거주 지역 -->
      <div class="form-group">
        <label class="form-label">
          <span class="label-icon">📍</span> 거주 지역
        </label>
        <button type="button" id="locate-btn" class="btn-locate">
          <span class="locate-icon">📡</span>
          <span class="locate-text">내 위치로 자동 선택</span>
        </button>
        <p class="form-hint locate-status" id="locate-status" aria-live="polite"></p>
        <div id="region-map-host" class="region-map-host"></div>
        <p class="form-hint region-select-fallback-hint" id="region-select-fallback-hint">시·도를 목록에서 고를 수도 있어요.</p>
        <div class="region-row">
          <div class="region-col">
            <label for="province-select" class="visually-hidden">시·도 (목록)</label>
            <select id="province-select" class="form-select" required aria-describedby="region-select-fallback-hint">
              <option value="">시/도를 선택하세요</option>
              ${REGIONS.map(
                (r) => `<option value="${r.code}" data-name="${r.name}">${r.name}</option>`
              ).join("")}
            </select>
          </div>
          <div class="region-col" id="city-col" style="display:none;">
            <select id="city-select" class="form-select">
              <option value="">시/군/구 선택은 안 해도 됩니다</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 직업 상태 -->
      <div class="form-group">
        <label class="form-label">
          <span class="label-icon">👤</span> 직업 상태
        </label>
        <div class="radio-group" id="occupation-group">
          ${OCCUPATIONS.map(
            (o) => `
            <div class="radio-option">
              <input type="radio" name="occupation" id="${o.id}" value="${o.value}" ${o.value === "기타" ? "checked" : ""}>
              <label for="${o.id}">${o.label}</label>
            </div>
          `
          ).join("")}
        </div>
      </div>

      <!-- 관심 분야 -->
      <div class="form-group">
        <label class="form-label">
          <span class="label-icon">💡</span> 알고 싶은 분야
        </label>
        <div class="checkbox-group" id="interests-group">
          ${INTERESTS.map(
            (i) => `
            <div class="checkbox-option">
              <input type="checkbox" id="${i.id}" value="${i.value}">
              <label for="${i.id}">${i.label}</label>
            </div>
          `
          ).join("")}
        </div>
        <p class="form-hint">여러 개를 선택해도 됩니다. 선택한 분야를 먼저 찾아드려요.</p>
      </div>

      <!-- 제출 버튼 -->
      <button type="submit" class="btn btn-primary btn-full" id="search-btn">
        내게 맞는 정보 찾기
      </button>
    </form>
  `;

  // 나이 슬라이더
  const slider = section.querySelector("#age-slider");
  const display = section.querySelector("#age-display");
  slider.addEventListener("input", () => {
    display.textContent = `${slider.value}세`;
  });

  // 시/도 선택 → 시/군/구 목록 동적 갱신
  const provinceSelect = section.querySelector("#province-select");
  const cityCol = section.querySelector("#city-col");
  const citySelect = section.querySelector("#city-select");

  const refreshCityOptions = (code) => {
    const cities = REGION_CITIES[code] || [];
    if (cities.length > 0) {
      citySelect.innerHTML = `<option value="">시/군/구 선택은 안 해도 됩니다</option>`;
      cities.forEach((city) => {
        const opt = document.createElement("option");
        opt.value = city;
        opt.textContent = city;
        citySelect.appendChild(opt);
      });
      cityCol.style.display = "";
    } else {
      cityCol.style.display = "none";
      citySelect.value = "";
    }
  };

  const regionMapHost = section.querySelector("#region-map-host");
  const locateBtn = section.querySelector("#locate-btn");
  const locateStatus = section.querySelector("#locate-status");

  const setLocateStatus = (message, tone = "info") => {
    locateStatus.textContent = message;
    locateStatus.dataset.tone = tone;
  };

  let regionPickerApi = { setSelected: () => {} };

  const naverMapKey = import.meta.env.VITE_NAVER_MAP_KEY_ID;
  createNaverRegionPicker({
    keyId: typeof naverMapKey === "string" ? naverMapKey : undefined,
    regions: REGIONS,
    regionCities: REGION_CITIES,
    onPick: ({ province, city }) => {
      provinceSelect.value = province.code;
      refreshCityOptions(province.code);
      if (city) citySelect.value = city;
    },
    onStatus: setLocateStatus,
  }).then((api) => {
    regionMapHost.appendChild(api.el);
    api.initMap();
    regionPickerApi = api;
    section.addEventListener(
      "animationend",
      (e) => {
        if (e.animationName !== "fadeIn" && e.animationName !== "slideUp") return;
        api.relayoutMap();
      },
      { once: true }
    );
  });

  provinceSelect.addEventListener("change", () => {
    refreshCityOptions(provinceSelect.value);
    regionPickerApi.setSelected(provinceSelect.value || "");
  });

  // GPS 자동 선택
  locateBtn.addEventListener("click", async () => {
    if (!navigator.geolocation) {
      setLocateStatus("이 브라우저는 위치 기능을 지원하지 않아요.", "error");
      return;
    }

    locateBtn.disabled = true;
    locateBtn.classList.add("is-loading");
    setLocateStatus("위치 정보를 받아오고 있어요…", "info");

    try {
      const matched = await detectRegionFromGPS();
      if (!matched) {
        setLocateStatus("현재 위치에 해당하는 지역을 찾지 못했어요. 직접 선택해 주세요.", "error");
        return;
      }

      provinceSelect.value = matched.province.code;
      refreshCityOptions(matched.province.code);
      regionPickerApi.setSelected(matched.province.code);
      if (matched.city) citySelect.value = matched.city;

      const labelParts = [matched.province.name];
      if (matched.city) labelParts.push(matched.city);
      setLocateStatus(`현재 위치: ${labelParts.join(" ")}`, "success");
    } catch (err) {
      setLocateStatus(err.message || "위치를 가져오지 못했어요.", "error");
    } finally {
      locateBtn.disabled = false;
      locateBtn.classList.remove("is-loading");
    }
  });

  // 리플 효과
  const submitBtn = section.querySelector("#search-btn");
  submitBtn.addEventListener("click", (e) => {
    const rect = submitBtn.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
    submitBtn.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  });

  // 폼 제출
  const form = section.querySelector("#search-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const age = parseInt(slider.value, 10);
    const regionCode = provinceSelect.value;
    const provinceName =
      provinceSelect.options[provinceSelect.selectedIndex]?.dataset?.name || "";
    const cityName = citySelect?.value || "";
    const regionName = cityName ? `${provinceName} ${cityName}` : provinceName;

    if (!regionCode) {
      provinceSelect.focus();
      provinceSelect.style.borderColor = "var(--color-error)";
      setTimeout(() => { provinceSelect.style.borderColor = ""; }, 2000);
      return;
    }

    const occupation =
      section.querySelector('input[name="occupation"]:checked')?.value || "기타";

    const interests = Array.from(
      section.querySelectorAll('#interests-group input[type="checkbox"]:checked')
    ).map((cb) => cb.value);

    onSubmit({ age, region_code: regionCode, region_name: regionName, occupation, interests });
  });

  return section;
}

async function detectRegionFromGPS() {
  const keyId = import.meta.env.VITE_NAVER_MAP_KEY_ID;
  if (typeof keyId !== "string" || !keyId.trim()) {
    throw new Error(
      "내 위치 자동 선택에는 네이버 지도 키가 필요해요. `.env`에 VITE_NAVER_MAP_KEY_ID를 넣어 주세요."
    );
  }

  const position = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => {
        const messages = {
          1: "위치 사용 권한이 거부됐어요. 브라우저 설정에서 허용해 주세요.",
          2: "현재 위치를 확인할 수 없어요. 잠시 후 다시 시도해 주세요.",
          3: "위치 확인이 너무 오래 걸려요. 다시 시도해 주세요.",
        };
        reject(new Error(messages[err.code] || "위치를 가져오지 못했어요."));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });

  const { latitude, longitude } = position.coords;
  const coordStr = reverseGeocodeCoordString(latitude, longitude);
  if (!coordStr) throw new Error("좌표를 읽지 못했어요.");

  await loadNaverMapsWithGeocoder(keyId);
  const n = window.naver;
  const { parsed, transportOk } = await reverseGeocodeServiceToRegion(
    n,
    coordStr,
    REGIONS,
    REGION_CITIES
  );
  if (parsed) return { province: parsed.province, city: parsed.city };
  if (transportOk) return null;
  throw new Error("현재 위치의 주소를 찾지 못했어요. 목록에서 골라 주세요.");
}
