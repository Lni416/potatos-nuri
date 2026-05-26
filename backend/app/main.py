"""NuRI FastAPI 애플리케이션 엔트리포인트."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.v1.router import router as v1_router

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

settings = get_settings()

app = FastAPI(
    title="NuRI API",
    description="이용자 맞춤형 복지·행사 정보 요약 서비스",
    version="1.0.0",
)

# CORS 미들웨어
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(v1_router)


@app.get("/")
async def root():
    """루트 엔드포인트."""
    return {
        "service": "NuRI API",
        "version": "1.0.0",
        "docs": "/docs",
    }
