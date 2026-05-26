"""
복지·행사 정보 수집 및 요약 서비스.

전략:
1. 복지 정보: Gemini + Google Search grounding으로 직접 검색 (공공API 대신)
2. 지역 행사: TourAPI(공공데이터포털)로 수집 시도
3. 수집된 원문을 Gemini가 시니어 친화적으로 요약
"""
import asyncio
import json
import logging
import re
from pathlib import Path

from google import genai
from google.genai import errors, types

from app.config import get_settings
from app.services.events import fetch_events, format_events_for_summary

logger = logging.getLogger(__name__)

_RULES_PATH = Path(__file__).resolve().parents[3] / "rules.md"
MAX_ITEMS_FOR_SUMMARY = 32
EVENT_CAP = 8
GEMINI_RETRY_DELAYS_SECONDS = (1.0, 2.0)
TRANSIENT_GEMINI_ERROR_CODES = {429, 500, 502, 503, 504}

INTEREST_KEYWORDS: dict[str, list[str]] = {
    "생활지원": ["생활비", "생계", "긴급복지", "식품", "에너지", "냉난방", "생활지원", "기초생활", "생계급여", "에너지바우처"],
    "의료건강": ["의료비", "건강", "병원", "치료", "건강검진", "재활", "정신건강", "요양", "의약품", "의료급여", "진료"],
    "주거":     ["주거", "임대", "주택", "전세", "월세", "거주", "주거급여", "공공임대", "주거비"],
    "취업고용": ["취업", "일자리", "고용", "직업훈련", "창업", "취업성공패키지", "국민취업지원", "고용장려금"],
    "교육장학": ["교육", "장학", "학비", "교육급여", "국가장학금", "훈련", "학습", "학교", "수업료"],
    "임신육아": ["임신", "출산", "육아", "보육", "아동", "아이돌봄", "영유아", "아동수당", "육아휴직", "출산장려금"],
    "노인돌봄": ["노인", "어르신", "돌봄", "요양", "기초연금", "노인돌봄", "장기요양", "시니어", "노인복지"],
    "문화여가": ["문화", "여가", "문화누리", "체육", "관광", "축제", "통합문화이용권", "문화비"],
    "법률인권": ["법률", "인권", "권익", "피해", "법률구조", "상담", "권리", "분쟁"],
    "장애지원": ["장애", "장애인", "장애인연금", "활동보조", "보조기구", "장애급여", "장애서비스"],
}

OCCUPATION_LABEL: dict[str, str] = {
    "employed": "직장인",
    "self-employed": "자영업자",
    "unemployed": "무직/구직자",
    "student": "학생",
    "retired": "은퇴자",
    "homemaker": "가정주부",
    "disability": "장애인",
    "farmer": "농어업인",
    "other": "",
}


def _load_summary_rules() -> str:
    try:
        content = _RULES_PATH.read_text(encoding="utf-8")
        marker = "[원문 데이터]:"
        idx = content.find(marker)
        if idx != -1:
            return content[:idx].strip()
        return content.strip()
    except FileNotFoundError:
        return ""


def _model_candidates(primary_model: str, fallback_models: list[str]) -> list[str]:
    models = []
    for model in [primary_model, *fallback_models]:
        model = model.strip()
        if model and model not in models:
            models.append(model)
    return models


def _extract_json(text: str) -> dict | None:
    """Gemini 응답 텍스트에서 JSON 블록 또는 raw JSON 추출."""
    block = re.search(r"```(?:json)?\s*([\s\S]+?)```", text)
    if block:
        try:
            return json.loads(block.group(1))
        except json.JSONDecodeError:
            pass
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return None


def _build_basic_summary(item: dict) -> str:
    fields = {}
    for line in item.get("raw_text", "").splitlines():
        label, separator, value = line.partition(":")
        if separator and value.strip():
            fields[label.strip()] = value.strip()

    overview = fields.get("서비스 요약") or fields.get("개요") or item.get("title", "정보")
    target = fields.get("지원 대상") or fields.get("대상 특성")
    benefit = fields.get("지원 내용")
    apply_method = fields.get("신청 방법")
    contact = fields.get("문의 전화") or fields.get("대표 문의처")

    sections = ["### 한눈에 보기", f"- {overview}"]
    if target:
        sections.extend(["", "### 누가 받을 수 있나요?", f"- {target}"])
    if benefit:
        sections.extend(["", "### 어떤 도움을 받을 수 있나요?", f"- {benefit}"])
    if apply_method:
        sections.extend(["", "### 어떻게 신청하나요?", f"- {apply_method}"])
    if contact:
        sections.extend(["", "### 문의", f"- {contact}"])

    return "\n".join(sections)


