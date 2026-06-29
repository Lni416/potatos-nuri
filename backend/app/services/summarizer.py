"""
단일 카드 사실 요약 서비스.

정확도 보장 전략:
  1. Google Search Grounding으로 실시간 공식 정보를 PRIMARY 소스로 사용
  2. raw_text(크롤링 데이터)는 "어떤 서비스인지 식별"하는 힌트일 뿐, 사실 판단 기준이 아님
  3. 공식 출처로 확인 못 한 수치/조건은 [[TRUST]] 마커로 표시 → 프론트가 "확인 필요" UI로 노출

신뢰도 마커: grounding 툴과 JSON 강제출력은 한 호출에 병행 불가하므로,
본문 끝에 한 줄 마커를 출력시키고 서버가 분리한다. (LLM 호출은 1회)

요약은 비개인화 사실 본문만 생성한다 → item 단위로 캐시 공유 가능.
개인화(이 사용자가 받을 수 있나?)는 LLM이 아니라 구조화 필드로 규칙 계산한다(recommendation.eval_eligibility).
"""
import asyncio
import logging
import re

from google import genai
from google.genai import errors, types

logger = logging.getLogger(__name__)

_RULES = """## [요약 규칙]
1. **검색 우선 원칙:** Google 검색으로 이 서비스의 현재 공식 정보를 반드시 먼저 확인하세요.
   검색 결과와 아래 '참고 정보'가 다르면 **항상 검색 결과를 사용**하세요.
   참고 정보는 이전에 수집된 데이터로 오래됐거나 부정확할 수 있습니다.
2. **독자 수준:** 초등학교 고학년 ~ 중학생 수준, 어르신도 이해할 수 있는 평이한 일상어로 작성하세요.
3. **행정 용어 순화:** 어려운 한자어와 전문 용어는 쉬운 말로 풀어 쓰세요.
4. **감정 표현:** 공감형 이모지를 적절히 사용하세요. (권장: 🙂 😊 💡 📌 ℹ️)
5. **중요 내용 강조:** 핵심 단어와 조건은 **굵게** 표시하세요.
6. **가독성 최우선:** 자연스러운 문장은 억지로 불릿으로 쪼개지 마세요.
7. **간결한 구조화:** 아래 4개 섹션으로 요약하세요.

## [출력 포맷]
### 🎁 어떤 혜택(행사)인가요?
(핵심 혜택 내용 1~2문장)

### 🙋‍♀️ 누가 받을 수 있나요?
- (나이, 소득, 거주지 등 지원 자격 — 일반 기준으로 기술)

### 📅 언제까지인가요?
- (신청 기간 또는 행사 일시)

### 📝 어떻게 신청하나요?
- (온라인/오프라인 신청 방법 및 필수 서류)

## [신뢰도 마커 — 본문 맨 마지막 줄에 반드시 한 줄 출력]
형식: [[TRUST level=<high|medium|low> | unverified: <항목들 또는 none>]]
판정 기준:
- low: Google 검색으로 이 서비스의 공식 출처/정보를 찾지 못함
- medium: 출처는 찾았으나 일부 수치(지원금액·신청기간·자격기준 등)를 명확히 확인하지 못함
- high: 핵심 사실을 모두 공식 출처로 확인함
unverified에는 공식 출처로 확정하지 못한 항목을 쉼표로 나열하세요(예: 지원금액,성적기준). 모두 확인했으면 none.
예시: [[TRUST level=medium | unverified: 지원금액]]"""


_TRUST_RE = re.compile(
    r"\[\[\s*TRUST\s+level\s*=\s*(high|medium|low)\s*\|\s*unverified\s*:\s*([^\]]*?)\s*\]\]",
    re.IGNORECASE,
)

_RETRY_DELAYS = (1.0, 2.0)
_TRANSIENT_CODES = {429, 500, 502, 503, 504}


def _parse_trust_marker(text: str) -> tuple[str, str, list[str]]:
    """본문에서 [[TRUST ...]] 마커를 떼어내 (정리된 본문, level, unverified[]) 반환."""
    match = _TRUST_RE.search(text)
    if not match:
        # 마커 누락 시 보수적으로 medium 처리
        return text.strip(), "medium", []

    level = match.group(1).lower()
    raw_unverified = match.group(2).strip()
    unverified: list[str] = []
    if raw_unverified and raw_unverified.lower() != "none":
        unverified = [u.strip() for u in re.split(r"[,，]", raw_unverified) if u.strip()]

    cleaned = _TRUST_RE.sub("", text).strip()
    return cleaned, level, unverified


def _make_prompt(title: str, source_url: str, raw_text: str) -> str:
    source_hint = f"\n- 공식 출처: {source_url}" if source_url else ""
    return f"""{_RULES}

---

## 요약 지시
**1단계 — 검색:** 아래 서비스명{source_hint}으로 Google 검색을 수행해 현재 공식 자격 조건·지원 금액·신청 기간을 확인하세요.
**2단계 — 교차 검증:** 검색 결과와 '참고 정보'가 다르면 검색 결과를 사용하세요.
**3단계 — 요약 작성:** [출력 포맷] 4개 섹션으로 요약하고, 맨 마지막 줄에 [[TRUST]] 마커를 출력하세요.
- 평이하고 따뜻한 말투(~해요, ~예요)를 사용하세요.
- 특정 사용자 맞춤이 아니라 누구에게나 통하는 일반 기준으로 작성하세요.
- 마크다운 본문 + 마지막 줄 마커만 출력하세요.

## 서비스명
{title}

## 참고 정보 (크롤링 데이터 — 부정확할 수 있음, 검색 결과로 교정하세요)
{raw_text}"""


async def summarize_card(
    client: genai.Client,
    models: list[str],
    title: str,
    source_url: str,
    raw_text: str,
) -> dict:
    """
    비개인화 사실 요약 생성. grounding 1회 호출.
    반환: {"markdown": str, "trust_level": str, "unverified": list[str]}
    실패 시 markdown="".
    """
    prompt = _make_prompt(title, source_url, raw_text)

    last_error: Exception | None = None
    for model in models:
        for attempt in range(len(_RETRY_DELAYS) + 1):
            try:
                logger.info("카드 요약: model=%s title=%.30s", model, title)
                resp = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.3,
                        max_output_tokens=1024,
                        tools=[types.Tool(google_search=types.GoogleSearch())],
                    ),
                )
                text = (resp.text or "").strip()
                if text:
                    markdown, level, unverified = _parse_trust_marker(text)
                    logger.info("카드 요약 완료: model=%s trust=%s unverified=%d",
                                model, level, len(unverified))
                    return {"markdown": markdown, "trust_level": level, "unverified": unverified}
                last_error = ValueError("빈 응답")
                break

            except errors.APIError as e:
                last_error = e
                if e.code not in _TRANSIENT_CODES:
                    logger.error("카드 요약 API 오류: code=%s", e.code)
                    break
                logger.warning("카드 요약 일시 장애: code=%s attempt=%d", e.code, attempt + 1)
                if attempt >= len(_RETRY_DELAYS):
                    break

            except Exception as e:
                last_error = e
                logger.error("카드 요약 예외: model=%s error=%s", model, e)
                break

            await asyncio.sleep(_RETRY_DELAYS[attempt])

    logger.error("카드 요약 모든 모델 실패: %s", last_error)
    return {"markdown": "", "trust_level": "low", "unverified": []}
