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
# key는 target_interests에 주입할 카테고리 값 — 프로필 관심분야 선택지와 1:1 대응해야 추천 점수가 붙음
CRAWL_QUERIES = [
    # ── 생활지원 ──────────────────────────────────────────────────────────────
    ("생활지원", "복지로 긴급복지지원 위기가구 생계지원 신청방법 2026"),
    ("생활지원", "기초생활수급자 생계급여 의료급여 주거급여 교육급여 선정기준 2026"),
    ("생활지원", "차상위계층 복지서비스 지원 혜택 신청 2026"),
    ("생활지원", "법률구조공단 무료법률상담 피해지원 권익보호 신청 2026"),
    ("생활지원", "장애인연금 장애수당 활동지원 장애인 복지서비스 2026"),

    # ── 의료건강 ──────────────────────────────────────────────────────────────
    ("의료건강", "복지로 의료급여 건강보험료 지원 취약계층 의료비 2026"),
    ("의료건강", "암환자 희귀질환 의료비 지원사업 신청 2026"),
    ("의료건강", "정신건강 상담 치료비 지원 복지서비스 2026"),
    ("의료건강", "노인 건강검진 치매 예방 치료지원 서비스 2026"),

    # ── 주거 ──────────────────────────────────────────────────────────────────
    ("주거", "주거급여 임차급여 수선유지급여 신청 자격 2026"),
    ("주거", "청년 행복주택 공공임대 청약 신청방법 2026"),
    ("주거", "전세사기 피해자 긴급주거지원 구제방안 2026"),
    ("주거", "주거취약계층 쪽방 고시원 임시주거 지원 2026"),

    # ── 취업고용 ──────────────────────────────────────────────────────────────
    ("취업고용", "고용노동부 국민취업지원제도 취업장려금 신청 2026"),
    ("취업고용", "청년 일자리 도약장려금 청년인턴 취업지원금 2026"),
    ("취업고용", "중장년 재취업 고용지원금 직업훈련 내일배움카드 2026"),
    ("취업고용", "자영업자 소상공인 고용지원 폐업지원금 2026"),

    # ── 교육장학 ──────────────────────────────────────────────────────────────
    ("교육장학", "교육급여 교육비 지원 학교 급식비 입학금 2026"),
    ("교육장학", "국가장학금 한국장학재단 대학생 장학금 신청 2026"),
    ("교육장학", "청소년 교육비 방과후 학원비 지원 저소득 2026"),
    ("교육장학", "평생교육 직업훈련 내일배움카드 국비지원과정 2026"),

    # ── 임신육아 ──────────────────────────────────────────────────────────────
    ("임신육아", "임신 출산 진료비 바우처 고운맘카드 신청 2026"),
    ("임신육아", "아동수당 영아수당 부모급여 지급대상 신청방법 2026"),
    ("임신육아", "어린이집 유치원 보육료 양육수당 지원 2026"),
    ("임신육아", "다자녀 혜택 첫만남이용권 출산지원금 신청 2026"),

    # ── 노인돌봄 ──────────────────────────────────────────────────────────────
    ("노인돌봄", "기초연금 수급자격 신청방법 지급액 2026"),
    ("노인돌봄", "노인장기요양보험 등급 재가급여 시설급여 신청 2026"),
    ("노인돌봄", "독거노인 노인돌봄서비스 안부확인 식사지원 2026"),
    ("노인돌봄", "치매안심센터 치매가족 지원 서비스 신청 2026"),

    # ── 문화여가 ──────────────────────────────────────────────────────────────
    ("문화여가", "문화누리카드 통합문화이용권 발급 사용처 2026"),
    ("문화여가", "청소년 문화 체육 여가활동 지원 바우처 2026"),
    ("문화여가", "스포츠강좌이용권 체육시설 이용료 지원 2026"),
]


def _make_item_id(source_name: str, title: str) -> str:
    """결정적 해시로 중복 방지 ID 생성."""
    key = f"{source_name}::{title}"
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:12]


# 프로필 관심분야 선택지 — 이 목록에 없는 값은 추천 점수가 붙지 않으므로 저장 전 필터링
_VALID_INTERESTS = {
    "생활지원", "의료건강", "주거", "취업고용",
    "교육장학", "임신육아", "노인돌봄", "문화여가",
}
# 프로필 직업 선택지 — 이 목록에 없는 값은 추천 점수가 붙지 않음
_VALID_OCCUPATIONS = {"학생", "직장인", "자영업자", "은퇴", "기타"}


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
        "targetOccupations": [o for o in item.target_occupations if o in _VALID_OCCUPATIONS],
        "targetInterests": [i for i in item.target_interests if i in _VALID_INTERESTS],
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
