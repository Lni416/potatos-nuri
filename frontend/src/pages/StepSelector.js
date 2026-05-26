/**
 * 공통 단계별 선택 컴포넌트 (음성 / 텍스트 공통).
 * 3단계: 지역 → 나이 → 분야
 */

const STEPS = [
  {
    id: 'region',
    question: '어디에 살고 계세요?',
    hint: '지역을 말하거나 눌러 주세요',
    options: [
      { value: '서울', label: '서울', keywords: ['서울'] },
      { value: '경기', label: '경기', keywords: ['경기'] },
      { value: '인천', label: '인천', keywords: ['인천'] },
      { value: '부산', label: '부산', keywords: ['부산'] },
      { value: '대구', label: '대구', keywords: ['대구'] },
      { value: '광주', label: '광주', keywords: ['광주'] },
      { value: '대전', label: '대전', keywords: ['대전'] },
      { value: '기타', label: '기타 지역', keywords: ['기타', '그 외', '다른', '지방', '기타지역'] },
    ],
  },
  {
    id: 'age',
    question: '나이대가 어떻게 되세요?',
    hint: '나이대를 말하거나 눌러 주세요',
    options: [
      { value: '10', label: '10대', age: 15, occupation: '학생',  keywords: ['십대', '10대', '열'] },
      { value: '20', label: '20대', age: 25, occupation: '직장인', keywords: ['이십대', '20대', '스물', '이십'] },
      { value: '30', label: '30대', age: 35, occupation: '직장인', keywords: ['삼십대', '30대', '서른', '삼십'] },
      { value: '40', label: '40대', age: 45, occupation: '직장인', keywords: ['사십대', '40대', '마흔', '사십'] },
      { value: '50', label: '50대 이상', age: 55, occupation: '은퇴',  keywords: ['오십대', '50대', '쉰', '오십', '육십', '60대', '칠십', '70대', '팔십', '이상'] },
    ],
  },
  {
    id: 'field',
    question: '어떤 지원이 필요하세요?',
    hint: '필요한 지원을 말하거나 눌러 주세요',
    options: [
      { value: '생활지원', label: '생활·복지',  interests: ['생활지원'], keywords: ['생활', '복지', '생계', '긴급', '식품', '에너지'] },
      { value: '의료건강', label: '의료·건강',  interests: ['의료건강'], keywords: ['의료', '건강', '병원', '치료', '검진', '재활'] },
      { value: '주거',    label: '주거·임대',   interests: ['주거'],    keywords: ['주거', '집', '임대', '전세', '월세', '주택'] },
      { value: '취업고용', label: '취업·일자리', interests: ['취업고용'], keywords: ['취업', '일자리', '고용', '직업', '훈련', '창업'] },
      { value: '교육장학', label: '교육·장학',  interests: ['교육장학'], keywords: ['교육', '장학', '학비', '공부', '학교', '학습'] },
      { value: '임신육아', label: '임신·육아',  interests: ['임신육아'], keywords: ['임신', '출산', '육아', '아이', '보육', '아동'] },
      { value: '노인돌봄', label: '노인·돌봄',  interests: ['노인돌봄'], keywords: ['노인', '어르신', '돌봄', '요양', '연금', '시니어'] },
      { value: '문화여가', label: '문화·여가',  interests: ['문화여가'], keywords: ['문화', '여가', '체육', '관광', '축제', '여행'] },
    ],
  },
];

const REGION_NAME_MAP = {
  서울: '서울특별시',
  경기: '경기도',
  인천: '인천광역시',
  부산: '부산광역시',
  대구: '대구광역시',
  광주: '광주광역시',
  대전: '대전광역시',
  기타: '경기도',
};

/**
 * @param {{ mode: 'voice'|'text', onComplete: Function }} params
 */
export function createStepSelector({ mode, onComplete }) {
  let currentStep = 0;
  let locked = false;
  const selections = [null, null, null];

  const el = document.createElement('div');
  el.className = 'step-selector';

  function render() {
    el.innerHTML = '';

    // 진행 표시
    const progress = document.createElement('div');
    progress.className = 'step-progress';
    for (let i = 0; i < STEPS.length; i++) {
      const dot = document.createElement('span');
      dot.className = 'step-dot' + (i < currentStep ? ' done' : i === currentStep ? ' active' : '');
      progress.appendChild(dot);
      if (i < STEPS.length - 1) {
        const line = document.createElement('span');
        line.className = 'step-line' + (i < currentStep ? ' done' : '');
        progress.appendChild(line);
      }
    }
    const stepLabel = document.createElement('span');
    stepLabel.className = 'step-count';
    stepLabel.textContent = `${currentStep + 1} / ${STEPS.length}`;
    progress.appendChild(stepLabel);
    el.appendChild(progress);

    // 이전 선택 요약
    const prevSelections = selections.slice(0, currentStep).filter(Boolean);
    if (prevSelections.length > 0) {
      const summary = document.createElement('div');
      summary.className = 'step-summary';
      summary.innerHTML = prevSelections
        .map((s) => `<span class="step-chip">${s.label}</span>`)
        .join('<span class="step-chip-sep">•</span>');
      el.appendChild(summary);
    }

    // 질문
    const step = STEPS[currentStep];
    const questionEl = document.createElement('h2');
    questionEl.className = 'step-question fade-in-fast';
    questionEl.textContent = step.question;
    el.appendChild(questionEl);

    // 힌트 (음성 모드)
    if (mode === 'voice') {
      const hint = document.createElement('p');
      hint.className = 'step-hint';
      hint.textContent = step.hint;
      el.appendChild(hint);
    }

    // 선택지 그리드
    const grid = document.createElement('div');
    grid.className = 'step-grid fade-in-fast';
    step.options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.className = 'step-option';
      btn.dataset.value = opt.value;
      btn.addEventListener('click', () => select(opt));

      const label = document.createElement('span');
      label.className = 'step-option-label';
      label.textContent = opt.label;
      btn.appendChild(label);

      grid.appendChild(btn);
    });
    el.appendChild(grid);
  }

  function select(option) {
    if (locked) return;
    locked = true;

    const btn = el.querySelector(`.step-option[data-value="${option.value}"]`);
    if (btn) btn.classList.add('selected');

    selections[currentStep] = option;

    setTimeout(() => {
      locked = false;
      if (currentStep < STEPS.length - 1) {
        currentStep++;
        render();
      } else {
        onComplete(buildFormData());
      }
    }, 600);
  }

  function handleTranscript(transcript) {
    if (locked) return;
    const step = STEPS[currentStep];
    const lower = transcript.toLowerCase();
    for (const opt of step.options) {
      for (const kw of opt.keywords) {
        if (lower.includes(kw.toLowerCase())) {
          select(opt);
          return;
        }
      }
    }
  }

  function buildFormData() {
    const [region, ageOpt, fieldOpt] = selections;
    return {
      age: ageOpt?.age ?? 30,
      region_code: region?.value ?? '기타',
      region_name: REGION_NAME_MAP[region?.value] ?? '경기도',
      occupation: ageOpt?.occupation ?? '기타',
      interests: fieldOpt?.interests ?? [],
    };
  }

  render();

  return { el, handleTranscript };
}
