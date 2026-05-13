# Katha → Susheela

## Status

This repo is mid-pivot. Read this section before touching anything.

The original Katha (record-in-app for grandparents) is being replaced by **Susheela** — an AI that calls elders on their phone, captures their stories, and surfaces them to the family. The elder's mobile app goes away; the family-side mobile app stays and gets repurposed. Plan 1 Tasks 2.3 (SarvamProvider), 2.5 (provider selector), and 9.3 (real-call smoke) are intentionally deferred; see `docs/superpowers/research/sarvam-capabilities.md` for the architectural rationale.

**Authoritative sources, in order:**

1. `docs/superpowers/specs/2026-05-10-susheela-pivot-design.md` — what we're building and why. Read first.
2. `docs/superpowers/plans/2026-05-10-calling-foundation.md` — implementation plan for the calling backbone (Plan 1 of 5). Tasks are bite-sized; execute via `superpowers:subagent-driven-development`.
3. Memory at `~/.claude/projects/-Users-gautamdambekodi-repos-katha/memory/MEMORY.md` — durable user/project context.

If a question is answered by the spec or plan, **read it instead of guessing**. The CLAUDE.md you're reading is signposts, not specifications.

## What's actually in the repo right now

- `apps/mobile/` — Expo React Native app. Currently shaped for old Katha (elder records, family reads). After Plan 2, the elder-recording surface is deprecated and the family surface evolves.
- `packages/shared/` — types, zod schemas, generated Supabase types.
- `supabase/migrations/` — 001-011 applied. Plan 1 adds 012-019.
- `supabase/functions/` — `ai-polish`, `generate-metadata`, `smart-prompts`, `speech-to-text`, `send-notification`. Plan 1 adds `schedule-call`, `call-orchestrator`, `post-call-process`, `qa-retrieval`.
- `packages/calling/` and `packages/ai/` — created by Plan 1, not present yet.
- `apps/web/` — created by Plan 4, not present yet.

There are uncommitted files from in-flight Phase 2/3 work on the original Katha (photo gallery, reactions, family tree, notifications). Don't delete them; they'll be triaged when the family-side mobile app is reworked in Plan 2.

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

# Functions (after creating an Edge Function)
npx supabase functions deploy <name>
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

- Sarvam's exact API surface is verified in `docs/superpowers/research/sarvam-capabilities.md` (Plan 1 Task 0.2). The SarvamProvider stub in the plan reflects an *expected* shape; reconcile against that report when implementing.
- `pyannote/embedding` returns ~512-dim vectors via HuggingFace Inference; the persona index uses 1536-dim from OpenAI text-embedding-3-small. They are different vectors — don't conflate the two.
- The phone encryption key (`app.phone_encryption_key`) is a Postgres GUC that must be set before any elder is inserted. Set it once per environment via `ALTER DATABASE postgres SET app.phone_encryption_key = '<key>';`.
- Audio quality matters. Don't compress archival audio — voice cloning ships in Phase 2 and degraded archival audio cannot be repaired retroactively.
- Voice verification threshold is 0.75 (cosine similarity). Tune in private beta with real fixtures, not tests.

## What NOT to do

- Don't reintroduce the elder-records-in-app flow. The pivot is to outbound calling. The old code stays for fallback only.
- Don't ship the Sarvam API key to the mobile/web client. Edge Functions only.
- Don't bypass voice verification when populating the persona index. Unverified turns must not enter persona retrieval — they corrupt the data we'll later voice-clone from.
- Don't mix `audio-archival` bucket files with `audio-playback` files. Archival is service-role-only; playback is family-readable. They serve different purposes and have different fidelity.
- Don't write new comments explaining what the code does. The user prefers terse, comment-light code; only document hidden constraints, invariants, or workarounds.
- Don't hyperlink to "Susheela" externally as a brand without trademark/domain check first (TBD §13.1 of the spec).

## Working with subagents

Plan 1 is large and is designed to be executed via `superpowers:subagent-driven-development` — fresh subagent per task with two-stage review. When dispatching a subagent for a Plan 1 task:

- Hand it the task ID + a link to the plan. Don't paste the whole plan into the prompt.
- Tell it to read this CLAUDE.md and the spec before touching code.
- Make it complete only its assigned task. No scope creep.
- Verify the commit it produces matches the task's commit message; verify the test it added actually runs.

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
