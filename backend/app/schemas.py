"""Pydantic 요청/응답 스키마 정의."""

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    """사용자 검색 요청."""

    age: int = Field(..., ge=0, le=120, description="나이")
    region_code: str = Field(..., description="시/도 지역 코드")
    region_name: str = Field("", description="지역명 (표시용)")
    occupation: str = Field("기타", description="직업 상태")
    interests: list[str] = Field(default_factory=list, description="관심 분야 목록")


class SummaryCard(BaseModel):
    """요약된 혜택/행사 정보 카드."""

    id: str = Field(..., description="고유 식별자")
    title: str = Field(..., description="혜택/행사 제목")
    category: str = Field("복지", description="카테고리 (복지/행사)")
    summary: str = Field(..., description="Gemini가 요약한 본문 (마크다운)")
    original_text: str = Field("", description="원문 텍스트")
    source_url: str = Field("", description="원문 출처 URL")
    source_name: str = Field("", description="출처 기관명")
    apply_deadline: str = Field("", description="신청 기한")


class SearchResponse(BaseModel):
    """검색 응답."""

    cards: list[SummaryCard] = Field(default_factory=list)
    total_count: int = Field(0, description="총 결과 수")
    message: str = Field("", description="안내 메시지")
