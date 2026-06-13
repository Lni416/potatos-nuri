import React from "react";

export default function WelfareCardSkeleton() {
  return (
    <div className="welfare-card welfare-card--skeleton" aria-hidden="true">
      <div className="skeleton-badge" />
      <div className="skeleton-title" />
      <div className="skeleton-text" />
      <div className="skeleton-text skeleton-text--short" />
      <div className="skeleton-footer" />
    </div>
  );
}
