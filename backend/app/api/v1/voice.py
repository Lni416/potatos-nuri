"""음성 NLU 엔드포인트."""

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.config import get_settings
from app.middleware.auth import verify_firebase_token
from app.middleware.limiter import limiter
from app.services.voice_nlu import NLUResult, interpret_voice

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/voice", tags=["voice"])


class VoiceInterpretRequest(BaseModel):
    transcript: str = Field(..., min_length=1, max_length=500)
    step: Literal["region", "age", "field"]


@router.post("/interpret", response_model=NLUResult)
@limiter.limit("30/minute")
async def interpret(
    request: Request,
    body: VoiceInterpretRequest,
    user: dict = Depends(verify_firebase_token),
):
    """
    음성 키워드 매칭 실패 시 Gemini NLU 폴백.
    나이('스물셋이야'), 지역('달성구에 살아'), 관심분야('집 구하기 힘들어') 등
    자연어 표현을 구조화된 선택지로 변환합니다.
    """
    settings = get_settings()
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="AI 서비스가 준비되지 않았습니다.")

    result = await interpret_voice(
        transcript=body.transcript,
        step=body.step,
        api_key=settings.GEMINI_API_KEY,
    )
    return result
