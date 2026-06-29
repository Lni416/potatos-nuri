import React, { useEffect, useRef, useState } from "react";
import { WelfareItem } from "../../utils/api";
import WelfareCard from "./WelfareCard";
import WelfareCardSkeleton from "./WelfareCardSkeleton";

interface Props {
  items: WelfareItem[];
  loading: boolean;
  error: string | null;
  isBookmarked: (id: string) => boolean;
  onToggleBookmark: (id: string) => void;
}

export default function CardCarousel({ items, loading, error, isBookmarked, onToggleBookmark }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef({ down: false, startX: 0, startScroll: 0, moved: false });
  const [displayIndex, setDisplayIndex] = useState(0);

  function snapToActive() {
    const el = scrollRef.current;
    if (!el) return;
    const cards = el.querySelectorAll<HTMLElement>(".carousel-item");
    cards[activeRef.current]?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }

  // 마우스로 꾹 눌러 끌어서 슬라이드 (데스크톱)
  function onMouseDown(e: React.MouseEvent) {
    const el = scrollRef.current;
    if (!el) return;
    dragRef.current = { down: true, startX: e.pageX, startScroll: el.scrollLeft, moved: false };
  }
  function onMouseMove(e: React.MouseEvent) {
    const el = scrollRef.current;
    const d = dragRef.current;
    if (!el || !d.down) return;
    e.preventDefault();
    const dx = e.pageX - d.startX;
    if (Math.abs(dx) > 4) d.moved = true;
    el.scrollLeft = d.startScroll - dx;
  }
  function endDrag() {
    const d = dragRef.current;
    if (!d.down) return;
    d.down = false;
    if (d.moved) snapToActive(); // 드래그 후 가장 가까운 카드로 스냅 락
  }
  // 드래그였다면 카드 클릭(상세 이동) 억제
  function onClickCapture(e: React.MouseEvent) {
    if (dragRef.current.moved) {
      e.stopPropagation();
      e.preventDefault();
      dragRef.current.moved = false;
    }
  }

  function updateOpacities() {
    const el = scrollRef.current;
    if (!el) return;
    const cards = el.querySelectorAll<HTMLElement>(".carousel-item");
    // viewport 좌표 기준 — offsetParent 의존성 제거 (scroll 컨테이너가 positioned가 아니어도 정확)
    const containerRect = el.getBoundingClientRect();
    const center = containerRect.left + containerRect.width / 2;
    // 거리 정규화 기준: 컨테이너 폭 기반(카드 자체 폭은 scale 변형 영향을 받으므로 사용 안 함)
    const reference = containerRect.width * 0.72;
    let closestIdx = 0;
    let closestDist = Infinity;

    cards.forEach((card, i) => {
      const r = card.getBoundingClientRect();
      // transform-origin: center 이므로 scale과 무관하게 카드 중심은 고정
      const cardCenter = r.left + r.width / 2;
      const dist = Math.abs(center - cardCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
      const norm = dist / reference;
      const opacity = Math.max(0.08, 1 - norm * 0.6);
      const scale = Math.max(0.86, 1 - norm * 0.1);
      card.style.opacity = opacity.toFixed(3);
      card.style.transform = `scale(${scale.toFixed(3)})`;
    });

    activeRef.current = closestIdx;
  }

  function handleScroll() {
    updateOpacities();
    // 스크롤 멈추면 카운터만 React 상태로 업데이트
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDisplayIndex(activeRef.current);
    }, 80);
  }

  // 초기 렌더 후 opacity 세팅
  useEffect(() => {
    updateOpacities();
  });

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
      <div className="carousel-wrap">
        <div className="carousel-scroll">
          <div className="carousel-spacer" />
          <div className="carousel-item">
            <WelfareCardSkeleton />
          </div>
          <div className="carousel-spacer" />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="feed-empty">
        <p>추천 복지 정보가 없어요.</p>
        <p className="feed-empty-sub">프로필을 완성하면 맞춤 정보를 추천해 드려요.</p>
      </div>
    );
  }

  return (
    <div className="carousel-wrap">
      <div
        ref={scrollRef}
        className="carousel-scroll"
        onScroll={handleScroll}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onClickCapture={onClickCapture}
      >
        <div className="carousel-spacer" />
        {items.map((item) => (
          <div key={item.id} className="carousel-item">
            <WelfareCard
              item={item}
              isBookmarked={isBookmarked(item.id)}
              onToggleBookmark={onToggleBookmark}
              large
            />
          </div>
        ))}
        <div className="carousel-spacer" />
      </div>

      <div className="carousel-counter-bar">
        <span className="carousel-counter">{displayIndex + 1} / {items.length}</span>
      </div>

      <div className="carousel-dots" role="tablist">
        {items.slice(0, 20).map((_, i) => (
          <button
            key={i}
            className={`carousel-dot${i === displayIndex ? " active" : ""}`}
            onClick={() => {
              const el = scrollRef.current;
              if (!el) return;
              const cards = el.querySelectorAll<HTMLElement>(".carousel-item");
              const target = cards[i];
              target?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
            }}
            aria-label={`${i + 1}번째 카드`}
          />
        ))}
      </div>
    </div>
  );
}