async def _search_welfare_grounding(
    client: genai.Client,
    models: list[str],
    age: int,
    region_name: str,
    occupation: str,
    interests: list[str],
) -> list[dict]:
    """Gemini + Google Search grounding으로 현행 복지 서비스 검색."""
    occupation_kor = OCCUPATION_LABEL.get(occupation, occupation) or "일반"
    interest_kor = ", ".join(interests) if interests else "생활 전반"

    prompt = f"""다음 조건에 맞는 현재 신청 가능한 복지 서비스를 bokjiro.go.kr, mohw.go.kr, 해당 지역 복지관 사이트에서 검색하여 6~8개를 찾아 주세요.

조건:
- 나이: {age}세
- 거주 지역: {region_name}
- 직업/신분: {occupation_kor}
- 필요한 지원 분야: {interest_kor} (복지로 공식 분류 기준)

각 서비스에 대해 반드시 다음 JSON 형식으로만 응답해 주세요. 다른 설명 없이 JSON만 출력하세요.

{{
  "welfare_items": [
    {{
      "id": "고유 번호 (w1, w2, ...)",
      "title": "서비스 명칭",
      "category": "복지",
      "target": "지원 대상 (예: 65세 이상 노인, 기초생활수급자 등)",
      "benefit": "지원 내용 (금액, 서비스 종류 등)",
      "how_to_apply": "신청 방법 (온라인/방문/전화 등)",
      "contact": "문의처 또는 전화번호",
      "source_name": "출처 기관명",
      "source_url": "출처 URL (없으면 빈 문자열)"
    }}
  ]
}}"""

    last_error: Exception | None = None
    for model in models:
        for attempt in range(len(GEMINI_RETRY_DELAYS_SECONDS) + 1):
            try:
                logger.info("복지 grounding 검색: model=%s attempt=%d", model, attempt + 1)
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        tools=[types.Tool(google_search=types.GoogleSearch())],
                        temperature=0.1,
                        max_output_tokens=8192,
                    ),
                )
                text = response.text or ""
                data = _extract_json(text)
                if data and data.get("welfare_items"):
                    items = data["welfare_items"]
                    logger.info("복지 grounding 완료: %d건 수집", len(items))
                    return [
                        {
                            "id": item.get("id", f"w{i}"),
                            "title": item.get("title", "복지 서비스"),
                            "category": "복지",
                            "raw_text": (
                                f"지원 대상: {item.get('target', '')}\n"
                                f"지원 내용: {item.get('benefit', '')}\n"
                                f"신청 방법: {item.get('how_to_apply', '')}\n"
                                f"문의: {item.get('contact', '')}"
                            ),
                            "source_name": item.get("source_name", "복지로"),
                            "source_url": item.get("source_url", ""),
                        }
                        for i, item in enumerate(items, 1)
                    ]

                logger.warning("grounding 응답에 welfare_items 없음: model=%s, text=%s", model, text[:200])
                last_error = ValueError("grounding 응답에 welfare_items 없음")
                break

            except errors.APIError as e:
                last_error = e
                if e.code not in TRANSIENT_GEMINI_ERROR_CODES:
                    logger.error("Gemini grounding API 오류: code=%s status=%s", e.code, e.status)
                    break
                logger.warning("Gemini grounding 일시 장애: code=%s attempt=%d", e.code, attempt + 1)
                if attempt >= len(GEMINI_RETRY_DELAYS_SECONDS):
                    break

            except Exception as e:
                last_error = e
                logger.error("복지 grounding 실패: model=%s error=%s", model, e)
                break

            await asyncio.sleep(GEMINI_RETRY_DELAYS_SECONDS[attempt])

    logger.error("모든 grounding 시도 실패: %s", last_error)
    return []


async def _collect_events(region_name: str) -> list[dict]:
    """TourAPI로 지역 행사 수집. 실패해도 빈 리스트 반환."""
    try:
        event_items = await fetch_events(region_code=region_name, num_of_rows=20)
        return format_events_for_summary(event_items)
    except Exception as e:
        logger.warning("TourAPI 행사 수집 실패 (무시): %s", e)
        return []


async def _request_gemini_summaries(
    client: genai.Client,
    models: list[str],
    summary_prompt: str,
    summary_system: str,
) -> dict[str, str]:
    """Gemini 요약 요청. 일시 장애는 재시도하고 모델 후보를 순차 사용한다."""
    last_error: Exception | None = None

    for model in models:
        for attempt in range(len(GEMINI_RETRY_DELAYS_SECONDS) + 1):
            try:
                logger.info("요약 요청: model=%s attempt=%d", model, attempt + 1)
                summary_response = client.models.generate_content(
                    model=model,
                    contents=summary_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=summary_system,
                        temperature=0.2,
                        max_output_tokens=16384,
                        response_mime_type="application/json",
                    ),
                )

                summary_json_text = summary_response.text or ""
                summary_data = json.loads(summary_json_text)
                summaries = {
                    s["id"]: s["summary"]
                    for s in summary_data.get("summaries", [])
                    if s.get("id") and s.get("summary")
                }

                if summaries:
                    logger.info("요약 완료: model=%s, %d건", model, len(summaries))
                    return summaries

                last_error = ValueError("Gemini 응답에 summaries가 없습니다.")
                logger.warning("Gemini 응답에 summaries 없음: model=%s", model)
                break

            except json.JSONDecodeError as e:
                last_error = e
                logger.warning("Gemini 요약 JSON 파싱 실패: model=%s error=%s", model, e)
                if attempt >= len(GEMINI_RETRY_DELAYS_SECONDS):
                    break

            except errors.APIError as e:
                last_error = e
                if e.code not in TRANSIENT_GEMINI_ERROR_CODES:
                    logger.error("Gemini API 오류: model=%s code=%s status=%s", model, e.code, e.status)
                    break
                logger.warning("Gemini 일시 장애: code=%s attempt=%d", e.code, attempt + 1)
                if attempt >= len(GEMINI_RETRY_DELAYS_SECONDS):
                    break

            except Exception as e:
                last_error = e
                logger.error("Gemini 요약 실패: model=%s error=%s", model, e)
                break

            await asyncio.sleep(GEMINI_RETRY_DELAYS_SECONDS[attempt])

    if last_error:
        logger.error("모든 요약 시도 실패: %s", last_error)
    return {}


