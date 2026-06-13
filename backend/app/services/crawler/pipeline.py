"""크롤링 파이프라인 — 복지로 API + Gemini grounding → Firestore 저장."""

import asyncio
import hashlib
import logging
from datetime import datetime, timedelta, timezone

import httpx
from google.cloud import firestore as fs

from app.config import get_settings
from app.services.crawler.agent import CrawledItem, extract_welfare_items
from app.services.firestore import get_db, upsert_welfare_item

logger = logging.getLogger(__name__)

# 광역 검색 쿼리 목록 (카테고리별 광역 검색)
CRAWL_QUERIES = [
    ("생활지원", "복지로 생활지원 긴급복지 기초생활수급 신청가능 2025"),
    ("의료건강", "복지로 의료급여 건강지원 복지서비스 신청가능 2025"),
    ("주거", "복지로 주거급여 임대지원 주거복지 신청가능 2025"),
    ("취업고용", "복지로 취업지원 고용장려금 일자리 복지서비스 2025"),
    ("교육장학", "복지로 교육급여 국가장학금 학비지원 신청가능 2025"),
    ("임신육아", "복지로 임신출산 육아지원 아동수당 보육료 2025"),
    ("노인돌봄", "복지로 기초연금 노인돌봄 장기요양 어르신지원 2025"),
    ("문화여가", "복지로 문화누리 통합문화이용권 여가지원 2025"),
    ("법률인권", "복지로 법률구조 권익보호 피해지원 2025"),
    ("장애지원", "복지로 장애인연금 활동보조 장애서비스 2025"),
]


def _make_item_id(source_name: str, title: str) -> str:
    """결정적 해시로 중복 방지 ID 생성."""
    key = f"{source_name}::{title}"
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:12]


def _item_to_firestore(item: CrawledItem, crawled_at: datetime) -> dict:
    """CrawledItem → Firestore 문서 dict 변환."""
    expires_at = crawled_at + timedelta(days=30)
    if item.apply_deadline:
        try:
            deadline_dt = datetime.fromisoformat(item.apply_deadline).replace(tzinfo=timezone.utc)
            expires_at = deadline_dt + timedelta(days=7)
        except ValueError:
            pass

    return {
        "title": item.title,
        "category": item.category,
        "rawText": item.raw_text,
        "sourceName": item.source_name,
        "sourceUrl": item.source_url,
        "applyDeadline": (
            datetime.fromisoformat(item.apply_deadline).replace(tzinfo=timezone.utc)
            if item.apply_deadline else None
        ),
        "applyStart": (
            datetime.fromisoformat(item.apply_start).replace(tzinfo=timezone.utc)
            if item.apply_start else None
        ),
        "targetAgeMin": item.target_age_min,
        "targetAgeMax": item.target_age_max,
        "targetOccupations": item.target_occupations,
        "targetInterests": item.target_interests,
        "regions": item.regions or ["전국"],
        "crawledAt": crawled_at,
        "expiresAt": expires_at,
        "isActive": True,
        "summaryCache": None,
    }


async def _search_with_grounding(query: str, api_key: str) -> str:
    """Gemini grounding 검색으로 원문 텍스트 수집."""
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"""다음 검색어로 현재 신청 가능한 복지 서비스를 찾아 목록으로 정리해 주세요.
각 서비스의 제목, 지원 대상, 지원 내용, 신청 기간, 신청 방법을 포함하세요.

검색어: {query}""",
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                temperature=0.1,
                max_output_tokens=4096,
            ),
        )
        return response.text or ""
    except Exception as e:
        logger.warning("Grounding 검색 실패: query=%s error=%s", query, e)
        return ""


async def run_crawl_pipeline() -> dict:
    """
    전체 크롤링 파이프라인 실행.
    반환: {"saved": int, "failed": int, "total_queries": int}
    """
    settings = get_settings()
    if not settings.GEMINI_API_KEY:
        logger.error("GEMINI_API_KEY가 없어 크롤링 불가")
        return {"saved": 0, "failed": 0, "total_queries": 0}

    crawled_at = datetime.now(timezone.utc)
    saved = 0
    failed = 0

    for interest_cat, query in CRAWL_QUERIES:
        logger.info("크롤링 시작: category=%s", interest_cat)
        try:
            raw_text = await _search_with_grounding(query, settings.GEMINI_API_KEY)
            if not raw_text:
                logger.warning("빈 검색 결과: category=%s", interest_cat)
                failed += 1
                continue

            items = await extract_welfare_items(raw_text, settings.GEMINI_API_KEY)
            for item in items:
                try:
                    item_id = _make_item_id(item.source_name, item.title)
                    # target_interests에 현재 카테고리가 없으면 추가
                    if interest_cat not in item.target_interests:
                        item.target_interests.append(interest_cat)
                    doc = _item_to_firestore(item, crawled_at)
                    upsert_welfare_item(item_id, doc)
                    saved += 1
                    logger.debug("저장: %s", item.title)
                except Exception as e:
                    logger.error("아이템 저장 실패: %s error=%s", item.title, e)
                    failed += 1

            # API 과부하 방지
            await asyncio.sleep(2.0)

        except Exception as e:
            logger.error("카테고리 크롤링 실패: category=%s error=%s", interest_cat, e)
            failed += 1

    logger.info("크롤링 완료: saved=%d failed=%d", saved, failed)
    return {"saved": saved, "failed": failed, "total_queries": len(CRAWL_QUERIES)}
