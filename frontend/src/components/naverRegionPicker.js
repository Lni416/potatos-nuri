/**
 * 네이버 지도：클릭 → 역지오코딩 → 시·도 선택 콜백
 */

import {
  loadNaverMapsWithGeocoder,
  reverseGeocodeCoordsFromMapClick,
  reverseGeocodeServiceToRegion,
} from "../lib/naverMapsGeocode.js";

export async function createNaverRegionPicker(opts) {
  const { keyId, regions, regionCities, onPick, onStatus } = opts;
  const wrap = document.createElement("div");
  wrap.className = "naver-region-picker";

  const hint = document.createElement("p");
  hint.className = "form-hint naver-region-picker-hint";
  hint.textContent =
    "지도에서 거주 지역을 가리키는 곳을 눌러 주세요. 선택한 위치로 시·도가 맞춰져요.";

  const mapEl = document.createElement("div");
  mapEl.className = "naver-region-picker-map";
  mapEl.setAttribute("role", "application");
  mapEl.setAttribute("aria-label", "대한민국 지도 — 클릭하여 시·도 선택");

  wrap.appendChild(hint);
  wrap.appendChild(mapEl);

  if (!keyId || !String(keyId).trim()) {
    const note = document.createElement("p");
    note.className = "form-hint naver-region-picker-missing-key";
    note.textContent =
      "네이버 지도를 쓰려면 `.env`에 VITE_NAVER_MAP_KEY_ID 를 넣어 주세요.";
    wrap.appendChild(note);
    return {
      el: wrap,
      initMap() {},
      relayoutMap() {},
      setSelected() {},
      destroy() {},
    };
  }

  try {
    await loadNaverMapsWithGeocoder(keyId);
  } catch (e) {
    const note = document.createElement("p");
    note.className = "form-hint locate-status";
    note.dataset.tone = "error";
    note.style.whiteSpace = "pre-line";
    note.textContent = e instanceof Error ? e.message : "지도를 불러오지 못했어요.";
    wrap.appendChild(note);
    return {
      el: wrap,
      initMap() {},
      relayoutMap() {},
      setSelected() {},
      destroy() {},
    };
  }

  const n = window.naver;
  let map = null;
  let marker = null;
  let clickListen = null;
  let resizeObserver = null;
  const onOrientation = () => relayoutMap();

  const relayoutMap = () => {
    if (!map || !n?.maps?.Event) return;
    n.maps.Event.trigger(map, "resize");
  };

  const scheduleRelayout = () => {
    relayoutMap();
    requestAnimationFrame(() => {
      relayoutMap();
      requestAnimationFrame(relayoutMap);
    });
    setTimeout(relayoutMap, 120);
    setTimeout(relayoutMap, 400);
  };

  const initMap = () => {
    if (map) return;
    const center = new n.maps.LatLng(36.34, 127.77);
    map = new n.maps.Map(mapEl, {
      center,
      zoom: 7,
      minZoom: 6,
      maxZoom: 19,
      mapTypeControl: false,
    });

    clickListen = n.maps.Event.addListener(map, "click", (e) => {
      const latlng = e.coord;
      if (marker) marker.setMap(null);
      marker = new n.maps.Marker({ position: latlng, map });

      onStatus?.("주소를 확인하고 있어요…", "info");

      const coordStr = reverseGeocodeCoordsFromMapClick(latlng);
      if (!coordStr) {
        onStatus?.("누른 위치 좌표를 읽지 못했어요. 다시 눌러 주세요.", "error");
        return;
      }

      reverseGeocodeServiceToRegion(n, coordStr, regions, regionCities).then(({ parsed, transportOk }) => {
        if (parsed) {
          onPick(parsed);
          const loc = parsed.city
            ? `${parsed.province.name} ${parsed.city}`
            : parsed.province.name;
          onStatus?.(`지도에서 선택: ${loc}`, "success");
          return;
        }
        if (transportOk) {
          onStatus?.("시·도를 알 수 없어요. 목록에서 골라 주세요.", "error");
        } else {
          onStatus?.(
            "이 위치의 주소를 찾지 못했어요. 다른 곳을 누르거나 목록에서 골라 주세요.",
            "error"
          );
        }
      });
    });

    scheduleRelayout();
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => relayoutMap());
      resizeObserver.observe(mapEl);
    }
    window.addEventListener("orientationchange", onOrientation);
  };

  const destroy = () => {
    window.removeEventListener("orientationchange", onOrientation);
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (clickListen) n.maps.Event.removeListener(clickListen);
    clickListen = null;
    if (marker) marker.setMap(null);
    marker = null;
    map = null;
    mapEl.replaceChildren();
  };

  return {
    el: wrap,
    initMap,
    relayoutMap,
    setSelected() {},
    destroy,
  };
}
