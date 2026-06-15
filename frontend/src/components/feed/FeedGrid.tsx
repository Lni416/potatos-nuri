import React from "react";
import { WelfareItem } from "../../utils/api";
import WelfareCard from "./WelfareCard";
import WelfareCardSkeleton from "./WelfareCardSkeleton";

interface Props {
  items: WelfareItem[];
  loading: boolean;
  error: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshMessage?: string | null;
}

const SKELETON_COUNT = 6;

export default function FeedGrid({ items, loading, error, onRefresh, refreshing, refreshMessage }: Props) {
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

  return (
    <div className="feed-grid">
      {items.map((item) => (
        <WelfareCard key={item.id} item={item} />
      ))}
    </div>
  );
}
