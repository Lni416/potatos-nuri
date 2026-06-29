import React from "react";
import { useNavigate } from "react-router-dom";
import { WelfareItem } from "../../utils/api";

interface Props {
  item: WelfareItem;
  isBookmarked?: boolean;
  onToggleBookmark?: (id: string) => void;
  large?: boolean;
}

const CATEGORY_ICONS: Record<string, string> = {
  생활지원: "🏠",
  의료건강: "🏥",
  주거: "🏗️",
  취업고용: "💼",
  교육장학: "🎓",
  임신육아: "👶",
  노인돌봄: "👴",
  문화여가: "🎨",
  복지: "🤝",
  행사: "📅",
};

function daysUntil(deadline: string): number {
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

export default function WelfareCard({ item, isBookmarked, onToggleBookmark, large }: Props) {
  const navigate = useNavigate();
  const icon = CATEGORY_ICONS[item.category] ?? "📋";
  const isEvent = item.category === "행사";

  let deadlineBadge: React.ReactNode = null;
  if (item.applyDeadline) {
    const days = daysUntil(item.applyDeadline);
    if (days > 0 && days <= 14) {
      const urgentClass =
        days <= 3 ? "badge--urgent" : days <= 7 ? "badge--warn" : "badge--info";
      deadlineBadge = (
        <span className={`badge ${urgentClass}`}>D-{days}</span>
      );
    } else if (days <= 0) {
      deadlineBadge = <span className="badge badge--closed">마감</span>;
    }
  }

  const regionExpanded = item.is_region_expanded;

  return (
    <article
      className={`welfare-card${isEvent ? " welfare-card--event" : ""}${large ? " welfare-card--large" : ""}`}
      onClick={() => navigate(`/feed/${item.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/feed/${item.id}`)}
      aria-label={item.title}
    >
      <div className="welfare-card-top">
        <span className="welfare-card-icon">{icon}</span>
        <span className="welfare-card-category">{item.category}</span>
        {deadlineBadge}
        {regionExpanded && (
          <span className="badge badge--region" title={`${item.search_region ?? ""} 지역 기준 확장`}>
            +광역
          </span>
        )}
        {onToggleBookmark && (
          <button
            className="welfare-card-bookmark"
            onClick={(e) => { e.stopPropagation(); onToggleBookmark(item.id); }}
            aria-label={isBookmarked ? "찜 해제" : "찜하기"}
          >
            {isBookmarked ? "❤️" : "🤍"}
          </button>
        )}
      </div>
      <h3 className="welfare-card-title">{item.title}</h3>
      <p className="welfare-card-source">{item.sourceName ?? item.source_name}</p>
      <div className="welfare-card-footer">
        {item._score !== undefined && (
          <span className="welfare-card-score" title="개인화 점수">
            ★ {Math.round(item._score)}
          </span>
        )}
        <span className="welfare-card-arrow">→</span>
      </div>
    </article>
  );
}
