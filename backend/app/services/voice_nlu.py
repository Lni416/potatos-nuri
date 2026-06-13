"""음성 자연어 이해(NLU) 서비스 — Pydantic AI 기반."""

import logging
from typing import Literal

from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.models.gemini import GeminiModel

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """당신은 한국어 복지 앱의 음성 입력을 분석하는 NLU 모듈입니다.
사용자의 발화에서 나이·지역·관심분야 정보를 추출합니다.

## 나이 처리 규칙
- 한국 고유어 수사 변환: 열=10, 스물=20, 서른=30, 마흔=40, 쉰=50, 예순=60, 일흔=70
- 합성 수사: "스물셋"=23, "서른다섯"=35, "마흔둘"=42 등
- 한자어 수사: 이십=20, 삼십=30, 사십=40, 오십=50
- 접미 수식: "초반"(+1~3), "중반"(+4~6), "후반"(+7~9)으로 구간 중앙값 사용
- 나이 → 연령대 구간 매핑: 10대=10, 20대=20, 30대=30, 40대=40, 50대 이상=50

## 지역 처리 규칙
- 구/군 단위 → 상위 시/도 추론 ("달성구" → "대구", "분당구" → "경기", "해운대구" → "부산")
- 별칭/줄임말: "경남"→경상남도, "경북"→경상북도, "전남"→전라남도, "충남"→충청남도
- 가능한 선택지: 서울, 경기, 인천, 부산, 대구, 광주, 대전, 기타

## 관심분야 처리 규칙
- 간접 표현 인식: "집 구하기 힘들어"→주거, "아파서 병원"→의료건강, "아이 어린이집"→임신육아
- 생활 맥락에서 복지 카테고리 추론
- 가능한 카테고리: 생활지원, 의료건강, 주거, 취업고용, 교육장학, 임신육아, 노인돌봄, 문화여가

## 주의사항
- 확신이 낮으면 confidence 0.7 미만으로 반환하세요.
- matched_value는 반드시 주어진 options 중 하나여야 합니다. 없으면 null.
- reasoning은 간결하게 (로깅용, 사용자에게 표시되지 않음)."""


class NLUResult(BaseModel):
    matched_value: str | None = Field(None, description="선택지 value 중 하나, 없으면 null")
    matched_label: str | None = Field(None, description="표시 레이블")
    exact_age: int | None = Field(None, description="정확한 나이 (age step만)")
    confidence: float = Field(0.0, ge=0.0, le=1.0)
    reasoning: str = Field("", description="판단 근거")


STEP_CONTEXTS: dict[str, dict] = {
    "region": {
        "options": ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "기타"],
        "prompt_suffix": "사용자가 거주 지역을 말하고 있습니다. 가장 가까운 option을 matched_value로 반환하세요.",
    },
    "age": {
        "options": ["10", "20", "30", "40", "50"],
        "labels": {"10": "10대", "20": "20대", "30": "30대", "40": "40대", "50": "50대 이상"},
        "prompt_suffix": "사용자가 나이를 말하고 있습니다. 연령대 구간(10/20/30/40/50)으로 매핑하고 exact_age에 정확한 나이(정수)를 넣으세요.",
    },
    "field": {
        "options": ["생활지원", "의료건강", "주거", "취업고용", "교육장학", "임신육아", "노인돌봄", "문화여가"],
        "prompt_suffix": "사용자가 필요한 지원 분야를 말하고 있습니다. 복지 카테고리로 매핑하세요. 복수 언급 시 가장 강조된 하나만 반환하세요.",
    },
}

_agent: Agent | None = None


def _get_agent(api_key: str) -> Agent:
    global _agent
    if _agent is None:
        model = GeminiModel("gemini-2.5-flash-lite", api_key=api_key)
        _agent = Agent(model=model, result_type=NLUResult, system_prompt=_SYSTEM_PROMPT)
    return _agent


async def interpret_voice(transcript: str, step: str, api_key: str) -> NLUResult:
    """
    음성 트랜스크립트에서 구조화된 정보를 추출합니다.
    키워드 매칭 실패 시 프론트엔드가 호출하는 폴백 NLU.
    """
    ctx = STEP_CONTEXTS.get(step)
    if not ctx:
        logger.warning("알 수 없는 step: %s", step)
        return NLUResult(confidence=0.0, reasoning=f"알 수 없는 step: {step}")

    prompt = (
        f'발화: "{transcript}"\n'
        f'가능한 선택지: {ctx["options"]}\n'
        f'{ctx["prompt_suffix"]}'
    )

    try:
        agent = _get_agent(api_key)
        result = await agent.run(prompt)
        nlu: NLUResult = result.data

        # labels 매핑 (age step)
        if step == "age" and nlu.matched_value and "labels" in ctx:
            nlu.matched_label = ctx["labels"].get(nlu.matched_value)

        logger.info(
            "NLU 결과: step=%s transcript=%.30s matched=%s confidence=%.2f",
            step, transcript, nlu.matched_value, nlu.confidence,
        )
        return nlu

    except Exception as e:
        logger.error("NLU 오류: %s", e)
        return NLUResult(confidence=0.0, reasoning=f"NLU 오류: {e}")
