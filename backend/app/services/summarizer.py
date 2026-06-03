"""
단일 카드 개인화 요약 서비스.
사용자 프로필 + 원문을 받아 rules.md 포맷(🎁 🙋 📅 📝)으로 Gemini 요약을 생성합니다.
배치 요약 대신 카드 클릭 시 on-demand로 호출됩니다.
"""
import asyncio
import logging

from google import genai
from google.genai import errors, types

logger = logging.getLogger(__name__)

# rules.md 내용 인라인 (Docker 빌드 컨텍스트 외부 파일 의존성 제거)
_RULES_INLINE = """## [요약 규칙]
1. **독자 수준:** 초등학교 고학년 ~ 중학생 수준의 어휘력을 가진 사람이나 어르신들도 한 번에 이해할 수 있도록 평이한 일상어로 작성하세요.
2. **행정 용어 순화:** 어려운 한자어나 전문 용어는 반드시 쉬운 말로 풀어서 쓰세요.
3. **사실 기반(No Hallucination):** 절대로 원문에 없는 혜택이나 조건을 지어내지 마세요.
4. **정보 부족 안내:** 정보가 부족할 때는 "ℹ️ 원문에 자세한 안내가 없어 확인이 어려워요." 등의 표현을 사용하세요.
5. **감정 표현:** 과하지 않게 공감형 이모지를 사용하세요. (권장: 🙂 😊 💡 📌 ℹ️ 🧭)
6. **중요 내용 강조:** 핵심 단어와 조건은 **굵게** 표시하세요.
7. **가독성 최우선:** 자연스러운 문장은 억지로 불릿으로 쪼개지 마세요.
8. **간결한 구조화:** 아래 4개 섹션으로 요약하세요.

## [출력 포맷]
### 🎁 어떤 혜택(행사)인가요?
(핵심 혜택 내용 1~2문장)

### 🙋‍♀️ 누가 받을 수 있나요?
- (나이, 소득, 거주지 등 지원 자격)

### 📅 언제까지인가요?
- (신청 기간 또는 행사 일시)

### 📝 어떻게 신청하나요?
- (온라인/오프라인 신청 방법 및 필수 서류)"""


def _load_rules() -> str:
    return _RULES_INLINE


OCCUPATION_LABEL: dict[str, str] = {
    # 한국어 (StepSelector)
    "학생": "학생",
    "직장인": "직장인",
    "은퇴": "은퇴자",
    "구직자": "구직자/취업 준비중",
    "자영업": "자영업자",
    "기타": "",
    # 영어 (form.js)
    "employed": "직장인",
    "self-employed": "자영업자",
    "unemployed": "무직/구직자",
    "student": "학생",
    "retired": "은퇴자",
    "homemaker": "가정주부",
    "disability": "장애인",
    "farmer": "농어업인",
    "other": "",
}

_RETRY_DELAYS = (1.0, 2.0)
_TRANSIENT_CODES = {429, 500, 502, 503, 504}


def _load_rules() -> str:
    return _RULES_INLINE


def _make_prompt(
    rules: str,
    title: str,
    raw_text: str,
    age: int,
    region_name: str,
    occupation_kor: str,
    interests_kor: str,
) -> str:
    return f"""{rules}

---

## 이 요약을 받을 사용자 정보
- 나이: **{age}세**
- 거주지: **{region_name or "미입력"}**
- 직업/신분: **{occupation_kor or "일반"}**
- 관심 분야: **{interests_kor or "생활 전반"}**

## 요약 지시
위 사용자를 위해 아래 서비스를 [출력 포맷]의 4개 섹션(### 🎁, ### 🙋‍♀️, ### 📅, ### 📝)으로 요약해 주세요.
- 사용자의 나이·거주지·직업 조건에 비춰 이 서비스를 받을 수 있는지 🙋‍♀️ 섹션에 한 줄 추가하세요.
- 평이하고 따뜻한 말투(~해요, ~예요)를 사용하세요.
- 마크다운 본문만 출력하세요. JSON이나 부가 설명은 쓰지 마세요.

## 서비스 정보
**서비스명:** {title}

{raw_text}"""


async def summarize_card(
    client: genai.Client,
    models: list[str],
    title: str,
    raw_text: str,
    age: int,
    region_name: str,
    occupation: str,
    interests: list[str],
) -> str:
    """사용자 맞춤 단일 카드 요약. 실패 시 빈 문자열 반환."""
    rules = _load_rules()
    occupation_kor = OCCUPATION_LABEL.get(occupation, occupation)
    interests_kor = ", ".join(interests) if interests else ""
    prompt = _make_prompt(rules, title, raw_text, age, region_name, occupation_kor, interests_kor)

    last_error: Exception | None = None
    for model in models:
        for attempt in range(len(_RETRY_DELAYS) + 1):
            try:
                logger.info("카드 요약: model=%s title=%.30s", model, title)
                resp = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.3,
                        max_output_tokens=1024,
                    ),
                )
                text = (resp.text or "").strip()
                if text:
                    logger.info("카드 요약 완료: model=%s", model)
                    return text
                last_error = ValueError("빈 응답")
                break

            except errors.APIError as e:
                last_error = e
                if e.code not in _TRANSIENT_CODES:
                    logger.error("카드 요약 API 오류: code=%s", e.code)
                    break
                logger.warning("카드 요약 일시 장애: code=%s attempt=%d", e.code, attempt + 1)
                if attempt >= len(_RETRY_DELAYS):
                    break

            except Exception as e:
                last_error = e
                logger.error("카드 요약 예외: model=%s error=%s", model, e)
                break

            await asyncio.sleep(_RETRY_DELAYS[attempt])

    logger.error("카드 요약 모든 모델 실패: %s", last_error)
    return ""