SUMMARY_SYSTEM_PROMPT_TEMPLATE = """당신은 복잡하고 어려운 공공기관의 복지 혜택 및 행사 공고문을 누구나 쉽게 이해할 수 있도록 요약해 주는 친절한 AI 비서 '누리'입니다.

{rules}

아래에 주어지는 여러 복지/행사 항목을 각각 요약 규칙에 따라 요약하세요.

## 응답 형식
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력하세요.

```json
{{
  "summaries": [
    {{
      "id": "원본 항목의 id",
      "summary": "요약된 마크다운 텍스트"
    }}
  ]
}}
```"""


def _apply_interest_filter(items: list[dict], interests: list[str]) -> list[dict]:
    if not interests:
        return items

    keywords = []
    for interest in interests:
        normalized = interest.strip()
        if not normalized:
            continue
        keywords.extend(INTEREST_KEYWORDS.get(normalized, [normalized]))

    lowered_keywords = [kw.lower() for kw in keywords if kw.strip()]
    if not lowered_keywords:
        return items

    matched = []
    for item in items:
        haystack = f"{item.get('title', '')}\n{item.get('raw_text', '')}".lower()
        if any(kw in haystack for kw in lowered_keywords):
            matched.append(item)

    return matched if matched else items


async def search_and_summarize(
    age: int,
    region_name: str,
    occupation: str,
    interests: list[str],
) -> list[dict]:
    """
    Gemini Google Search grounding으로 맞춤형 복지 정보를 수집하고,
    TourAPI로 지역 행사를 보강한 뒤 Gemini로 시니어 친화적으로 요약합니다.
    """
    settings = get_settings()

    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY가 없어 검색을 건너뜁니다.")
        return []

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    models = _model_candidates(settings.GEMINI_MODEL, settings.GEMINI_FALLBACK_MODELS)

    # ── 1단계: 복지(grounding) + 행사(TourAPI) 병렬 수집 ──
    welfare_task = _search_welfare_grounding(client, models, age, region_name, occupation, interests)
    events_task = _collect_events(region_name)
    welfare_raw, event_raw = await asyncio.gather(welfare_task, events_task)

    all_tagged: list[dict] = (
        [{**w, "category": "복지"} for w in welfare_raw]
        + [{**e, "category": "행사"} for e in event_raw[:EVENT_CAP]]
    )

    if interests:
        items = _apply_interest_filter(all_tagged, interests)[:MAX_ITEMS_FOR_SUMMARY]
    else:
        items = all_tagged[:MAX_ITEMS_FOR_SUMMARY]

    if not items:
        logger.warning("수집된 항목이 없습니다.")
        return []

    logger.info("1단계 완료: 복지 %d건 / 행사 %d건", len(welfare_raw), len(event_raw))

    # ── 2단계: 시니어 친화적 요약 ──
    rules_text = _load_summary_rules()
    summary_system = SUMMARY_SYSTEM_PROMPT_TEMPLATE.format(rules=rules_text)

    items_for_summary = [
        {"id": item.get("id", ""), "title": item.get("title", ""), "raw_text": item.get("raw_text", "")}
        for item in items
    ]

    summary_prompt = f"""아래 {len(items_for_summary)}건의 복지/행사 항목을 각각 요약해 주세요.

{json.dumps(items_for_summary, ensure_ascii=False, indent=2)}"""

    summaries = await _request_gemini_summaries(
        client=client,
        models=models,
        summary_prompt=summary_prompt,
        summary_system=summary_system,
    )

    # ── 결과 조합 ──
    results = []
    for item in items:
        item_id = item.get("id", "")
        results.append({
            "id": item_id,
            "title": item.get("title", "정보"),
            "category": item.get("category", "복지"),
            "summary": summaries.get(item_id) or _build_basic_summary(item),
            "raw_text": item.get("raw_text", ""),
            "source_name": item.get("source_name", ""),
            "source_url": item.get("source_url", ""),
        })

    return results
