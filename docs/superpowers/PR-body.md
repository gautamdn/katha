## Summary

First of 5 implementation plans for the Susheela pivot (record-in-app → outbound AI calling). Builds the calling backbone end-to-end in **mock mode**: schedule → outbound dial → on-call orchestration → post-call extraction → Q&A retrieval. Real Sarvam/Plivo/Pipecat composition is a follow-up plan.

**37 commits across 10 phases:**
- 8 DB migrations (012-019) + 1 hardening (020) — elders, consents, calls, call_turns, capsules evolution, persona_index, audio storage tiers, phone encrypt/decrypt RPCs, persona search RPC, scoped elder UPDATE
- 2 new workspace packages: `@katha/calling` (Provider abstraction + MockProvider + Twilio/Exotel skeletons), `@katha/ai` (Anthropic wrapper, OpenAI embeddings, voiceprint via pyannote HF, story extraction, persona fact extraction)
- 5 Edge Functions: `_shared` utils, `schedule-call`, `call-orchestrator` (start + 3 webhook handlers), `post-call-process`, `qa-retrieval`
- 2 operator scripts: `seed-test-family.ts`, `trigger-test-call.ts`
- Documentation: Sarvam capability report, mock-mode smoke playbook, design spec, implementation plan

**Tests:** 5 @katha/calling + 18 @katha/ai passing (2 HF live tests skipped — gated on `HUGGINGFACE_TOKEN` + audio fixtures).

## Deferred (intentional)

- **Task 2.3 (SarvamProvider HTTP shim):** Sarvam doesn't expose a managed voice-bot endpoint. Real architecture is Plivo + Pipecat sidecar + Sarvam STT/TTS — belongs in a follow-up "Plan 1.5" plan. See `docs/superpowers/research/sarvam-capabilities.md`.
- **Task 2.5 (Provider selector):** Depends on 2.3.
- **Task 9.3 (First real call smoke):** Manual operator task; awaits voice fixtures + deployed environment.

## Critical fixes already applied from final review

- **C1:** `qa-retrieval` now enforces family-scoped elder access via caller JWT (was a cross-tenant data leak).
- **C2:** Voiceprint HF response parsing is now defensive across both Node and Deno paths (`normalizePyannoteEmbedding` handles all observed shapes).
- **C3:** Production webhook posture documented (don't disable verify_jwt without HMAC signing).
- **I2:** `/start` now restricts to service-role bearer (was open to authenticated cross-tenant abuse).
- **I6:** `elders` UPDATE is now column-scoped (sensitive fields like voiceprint and phone_number_encrypted require service role).
- Plus 4 more important issues (env vars, docs, naming, dead code, error context parity).

## Known issues deferred (not blocking review)

- **I5 (latency):** Per-turn Haiku calls for cue + consent extraction add webhook latency. Move to `post-call-process` in batch in a follow-up.
- S1-S10 from the final review — minor hardening and cleanup; safe to defer.

## Test plan

- [ ] Reviewer reads `docs/superpowers/specs/2026-05-10-susheela-pivot-design.md` (the spec) and `docs/superpowers/plans/2026-05-10-calling-foundation.md` (the plan with its Deferred section) to validate scope.
- [ ] Reviewer reads `docs/superpowers/research/sarvam-capabilities.md` to understand why 2.3/2.5 are deferred.
- [ ] CI runs `npm run test:calling` (expect 5 pass) and `npm run test:ai` (expect 18 pass + 2 skipped).
- [ ] CI runs Deno tests for `schedule-call/theme.test.ts` (3 tests).
- [ ] Apply migrations 012-020 against a dev Supabase project; verify schema + RLS via `\d <table>` + a few representative policy tests.
- [ ] Set up dev env vars per `.env.example`, including the new `PROVIDER_MODE=mock` and Supabase keys.
- [ ] Run the mock-mode smoke playbook (`docs/superpowers/playbooks/mock-mode-smoke.md`): seed family → trigger call → POST simulated webhook events → verify capsules + persona_index populated → curl qa-retrieval.
- [ ] Manual real-call smoke (Task 9.3) is gated on Plan 1.5 (Plivo + Pipecat integration); not part of this PR's acceptance.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
