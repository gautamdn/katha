# Katha → Susheela

## Status

This repo is mid-pivot. Read this section before touching anything.

The original Katha (record-in-app for grandparents) is being replaced by **Susheela** — an AI that calls elders on their phone, captures their stories, and surfaces them to the family. The elder's mobile app goes away; the family-side mobile app stays and gets repurposed.

**Where things stand (2026-05-13):**
- Plan 1 (calling foundation, mock mode) is functionally complete and end-to-end validated against the dev Supabase project. Smoke playbook: `docs/superpowers/playbooks/mock-mode-smoke.md`; runner: `scripts/smoke-mock-mode.sh`.
- Plan 1 deferred items (Tasks 2.3 SarvamProvider, 2.5 provider selector, 9.3 first-real-call smoke) are intentionally pushed to Plan 1.5+ because Sarvam isn't a managed voice bot — see `docs/superpowers/research/sarvam-capabilities.md`.
- Plan 1.5 (hello-world outbound dial via Plivo + Sarvam TTS) is designed but not implemented. Spec: `docs/superpowers/specs/2026-05-13-plan-1.5-hello-world-dial-design.md`.

**Authoritative sources, in order:**

1. `docs/superpowers/specs/2026-05-10-susheela-pivot-design.md` — what we're building and why. Read first.
2. `docs/superpowers/plans/2026-05-10-calling-foundation.md` — implementation plan for Plan 1 (calling backbone, mock-mode complete). Plan 1 of 5 overall.
3. `docs/superpowers/specs/2026-05-13-plan-1.5-hello-world-dial-design.md` — Plan 1.5 design (real telephony smoke, not yet implemented).
4. Memory at `~/.claude/projects/-Users-gautamdambekodi-repos-katha/memory/MEMORY.md` — durable user/project context.

If a question is answered by the spec or plan, **read it instead of guessing**. The CLAUDE.md you're reading is signposts, not specifications.

## What's actually in the repo right now

- `apps/mobile/` — Expo React Native app. Currently shaped for old Katha (elder records, family reads). After Plan 2, the elder-recording surface is deprecated and the family surface evolves. Old Phase 2/3 features (photo gallery, reactions, family tree, notifications) are committed; they'll be triaged when the family-side mobile app is reworked in Plan 2.
- `packages/shared/` — types, zod schemas, generated Supabase types.
- `packages/calling/` — provider interface + types + MockProvider + Twilio/Exotel placeholders (Plan 1). Sarvam-as-composite (Plivo + Pipecat + Sarvam) is deferred to Plan 1.5+; the Plan 1.5 hello-world dial sidesteps the provider abstraction entirely.
- `packages/ai/` — Node TypeScript mirror of the AI logic in Edge Functions: Anthropic wrapper, embeddings, voiceprint, story + persona extraction.
- `supabase/migrations/` — 001-009 + 012-021 applied (gap is intentional; legacy numbering).
- `supabase/functions/` — calling stack: `schedule-call`, `call-orchestrator`, `post-call-process`, `qa-retrieval` (Plan 1). Legacy: `ai-polish`, `generate-metadata`, `smart-prompts`, `speech-to-text`. Shared modules under `_shared/`.
- `scripts/` — `seed-test-family.ts`, `trigger-test-call.ts`, `smoke-mock-mode.sh` (Plan 1 mock-mode validation harness).
- `apps/web/` — created by Plan 4, not present yet.

## Tech stack

TypeScript everywhere, strict. Expo SDK 54. Supabase (Postgres + Auth + Storage + Edge Functions). pgvector for embeddings (added by Plan 1). Sarvam AI for the calling stack. Anthropic Claude for content generation. OpenAI for embeddings. HuggingFace Inference for pyannote speaker embeddings.

Edge Functions are Deno. The `@katha/*` packages are Node TypeScript with Vitest. They don't share runtimes — the AI logic is duplicated between `packages/ai/` (Node, for unit tests + future mobile use) and `supabase/functions/*/lib/` (Deno mirror, for runtime). Keep them in sync when changing extraction logic.

## Commands

```bash
# Mobile dev
npm run dev                              # expo start
npm run ios                              # build + run iOS simulator

# Database
npm run db:push                          # apply migrations
npm run db:reset                         # nuke + re-apply (local only)
npm run db:types                         # regenerate packages/shared/database.types.ts

# Tests
npm test                                 # all workspaces
npm run test:calling                     # @katha/calling
npm run test:ai                          # @katha/ai
# Edge function tests via Deno: cd into the function dir and `deno test --allow-all`

# Functions
npx supabase functions deploy <name>

# Plan 1 mock-mode end-to-end smoke (deploys migrations + functions, seeds,
# triggers a mock call, verifies capsules + persona_index + qa-retrieval).
# Requires .env with SUPABASE_PROJECT_REF, SUPABASE_DB_PASSWORD,
# SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, PHONE_ENCRYPTION_KEY.
set -a && source .env && set +a && ./scripts/smoke-mock-mode.sh
```

## Codebase conventions

