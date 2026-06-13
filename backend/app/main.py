"""NuRI FastAPI 애플리케이션 엔트리포인트."""

import logging
from contextlib import asynccontextmanager

import firebase_admin
from firebase_admin import credentials
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 시작: Firebase Admin 초기화
    if not firebase_admin._apps:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {"projectId": settings.FIREBASE_PROJECT_ID})
        logging.getLogger(__name__).info(
            "Firebase Admin 초기화 완료: project=%s", settings.FIREBASE_PROJECT_ID
        )
    yield
    # 종료: 특별한 정리 없음


# 속도 제한 (UID 기반이 이상적이나, 간단히 IP 기반으로 시작)
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="NuRI API",
    description="이용자 맞춤형 복지·행사 정보 요약 서비스",
    version="2.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS 미들웨어
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
from app.api.v1.router import router as v1_router
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.feed import router as feed_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.voice import router as voice_router

app.include_router(v1_router)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(feed_router)
app.include_router(notifications_router)
app.include_router(voice_router)


@app.get("/")
async def root():
    return {"service": "NuRI API", "version": "2.0.0", "docs": "/docs"}
