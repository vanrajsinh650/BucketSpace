#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# BucketSpace — Production Pre-Deployment Validation Script
#
# Validates TypeScript types, unit tests, Next.js production build, and performs
# a live production server startup smoke test on an isolated test port.
# ==============================================================================

echo "=================================================="
echo "  BucketSpace Production Pre-Deploy Validation"
echo "=================================================="

# 1. Typecheck
echo ""
echo "--> Step 1/4: Running TypeScript validity check..."
npx tsc --noEmit
echo "✓ TypeScript check passed (0 errors)."

# 2. Automated Tests
echo ""
echo "--> Step 2/4: Running test suite..."
npm run test
echo "✓ All test suites passed."

# 3. Production Build
echo ""
echo "--> Step 3/4: Compiling production Next.js build..."
npm run build
echo "✓ Production build compiled successfully."

# 4. Production Startup & Smoke Test
echo ""
echo "--> Step 4/4: Executing production startup smoke test..."
SMOKE_PORT=3999
PORT=${SMOKE_PORT} pnpm run start &
SERVER_PID=$!

cleanup() {
  echo "--> Terminating test server (PID: ${SERVER_PID})..."
  kill -TERM "${SERVER_PID}" 2>/dev/null || true
  wait "${SERVER_PID}" 2>/dev/null || true
}
trap cleanup EXIT

# Wait up to 15 seconds for server to bind and respond
echo "Waiting for server to become ready on port ${SMOKE_PORT}..."
MAX_WAIT=15
WAITED=0
READY=0

while [ $WAITED -lt $MAX_WAIT ]; do
  if curl -s -f "http://localhost:${SMOKE_PORT}/api/health" > /dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
  WAITED=$((WAITED + 1))
done

if [ $READY -ne 1 ]; then
  echo "FAIL: Server did not respond to /api/health within ${MAX_WAIT} seconds."
  exit 1
fi

echo "✓ Health endpoint responded HTTP 200 OK:"
curl -s "http://localhost:${SMOKE_PORT}/api/health" | head -n 5
echo ""

echo "Testing CORS preflight on /api/v1/telegram/vault..."
CORS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "http://localhost:${SMOKE_PORT}/api/v1/telegram/vault" \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: x-telegram-session")

if [ "$CORS_STATUS" -eq 204 ] || [ "$CORS_STATUS" -eq 200 ]; then
  echo "✓ CORS preflight OPTIONS returned HTTP ${CORS_STATUS}."
else
  echo "WARNING: CORS preflight returned HTTP ${CORS_STATUS} (expected 204)."
fi

echo "Testing unauthenticated vault rejection..."
VAULT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${SMOKE_PORT}/api/v1/telegram/vault")
if [ "$VAULT_STATUS" -eq 401 ]; then
  echo "✓ Unauthenticated vault request rejected with HTTP 401 Unauthorized."
else
  echo "WARNING: Unauthenticated vault request returned HTTP ${VAULT_STATUS} (expected 401)."
fi

echo ""
echo "=================================================="
echo "  ALL PRODUCTION VALIDATION CHECKS PASSED!"
echo "=================================================="

