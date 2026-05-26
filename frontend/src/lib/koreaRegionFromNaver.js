/**
 * 네이버 지도 reverseGeocode 응답(v2)에서 시·도·시군구 추출 후 TourAPI용 code와 맞춤.
 */

export function extractNaverSidoSigungu(v2) {
  const results = v2?.results;
  if (!Array.isArray(results) || results.length === 0) {
    return { sido: null, sigungu: null };
  }
  for (const r of results) {
    const sido = r?.region?.area1?.name?.trim() || null;
    if (sido) {
      const sigungu = r?.region?.area2?.name?.trim() || null;
      return { sido, sigungu };
    }
  }
  return { sido: null, sigungu: null };
}

const SIDO_NAME_OVERRIDES = new Map([
  ["전북특별자치도", "전북"],
  ["강원특별자치도", "강원"],
  ["제주특별자치도", "제주"],
]);

export function matchProvinceFromNaverSido(sidoName, regions) {
  if (!sidoName) return null;

  const overrideCode = SIDO_NAME_OVERRIDES.get(sidoName);
  if (overrideCode) {
    const r = regions.find((x) => x.code === overrideCode);
    if (r) return r;
  }

  const exact = regions.find((r) => r.name === sidoName);
  if (exact) return exact;

  const norm = sidoName.replace(/\s/g, "");
  for (const r of regions) {
    const rn = r.name.replace(/\s/g, "");
    if (norm === rn || norm.startsWith(rn) || rn.startsWith(norm)) return r;
  }

  for (const r of regions) {
    const short = r.name.replace(/특별시|광역시|특별자치시|특별자치도|도/g, "");
    if (short.length >= 2 && norm.includes(short)) return r;
  }

  return null;
}

export function matchCityFromNaverSigungu(sigungu, provinceCode, regionCities) {
  if (!sigungu) return "";
  const cities = regionCities[provinceCode] || [];
  const found = cities.find(
    (c) => sigungu === c || sigungu.includes(c) || c.includes(sigungu)
  );
  return found || "";
}

export function parseNaverReverseGeocodeForForm(v2, regions, regionCities) {
  const { sido, sigungu } = extractNaverSidoSigungu(v2);
  const province = matchProvinceFromNaverSido(sido, regions);
  if (!province) return null;
  const city = matchCityFromNaverSigungu(sigungu, province.code, regionCities);
  return { province, city };
}

export function parseNaverReverseGeocodeResponse(response, regions, regionCities) {
  const v2 = response?.v2;
  if (v2) {
    const fromV2 = parseNaverReverseGeocodeForForm(v2, regions, regionCities);
    if (fromV2) return fromV2;
  }

  const items = response?.result?.items;
  if (Array.isArray(items)) {
    for (const item of items) {
      const d = item?.addrdetail;
      const sidoRaw = d?.sido;
      if (typeof sidoRaw !== "string" || !sidoRaw.trim()) continue;
      const sido = sidoRaw.trim();
      const sigunguRaw = d?.sigugun;
      const sigungu = typeof sigunguRaw === "string" ? sigunguRaw.trim() : "";
      const province = matchProvinceFromNaverSido(sido, regions);
      if (!province) continue;
      const city = matchCityFromNaverSigungu(sigungu || null, province.code, regionCities);
      return { province, city };
    }
  }

  return null;
}
