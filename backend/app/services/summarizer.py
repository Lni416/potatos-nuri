"""
단일 카드 개인화 요약 서비스.
사용자 프로필 + 원문을 받아 rules.md 포맷(🎁 🙋 📅 📝)으로 Gemini 요약을 생성합니다.
배치 요약 대신 카드 클릭 시 on-demand로 호출됩니다.
"""
import asyncio
import logging
from pathlib import Path

from google import genai
from google.genai import errors, types

logger = logging.getLogger(__name__)

_RULES_PATH = Path(__file__).resolve().parents[3] / "rules.md"

OCCUPATION_LABEL: dict[str, str] = {
    # 한국어 (StepSelector)
    "학생": "학생",
    "직장인": "직장인",
    "은퇴": "은퇴자",
    "구직자": "구직자/취업 준비중",
    "자영업": "자영업자",
    "기타": "",
    # 영어 (form.js)
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

_RETRY_DELAYS = (1.0, 2.0)
_TRANSIENT_CODES = {429, 500, 502, 503, 504}


def _load_rules() -> str:
    try:
        content = _RULES_PATH.read_text(encoding="utf-8")
        marker = "[원문 데이터]:"
        idx = content.find(marker)
        return content[:idx].strip() if idx != -1 else content.strip()
    except FileNotFoundError:
        logger.warning("rules.md 파일을 찾을 수 없습니다: %s", _RULES_PATH)
        return ""


def _make_prompt(
    rules: str,
    title: str,
    raw_text: str,
    age: int,
    region_name: str,
    occupation_kor: str,
    interests_kor: str,
) -> str:
    return f"""{rules}

---

## 이 요약을 받을 사용자 정보
- 나이: **{age}세**
- 거주지: **{region_name or "미입력"}**
- 직업/신분: **{occupation_kor or "일반"}**
- 관심 분야: **{interests_kor or "생활 전반"}**

## 요약 지시
위 사용자를 위해 아래 서비스를 [출력 포맷]의 4개 섹션(### 🎁, ### 🙋‍♀️, ### 📅, ### 📝)으로 요약해 주세요.
- 사용자의 나이·거주지·직업 조건에 비춰 이 서비스를 받을 수 있는지 🙋‍♀️ 섹션에 한 줄 추가하세요.
- 평이하고 따뜻한 말투(~해요, ~예요)를 사용하세요.
- 마크다운 본문만 출력하세요. JSON이나 부가 설명은 쓰지 마세요.

## 서비스 정보
**서비스명:** {title}

{raw_text}"""


async def summarize_card(
    client: genai.Client,
    models: list[str],
    title: str,
    raw_text: str,
    age: int,
    region_name: str,
    occupation: str,
    interests: list[str],
) -> str:
    """사용자 맞춤 단일 카드 요약. 실패 시 빈 문자열 반환."""
    rules = _load_rules()
    occupation_kor = OCCUPATION_LABEL.get(occupation, occupation)
    interests_kor = ", ".join(interests) if interests else ""
    prompt = _make_prompt(rules, title, raw_text, age, region_name, occupation_kor, interests_kor)

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
                        max_output_tokens=2048,
                    ),
                )
                text = (resp.text or "").strip()
                if text:
                    logger.info("카드 요약 완료: model=%s", model)
                    return text
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
    return ""
