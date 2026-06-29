import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFeed, refreshFeed, FeedResponse, WelfareItem } from "../utils/api";
import CardCarousel from "../components/feed/CardCarousel";
import BookmarkList from "../components/feed/BookmarkList";
import FeedGrid from "../components/feed/FeedGrid";
import { useBookmarks } from "../hooks/useBookmarks";

type TabId = 0 | 1 | 2;

const TABS = [
  { id: 0 as TabId, icon: "🏠", label: "메인" },
  { id: 1 as TabId, icon: "❤️", label: "찜" },
  { id: 2 as TabId, icon: "☰", label: "목록" },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [feed, setFeed] = useState<WelfareItem[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>(0);
  const { toggle, isBookmarked } = useBookmarks();

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: FeedResponse = await getFeed();
      if (!data.profile_complete) {
        navigate("/onboarding", { replace: true });
        return;
      }
      // 만료 공고 제외는 백엔드에서 처리 → cards 개수가 곧 표시 개수 (메시지와 일치)
      setFeed(data.cards);
      setMessage(data.message);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "피드를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshMessage(null);
    try {
      const res = await refreshFeed();
      setRefreshMessage(res.message);
      setTimeout(() => {
        loadFeed().finally(() => {
          setRefreshing(false);
          setRefreshMessage(null);
        });
      }, 120_000);
    } catch {
      setRefreshing(false);
    }
  }

  return (
    <section className="home-page">
      {message && !loading && tab === 0 && (
        <p className="feed-message">{message}</p>
      )}

      {tab === 0 && (
        <CardCarousel
          items={feed}
          loading={loading}
          error={error}
          isBookmarked={isBookmarked}
          onToggleBookmark={toggle}
        />
      )}
      {tab === 1 && (
        <BookmarkList
          items={feed}
          loading={loading}
          isBookmarked={isBookmarked}
          onToggleBookmark={toggle}
        />
      )}
      {tab === 2 && (
        <FeedGrid
          items={feed}
          loading={loading}
          error={error}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          refreshMessage={refreshMessage}
          isBookmarked={isBookmarked}
          onToggleBookmark={toggle}
        />
      )}

      <nav className="home-tab-nav" aria-label="메뉴">
        {TABS.map(({ id, icon, label }) => (
          <button
            key={id}
            className={`tab-btn${tab === id ? " active" : ""}`}
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
          >
            <span className="tab-icon">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </section>
  );
}
