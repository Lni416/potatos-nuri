import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getFeedItem, summarizeCard, getMyProfile, WelfareItem, UserProfile, SummarizeResponse } from "../utils/api";
import SummaryRenderer from "../components/ui/SummaryRenderer";

const TRUST_META: Record<string, { cls: string; icon: string; label: string }> = {
  high: { cls: "trust-badge--high", icon: "🟢", label: "공식 정보로 확인했어요" },
  medium: { cls: "trust-badge--medium", icon: "🟡", label: "일부 내용은 확인이 필요해요" },
  low: { cls: "trust-badge--low", icon: "🔴", label: "공식 사이트에서 꼭 확인하세요" },
};

export default function ItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<WelfareItem | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [result, setResult] = useState<SummarizeResponse | null>(null);
  const [loadingItem, setLoadingItem] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!itemId) return;
    setLoadingItem(true);
    Promise.all([getFeedItem(itemId), getMyProfile()])
      .then(([fetchedItem, profileData]) => {
        setItem(fetchedItem);
        setProfile(profileData.profile ?? null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadingItem(false));
  }, [itemId]);

  useEffect(() => {
    if (!item || !profile || !itemId) return;
    setLoadingSummary(true);
    summarizeCard({
      item_id: itemId,
      age: profile.age,
      region_name: profile.regionName,
      region_code: profile.regionCode,
      occupation: profile.occupation,
      interests: profile.interests,
    })
      .then((r) => setResult(r))
      .catch(() =>
        setResult({
          summary: "요약을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
          trust_level: "low",
          unverified_notes: [],
          official_url: item.sourceUrl ?? item.source_url ?? "",
          eligibility_hint: "",
        })
      )
      .finally(() => setLoadingSummary(false));
  }, [item, profile, itemId]);

  if (loadingItem) {
    return <div className="loading-screen"><span className="loading-spinner" /></div>;
  }

  if (error || !item) {
    return (
      <div className="detail-error">
        <p>{error ?? "정보를 찾을 수 없습니다."}</p>
        <button onClick={() => navigate(-1)}>돌아가기</button>
      </div>
    );
  }

  const isWelfare = item.category === "복지";

  return (
    <article className="item-detail">
      <button className="detail-back" onClick={() => navigate(-1)} aria-label="뒤로">
        ← 목록으로
      </button>

      <header className="detail-header">
        <span className={`detail-category${isWelfare ? "" : " event"}`}>
          {isWelfare ? "🏛️ 복지 혜택" : "🎪 행사·축제"}
        </span>
        <h1 className="detail-title">{item.title}</h1>
        {item.sourceName || item.source_name ? (
          <p className="detail-source">
            출처:{" "}
            {(item.sourceUrl || item.source_url) ? (
              <a
                href={item.sourceUrl ?? item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="detail-source-link"
              >
                {item.sourceName ?? item.source_name}
              </a>
            ) : (
              item.sourceName ?? item.source_name
            )}
          </p>
        ) : null}
        {item.applyDeadline && (
          <p className="detail-deadline">
            📅 신청 마감: {new Date(item.applyDeadline).toLocaleDateString("ko-KR")}
          </p>
        )}
      </header>

      <section className="detail-summary">
        <h2 className="detail-summary-heading">
          ✦ AI 요약{loadingSummary && <span className="summary-loading-dot">...</span>}
        </h2>

        {!loadingSummary && result && (
          <div className={`trust-badge ${TRUST_META[result.trust_level]?.cls ?? "trust-badge--medium"}`}>
            <span className="trust-badge-icon">{TRUST_META[result.trust_level]?.icon ?? "🟡"}</span>
            <span>{TRUST_META[result.trust_level]?.label ?? "일부 내용은 확인이 필요해요"}</span>
          </div>
        )}

        {loadingSummary ? (
          <div className="summary-skeleton">
            <div className="skeleton-heading" />
            <div className="skeleton-line w80" />
            <div className="skeleton-line w60" />
            <div className="skeleton-heading mt" />
            <div className="skeleton-line w90" />
          </div>
        ) : (
          <>
            <SummaryRenderer text={result?.summary ?? ""} />

            {result?.eligibility_hint && (
              <p className="eligibility-hint">{result.eligibility_hint}</p>
            )}

            {result && result.unverified_notes.length > 0 && (
              <div className="unverified-callout">
                <p className="unverified-title">⚠️ 확인이 필요한 정보</p>
                <p className="unverified-desc">
                  아래 항목은 공식 출처로 정확히 확인하지 못했어요. 신청 전 꼭 확인하세요.
                </p>
                <ul className="unverified-list">
                  {result.unverified_notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </div>
            )}

            {(result?.official_url || item.sourceUrl || item.source_url) && (
              <a
                className="official-cta"
                href={result?.official_url || item.sourceUrl || item.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                공식 사이트에서 확인하기 →
              </a>
            )}

            <p className="summary-disclaimer">
              AI가 정리한 내용이에요. 신청 전 공식 사이트에서 최종 확인하세요.
            </p>
          </>
        )}
      </section>
    </article>
  );
}
