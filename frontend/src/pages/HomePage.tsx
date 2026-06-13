import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFeed, FeedResponse, WelfareItem } from "../utils/api";
import FeedGrid from "../components/feed/FeedGrid";

export default function HomePage() {
  const navigate = useNavigate();
  const [feed, setFeed] = useState<WelfareItem[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getFeed()
      .then((data: FeedResponse) => {
        if (cancelled) return;
        if (!data.profile_complete) {
          navigate("/onboarding", { replace: true });
          return;
        }
        setFeed(data.cards);
        setMessage(data.message);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <section className="home-page">
      {message && !loading && (
        <p className="feed-message">{message}</p>
      )}
      <FeedGrid items={feed} loading={loading} error={error} />
    </section>
  );
}
