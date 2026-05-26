/**
 * API 요청 유틸리티.
 */

const API_BASE = "/api/v1";

/**
 * 맞춤형 복지/행사 정보 검색.
 * @param {Object} params
 * @param {number} params.age
 * @param {string} params.region_code
 * @param {string} params.region_name
 * @param {string} params.occupation
 * @param {string[]} params.interests
 * @returns {Promise<Object>} SearchResponse
 */
export async function searchInfo(params) {
  const response = await fetch(`${API_BASE}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`검색 요청 실패 (${response.status}): ${errorText}`);
  }

  return response.json();
}
