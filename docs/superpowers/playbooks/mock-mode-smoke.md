# Mock-Mode Smoke Playbook

End-to-end smoke test for the calling pipeline using `PROVIDER_MODE=mock`.
Run after deploying all Plan 1 Edge Functions.

## Prerequisites

- Supabase project deployed with all Plan 1 migrations (012-019) applied.
- Edge Function env vars set: `PROVIDER_MODE=mock`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `HUGGINGFACE_TOKEN`, `PHONE_ENCRYPTION_KEY`.
- Elder seeded via `scripts/seed-test-family.ts`. Export `ELDER_ID` from that run.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exported in your shell.

---

## Step 1: Trigger a call

```bash
ELDER_ID=<from seed> npx ts-node scripts/trigger-test-call.ts
```

Note the `call_id` from the response.

---

## Step 2: Simulate webhook events

Set the provider call ID variable, then POST each event in order.

```bash
PROVIDER_CALL_ID=mock-<call_id>

# call_started
curl -X POST $SUPABASE_URL/functions/v1/call-orchestrator/webhook \
  -H "authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "content-type: application/json" \
  -d "{\"event\":\"call_started\",\"provider_call_id\":\"$PROVIDER_CALL_ID\"}"

# turn (susheela)
curl -X POST $SUPABASE_URL/functions/v1/call-orchestrator/webhook \
  -H "authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "content-type: application/json" \
  -d "{\"event\":\"turn\",\"provider_call_id\":\"$PROVIDER_CALL_ID\",\"speaker\":\"susheela\",\"transcript\":\"Namaste Ajji, tell me about your wedding day.\",\"language\":\"kn\",\"audio_clip_url\":\"https://example.com/turn1.flac\",\"started_at_ms\":0,\"ended_at_ms\":3000}"

# turn (elder) — replace <hosted-flac> with a real publicly accessible .flac URL for voiceprint to work
curl -X POST $SUPABASE_URL/functions/v1/call-orchestrator/webhook \
  -H "authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "content-type: application/json" \
  -d "{\"event\":\"turn\",\"provider_call_id\":\"$PROVIDER_CALL_ID\",\"speaker\":\"elder\",\"transcript\":\"It was 1957 in Bhuj. We had a beautiful ceremony.\",\"language\":\"kn\",\"audio_clip_url\":\"<hosted-flac>\",\"started_at_ms\":3000,\"ended_at_ms\":12000}"

# call_ended
curl -X POST $SUPABASE_URL/functions/v1/call-orchestrator/webhook \
  -H "authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "content-type: application/json" \
  -d "{\"event\":\"call_ended\",\"provider_call_id\":\"$PROVIDER_CALL_ID\",\"status\":\"completed\",\"duration_seconds\":600,\"recording_url\":\"https://example.com/full.flac\",\"cost_cents\":50}"
```

---

## Step 3: Verification SQL

Run in Supabase SQL editor or psql, replacing `<call_id>` and `<elder_id>`.

```sql
-- call row: expect status=completed, summary non-null
SELECT * FROM calls WHERE id = '<call_id>';

-- 2 turn rows, elder turn should have embedding non-null if voice-verified
SELECT * FROM call_turns WHERE call_id = '<call_id>';

-- 1+ capsule rows extracted from the call
SELECT * FROM capsules WHERE source_call_id = '<call_id>';

-- 1+ persona facts (only populated if elder turn passed voice verification)
SELECT * FROM persona_index WHERE source_call_id = '<call_id>';
```

---

## Step 4: Q&A smoke

```bash
curl -X POST $SUPABASE_URL/functions/v1/qa-retrieval \
  -H "authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "content-type: application/json" \
  -d "{\"elder_id\":\"$ELDER_ID\",\"question\":\"What did Ajji say about her wedding day?\"}"
```

Expected: an answer quoting or paraphrasing the wedding-day turn, with a citation including `audio_clip_url`.
