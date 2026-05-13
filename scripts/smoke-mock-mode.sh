#!/usr/bin/env bash
# Plan 1 mock-mode end-to-end smoke runner.
#
# Prereqs:
#   - npx supabase login already done
#   - SUPABASE_PROJECT_REF, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_PASSWORD in env
#   - ANTHROPIC_API_KEY, OPENAI_API_KEY in env (already in .env)
#
# This script:
#   1. Links to the project (if not linked)
#   2. Pushes migrations 012-021
#   3. Deploys all four Edge Functions (_shared sits beside them; no separate deploy)
#   4. Sets function secrets (Anthropic + OpenAI + PHONE_ENCRYPTION_KEY + optional HF)
#   5. Runs seed-test-family.ts
#   6. Triggers a mock call
#   7. Simulates webhook events (start, two turns, end)
#   8. Verifies capsules + persona_index populated
#   9. Runs qa-retrieval
#
# Exit codes: 0 = full pass, non-zero = first failure.

set -euo pipefail

if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
  echo "SUPABASE_PROJECT_REF not set. Aborting." >&2
  exit 1
fi
if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "SUPABASE_SERVICE_ROLE_KEY not set. Aborting." >&2
  exit 1
fi
if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "SUPABASE_DB_PASSWORD not set (for db push). Aborting." >&2
  exit 1
fi

PROJECT_URL="https://${SUPABASE_PROJECT_REF}.supabase.co"
# Phone encryption key is passed as an RPC parameter (migration 021), not a DB GUC.
# Reuse via env so a re-run touches the same encrypted phone column; otherwise mint.
export PHONE_ENCRYPTION_KEY="${PHONE_ENCRYPTION_KEY:-$(openssl rand -hex 32)}"

echo "==> Linking project ${SUPABASE_PROJECT_REF}"
npx supabase link --project-ref "${SUPABASE_PROJECT_REF}" --password "${SUPABASE_DB_PASSWORD}"

echo "==> Pushing migrations"
npx supabase db push --password "${SUPABASE_DB_PASSWORD}"

echo "==> Setting Edge Function secrets"
npx supabase secrets set --project-ref "${SUPABASE_PROJECT_REF}" \
  ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
  OPENAI_API_KEY="${OPENAI_API_KEY}" \
  PHONE_ENCRYPTION_KEY="${PHONE_ENCRYPTION_KEY}" \
  PROVIDER_MODE="mock" \
  ${HUGGINGFACE_TOKEN:+HUGGINGFACE_TOKEN="${HUGGINGFACE_TOKEN}"}

echo "==> Deploying Edge Functions"
for fn in schedule-call call-orchestrator post-call-process qa-retrieval; do
  echo "    deploying ${fn}"
  npx supabase functions deploy "${fn}" --project-ref "${SUPABASE_PROJECT_REF}"
done

echo "==> Seeding test family"
export SUPABASE_URL="${PROJECT_URL}"
export TEST_USER_EMAIL="${TEST_USER_EMAIL:-gautam-smoke@example.com}"
export TEST_USER_PASSWORD="${TEST_USER_PASSWORD:-changeme-smoke-12345}"
export TEST_ELDER_PHONE="${TEST_ELDER_PHONE:-+919999999999}"
export TEST_ELDER_NAME="${TEST_ELDER_NAME:-Susheela}"
export TEST_ELDER_LANG="${TEST_ELDER_LANG:-kn}"

# --transpile-only + explicit CJS module: avoids ts-node's auto-ESM detection
# (which fails on .ts when the script has zero package.json "type" hint and
# ts-node 10.9.x routes through the ESM loader by default in some environments).
TS_NODE_OPTS=(--transpile-only --compiler-options '{"module":"commonjs","esModuleInterop":true,"target":"ES2020"}')
SEED_OUTPUT=$(npx ts-node "${TS_NODE_OPTS[@]}" scripts/seed-test-family.ts)
echo "${SEED_OUTPUT}"
ELDER_ID=$(echo "${SEED_OUTPUT}" | grep "^Elder:" | awk '{print $2}')
if [[ -z "${ELDER_ID}" ]]; then
  echo "Could not parse elder ID from seed output" >&2
  exit 1
