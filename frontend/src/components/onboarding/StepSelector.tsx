import React, { useState, forwardRef, useImperativeHandle } from "react";
import { interpretVoice, NLUResult } from "../../utils/api";

// 한국어 수사 → 나이(숫자) 변환
function parseKoreanAge(text: string): number | null {
  // 아라비아 숫자: "23살", "35세"
  const arabic = text.match(/(\d+)\s*(?:살|세)/);
  if (arabic) return parseInt(arabic[1]);

  const tens: Record<string, number> = {
    열: 10, 스물: 20, 서른: 30, 마흔: 40,
    쉰: 50, 예순: 60, 일흔: 70, 여든: 80, 아흔: 90,
  };
  const units: Record<string, number> = {
    하나: 1, 둘: 2, 셋: 3, 넷: 4, 다섯: 5,
    여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9,
  };
  const sinoTens: Record<string, number> = {
    이십: 20, 삼십: 30, 사십: 40, 오십: 50,
    육십: 60, 칠십: 70, 팔십: 80, 구십: 90,
  };
  const sinoUnits: Record<string, number> = {
    일: 1, 이: 2, 삼: 3, 사: 4, 오: 5,
    육: 6, 칠: 7, 팔: 8, 구: 9,
  };

  // 고유어: "쉰다섯" → 55, "스물셋" → 23
  for (const [dec, dv] of Object.entries(tens)) {
    if (text.includes(dec)) {
      for (const [u, uv] of Object.entries(units)) {
        if (text.includes(dec + u)) return dv + uv;
      }
      return dv;
    }
  }

  // 한자어: "이십삼" → 23, "오십오" → 55
  for (const [dec, dv] of Object.entries(sinoTens)) {
    if (text.includes(dec)) {
      for (const [u, uv] of Object.entries(sinoUnits)) {
        if (text.includes(dec + u)) return dv + uv;
      }
      return dv;
    }
  }

  return null;
}

export interface StepOption {
  value: string;
  label: string;
  keywords: string[];
  age?: number;
  occupation?: string;
  interests?: string[];
}

export interface Step {
  id: string;
  question: string;
  hint: string;
  options: StepOption[];
}

export const STEPS: Step[] = [
  {
    id: "region",
    question: "어디에 살고 계세요?",
    hint: "지역을 말하거나 눌러 주세요",
    options: [
      { value: "서울", label: "서울", keywords: ["서울"] },
      { value: "경기", label: "경기", keywords: ["경기"] },
      { value: "인천", label: "인천", keywords: ["인천"] },
      { value: "부산", label: "부산", keywords: ["부산"] },
      { value: "대구", label: "대구", keywords: ["대구"] },
      { value: "광주", label: "광주", keywords: ["광주"] },
      { value: "대전", label: "대전", keywords: ["대전"] },
      { value: "기타", label: "기타 지역", keywords: ["기타", "그 외", "다른", "지방", "기타지역"] },
    ],
  },
  {
    id: "age",
    question: "나이대가 어떻게 되세요?",
    hint: "나이대를 말하거나 눌러 주세요",
    options: [
      { value: "10", label: "10대", age: 15, occupation: "학생", keywords: ["십대", "10대", "열"] },
      { value: "20", label: "20대", age: 25, occupation: "직장인", keywords: ["이십대", "20대", "스물", "이십"] },
      { value: "30", label: "30대", age: 35, occupation: "직장인", keywords: ["삼십대", "30대", "서른", "삼십"] },
      { value: "40", label: "40대", age: 45, occupation: "직장인", keywords: ["사십대", "40대", "마흔", "사십"] },
      { value: "50", label: "50대 이상", age: 55, occupation: "은퇴", keywords: ["오십대", "50대", "쉰", "오십", "육십", "60대", "칠십", "70대", "팔십", "이상"] },
    ],
  },
  {
    id: "field",
    question: "어떤 지원이 필요하세요?",
    hint: "필요한 지원을 말하거나 눌러 주세요",
    options: [
      { value: "생활지원", label: "생활·복지", interests: ["생활지원"], keywords: ["생활", "복지", "생계", "긴급", "식품", "에너지"] },
      { value: "의료건강", label: "의료·건강", interests: ["의료건강"], keywords: ["의료", "건강", "병원", "치료", "검진", "재활"] },
      { value: "주거", label: "주거·임대", interests: ["주거"], keywords: ["주거", "집", "임대", "전세", "월세", "주택"] },
      { value: "취업고용", label: "취업·일자리", interests: ["취업고용"], keywords: ["취업", "일자리", "고용", "직업", "훈련", "창업"] },
      { value: "교육장학", label: "교육·장학", interests: ["교육장학"], keywords: ["교육", "장학", "학비", "공부", "학교", "학습"] },
      { value: "임신육아", label: "임신·육아", interests: ["임신육아"], keywords: ["임신", "출산", "육아", "아이", "보육", "아동"] },
      { value: "노인돌봄", label: "노인·돌봄", interests: ["노인돌봄"], keywords: ["노인", "어르신", "돌봄", "요양", "연금", "시니어"] },
      { value: "문화여가", label: "문화·여가", interests: ["문화여가"], keywords: ["문화", "여가", "체육", "관광", "축제", "여행"] },
    ],
  },
];

