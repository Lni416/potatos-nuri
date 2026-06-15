# NuRI 🐰

복지·행사 정보를 AI가 쉬운 말로 요약해 주는 서비스입니다.  
음성으로 프로필을 설정하고, 나이·지역·관심분야에 맞는 복지 정보를 피드로 받아볼 수 있습니다.

**라이브:** https://nuri-90a4f.web.app

---

## 기능

- **음성 온보딩** — "서울에 살고 있어요", "스물셋이에요" 같은 자연어를 Gemini가 해석해 프로필 자동 설정
- **개인화 피드** — 나이·지역·직업·관심분야 기반 점수 계산으로 복지 정보 랭킹
- **AI 요약** — 행정 문서를 Gemini가 읽기 쉬운 말로 변환 (카드 클릭 시 on-demand)
- **마감 알림** — D-3/7 신청 마감 알림 (Firestore 실시간 수신)
- **이메일 + Google 로그인**

## 기술 스택

| 구분 | 사용 기술 |
|------|----------|
| 프론트엔드 | React 18, TypeScript, Vite, React Router v6 |
| 인증 | Firebase Auth (Email/Password, Google) |
| 실시간 DB | Firestore (알림 onSnapshot) |
| 백엔드 | FastAPI, Python 3.12, Uvicorn |
| AI | Gemini 2.5 Flash (크롤링·요약), Gemini Flash Lite (NLU) |
| AI 에이전트 | Pydantic AI (구조화 출력 강제) |
| 인프라 | Firebase Hosting, Cloud Run (서울), Cloud Scheduler |

---

## 로컬 실행

### 사전 준비

- Node.js 18+, Python 3.12+
- Firebase 프로젝트 + Google Cloud 프로젝트
- Gemini API 키 ([AI Studio](https://aistudio.google.com))

### 프론트엔드

```bash
cd frontend
npm install
cp .env.example .env   # Firebase 키 입력
npm run dev
```

`frontend/.env` 에 필요한 값:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### 백엔드

```bash
cd backend
pip install -r requirements.txt
gcloud auth application-default login   # Firebase Admin 인증
cp .env.example .env                    # GEMINI_API_KEY 입력
uvicorn app.main:app --reload --port 8080
```

개발 중 프론트엔드는 `/api/**` 요청을 `localhost:8080` 으로 프록시합니다 (`vite.config.ts`).

### 데이터 시딩

Firestore에 복지 데이터가 없으면 피드가 비어 보입니다. 크롤러를 한 번 실행하세요.

```bash
cd backend
python -m app.jobs.crawl
```

---

## 배포

```bash
# 백엔드 → Cloud Run
./deploy-backend.sh

# 프론트엔드 → Firebase Hosting
./deploy-frontend.sh

# Cloud Scheduler (크롤링·알림 자동화) — 최초 1회
./setup-scheduler.sh
```

백엔드 환경변수(`GEMINI_API_KEY`)는 Secret Manager로 주입합니다:

```bash
echo -n "YOUR_KEY" | gcloud secrets create gemini-api-key --data-file=-
gcloud run services update nuri-backend --region asia-northeast3 \
  --update-secrets "GEMINI_API_KEY=gemini-api-key:latest"
```

---

## 프로젝트 구조

```
├── frontend/          # React SPA
│   └── src/
│       ├── pages/     # 라우트 페이지
│       ├── components/
│       ├── contexts/  # Auth, Notification
│       └── utils/     # API 클라이언트, Firebase 초기화
├── backend/           # FastAPI
│   └── app/
│       ├── api/v1/    # 엔드포인트
│       ├── services/  # Firestore, Gemini, 크롤러, 추천 알고리즘
│       ├── jobs/      # 크롤링·알림 배치 잡
│       └── middleware/ # 인증, Rate Limit, 보안 헤더
├── firestore.rules
└── firebase.json
```
