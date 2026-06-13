import React, { useState } from "react";

const GLOSSARY: Record<string, string> = {
  개발제한구역: "도시가 너무 넓게 퍼지는 것을 막기 위해 건축이나 개발을 제한한 지역입니다. 그린벨트라고도 합니다.",
  그린벨트: "도시 주변의 자연환경을 지키기 위해 건축이나 개발을 제한한 지역입니다.",
  기초생활수급자: "생활비가 부족해 나라에서 생계, 의료, 주거 같은 도움을 받는 분입니다.",
  차상위계층: "기초생활수급자는 아니지만 소득이 낮아 일부 복지 지원을 받을 수 있는 분입니다.",
  소득인정액: "월 소득과 재산을 함께 계산해 복지 대상인지 판단하는 금액입니다.",
  "기준 중위소득": "우리나라 가구 소득을 순서대로 세웠을 때 가운데에 있는 소득입니다. 복지 대상 기준으로 자주 씁니다.",
  주민센터: "사는 곳 가까이에 있는 행정복지센터입니다. 복지 신청과 상담을 할 수 있습니다.",
  행정복지센터: "예전의 동주민센터와 비슷한 곳입니다. 복지 신청과 상담을 할 수 있습니다.",
  읍면동: "읍, 면, 동을 함께 부르는 말입니다. 보통 가까운 주민센터를 뜻합니다.",
  중증질환: "치료가 오래 걸리거나 병원비 부담이 큰 심한 질병입니다.",
  희귀질환: "환자 수가 적어 보기 드문 질병입니다.",
  난치질환: "치료가 어렵거나 오래 관리해야 하는 질병입니다.",
  자산형성: "저축이나 지원금을 통해 목돈을 만들 수 있도록 돕는 것입니다.",
  현금지급: "물건이나 서비스가 아니라 돈으로 지원한다는 뜻입니다.",
  바우처: "정해진 곳에서 서비스나 물건을 살 수 있는 이용권입니다.",
};

const TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);

interface TooltipProps {
  term: string;
}

function GlossaryTerm({ term }: TooltipProps) {
  const [open, setOpen] = useState(false);
  return (
    <span className="term-help-wrap">
      <button
        type="button"
        className="term-help"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {term}
      </button>
      {open && (
        <span className="term-tooltip" role="tooltip">
          {GLOSSARY[term]}
        </span>
      )}
    </span>
  );
}

function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    let earliest = remaining.length;
    let matchedTerm = "";

    for (const term of TERMS) {
      const idx = remaining.indexOf(term);
      if (idx !== -1 && idx < earliest) {
        earliest = idx;
        matchedTerm = term;
      }
    }

    const boldPattern = /\*\*(.+?)\*\*/;
    const boldMatch = remaining.match(boldPattern);
    const boldIdx = boldMatch ? remaining.indexOf(boldMatch[0]) : remaining.length;

    if (boldIdx < earliest) {
      if (boldIdx > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, boldIdx)}</span>);
      }
      parts.push(<strong key={key++}>{boldMatch![1]}</strong>);
      remaining = remaining.slice(boldIdx + boldMatch![0].length);
    } else if (matchedTerm) {
      if (earliest > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, earliest)}</span>);
      }
      parts.push(<GlossaryTerm key={key++} term={matchedTerm} />);
      remaining = remaining.slice(earliest + matchedTerm.length);
    } else {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
  }

  return parts;
}

interface Props {
  text: string;
}

export default function SummaryRenderer({ text }: Props) {
  if (!text) return <p>요약 내용이 없습니다.</p>;

  const lines = text.split(/\r?\n/);
  const nodes: React.ReactNode[] = [];
  const listItems: React.ReactNode[] = [];
  let listKey = 0;
  let nodeKey = 0;

  function flushList() {
    if (listItems.length > 0) {
      nodes.push(<ul key={nodeKey++}>{[...listItems]}</ul>);
      listItems.length = 0;
    }
  }

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) { flushList(); return; }
    if (line === "---") { flushList(); nodes.push(<hr key={nodeKey++} />); return; }

    const headingMatch = line.match(/^###\s+(.+)$/);
    if (headingMatch) { flushList(); nodes.push(<h3 key={nodeKey++}>{parseInline(headingMatch[1])}</h3>); return; }

    const listMatch = line.match(/^-\s+(.+)$/);
    if (listMatch) {
      listItems.push(<li key={listKey++}>{parseInline(listMatch[1])}</li>);
      return;
    }

    flushList();
    nodes.push(<p key={nodeKey++}>{parseInline(line)}</p>);
  });

  flushList();

  return <div className="summary-content">{nodes}</div>;
}