const REGION_NAME_MAP: Record<string, string> = {
  서울: "서울특별시",
  경기: "경기도",
  인천: "인천광역시",
  부산: "부산광역시",
  대구: "대구광역시",
  광주: "광주광역시",
  대전: "대전광역시",
  기타: "경기도",
};

export interface FormData {
  age: number;
  region_code: string;
  region_name: string;
  occupation: string;
  interests: string[];
}

interface Props {
  mode: "voice" | "text";
  onComplete: (data: FormData) => void;
}

export type StepSelectorHandle = {
  handleTranscript: (t: string) => void;
};

const StepSelector = forwardRef<StepSelectorHandle, Props>(function StepSelector({ mode, onComplete }, ref) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selections, setSelections] = useState<(StepOption | null)[]>([null, null, null]);
  const [exactAge, setExactAge] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [nluHint, setNluHint] = useState<string | null>(null);

  const step = STEPS[currentStep];

  useImperativeHandle(ref, () => ({ handleTranscript }));

  function buildFormData(sels: (StepOption | null)[], age: number | null): FormData {
    const [region, ageOpt, fieldOpt] = sels;
    return {
      age: age ?? ageOpt?.age ?? 30,
      region_code: region?.value ?? "기타",
      region_name: REGION_NAME_MAP[region?.value ?? ""] ?? "경기도",
      occupation: ageOpt?.occupation ?? "기타",
      interests: fieldOpt?.interests ?? [],
    };
  }

  function select(opt: StepOption, age?: number | null) {
    if (locked) return;
    setLocked(true);
    setNluHint(null);

    const newSels = [...selections] as (StepOption | null)[];
    newSels[currentStep] = opt;
    setSelections(newSels);

    if (age != null) setExactAge(age);

    setTimeout(() => {
      setLocked(false);
      if (currentStep < STEPS.length - 1) {
        setCurrentStep((s) => s + 1);
      } else {
        onComplete(buildFormData(newSels, age ?? exactAge));
      }
    }, 500);
  }

  async function handleTranscript(transcript: string) {
    if (locked) return;
    const lower = transcript.toLowerCase();

    for (const opt of step.options) {
      if (opt.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
        const exactAge = step.id === "age" ? parseKoreanAge(transcript) : null;
        select(opt, exactAge);
        return;
      }
    }

    // NLU 폴백
    try {
      const result: NLUResult = await interpretVoice(transcript, step.id);
      if (result.matched_value && result.confidence >= 0.7) {
        const matched = step.options.find((o) => o.value === result.matched_value);
        if (matched) {
          setNluHint(`"${transcript}" → ${matched.label} 로 인식했어요`);
          setTimeout(() => select(matched, result.exact_age), 800);
        }
      } else if (result.confidence >= 0.4 && result.matched_label) {
        setNluHint(`혹시 "${result.matched_label}"을 말씀하신 건가요?`);
      }
    } catch {
      // NLU 실패는 조용히 무시
    }
  }

  return (
    <div className="step-selector">
      {/* 진행 표시 */}
      <div className="step-progress">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <span
              className={`step-dot${i < currentStep ? " done" : i === currentStep ? " active" : ""}`}
            />
            {i < STEPS.length - 1 && (
              <span className={`step-line${i < currentStep ? " done" : ""}`} />
            )}
          </React.Fragment>
        ))}
        <span className="step-count">{currentStep + 1} / {STEPS.length}</span>
      </div>

      {/* 이전 선택 요약 */}
      {selections.slice(0, currentStep).some(Boolean) && (
        <div className="step-summary">
          {selections.slice(0, currentStep).filter(Boolean).map((s, i) => (
            <React.Fragment key={i}>
              <span className="step-chip">{s!.label}</span>
              {i < currentStep - 1 && <span className="step-chip-sep">•</span>}
            </React.Fragment>
          ))}
        </div>
      )}

      <h2 className="step-question fade-in-fast">{step.question}</h2>
      {mode === "voice" && <p className="step-hint">{step.hint}</p>}

      {nluHint && (
        <div className="nlu-hint fade-in-fast">
          <span className="nlu-hint-icon">🤖</span> {nluHint}
        </div>
      )}

      <div className="step-grid fade-in-fast">
        {step.options.map((opt) => (
          <button
            key={opt.value}
            className={`step-option${selections[currentStep]?.value === opt.value ? " selected" : ""}`}
            onClick={() => select(opt)}
            disabled={locked}
          >
            <span className="step-option-label">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
});

export default StepSelector;
