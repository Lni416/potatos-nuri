"""Google Gemini API를 활용한 정보 요약 서비스."""

import logging
from pathlib import Path

from google import genai

from app.config import get_settings

logger = logging.getLogger(__name__)

# rules.md 로드 (프로젝트 루트 기준)
_RULES_PATH = Path(__file__).resolve().parents[3] / "rules.md"

def _load_system_prompt() -> str:
    """rules.md에서 시스템 프롬프트를 로드."""
    try:
        content = _RULES_PATH.read_text(encoding="utf-8")
        # '[원문 데이터]:' 이전까지만 시스템 프롬프트로 사용
        marker = "[원문 데이터]:"
        idx = content.find(marker)
        if idx != -1:
            return content[:idx].strip()
        return content.strip()
    except FileNotFoundError:
        logger.warning("rules.md 파일을 찾을 수 없습니다: %s", _RULES_PATH)
        return _DEFAULT_PROMPT


_DEFAULT_PROMPT = """당신은 복잡한 공공기관의 복지 혜택 및 행사 공고문을 누구나 쉽게 이해할 수 있도록 요약해주는 친절한 AI 비서 '누리'입니다.
중학생 수준의 어휘력으로 평이한 일상어를 사용하고, 어려운 행정 용어는 쉬운 말로 순화하세요.
다음 4가지 항목을 이모지와 개조식으로 정리하세요:
🎁 어떤 혜택(행사)인가요?
🙋‍♀️ 누가 받을 수 있나요?
📅 언제까지인가요?
📝 어떻게 신청하나요?
원문에 없는 내용은 절대 지어내지 마세요."""


async def summarize_item(raw_text: str, title: str = "") -> str:
    """원문 텍스트를 Gemini API로 요약."""
    settings = get_settings()

    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY가 설정되지 않았습니다. 원문을 그대로 반환합니다.")
        return f"⚠️ AI 요약을 사용하려면 Gemini API 키를 설정해주세요.\n\n---\n\n{raw_text}"

    system_prompt = _load_system_prompt()

    user_message = f"""아래의 [원문 데이터]를 요약 규칙에 따라 요약해 주세요.

[원문 데이터]:
제목: {title}
{raw_text}"""

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=user_message,
            config={
                "system_instruction": system_prompt,
                "temperature": 0.3,
                "max_output_tokens": 1024,
            },
        )
        return response.text or "요약 결과를 생성하지 못했습니다."

    except Exception as e:
        logger.error("Gemini API 호출 실패: %s", e)
        return f"⚠️ AI 요약 중 오류가 발생했습니다: {e}\n\n---\n원문:\n{raw_text[:500]}"


async def summarize_batch(items: list[dict[str, str]]) -> list[dict[str, str]]:
    """여러 항목을 일괄 요약. 각 item은 {id, title, raw_text, ...} 형태."""
    results = []
    for item in items:
        summary = await summarize_item(
            raw_text=item.get("raw_text", ""),
            title=item.get("title", ""),
        )
        results.append({
            **item,
            "summary": summary,
        })
    return results
