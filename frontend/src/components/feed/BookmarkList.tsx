import React from "react";
import { WelfareItem } from "../../utils/api";
import WelfareCard from "./WelfareCard";

interface Props {
  items: WelfareItem[];
  loading: boolean;
  isBookmarked: (id: string) => boolean;
  onToggleBookmark: (id: string) => void;
}

export default function BookmarkList({ items, loading, isBookmarked, onToggleBookmark }: Props) {
  if (loading) {
    return (
      <div className="feed-empty">
        <p>로딩 중...</p>
      </div>
    );
  }

  const saved = items.filter((item) => isBookmarked(item.id));

  if (saved.length === 0) {
    return (
      <div className="bookmark-empty">
        <span className="bookmark-empty-icon">❤️</span>
        <p>찜한 복지 정보가 없어요.</p>
        <p className="feed-empty-sub">메인 탭에서 카드의 하트를 눌러 저장해 보세요.</p>
      </div>
    );
  }

  return (
    <div className="feed-list">
      {saved.map((item) => (
        <WelfareCard
          key={item.id}
          item={item}
          isBookmarked={true}
          onToggleBookmark={onToggleBookmark}
        />
      ))}
    </div>
  );
}
