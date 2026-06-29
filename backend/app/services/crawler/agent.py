"""Pydantic AI 기반 복지 데이터 구조화 에이전트."""

import logging
from typing import Literal

from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.providers.google import GoogleProvider

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """당신은 복지 서비스 정보를 JSON 구조체로 변환하는 데이터 처리 AI입니다.
주어진 원문 텍스트에서 복지 서비스 정보를 추출하여 정확하게 구조화합니다.

## 필드 추출 규칙

**apply_deadline / apply_start**: ISO 8601 날짜 (YYYY-MM-DD). 명시되지 않으면 null.
**target_age_min / target_age_max**: 정수 나이. "65세 이상"이면 min=65, max=null. 제한 없으면 null.
**target_occupations**: ["학생","직장인","자영업자","은퇴","기타"] 중 해당 값만.
  - "은퇴자/고령자/어르신" → "은퇴"
  - "구직자/취업준비생/실직자" → "기타"
  - "가정주부/전업주부" → "기타"
  - "장애인/농어업인" → "기타"
  - 비어있음=전체 대상.
**target_interests**: ["생활지원","의료건강","주거","취업고용","교육장학","임신육아","노인돌봄","문화여가"] 중 해당 값만.
  - 법률·인권·권익 관련 → "생활지원"
  - 장애 서비스 관련 → "생활지원"
**regions**: ["전국"] 또는 ["서울","경기","인천","부산","대구","광주","대전","울산","세종","강원","충북","충남","전북","전남","경북","경남","제주"] 중 해당 값만.
  전국 대상이면 ["전국"].

## 주의사항
- 원문에 없는 내용은 추측하지 마세요.
- 날짜 형식은 반드시 YYYY-MM-DD.
- raw_text는 원문 핵심 정보를 줄바꿈으로 정리한 3~5줄 요약."""


class CrawledItem(BaseModel):
    title: str
    category: Literal["복지", "행사"]
    raw_text: str = Field(description="원문 핵심 정보 3~5줄 요약")
    source_name: str
    source_url: str = ""
    apply_deadline: str | None = None
    apply_start: str | None = None
    target_age_min: int | None = None
    target_age_max: int | None = None
    target_occupations: list[str] = Field(default_factory=list)
    target_interests: list[str] = Field(default_factory=list)
    regions: list[str] = Field(default_factory=lambda: ["전국"])


class CrawlResult(BaseModel):
    items: list[CrawledItem]


_agent: Agent | None = None


def _get_agent(api_key: str) -> Agent:
    global _agent
    if _agent is None:
        model = GoogleModel("gemini-2.5-flash", provider=GoogleProvider(api_key=api_key))
        _agent = Agent(model=model, output_type=CrawlResult, system_prompt=_SYSTEM_PROMPT)
    return _agent


async def extract_welfare_items(raw_content: str, api_key: str) -> list[CrawledItem]:
    """
    원문 텍스트(API 응답, 검색 결과 등)에서 복지 서비스 목록을 추출합니다.
    """
    prompt = f"""다음 복지 정보 원문에서 복지 서비스 항목들을 추출하세요.
각 서비스를 개별 항목으로 구분하여 구조화하세요.

원문:
{raw_content[:8000]}"""  # 토큰 제한

    try:
        agent = _get_agent(api_key)
        result = await agent.run(prompt)
        items = result.output.items
        logger.info("크롤러 에이전트: %d건 추출", len(items))
        return items
    except Exception as e:
        logger.error("크롤러 에이전트 오류: %s", e)
        return []
