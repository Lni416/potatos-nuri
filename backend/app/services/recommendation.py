"""복지 아이템 추천 점수 계산."""

from datetime import datetime, timezone


def score_item(item: dict, profile: dict) -> float:
    """
    사용자 프로필 기반 복지 아이템 점수 계산.
    최대 약 130점.
    """
    score = 0.0
    now = datetime.now(timezone.utc)

    user_interests: list[str] = profile.get("interests", [])
    user_region_code: str = profile.get("regionCode", "")
    user_region_name: str = profile.get("regionName", "")
    user_age: int = profile.get("age", 30)
    user_occupation: str = profile.get("occupation", "")

    item_interests: list[str] = item.get("targetInterests", [])
    item_regions: list[str] = item.get("regions", [])
    item_occupations: list[str] = item.get("targetOccupations", [])
    item_age_min: int | None = item.get("targetAgeMin")
    item_age_max: int | None = item.get("targetAgeMax")

    # 관심 분야 매칭 (최대 40점)
    matching = set(item_interests) & set(user_interests)
    score += len(matching) * 5.0
    if user_interests and set(user_interests).issubset(set(item_interests)):
        score += 10.0

    # 지역 매칭 (최대 30점)
    if not item_regions or "전국" in item_regions:
        score += 20.0
    elif user_region_code and user_region_code in item_regions:
        score += 30.0
    elif user_region_name and any(
        user_region_name.startswith(r) or r in user_region_name
        for r in item_regions
    ):
        score += 15.0

    # 나이 적합성 (최대 20점)
    age_min = item_age_min if item_age_min is not None else 0
    age_max = item_age_max if item_age_max is not None else 120
    if age_min <= user_age <= age_max:
        score += 20.0
    elif abs(user_age - age_min) <= 5 or abs(user_age - age_max) <= 5:
        score += 10.0

    # 직업 매칭 (최대 15점)
    if not item_occupations:
        score += 10.0
    elif user_occupation and user_occupation in item_occupations:
        score += 15.0

    # 최신성 (최대 10점, 30일 선형 감소)
    crawled_at = item.get("crawledAt")
    if crawled_at:
        if hasattr(crawled_at, "replace"):
            crawled_at = crawled_at.replace(tzinfo=timezone.utc) if crawled_at.tzinfo is None else crawled_at
        days_old = max(0, (now - crawled_at).days)
        score += max(0.0, 10.0 - days_old * (10.0 / 30.0))

    # 마감 긴박성 (최대 15점)
    apply_deadline = item.get("applyDeadline")
    if apply_deadline:
        if hasattr(apply_deadline, "replace"):
            apply_deadline = apply_deadline.replace(tzinfo=timezone.utc) if apply_deadline.tzinfo is None else apply_deadline
        days_left = (apply_deadline - now).days
        if 0 < days_left <= 3:
            score += 15.0
        elif days_left <= 7:
            score += 10.0
        elif days_left <= 14:
            score += 5.0

    return score


def eval_eligibility(profile: dict, item: dict) -> str:
    """
    구조화 필드 기반 규칙 자격 판정. LLM 없이 무료로 계산.
    사용자 프로필과 item의 나이/지역/직업 조건을 비교해 따뜻한 안내 한 줄 반환.
    """
    user_age: int = profile.get("age", 30)
    user_region_name: str = profile.get("regionName", "")
    user_region_code: str = profile.get("regionCode", "")
    user_occupation: str = profile.get("occupation", "")

    item_regions: list[str] = item.get("regions", [])
    item_occupations: list[str] = item.get("targetOccupations", [])
    item_age_min: int | None = item.get("targetAgeMin")
    item_age_max: int | None = item.get("targetAgeMax")

    mismatches: list[str] = []

    # 나이 조건
    age_min = item_age_min if item_age_min is not None else 0
    age_max = item_age_max if item_age_max is not None else 120
    if not (age_min <= user_age <= age_max):
        if item_age_min is not None and user_age < age_min:
            mismatches.append(f"나이 조건(만 {item_age_min}세 이상)")
        elif item_age_max is not None and user_age > age_max:
            mismatches.append(f"나이 조건(만 {item_age_max}세 이하)")

    # 지역 조건 (전국이면 통과)
    if item_regions and "전국" not in item_regions:
        region_ok = (
            (user_region_code and user_region_code in item_regions)
            or (user_region_name and any(
                user_region_name.startswith(r) or r in user_region_name
                for r in item_regions
            ))
        )
        if not region_ok:
            mismatches.append(f"거주 지역({'·'.join(item_regions)} 대상)")

    # 직업 조건 (비어있으면 전체 대상)
    if item_occupations and user_occupation and user_occupation not in item_occupations:
        mismatches.append(f"직업 조건({'·'.join(item_occupations)} 대상)")

    if not mismatches:
        return "회원님 조건에 잘 맞아 보여요. 자세한 자격은 공식 사이트에서 확인하세요. 😊"
    joined = ", ".join(mismatches)
    return f"⚠️ {joined}은 회원님과 맞지 않을 수 있어요. 예외 기준이 있을 수 있으니 공식 사이트에서 꼭 확인하세요."


def rank_items(items: list[dict], profile: dict, top_n: int = 20) -> list[dict]:
    """아이템 목록을 사용자 프로필 기반으로 점수 정렬 후 상위 top_n개 반환."""
    scored = [(item, score_item(item, profile)) for item in items]
    scored.sort(key=lambda x: x[1], reverse=True)
    result = []
    for item, score in scored[:top_n]:
        result.append({**item, "_score": round(score, 2)})
    return result
