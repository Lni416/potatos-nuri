#!/bin/bash
# NuRI 백엔드 Cloud Run 배포 스크립트
# 사용법: ./deploy-backend.sh

set -euo pipefail

PROJECT_ID="nuri-90a4f"
REGION="asia-northeast3"       # 서울 리전
SERVICE_NAME="nuri-backend"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "=== NuRI 백엔드 배포 시작 ==="

# 1. Docker 이미지 빌드 & 푸시
echo "[1/3] Docker 이미지 빌드 중..."
cd "$(dirname "$0")/backend"
gcloud builds submit --tag "${IMAGE}" .

# 2. Cloud Run 배포
echo "[2/3] Cloud Run 배포 중..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --set-env-vars "FIREBASE_PROJECT_ID=${PROJECT_ID}" \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --port 8080

# 3. 서비스 URL 확인
echo "[3/3] 배포 완료!"
gcloud run services describe "${SERVICE_NAME}" \
  --platform managed \
  --region "${REGION}" \
  --format "value(status.url)"

echo ""
echo "주의: GEMINI_API_KEY는 Secret Manager를 통해 별도 설정하세요:"
echo "  gcloud run services update ${SERVICE_NAME} --region ${REGION} \\"
echo "    --update-secrets GEMINI_API_KEY=gemini-api-key:latest"
