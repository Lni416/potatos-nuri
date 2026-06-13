"""환경변수 설정 관리 모듈."""

from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """애플리케이션 설정."""

    # 공공데이터포털 API 인증키
    DATA_GO_KR_API_KEY: str = ""

    # Google Gemini API 설정
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_FALLBACK_MODELS: list[str] = [
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash-001",
    ]
    # 카드 요약 전용 모델 (빠른 응답 우선)
    GEMINI_SUMMARY_MODEL: str = "gemini-2.5-flash-lite"

    # Firebase 설정
    FIREBASE_PROJECT_ID: str = "nuri-90a4f"
    ADMIN_UIDS: list[str] = []  # 관리자 UID 목록 (쉼표 구분)

    # 속도 제한
    RATE_LIMIT_FEED: str = "60/minute"
    RATE_LIMIT_SUMMARIZE: str = "20/minute"
    RATE_LIMIT_VOICE: str = "30/minute"

    # CORS 설정
    CORS_ORIGINS: list[str] = [
        "https://nuri-90a4f.web.app",
        "https://nuri-90a4f.firebaseapp.com",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> object:
        """Cloud Run 등: CORS_ORIGINS=https://a.com,https://b.com 형식 지원."""
        if isinstance(value, str):
            return [x.strip() for x in value.split(",") if x.strip()]
        return value

    @field_validator("ADMIN_UIDS", mode="before")
    @classmethod
    def parse_admin_uids(cls, value: object) -> object:
        if isinstance(value, str):
            return [x.strip() for x in value.split(",") if x.strip()]
        return value

    @field_validator("DATA_GO_KR_API_KEY", "GEMINI_API_KEY", mode="before")
    @classmethod
    def strip_api_keys(cls, value: str) -> str:
        """환경변수 키 값 양끝 공백/탭 제거."""
        if isinstance(value, str):
            return value.strip()
        return value


@lru_cache
def get_settings() -> Settings:
    """설정 싱글턴 반환."""
    return Settings()
