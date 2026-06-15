import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFeed, refreshFeed, FeedResponse, WelfareItem } from "../utils/api";
import FeedGrid from "../components/feed/FeedGrid";

export default function HomePage() {
  const navigate = useNavigate();
  const [feed, setFeed] = useState<WelfareItem[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: FeedResponse = await getFeed();
      if (!data.profile_complete) {
        navigate("/onboarding", { replace: true });
        return;
      }
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
      // 크롤링이 백그라운드에서 실행되므로 2분 후 피드 재조회
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
      {message && !loading && (
        <p className="feed-message">{message}</p>
      )}
      <FeedGrid
        items={feed}
        loading={loading}
        error={error}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        refreshMessage={refreshMessage}
      />
    </section>
  );
}
