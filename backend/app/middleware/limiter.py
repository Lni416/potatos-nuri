"""slowapi 리미터 싱글턴 — 라우터에서 공유 import."""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
