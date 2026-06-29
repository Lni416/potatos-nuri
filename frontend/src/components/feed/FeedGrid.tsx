import React, { useState } from "react";
import { WelfareItem } from "../../utils/api";
import WelfareCard from "./WelfareCard";
import WelfareCardSkeleton from "./WelfareCardSkeleton";

type SortKey = "score" | "deadline" | "recent";

const SORT_LABELS: { key: SortKey; label: string }[] = [
  { key: "score", label: "추천순" },
  { key: "deadline", label: "마감 임박순" },
  { key: "recent", label: "최신순" },
];

function sortItems(items: WelfareItem[], sort: SortKey): WelfareItem[] {
  switch (sort) {
    case "score":
      return [...items].sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
    case "deadline":
      return [...items].sort((a, b) => {
        if (!a.applyDeadline && !b.applyDeadline) return 0;
        if (!a.applyDeadline) return 1;
        if (!b.applyDeadline) return -1;
        return new Date(a.applyDeadline).getTime() - new Date(b.applyDeadline).getTime();
      });
    case "recent":
    default:
      return items;
  }
}

interface Props {
  items: WelfareItem[];
  loading: boolean;
  error: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshMessage?: string | null;
  isBookmarked?: (id: string) => boolean;
  onToggleBookmark?: (id: string) => void;
}

const SKELETON_COUNT = 6;

export default function FeedGrid({
  items, loading, error, onRefresh, refreshing, refreshMessage, isBookmarked, onToggleBookmark,
}: Props) {
  const [sort, setSort] = useState<SortKey>("score");

  if (error) {
    return (
      <div className="feed-error">
        <p>피드를 불러오지 못했습니다.</p>
        <p className="feed-error-detail">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="feed-grid">
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <WelfareCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="feed-empty">
        <p>😔 피드를 찾지 못했어요.</p>
        {refreshMessage ? (
          <p className="feed-empty-sub">{refreshMessage}</p>
        ) : (
          <p className="feed-empty-sub">버튼을 눌러 맞춤 정보를 불러와 보세요.</p>
        )}
        {onRefresh && (
          <button
            className="feed-refresh-btn"
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? "수집 중..." : "맞춤 정보 불러오기"}
          </button>
        )}
      </div>
    );
  }

  const sorted = sortItems(items, sort);

  return (
    <>
      <div className="feed-sort-bar">
        {SORT_LABELS.map(({ key, label }) => (
          <button
            key={key}
            className={`sort-btn${sort === key ? " active" : ""}`}
            onClick={() => setSort(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="feed-grid">
        {sorted.map((item) => (
          <WelfareCard
            key={item.id}
            item={item}
            isBookmarked={isBookmarked?.(item.id)}
            onToggleBookmark={onToggleBookmark}
          />
        ))}
      </div>
    </>
  );
}
