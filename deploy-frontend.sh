#!/bin/bash
# NuRI 프론트엔드 Firebase Hosting 배포 스크립트
# 사용법: ./deploy-frontend.sh
#
# 사전 조건:
#   1. frontend/.env 에 VITE_FIREBASE_* 값 모두 입력
#   2. firebase login 완료
#   3. firebase use nuri-90a4f

set -euo pipefail

echo "=== NuRI 프론트엔드 배포 시작 ==="

# .env 필수 값 확인
cd "$(dirname "$0")/frontend"
if ! grep -q "VITE_FIREBASE_API_KEY=AIza" .env 2>/dev/null; then
  echo "오류: frontend/.env 에 VITE_FIREBASE_API_KEY 값이 없습니다."
  echo "  Firebase Console → 프로젝트 설정 → 내 앱 → SDK 설정 및 구성에서 복사하세요."
  exit 1
fi

# 빌드
echo "[1/2] Vite 빌드 중..."
npm run build

# Firebase Hosting 배포
echo "[2/2] Firebase Hosting 배포 중..."
cd ..
firebase deploy --only hosting

echo ""
echo "=== 배포 완료 ==="
echo "URL: https://nuri-90a4f.web.app"
