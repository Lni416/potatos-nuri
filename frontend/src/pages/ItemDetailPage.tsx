import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getFeedItem, summarizeCard, getMyProfile, WelfareItem, UserProfile } from "../utils/api";
import SummaryRenderer from "../components/ui/SummaryRenderer";

export default function ItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<WelfareItem | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
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
    if (!item || !profile) return;
    setLoadingSummary(true);
    summarizeCard({
      title: item.title,
      raw_text: item.rawText ?? item.raw_text ?? "",
      age: profile.age,
      region_name: profile.regionName,
      occupation: profile.occupation,
      interests: profile.interests,
    })
      .then(({ summary: s }) => setSummary(s))
      .catch(() => setSummary("요약을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."))
      .finally(() => setLoadingSummary(false));
  }, [item, profile]);

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
        {loadingSummary ? (
          <div className="summary-skeleton">
            <div className="skeleton-heading" />
            <div className="skeleton-line w80" />
            <div className="skeleton-line w60" />
            <div className="skeleton-heading mt" />
            <div className="skeleton-line w90" />
          </div>
        ) : (
          <SummaryRenderer text={summary ?? ""} />
        )}
      </section>
    </article>
  );
}
