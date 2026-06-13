import React from "react";

interface Props {
  message: string;
}

export default function NluHint({ message }: Props) {
  return (
    <div className="nlu-hint fade-in-fast" role="status" aria-live="polite">
      <span className="nlu-hint-icon">🤖</span> {message}
    </div>
  );
}
