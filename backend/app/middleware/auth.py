"""Firebase ID 토큰 검증 미들웨어."""

import logging

import firebase_admin
from firebase_admin import auth
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger(__name__)

_security = HTTPBearer(auto_error=True)


async def verify_firebase_token(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
) -> dict:
    """
    Authorization: Bearer <Firebase ID Token> 헤더를 검증합니다.
    성공 시 decoded token dict (uid, email 등) 반환.
    실패 시 HTTP 401 반환.
    """
    if not firebase_admin._apps:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase Admin SDK가 초기화되지 않았습니다.",
        )

    token = credentials.credentials
    try:
        decoded = auth.verify_id_token(token, check_revoked=False)
        return decoded
    except auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰이 만료되었습니다. 다시 로그인해 주세요.",
        )
    except (auth.InvalidIdTokenError, auth.UserNotFoundError) as e:
        logger.warning("Invalid Firebase token: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 인증 토큰입니다.",
        )
    except Exception as e:
        logger.error("Token verification error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="인증 처리 중 오류가 발생했습니다.",
        )


async def verify_admin_token(
    user: dict = Depends(verify_firebase_token),
) -> dict:
    """관리자 전용 엔드포인트 보호. 일반 사용자는 403 반환."""
    from app.config import get_settings
    settings = get_settings()
    if user.get("uid") not in settings.ADMIN_UIDS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다.",
        )
    return user
