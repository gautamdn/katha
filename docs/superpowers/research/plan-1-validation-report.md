# Plan 1 Validation Report

**Date:** 2026-05-12
**Branch:** `main` (post Plan 1 merge at a7e8552)

## What was checked

Static validation only. Real Postgres + Edge Function deploy are still unverified — see "Still unvalidated" below.

### Tests run
- `@katha/calling` — 5/5 passing.
- `@katha/ai` — 18/18 passing, 2 skipped (HF live tests; expected without `HUGGINGFACE_TOKEN` + audio fixtures).
- `supabase/functions/schedule-call/theme.test.ts` (Deno) — 3/3 passing.

### Cross-reference checks (no drift found)
- **Tables.** Every `.from('<table>')` reference in Edge Functions resolves to a `CREATE TABLE` in migrations 001–020.
- **Columns.** Every column in every `.insert(...)` / `.select(...)` / `.update(...)` call resolves to a defined column in the corresponding table (verified against `capsules`, `call_turns`, `calls`, `elders`, `elder_consents`, `persona_index`).
- **RPC names + signatures.**
  - `supabase.rpc('search_persona_index', { elder_id_arg, query_embedding, match_count })` matches migration 018's `(elder_id_arg UUID, query_embedding vector(1536), match_count INT DEFAULT 6)`.
  - `supabase.rpc('get_elder_phone_e164', { elder_id_arg })` matches migration 017's `(elder_id_arg UUID)`.
- **Env vars.** Every `Deno.env.get(...)` and `process.env.X` reference has a corresponding entry in `.env.example`.

### Edge Function type-check (Deno)
After adding `supabase/functions/deno.json` with `nodeModulesDir: "auto"` and running `deno install`, all four Edge Function entries (`schedule-call`, `call-orchestrator`, `post-call-process`, `qa-retrieval`) type-check cleanly. Deno resolves `npm:@anthropic-ai/sdk@0.95.1`, `npm:openai@6.37.0`, and the functions-js transitive `openai@4.104.0` peer side-by-side.

## Issues found

### Real, fixed during this pass
- **Main branch was never `npm install`-ed after the merge.** `vitest: command not found` — installed and tests pass now.
- **`.env.example` PHONE_ENCRYPTION_KEY entry was misleading** — it's not read from env at runtime; it's a Postgres GUC set via `ALTER DATABASE`. Comment added clarifying this.
- **Edge Functions had no `deno.json`**, so local type-checking failed on npm specifier resolution. Added `supabase/functions/deno.json` with `nodeModulesDir: "auto"`. Local `deno check` now passes.

### Real, not fixed (needs runtime verification)
- **Anthropic SDK 0.95.1 API surface vs. our code.** Mocked vitest tests confirm our code handles `{ content: [{ type: 'text', text: ... }] }`; this matches the documented v0.95 shape, but no live API call has run. If Anthropic returns a different content-block shape in some scenario (e.g., tool use), our `find(b => b.type === 'text')` would return undefined and `generateJSON` throws "No text block".
- **OpenAI SDK 6.x embedding response shape.** Same situation. Our code expects `res.data[0].embedding`; v6's `embeddings.create` is documented to return that shape, but no live call has run.
- **HuggingFace `pyannote/embedding` response shape.** The defensive `normalizePyannoteEmbedding` handles four observed shapes, but the actual shape returned by the current HF Inference API is unverified. Recording audio fixtures and running the live tests would resolve this.

### Cosmetic / DX
- **functions-js v2.105.4 pins `openai@^4.52.5` as a peer.** Deno handles this fine (two side-by-side npm package instances), but Supabase's runtime might emit a warning. Watch on first deploy.

## Still unvalidated (requires running infrastructure)

Without Docker (no local Supabase) and without a remote project access token, the following remain unverified:

1. **Migrations 012–020 actually apply.** SQL was statically read; syntax looks correct; index names don't collide with existing migrations. But `pg_dump` of a freshly-applied state would catch issues that grep cannot — e.g., the `vector(1536)` column requires pgvector to be installed at the time of migration 013, and `decode(encrypted, 'base64')` in migration 017 depends on `pgcrypto` from migration 012.
2. **Edge Functions deploy.** No `supabase functions deploy` ran. Some risks:
   - Deno's edge runtime version on Supabase may differ from local 2.5.4 — `jsr:@supabase/functions-js` resolution behavior may vary.
   - `npm:` specifiers should work on Supabase's runtime per docs, but with two openai versions in play, watch for runtime warnings.
3. **RLS policies behave as intended.** Static policy text was reviewed; only a real Supabase project with two test users in different families can confirm that cross-tenant SELECT is denied as expected.
4. **The full mock-mode smoke playbook end-to-end.** `seed-test-family.ts` → `trigger-test-call.ts` → curl simulated webhook events → verify capsules + persona_index populated → curl qa-retrieval.
5. **HF Inference voice extraction.** Real audio in, real embedding out, voiceprint comparison threshold tuning.

## Next steps

In order of cost/value:

1. **Cheap: add an Anthropic + OpenAI ping smoke** — a single live API call against each SDK from a Node script to confirm response shape. ~5 min, ~$0.001 in spend.
2. **Medium: link to an existing remote Supabase project**, push migrations 012–020 to a dev branch of that project, run the mock-mode smoke playbook. ~30-60 min. Requires the user's `SUPABASE_ACCESS_TOKEN` and willingness to run on their cloud project.
3. **Bigger: install Docker Desktop, run Supabase locally, run the smoke playbook against `127.0.0.1`.** ~30 min to install + 30 min to smoke. Most thorough; no impact on any cloud project.

Recommendation: **option 2 if a dev project exists; option 3 otherwise.**

## Changes made in this pass

- `.env.example` — clarified `PHONE_ENCRYPTION_KEY` is a database GUC, not env.
- `.gitignore` — added Deno local-tooling paths.
- `supabase/functions/deno.json` — enables local `deno check` to pass.
- This file.
- No code or migration changes.
