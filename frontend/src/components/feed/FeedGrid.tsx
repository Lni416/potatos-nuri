import React from "react";
import { WelfareItem } from "../../utils/api";
import WelfareCard from "./WelfareCard";
import WelfareCardSkeleton from "./WelfareCardSkeleton";

interface Props {
  items: WelfareItem[];
  loading: boolean;
  error: string | null;
}

const SKELETON_COUNT = 6;

export default function FeedGrid({ items, loading, error }: Props) {
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
        <p>😔 표시할 복지 정보가 없습니다.</p>
        <p className="feed-empty-sub">프로필을 업데이트하거나 나중에 다시 확인해 보세요.</p>
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
