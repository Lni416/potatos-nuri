"""크롤링 배치 잡 — Cloud Run Job 또는 로컬 실행."""

import asyncio
import logging

import firebase_admin
from firebase_admin import credentials

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def main() -> None:
    # Firebase Admin 초기화
    if not firebase_admin._apps:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin 초기화 완료")

    from app.services.crawler.pipeline import run_crawl_pipeline
    from app.services.firestore import deactivate_expired_items

    logger.info("=== 복지 데이터 크롤링 시작 ===")

    # 만료 아이템 비활성화
    expired = deactivate_expired_items()
    logger.info("만료 아이템 비활성화: %d건", expired)

    # 크롤링 실행
    result = await run_crawl_pipeline()
    logger.info(
        "=== 크롤링 완료: saved=%d failed=%d total_queries=%d ===",
        result["saved"], result["failed"], result["total_queries"],
    )


if __name__ == "__main__":
    asyncio.run(main())