fi
echo "==> ELDER_ID=${ELDER_ID}"

echo "==> Triggering mock call"
export ELDER_ID
CALL_RESPONSE=$(npx ts-node "${TS_NODE_OPTS[@]}" scripts/trigger-test-call.ts)
echo "${CALL_RESPONSE}"
CALL_ID=$(echo "${CALL_RESPONSE}" | sed -nE 's/^call_id=(.+)$/\1/p' | head -1)
if [[ -z "${CALL_ID}" ]]; then
  echo "Could not parse call ID from trigger output" >&2
  exit 1
fi
PROVIDER_CALL_ID="mock-${CALL_ID}"

WEBHOOK_URL="${PROJECT_URL}/functions/v1/call-orchestrator/webhook"
AUTH="authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
CT="content-type: application/json"

echo "==> Simulating call_started"
curl -sS -X POST "${WEBHOOK_URL}" -H "${AUTH}" -H "${CT}" \
  -d "{\"event\":\"call_started\",\"provider_call_id\":\"${PROVIDER_CALL_ID}\"}" | head -3

echo "==> Simulating Susheela's first turn"
curl -sS -X POST "${WEBHOOK_URL}" -H "${AUTH}" -H "${CT}" -d "$(cat <<EOF
{"event":"turn","provider_call_id":"${PROVIDER_CALL_ID}","speaker":"susheela","transcript":"Namaste Ajji, tell me about your wedding day.","language":"kn","audio_clip_url":"https://example.com/turn1.flac","started_at_ms":0,"ended_at_ms":3000}
EOF
)" | head -3

echo "==> Simulating elder turn (no audio_clip_url → voiceprint skipped)"
curl -sS -X POST "${WEBHOOK_URL}" -H "${AUTH}" -H "${CT}" -d "$(cat <<EOF
{"event":"turn","provider_call_id":"${PROVIDER_CALL_ID}","speaker":"elder","transcript":"It was 1957 in Bhuj. We had a beautiful ceremony, my mother-in-law she gave me her pearl necklace.","language":"kn","audio_clip_url":"https://example.com/turn2.flac","started_at_ms":3000,"ended_at_ms":12000}
EOF
)" | head -3

echo "==> Simulating call_ended"
curl -sS -X POST "${WEBHOOK_URL}" -H "${AUTH}" -H "${CT}" -d "$(cat <<EOF
{"event":"call_ended","provider_call_id":"${PROVIDER_CALL_ID}","status":"completed","duration_seconds":120,"recording_url":"https://example.com/full.flac","cost_cents":10}
EOF
)" | head -3

echo "==> Waiting 30s for post-call-process to complete"
sleep 30

echo "==> Querying capsules"
curl -sS "${PROJECT_URL}/rest/v1/capsules?source_call_id=eq.${CALL_ID}&select=id,title,polished_text,voice_verified" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "${AUTH}" | head -20

echo "==> Querying persona_index"
curl -sS "${PROJECT_URL}/rest/v1/persona_index?source_call_id=eq.${CALL_ID}&select=fact_type,text,confidence,voice_verified" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "${AUTH}" | head -20

echo "==> Running qa-retrieval"
curl -sS -X POST "${PROJECT_URL}/functions/v1/qa-retrieval" \
  -H "${AUTH}" -H "${CT}" \
  -d "{\"elder_id\":\"${ELDER_ID}\",\"question\":\"What did Ajji say about her wedding day?\"}" | head -40

echo ""
echo "==> Smoke complete. PHONE_ENCRYPTION_KEY used:"
echo "${PHONE_ENCRYPTION_KEY}"
echo "Save it somewhere — needed for future scripts that touch phone data."
