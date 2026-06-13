#!/bin/bash
# Cloud Scheduler 설정 스크립트
# 사용법: ./setup-scheduler.sh

set -euo pipefail

PROJECT_ID="nuri-90a4f"
REGION="asia-northeast3"
SERVICE_NAME="nuri-backend"

# Cloud Run 서비스 URL 가져오기
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --platform managed --region "${REGION}" \
  --format "value(status.url)" 2>/dev/null || echo "")

if [ -z "$SERVICE_URL" ]; then
  echo "오류: ${SERVICE_NAME} 서비스 URL을 찾을 수 없습니다. 백엔드를 먼저 배포하세요."
  exit 1
fi

echo "서비스 URL: ${SERVICE_URL}"

# Cloud Scheduler 서비스 계정 생성 (없으면)
SA_EMAIL="nuri-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud iam service-accounts create nuri-scheduler \
  --display-name="NuRI Scheduler" \
  --project="${PROJECT_ID}" 2>/dev/null || true

# Cloud Run Invoker 권한 부여
gcloud run services add-iam-policy-binding "${SERVICE_NAME}" \
  --region="${REGION}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.invoker"

# 1. 크롤러 스케줄: 매주 월요일 03:00 KST (= UTC 18:00 일요일)
gcloud scheduler jobs create http nuri-crawler-weekly \
  --location="${REGION}" \
  --schedule="0 18 * * 0" \
  --uri="${SERVICE_URL}/api/v1/internal/crawl" \
  --http-method=POST \
  --oidc-service-account-email="${SA_EMAIL}" \
  --oidc-token-audience="${SERVICE_URL}" \
  --headers="Content-Type=application/json" \
  --message-body='{}' \
  --time-zone="UTC" \
  --description="매주 월요일 03:00 KST 복지 데이터 자동 크롤링" 2>/dev/null || \
gcloud scheduler jobs update http nuri-crawler-weekly \
  --location="${REGION}" \
  --schedule="0 18 * * 0" \
  --uri="${SERVICE_URL}/api/v1/internal/crawl" \
  --http-method=POST

# 2. 알림 dispatch: 매일 09:00 KST (= UTC 00:00)
gcloud scheduler jobs create http nuri-notifications-daily \
  --location="${REGION}" \
  --schedule="0 0 * * *" \
  --uri="${SERVICE_URL}/api/v1/notifications/dispatch" \
  --http-method=POST \
  --oidc-service-account-email="${SA_EMAIL}" \
  --oidc-token-audience="${SERVICE_URL}" \
  --headers="Content-Type=application/json" \
  --message-body='{}' \
  --time-zone="UTC" \
  --description="매일 09:00 KST 마감 D-1/3/7 알림 발송" 2>/dev/null || \
gcloud scheduler jobs update http nuri-notifications-daily \
  --location="${REGION}" \
  --schedule="0 0 * * *" \
  --uri="${SERVICE_URL}/api/v1/notifications/dispatch"

echo ""
echo "=== Cloud Scheduler 설정 완료 ==="
gcloud scheduler jobs list --location="${REGION}"