- **No emojis in code or commits** unless the user asks.
- **No comments unless the WHY is non-obvious.** Don't narrate what the code does.
- **No backwards-compat hacks.** This is pre-launch. Rename, delete, reshape.
- **No premature abstraction.** Three similar lines beats a wrong helper.
- **No mocks for external APIs in Edge Functions.** Mock at the boundary in `@katha/*` unit tests; integration tests use real services or fixtures.
- **TDD where the logic is deterministic** (extraction, embedding, voiceprint comparison, theme picking). Smoke/integration where it isn't (Sarvam dial, audio fidelity).
- **Migrations are append-only.** Numbered. Don't edit applied ones.
- **All AI keys live in Edge Function env, never in the client.** This is non-negotiable — the client is shipped to App Store and Play Store.

## RLS architecture

Family-scoped tables use the `get_my_family_id()` SECURITY DEFINER helper — never sub-query `profiles` directly from a policy (that's where 003-004 fixed infinite recursion). New tables follow the same pattern. Service-role-only inserts/updates for tables that the client should never directly mutate (calls, call_turns, persona_index, elder_consents).

## Gotchas

- Sarvam is **not** a managed voice bot — it's STT + TTS + LLM components. Real outbound calling needs a composite (Plivo + Pipecat + Sarvam). See `docs/superpowers/research/sarvam-capabilities.md`. The Plan 1 SarvamProvider stub never landed; Plan 1.5 starts with a hello-world dial that skips Pipecat.
- `pyannote/embedding` returns ~512-dim vectors via HuggingFace Inference; the persona index uses 1536-dim from OpenAI text-embedding-3-small. They are different vectors — don't conflate the two.
- The phone encryption key is passed as an RPC parameter to `encrypt_phone` and `get_elder_phone_e164` (migration 021). It is **not** a Postgres GUC — Supabase's managed Postgres restricts `ALTER DATABASE ... SET app.*` to `supabase_admin`. Set `PHONE_ENCRYPTION_KEY` as an Edge Function secret *and* in `.env` for scripts that touch phone data; the same value must be used across both contexts for a given project (rotation requires re-encrypting every elder row).
- Edge Function `verify_jwt = false` is set in `supabase/config.toml` for `call-orchestrator` and `post-call-process` because Supabase auto-injects the modern opaque `sb_secret_*` service-role key on managed runtime, and the gateway can't parse it as a JWT. Internal service-role bearer checks (e.g., `handleStart`) still enforce auth at the function level.
- Audio quality matters. Don't compress archival audio — voice cloning ships in Phase 2 and degraded archival audio cannot be repaired retroactively. Note PSTN reality: Plivo records at 8 kHz μ-law, below the spec's 16 kHz voice-cloning threshold — flagged in the Sarvam capabilities research.
- Voice verification threshold is 0.75 (cosine similarity). Tune in private beta with real fixtures, not tests. First calls have no voiceprint baseline; persona_index correctly stays empty until a second call has a verifiable elder turn.

## What NOT to do

- Don't reintroduce the elder-records-in-app flow. The pivot is to outbound calling. The old code stays for fallback only.
- Don't ship the Sarvam API key to the mobile/web client. Edge Functions only.
- Don't bypass voice verification when populating the persona index. Unverified turns must not enter persona retrieval — they corrupt the data we'll later voice-clone from.
- Don't mix `audio-archival` bucket files with `audio-playback` files. Archival is service-role-only; playback is family-readable. They serve different purposes and have different fidelity.
- Don't write new comments explaining what the code does. The user prefers terse, comment-light code; only document hidden constraints, invariants, or workarounds.
- Don't hyperlink to "Susheela" externally as a brand without trademark/domain check first (TBD §13.1 of the spec).

## Working with subagents

Plan 1 was executed via `superpowers:subagent-driven-development` — fresh subagent per task with two-stage review. Future multi-task plans (Plan 2 mobile rework, Plan 4 web) should use the same pattern. When dispatching a subagent for a task:

- Hand it the task ID + a link to the plan. Don't paste the whole plan into the prompt.
- Tell it to read this CLAUDE.md and the spec before touching code.
- Make it complete only its assigned task. No scope creep.
- Verify the commit it produces matches the task's commit message; verify the test it added actually runs.

Plan 1.5 is small enough (3 files, manual smoke) that subagent driving is overkill — implement directly.

## Memory

User-specific and project-specific durable memory lives at:

```
~/.claude/projects/-Users-gautamdambekodi-repos-katha/memory/
  MEMORY.md                            # index
  user_family_languages.md             # Kannada + Gujarati family; personal stake
  project_katha_pivot_to_susheela.md   # pivot decision, MVP scope, north star
```

Update these when you learn something durable about the user, the project, feedback, or external references. Don't write conversation-scoped state there (use TaskCreate / Plan / Spec instead).

## Founder note

Susheela is named after the user's grandmother. This is real and personal. Treat product decisions accordingly — Gautam is his own first user, and the Kannada/Gujarati language quality matters more than English polish.
