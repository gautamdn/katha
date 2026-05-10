# Calling Foundation + Capture Pipeline + Q&A — Plan 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the end-to-end pipeline so Susheela can call an elder, conduct a conversation in Kannada/Gujarati/English/Hindi, capture turns + audio at archival quality, verify the elder's voice, extract stories + persona facts post-call, and answer "what did Ajji say about X?" via a Q&A retrieval endpoint.

**Architecture:** Sarvam-first calling provider behind a provider abstraction (swap-friendly later). Edge Functions on Supabase orchestrate scheduling, on-call events, post-call extraction, and Q&A retrieval. Audio stored in three fidelity tiers in Supabase Storage (archival/playback/share). Voice verification via HuggingFace Inference API (pyannote) since Edge Functions are Deno (Python pyannote isn't usable in-process). Persona index uses pgvector with OpenAI text-embedding-3-small embeddings.

**Tech Stack:** TypeScript, Deno (Edge Functions), Supabase (Postgres + Storage + pgvector), Sarvam AI (calling + STT + TTS), Anthropic Claude (Sonnet + Haiku), OpenAI embeddings, HuggingFace Inference API (pyannote speaker embeddings), Vitest (unit tests for new packages), Deno test (Edge Function tests).

**Out of scope for this plan:** Mobile UI (Plan 2), Web UI (Plans 4/5), share links, digests, time-capsule sealing (Plan 3), billing (Plan 4). RLS for new tables is in this plan but mobile/web access isn't wired here.

---

## File structure (this plan creates / modifies)

```
docs/superpowers/plans/
  2026-05-10-calling-foundation.md          # this file

supabase/migrations/
  012_elders_and_consents.sql               # NEW
  013_calls_and_turns.sql                   # NEW (incl. pgvector extension)
  014_capsules_evolution.sql                # NEW
  015_persona_index.sql                     # NEW
  016_audio_storage_tiers.sql               # NEW (buckets + RLS)

supabase/functions/
  _shared/                                  # NEW
    cors.ts
    supabase-admin.ts
    types.ts                                # shared call/turn types
  schedule-call/                            # NEW
    index.ts
    brief.ts                                # call-brief assembly
    theme.ts                                # theme picker
  call-orchestrator/                        # NEW
    index.ts
    handlers.ts                             # call-start, turn, call-end, etc.
  post-call-process/                        # NEW
    index.ts
    extract-stories.ts
    extract-persona-facts.ts
  qa-retrieval/                             # NEW
    index.ts
    search.ts
  cron-schedule-calls/                      # NEW (cron-driven)
    index.ts

packages/calling/                           # NEW workspace package
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts
    types.ts
    Provider.ts                             # interface
    selector.ts                             # pick provider by country
    providers/
      mock.ts                               # for tests + local dev
      sarvam.ts
      twilio.ts                             # skeleton for US numbers
      exotel.ts                             # skeleton for India fallback
  test/
    Provider.test.ts
    providers/
      mock.test.ts
      sarvam.test.ts                        # contract tests w/ recorded fixtures

packages/ai/                                # NEW workspace package
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts
    anthropic.ts                            # Claude client wrapper
    embeddings.ts                           # OpenAI embeddings client
    voiceprint.ts                           # HuggingFace pyannote wrapper
    extract-stories.ts                      # turns -> stories logic
    extract-persona-facts.ts                # turns -> persona facts logic
  test/
    extract-stories.test.ts
    extract-persona-facts.test.ts
    voiceprint.test.ts
    fixtures/
      sample-call-turns.json
      voice-clip-elder-1.flac
      voice-clip-elder-1-followup.flac
      voice-clip-different-speaker.flac

packages/shared/                            # MODIFY
  database.types.ts                         # regenerated
  types.ts                                  # ADD new domain types

scripts/                                    # NEW
  seed-test-family.ts                       # operator: create family + elder
  trigger-test-call.ts                      # operator: kick off a call

package.json                                # MODIFY (add workspaces, test scripts)
```

---

## Phase 0 — Workspace + test setup

### Task 0.1: Add vitest and new workspaces to root

**Files:**
- Modify: `package.json`
- Create: `packages/calling/package.json`
- Create: `packages/calling/tsconfig.json`
- Create: `packages/calling/vitest.config.ts`
- Create: `packages/ai/package.json`
- Create: `packages/ai/tsconfig.json`
- Create: `packages/ai/vitest.config.ts`

- [ ] **Step 1: Update root package.json**

```json
{
  "name": "katha",
  "version": "0.1.0",
  "private": true,
  "description": "Katha: Family Stories, Forever — A voice-first, time-capsule family legacy app",
  "workspaces": [
    "apps/mobile",
    "packages/shared",
    "packages/calling",
    "packages/ai"
  ],
  "overrides": {
    "react": "19.1.0"
  },
  "scripts": {
    "dev": "cd apps/mobile && npx expo start",
    "ios": "cd apps/mobile && npx expo run:ios",
    "android": "cd apps/mobile && npx expo run:android",
    "db:types": "npx supabase gen types typescript --local > packages/shared/database.types.ts",
    "db:push": "npx supabase db push",
    "db:reset": "npx supabase db reset",
    "test": "npm run test --workspaces --if-present",
    "test:calling": "npm run test --workspace=@katha/calling",
    "test:ai": "npm run test --workspace=@katha/ai"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Create packages/calling/package.json**

```json
{
  "name": "@katha/calling",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@katha/shared": "*",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 3: Create packages/calling/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 4: Create packages/calling/vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Create packages/ai/{package.json,tsconfig.json,vitest.config.ts}**

Same shape as calling. Replace `@katha/calling` with `@katha/ai`. Add `@anthropic-ai/sdk`, `openai`, and `@huggingface/inference` to dependencies.

```json
{
  "name": "@katha/ai",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@katha/shared": "*",
    "@anthropic-ai/sdk": "^0.30.0",
    "openai": "^4.60.0",
    "@huggingface/inference": "^2.8.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "typescript": "^5.5.0"
  }
}
```

The tsconfig.json and vitest.config.ts files are identical to calling's.

- [ ] **Step 6: Install and verify**

Run: `cd /Users/gautamdambekodi/repos/katha && npm install`
Expected: succeeds with `added N packages` for new workspaces.
Run: `npm test`
Expected: vitest runs, finds no test files yet, exits 0 with "No test files found" (or similar).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json packages/calling packages/ai
git commit -m "chore: add @katha/calling and @katha/ai workspaces with vitest"
```

---

### Task 0.2: Sarvam capability verification report

This is a research spike, not TDD. Output: a written 1-page report committed to docs/.

**Files:**
- Create: `docs/superpowers/research/sarvam-capabilities.md`

- [ ] **Step 1: Read Sarvam docs**

Visit https://docs.sarvam.ai (or the equivalent latest docs). Read:
- Conversational agent / voice bot product overview
- Outbound calling support and how to initiate a call programmatically
- Telephony partners (does Sarvam handle dialing, or do we pair with Exotel/Twilio?)
- Audio quality returned (sample rate, codec, mono/stereo, lossy/lossless)
- Voiceprint / speaker verification API (does it exist?)
- Webhook event types during a call
- Pricing per minute by language
- Supported languages and which voices are available for Susheela

- [ ] **Step 2: Write report**

Create `docs/superpowers/research/sarvam-capabilities.md` with these sections, filled in concretely:
1. Outbound calling: native support? telephony partners? sample API call.
2. Audio quality: sample rate / codec / can we get archival audio (≥16 kHz lossless)?
3. Voiceprint: supported? API? else: must use HuggingFace pyannote.
4. Webhook events: list of events we can subscribe to.
5. Languages + voices: confirm Kannada, Gujarati, Hindi, English availability and voice IDs.
6. Pricing: per-minute rates per language.
7. Open questions to confirm with Sarvam team via support / sales contact.

The report becomes the source of truth for the SarvamProvider implementation in Task 2.3.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/research/sarvam-capabilities.md
git commit -m "docs: capture Sarvam capability verification report"
```

---

## Phase 1 — Database migrations

### Task 1.1: Migration 012 — elders + elder_consents

**Files:**
- Create: `supabase/migrations/012_elders_and_consents.sql`

- [ ] **Step 1: Write migration**

```sql
-- 012_elders_and_consents.sql
-- Adds elders (the person Susheela calls) and elder_consents (audio-recorded consent records)

CREATE TYPE elder_status AS ENUM (
  'pending_first_call',
  'active',
  'paused',
  'opted_out'
);

CREATE TYPE consent_type AS ENUM (
  'recording',
  'family_sharing',
  'persona_use',
  'voice_cloning',
  'external_share'
);

CREATE TABLE elders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  relationship_label TEXT NOT NULL,                 -- "Ajji", "Nani", "Dada"
  preferred_name TEXT,                              -- what Susheela calls them
  language TEXT NOT NULL CHECK (language IN ('kn', 'gu', 'en', 'hi')),
  phone_number_encrypted TEXT NOT NULL,             -- pgcrypto encrypted; helper RPC reads
  phone_number_hash TEXT NOT NULL UNIQUE,           -- SHA-256 hash for de-dup
  country TEXT NOT NULL CHECK (country IN ('IN', 'US')),
  timezone TEXT NOT NULL,
  added_by UUID NOT NULL REFERENCES profiles(id),
  voiceprint JSONB,                                 -- speaker embedding from pyannote
  voiceprint_enrolled_at TIMESTAMPTZ,
  status elder_status NOT NULL DEFAULT 'pending_first_call',
  family_intro_audio_url TEXT,                      -- 20-sec recording from family for first call
  call_cadence_days INT DEFAULT 7,                  -- default weekly
  preferred_call_time TIME,                         -- in elder's timezone
  preferred_call_day INT,                           -- 0-6, NULL means flexible
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_elders_family_id ON elders(family_id);
CREATE INDEX idx_elders_status ON elders(status);

CREATE TABLE elder_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  consent_type consent_type NOT NULL,
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  audio_url TEXT,                                    -- recording of consent statement
  transcript TEXT,
  language TEXT NOT NULL,
  call_id UUID,                                      -- FK added in 013 (calls table)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_elder_consents_elder_id ON elder_consents(elder_id);
CREATE INDEX idx_elder_consents_type ON elder_consents(elder_id, consent_type);

-- RLS
ALTER TABLE elders ENABLE ROW LEVEL SECURITY;
ALTER TABLE elder_consents ENABLE ROW LEVEL SECURITY;

-- Family members can see their family's elders
CREATE POLICY "Family members can view elders"
  ON elders FOR SELECT
  USING (family_id = get_my_family_id());

CREATE POLICY "Family members can insert elders"
  ON elders FOR INSERT
  WITH CHECK (family_id = get_my_family_id());

CREATE POLICY "Family members can update their elders"
  ON elders FOR UPDATE
  USING (family_id = get_my_family_id());

CREATE POLICY "Family members can view consents"
  ON elder_consents FOR SELECT
  USING (
    elder_id IN (SELECT id FROM elders WHERE family_id = get_my_family_id())
  );

-- Inserts/updates to consents only via service role (Edge Functions); no client direct insert
CREATE POLICY "Service role only insert consents"
  ON elder_consents FOR INSERT
  WITH CHECK (false);

-- updated_at trigger for elders
CREATE OR REPLACE FUNCTION update_elders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER elders_updated_at_trigger
  BEFORE UPDATE ON elders
  FOR EACH ROW
  EXECUTE FUNCTION update_elders_updated_at();

-- pgcrypto for phone encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase db push` (or `npx supabase db reset` if local-only and you want a clean slate)
Expected: migration applies successfully.

- [ ] **Step 3: Verify schema**

Run: `npx supabase db diff` — expect empty (no drift)
Run: `psql $DB_URL -c "\d elders"` — expect to see all columns + RLS enabled
Run: `psql $DB_URL -c "\d elder_consents"`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/012_elders_and_consents.sql
git commit -m "feat(db): add elders and elder_consents tables"
```

---

### Task 1.2: Migration 013 — calls + call_turns + pgvector

**Files:**
- Create: `supabase/migrations/013_calls_and_turns.sql`

- [ ] **Step 1: Write migration**

```sql
-- 013_calls_and_turns.sql
-- Adds calls (one row per phone call) and call_turns (granular per-turn records).
-- Enables pgvector for embeddings.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE call_status AS ENUM (
  'scheduled',
  'dialing',
  'in_progress',
  'completed',
  'voicemail',
  'no_answer',
  'declined',
  'failed'
);

CREATE TYPE call_speaker AS ENUM ('elder', 'susheela');

CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES families(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  status call_status NOT NULL DEFAULT 'scheduled',
  provider TEXT,                                     -- 'sarvam' | 'twilio' | 'exotel' | 'mock'
  provider_call_id TEXT,
  recording_url TEXT,                                -- archival, lossless
  recording_codec TEXT,
  transcript_url TEXT,
  theme TEXT,                                        -- assigned for this call
  brief_json JSONB,                                  -- last summaries, family suggestions, etc.
  summary TEXT,                                      -- generated post-call
  next_call_suggested_at TIMESTAMPTZ,
  duration_seconds INT,
  cost_cents INT,
  voice_verification_score NUMERIC(4,3),             -- aggregate across turns
  language TEXT,                                     -- detected/used
  is_first_call BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calls_elder_id ON calls(elder_id);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_scheduled_at ON calls(scheduled_at) WHERE status = 'scheduled';

CREATE TABLE call_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  speaker call_speaker NOT NULL,
  audio_clip_url TEXT,
  transcript TEXT,
  language TEXT,
  started_at_ms INT NOT NULL,                        -- ms offset within call
  ended_at_ms INT NOT NULL,
  voice_verification_score NUMERIC(4,3),
  cues JSONB DEFAULT '{}'::jsonb,                    -- {time_capsule, advice, distress, cadence, sharing_request}
  embedding vector(1536),                            -- OpenAI text-embedding-3-small dim
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_call_turns_call_id ON call_turns(call_id);
CREATE INDEX idx_call_turns_speaker ON call_turns(call_id, speaker);
-- HNSW index for embedding similarity search
CREATE INDEX idx_call_turns_embedding ON call_turns
  USING hnsw (embedding vector_cosine_ops);

-- Wire elder_consents.call_id FK now that calls table exists
ALTER TABLE elder_consents
  ADD CONSTRAINT elder_consents_call_id_fkey
  FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view their calls"
  ON calls FOR SELECT
  USING (family_id = get_my_family_id());

-- Calls inserted/updated only by service role (Edge Functions); no direct client writes
CREATE POLICY "Service role only insert calls"
  ON calls FOR INSERT WITH CHECK (false);

CREATE POLICY "Service role only update calls"
  ON calls FOR UPDATE USING (false);

CREATE POLICY "Family members can view turns"
  ON call_turns FOR SELECT
  USING (
    call_id IN (SELECT id FROM calls WHERE family_id = get_my_family_id())
  );

CREATE POLICY "Service role only write turns"
  ON call_turns FOR INSERT WITH CHECK (false);
```

- [ ] **Step 2: Apply + verify**

Run: `npx supabase db push`
Run: `psql $DB_URL -c "\dx vector"` — expect pgvector extension installed
Run: `psql $DB_URL -c "\d calls"` and `\d call_turns`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/013_calls_and_turns.sql
git commit -m "feat(db): add calls and call_turns with pgvector"
```

---

### Task 1.3: Migration 014 — capsules evolution

**Files:**
- Create: `supabase/migrations/014_capsules_evolution.sql`

- [ ] **Step 1: Write migration**

```sql
-- 014_capsules_evolution.sql
-- Evolves capsules to be authored by Susheela calls (not user self-recording).

CREATE TYPE story_privacy AS ENUM (
  'family',
  'private_elder_only',
  'family_extended'
);

ALTER TABLE capsules
  ADD COLUMN source_call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  ADD COLUMN source_turn_ids UUID[],                 -- array of call_turns.id
  ADD COLUMN voice_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN external_share_eligible BOOLEAN DEFAULT FALSE,
  ADD COLUMN privacy_flag story_privacy DEFAULT 'family',
  ADD COLUMN elder_id UUID REFERENCES elders(id) ON DELETE CASCADE;

CREATE INDEX idx_capsules_elder_id ON capsules(elder_id);
CREATE INDEX idx_capsules_source_call_id ON capsules(source_call_id);

-- writer_id is now nullable for Susheela-authored capsules
ALTER TABLE capsules ALTER COLUMN writer_id DROP NOT NULL;

-- The is_unlocked flag stays — used for time-capsules in Plan 3.
```

- [ ] **Step 2: Apply + verify**

Run: `npx supabase db push`
Run: `psql $DB_URL -c "\d capsules"` — verify new columns

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/014_capsules_evolution.sql
git commit -m "feat(db): evolve capsules for Susheela-authored stories"
```

---

### Task 1.4: Migration 015 — persona_index

**Files:**
- Create: `supabase/migrations/015_persona_index.sql`

- [ ] **Step 1: Write migration**

```sql
-- 015_persona_index.sql
-- Per-elder index of distilled persona facts: memories, opinions, advice, etc.
-- Used by Q&A retrieval at MVP; voice cloning + persona synthesis later phases.

CREATE TYPE persona_fact_type AS ENUM (
  'memory',
  'opinion',
  'advice',
  'preference',
  'relationship',
  'event'
);

CREATE TABLE persona_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  source_turn_id UUID NOT NULL REFERENCES call_turns(id) ON DELETE CASCADE,
  source_call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  fact_type persona_fact_type NOT NULL,
  text TEXT NOT NULL,                                -- distilled fact
  audio_clip_url TEXT,                               -- the elder actually saying it
  embedding vector(1536) NOT NULL,
  confidence NUMERIC(4,3),
  voice_verified BOOLEAN NOT NULL DEFAULT FALSE,
  language TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_persona_index_elder_id ON persona_index(elder_id);
CREATE INDEX idx_persona_index_fact_type ON persona_index(elder_id, fact_type);
CREATE INDEX idx_persona_index_embedding ON persona_index
  USING hnsw (embedding vector_cosine_ops);

-- RLS
ALTER TABLE persona_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can query their elder's persona"
  ON persona_index FOR SELECT
  USING (
    elder_id IN (SELECT id FROM elders WHERE family_id = get_my_family_id())
  );

CREATE POLICY "Service role only writes persona"
  ON persona_index FOR INSERT WITH CHECK (false);
```

- [ ] **Step 2: Apply + verify**

Run: `npx supabase db push`
Run: `psql $DB_URL -c "\d persona_index"`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/015_persona_index.sql
git commit -m "feat(db): add persona_index table for retrieval Q&A"
```

---

### Task 1.5: Migration 016 — audio storage tier buckets

**Files:**
- Create: `supabase/migrations/016_audio_storage_tiers.sql`

- [ ] **Step 1: Write migration**

```sql
-- 016_audio_storage_tiers.sql
-- Three audio fidelity tiers stored in three buckets with different access policies.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('audio-archival', 'audio-archival', false, 524288000, ARRAY['audio/wav', 'audio/flac', 'audio/x-wav']),
  ('audio-playback', 'audio-playback', false, 52428800, ARRAY['audio/ogg', 'audio/opus', 'audio/mpeg']),
  ('audio-share',    'audio-share',    false, 52428800, ARRAY['audio/ogg', 'audio/opus'])
ON CONFLICT (id) DO NOTHING;

-- Archival: service role only (no client access ever)
CREATE POLICY "archival service-role read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audio-archival' AND auth.role() = 'service_role');

CREATE POLICY "archival service-role write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'audio-archival' AND auth.role() = 'service_role');

-- Playback: family members of the call's elder can read
CREATE POLICY "playback family read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'audio-playback'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM elders WHERE family_id = get_my_family_id()
    )
  );

CREATE POLICY "playback service-role write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'audio-playback' AND auth.role() = 'service_role');

-- Share: signed URL only, no direct read (signed URLs are issued by Edge Function for share-link viewer)
-- Plan 3 will wire share access control. For Plan 1, just service-role write.
CREATE POLICY "share service-role write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'audio-share' AND auth.role() = 'service_role');
```

- [ ] **Step 2: Apply + verify**

Run: `npx supabase db push`
Run: `psql $DB_URL -c "SELECT id, public FROM storage.buckets WHERE id LIKE 'audio-%';"` — expect 3 rows, all public=false

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/016_audio_storage_tiers.sql
git commit -m "feat(storage): add three audio fidelity tier buckets"
```

---

### Task 1.6: Regenerate Supabase types and add domain types

**Files:**
- Modify: `packages/shared/database.types.ts` (regenerated)
- Modify: `packages/shared/types.ts`

- [ ] **Step 1: Regenerate database types**

Run: `npm run db:types`
Expected: `packages/shared/database.types.ts` is updated with new tables (elders, elder_consents, calls, call_turns, persona_index) and new capsules columns.

- [ ] **Step 2: Add domain types**

Read existing `packages/shared/types.ts` first to know what's there.

Add to `packages/shared/types.ts`:

```ts
export type ElderLanguage = 'kn' | 'gu' | 'en' | 'hi';
export type ElderCountry = 'IN' | 'US';

export type CallSpeaker = 'elder' | 'susheela';

export type CallStatus =
  | 'scheduled'
  | 'dialing'
  | 'in_progress'
  | 'completed'
  | 'voicemail'
  | 'no_answer'
  | 'declined'
  | 'failed';

export type CueKind = 'time_capsule' | 'advice' | 'distress' | 'cadence' | 'sharing_request';

export interface TurnCues {
  time_capsule?: { recipient?: string; condition?: string };
  advice?: { topic?: string };
  distress?: { severity: 'mild' | 'moderate' | 'severe' };
  cadence?: { request: string };           // free text: "call me Tuesdays at 5"
  sharing_request?: { recipient_label: string };
}

export type PersonaFactType =
  | 'memory'
  | 'opinion'
  | 'advice'
  | 'preference'
  | 'relationship'
  | 'event';

export interface PersonaFact {
  fact_type: PersonaFactType;
  text: string;
  source_turn_id: string;
  language: string;
  confidence: number;
}

export interface CallBrief {
  elder_id: string;
  elder_display_name: string;
  preferred_name?: string;
  relationship_label: string;
  language: ElderLanguage;
  is_first_call: boolean;
  family_intro_audio_url?: string;
  recent_summaries: string[];                // last 2-3 calls
  family_suggested_questions: string[];
  this_week_theme: string;
  voiceprint?: number[];                     // for verification
}
```

- [ ] **Step 3: Type-check**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/database.types.ts packages/shared/types.ts
git commit -m "feat(shared): regenerate db types and add domain types for calling"
```

---

## Phase 2 — Calling provider abstraction

### Task 2.1: Provider interface + types

**Files:**
- Create: `packages/calling/src/types.ts`
- Create: `packages/calling/src/Provider.ts`
- Create: `packages/calling/src/index.ts`
- Test: `packages/calling/test/Provider.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/calling/test/Provider.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Provider } from '../src/Provider';
import type { ProviderInitResult, ProviderCallHandle } from '../src/types';

// Type-level test — verify Provider interface shape exists.
// Real provider tests are in providers/*.test.ts.
describe('Provider interface', () => {
  it('declares startCall, endCall, getCallStatus, healthCheck', () => {
    const stub: Provider = {
      name: 'stub',
      startCall: async (): Promise<ProviderCallHandle> => ({
        provider_call_id: 'x',
        started_at: new Date(),
      }),
      endCall: async () => {},
      getCallStatus: async () => ({ status: 'completed' }),
      healthCheck: async () => ({ ok: true }),
    };
    expect(stub.name).toBe('stub');
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm run test:calling`
Expected: FAIL — `Provider` and types not defined.

- [ ] **Step 3: Implement types and interface**

`packages/calling/src/types.ts`:

```ts
import type { ElderLanguage, ElderCountry, CallStatus } from '@katha/shared/types';

export interface ProviderInitResult {
  ok: boolean;
  message?: string;
}

export interface ProviderCallConfig {
  call_id: string;                    // our internal call id
  elder_phone_e164: string;
  elder_name: string;
  preferred_name?: string;
  language: ElderLanguage;
  country: ElderCountry;
  is_first_call: boolean;
  family_intro_audio_url?: string;    // played first if is_first_call
  system_prompt: string;              // Susheela's persona + brief
  webhook_url: string;                // call-orchestrator endpoint
  archival_audio_target_url?: string; // where provider should POST archival audio after call
}

export interface ProviderCallHandle {
  provider_call_id: string;
  started_at: Date;
}

export interface ProviderCallStatusResult {
  status: CallStatus;
  duration_seconds?: number;
  recording_url?: string;
  cost_cents?: number;
}

export interface ProviderHealthResult {
  ok: boolean;
  detail?: string;
}
```

`packages/calling/src/Provider.ts`:

```ts
import type {
  ProviderCallConfig,
  ProviderCallHandle,
  ProviderCallStatusResult,
  ProviderHealthResult,
} from './types';

export interface Provider {
  readonly name: string;
  startCall(config: ProviderCallConfig): Promise<ProviderCallHandle>;
  endCall(provider_call_id: string): Promise<void>;
  getCallStatus(provider_call_id: string): Promise<ProviderCallStatusResult>;
  healthCheck(): Promise<ProviderHealthResult>;
}
```

`packages/calling/src/index.ts`:

```ts
export type { Provider } from './Provider';
export type {
  ProviderCallConfig,
  ProviderCallHandle,
  ProviderCallStatusResult,
  ProviderHealthResult,
  ProviderInitResult,
} from './types';
export { selectProvider } from './selector';
export { MockProvider } from './providers/mock';
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm run test:calling`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/calling/src
git commit -m "feat(calling): add Provider interface and types"
```

---

### Task 2.2: MockProvider for tests + local dev

**Files:**
- Create: `packages/calling/src/providers/mock.ts`
- Test: `packages/calling/test/providers/mock.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/calling/test/providers/mock.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { MockProvider } from '../../src/providers/mock';
import type { ProviderCallConfig } from '../../src/types';

const baseConfig: ProviderCallConfig = {
  call_id: 'call-1',
  elder_phone_e164: '+919999999999',
  elder_name: 'Susheela',
  language: 'kn',
  country: 'IN',
  is_first_call: true,
  system_prompt: 'You are Susheela...',
  webhook_url: 'https://example.com/hook',
};

describe('MockProvider', () => {
  it('returns a handle with deterministic provider_call_id', async () => {
    const p = new MockProvider();
    const handle = await p.startCall(baseConfig);
    expect(handle.provider_call_id).toBe('mock-call-1');
    expect(handle.started_at).toBeInstanceOf(Date);
  });

  it('records calls in memory', async () => {
    const p = new MockProvider();
    await p.startCall(baseConfig);
    expect(p.getStartedCalls()).toHaveLength(1);
    expect(p.getStartedCalls()[0].call_id).toBe('call-1');
  });

  it('endCall marks the call ended', async () => {
    const p = new MockProvider();
    await p.startCall(baseConfig);
    await p.endCall('mock-call-1');
    expect(p.getEndedCalls()).toContain('mock-call-1');
  });

  it('healthCheck returns ok', async () => {
    const p = new MockProvider();
    expect(await p.healthCheck()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm run test:calling`
Expected: FAIL — `MockProvider` not defined.

- [ ] **Step 3: Implement MockProvider**

`packages/calling/src/providers/mock.ts`:

```ts
import type {
  Provider,
} from '../Provider';
import type {
  ProviderCallConfig,
  ProviderCallHandle,
  ProviderCallStatusResult,
  ProviderHealthResult,
} from '../types';

export class MockProvider implements Provider {
  readonly name = 'mock';
  private started: ProviderCallConfig[] = [];
  private ended = new Set<string>();

  async startCall(config: ProviderCallConfig): Promise<ProviderCallHandle> {
    this.started.push(config);
    return {
      provider_call_id: `mock-${config.call_id}`,
      started_at: new Date(),
    };
  }

  async endCall(provider_call_id: string): Promise<void> {
    this.ended.add(provider_call_id);
  }

  async getCallStatus(provider_call_id: string): Promise<ProviderCallStatusResult> {
    return {
      status: this.ended.has(provider_call_id) ? 'completed' : 'in_progress',
    };
  }

  async healthCheck(): Promise<ProviderHealthResult> {
    return { ok: true };
  }

  // test helpers
  getStartedCalls(): ProviderCallConfig[] {
    return [...this.started];
  }
  getEndedCalls(): string[] {
    return [...this.ended];
  }
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm run test:calling`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/calling/src/providers/mock.ts packages/calling/test/providers/mock.test.ts
git commit -m "feat(calling): add MockProvider for tests and local dev"
```

---

### Task 2.3: SarvamProvider skeleton

This task implements the Sarvam provider based on the capability report from Task 0.2. The implementation is **specific to what Sarvam's API actually exposes**; if the report finds gaps (e.g., no native outbound calling), then SarvamProvider may pair with TwilioProvider/ExotelProvider for the dialer and use Sarvam only for in-call orchestration.

**Files:**
- Create: `packages/calling/src/providers/sarvam.ts`
- Test: `packages/calling/test/providers/sarvam.test.ts`

- [ ] **Step 1: Write contract test using fetch mocking**

`packages/calling/test/providers/sarvam.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SarvamProvider } from '../../src/providers/sarvam';
import type { ProviderCallConfig } from '../../src/types';

const baseConfig: ProviderCallConfig = {
  call_id: 'call-1',
  elder_phone_e164: '+919999999999',
  elder_name: 'Susheela',
  language: 'kn',
  country: 'IN',
  is_first_call: true,
  system_prompt: 'You are Susheela...',
  webhook_url: 'https://example.com/hook',
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('SarvamProvider', () => {
  it('startCall POSTs to Sarvam outbound API with expected payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ call_id: 'sarvam-xyz', started_at: '2026-05-10T00:00:00Z' }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const p = new SarvamProvider({ apiKey: 'k', baseUrl: 'https://api.sarvam.ai' });
    const handle = await p.startCall(baseConfig);

    expect(handle.provider_call_id).toBe('sarvam-xyz');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/voice-bot');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'api-subscription-key': 'k' });
    const body = JSON.parse(init.body as string);
    expect(body.to).toBe('+919999999999');
    expect(body.language).toBe('kn');
    expect(body.first_message_audio_url).toBeUndefined(); // since family_intro_audio_url not set in this test
    expect(body.system_prompt).toContain('Susheela');
  });

  it('throws on non-200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('err', { status: 500 })));
    const p = new SarvamProvider({ apiKey: 'k', baseUrl: 'https://api.sarvam.ai' });
    await expect(p.startCall(baseConfig)).rejects.toThrow(/Sarvam.*500/);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm run test:calling`
Expected: FAIL — `SarvamProvider` not defined.

- [ ] **Step 3: Implement SarvamProvider**

The exact endpoint paths and body shape come from the Sarvam capability report (Task 0.2). The implementation below is a starting shape; **adjust to match the actual Sarvam API** when implementing, but keep the test contracts (mock POST, header, body fields) consistent with the real API.

`packages/calling/src/providers/sarvam.ts`:

```ts
import type { Provider } from '../Provider';
import type {
  ProviderCallConfig,
  ProviderCallHandle,
  ProviderCallStatusResult,
  ProviderHealthResult,
} from '../types';

export interface SarvamConfig {
  apiKey: string;
  baseUrl?: string;       // default 'https://api.sarvam.ai'
  voiceId?: string;       // Susheela's voice id; per-language override map possible
}

export class SarvamProvider implements Provider {
  readonly name = 'sarvam';
  private apiKey: string;
  private baseUrl: string;
  private voiceId: string;

  constructor(cfg: SarvamConfig) {
    this.apiKey = cfg.apiKey;
    this.baseUrl = cfg.baseUrl ?? 'https://api.sarvam.ai';
    this.voiceId = cfg.voiceId ?? 'meera';  // placeholder; pick after capability report
  }

  async startCall(config: ProviderCallConfig): Promise<ProviderCallHandle> {
    const body = {
      to: config.elder_phone_e164,
      language: config.language,
      voice_id: this.voiceId,
      system_prompt: config.system_prompt,
      first_message_audio_url: config.is_first_call ? config.family_intro_audio_url : undefined,
      webhook_url: config.webhook_url,
      metadata: { call_id: config.call_id },
    };

    const res = await fetch(`${this.baseUrl}/voice-bot/start`, {
      method: 'POST',
      headers: {
        'api-subscription-key': this.apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Sarvam startCall failed ${res.status}: ${text}`);
    }
    const json = (await res.json()) as { call_id: string; started_at: string };
    return {
      provider_call_id: json.call_id,
      started_at: new Date(json.started_at),
    };
  }

  async endCall(provider_call_id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/voice-bot/${provider_call_id}/end`, {
      method: 'POST',
      headers: { 'api-subscription-key': this.apiKey },
    });
    if (!res.ok) {
      throw new Error(`Sarvam endCall failed ${res.status}`);
    }
  }

  async getCallStatus(provider_call_id: string): Promise<ProviderCallStatusResult> {
    const res = await fetch(`${this.baseUrl}/voice-bot/${provider_call_id}`, {
      headers: { 'api-subscription-key': this.apiKey },
    });
    if (!res.ok) throw new Error(`Sarvam getCallStatus failed ${res.status}`);
    const json = (await res.json()) as {
      status: string;
      duration_seconds?: number;
      recording_url?: string;
      cost_cents?: number;
    };
    return {
      status: this.mapStatus(json.status),
      duration_seconds: json.duration_seconds,
      recording_url: json.recording_url,
      cost_cents: json.cost_cents,
    };
  }

  async healthCheck(): Promise<ProviderHealthResult> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        headers: { 'api-subscription-key': this.apiKey },
      });
      return { ok: res.ok, detail: res.ok ? undefined : `${res.status}` };
    } catch (e) {
      return { ok: false, detail: (e as Error).message };
    }
  }

  private mapStatus(s: string): ProviderCallStatusResult['status'] {
    // map Sarvam-specific statuses to our enum
    switch (s) {
      case 'in_progress': return 'in_progress';
      case 'completed':   return 'completed';
      case 'no_answer':   return 'no_answer';
      case 'voicemail':   return 'voicemail';
      case 'failed':      return 'failed';
      default:            return 'failed';
    }
  }
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm run test:calling`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/calling/src/providers/sarvam.ts packages/calling/test/providers/sarvam.test.ts
git commit -m "feat(calling): add SarvamProvider skeleton with contract tests"
```

---

### Task 2.4: Twilio + Exotel placeholder providers

These are skeletons for Phase 2 / fallback paths. Marked as `not_implemented` to fail-fast if accidentally selected at runtime in MVP.

**Files:**
- Create: `packages/calling/src/providers/twilio.ts`
- Create: `packages/calling/src/providers/exotel.ts`

- [ ] **Step 1: Implement skeleton providers**

`packages/calling/src/providers/twilio.ts`:

```ts
import type { Provider } from '../Provider';
import type {
  ProviderCallConfig,
  ProviderCallHandle,
  ProviderCallStatusResult,
  ProviderHealthResult,
} from '../types';

export class TwilioProvider implements Provider {
  readonly name = 'twilio';
  startCall(_: ProviderCallConfig): Promise<ProviderCallHandle> {
    throw new Error('TwilioProvider not implemented — Phase 2');
  }
  endCall(_: string): Promise<void> {
    throw new Error('TwilioProvider not implemented — Phase 2');
  }
  getCallStatus(_: string): Promise<ProviderCallStatusResult> {
    throw new Error('TwilioProvider not implemented — Phase 2');
  }
  async healthCheck(): Promise<ProviderHealthResult> {
    return { ok: false, detail: 'not implemented' };
  }
}
```

`packages/calling/src/providers/exotel.ts`: identical shape, `name = 'exotel'`, same `not implemented` errors.

- [ ] **Step 2: Commit**

```bash
git add packages/calling/src/providers/twilio.ts packages/calling/src/providers/exotel.ts
git commit -m "feat(calling): add Twilio/Exotel skeleton providers"
```

---

### Task 2.5: Provider selector

**Files:**
- Create: `packages/calling/src/selector.ts`
- Test: `packages/calling/test/selector.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/calling/test/selector.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { selectProvider } from '../src/selector';
import { MockProvider } from '../src/providers/mock';
import { SarvamProvider } from '../src/providers/sarvam';

describe('selectProvider', () => {
  it('returns MockProvider when env mode is mock', () => {
    const p = selectProvider({ mode: 'mock', country: 'IN' });
    expect(p).toBeInstanceOf(MockProvider);
  });

  it('returns SarvamProvider for IN country in production mode', () => {
    const p = selectProvider({
      mode: 'production',
      country: 'IN',
      sarvam: { apiKey: 'k' },
    });
    expect(p).toBeInstanceOf(SarvamProvider);
  });

  it('throws if production mode picks a non-implemented provider', () => {
    expect(() =>
      selectProvider({ mode: 'production', country: 'US', sarvam: { apiKey: 'k' } }),
    ).toThrow(/twilio.*Phase 2/i);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm run test:calling`
Expected: FAIL.

- [ ] **Step 3: Implement selector**

`packages/calling/src/selector.ts`:

```ts
import type { Provider } from './Provider';
import { MockProvider } from './providers/mock';
import { SarvamProvider, type SarvamConfig } from './providers/sarvam';

export type ProviderMode = 'mock' | 'production';

export interface SelectorOptions {
  mode: ProviderMode;
  country: 'IN' | 'US';
  sarvam?: SarvamConfig;
}

export function selectProvider(opts: SelectorOptions): Provider {
  if (opts.mode === 'mock') return new MockProvider();
  if (opts.country === 'IN') {
    if (!opts.sarvam) throw new Error('Sarvam config required for IN production');
    return new SarvamProvider(opts.sarvam);
  }
  if (opts.country === 'US') {
    throw new Error('twilio: not implemented — Phase 2');
  }
  throw new Error(`Unsupported country: ${opts.country}`);
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm run test:calling`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/calling/src/selector.ts packages/calling/test/selector.test.ts
git commit -m "feat(calling): add provider selector by country and mode"
```

---

## Phase 3 — AI utilities (Anthropic, embeddings, voiceprint)

### Task 3.1: Anthropic client wrapper

**Files:**
- Create: `packages/ai/src/anthropic.ts`
- Test: `packages/ai/test/anthropic.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/ai/test/anthropic.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { generateJSON } from '../src/anthropic';

describe('generateJSON', () => {
  it('parses fenced JSON from Claude response', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: '```json\n{"x":1}\n```' }],
        }),
      },
    };
    const out = await generateJSON({
      client: fakeClient as unknown as import('@anthropic-ai/sdk').default,
      model: 'claude-haiku-4-5-20251001',
      systemPrompt: 'sys',
      userPrompt: 'user',
      schema: { type: 'object' },
    });
    expect(out).toEqual({ x: 1 });
  });

  it('parses plain JSON without fences', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: '{"y":2}' }],
        }),
      },
    };
    const out = await generateJSON({
      client: fakeClient as unknown as import('@anthropic-ai/sdk').default,
      model: 'claude-haiku-4-5-20251001',
      systemPrompt: 'sys',
      userPrompt: 'user',
      schema: { type: 'object' },
    });
    expect(out).toEqual({ y: 2 });
  });

  it('throws on invalid JSON', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'not json' }],
        }),
      },
    };
    await expect(
      generateJSON({
        client: fakeClient as unknown as import('@anthropic-ai/sdk').default,
        model: 'claude-haiku-4-5-20251001',
        systemPrompt: 'sys',
        userPrompt: 'user',
        schema: { type: 'object' },
      }),
    ).rejects.toThrow(/JSON/);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm run test:ai`
Expected: FAIL.

- [ ] **Step 3: Implement Anthropic wrapper**

`packages/ai/src/anthropic.ts`:

```ts
import Anthropic from '@anthropic-ai/sdk';

export interface GenerateJSONOptions<T> {
  client: Anthropic;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  schema: object;            // JSON schema; not enforced here, used in prompt
  maxTokens?: number;
  temperature?: number;
}

const FENCED = /```(?:json)?\n([\s\S]*?)\n```/;

export async function generateJSON<T = unknown>(opts: GenerateJSONOptions<T>): Promise<T> {
  const res = await opts.client.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 2048,
    temperature: opts.temperature ?? 0.3,
    system: opts.systemPrompt,
    messages: [{ role: 'user', content: opts.userPrompt }],
  });
  const block = res.content.find((b: { type: string }) => b.type === 'text') as
    | { type: 'text'; text: string }
    | undefined;
  if (!block) throw new Error('No text block in Claude response');

  const text = block.text.trim();
  const fenced = FENCED.exec(text);
  const candidate = fenced ? fenced[1] : text;
  try {
    return JSON.parse(candidate) as T;
  } catch (e) {
    throw new Error(`Failed to parse JSON from Claude: ${(e as Error).message}\n---\n${text}`);
  }
}

export function createAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

// Keep model IDs in one place to centralize migration
export const MODELS = {
  sonnet: 'claude-sonnet-4-6',
  haiku:  'claude-haiku-4-5-20251001',
} as const;
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm run test:ai`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/anthropic.ts packages/ai/test/anthropic.test.ts
git commit -m "feat(ai): add Anthropic JSON-generation wrapper"
```

---

### Task 3.2: Embeddings client (OpenAI)

**Files:**
- Create: `packages/ai/src/embeddings.ts`
- Test: `packages/ai/test/embeddings.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/ai/test/embeddings.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { embedText, embedBatch } from '../src/embeddings';

describe('embeddings', () => {
  it('embedText returns a 1536-dim vector for text-embedding-3-small', async () => {
    const fakeClient = {
      embeddings: {
        create: vi.fn().mockResolvedValue({
          data: [{ embedding: new Array(1536).fill(0.1) }],
        }),
      },
    };
    const v = await embedText({
      client: fakeClient as unknown as import('openai').default,
      text: 'hello',
    });
    expect(v).toHaveLength(1536);
  });

  it('embedBatch chunks calls', async () => {
    const fakeClient = {
      embeddings: {
        create: vi.fn().mockImplementation(async ({ input }: { input: string[] }) => ({
          data: input.map(() => ({ embedding: new Array(1536).fill(0) })),
        })),
      },
    };
    const result = await embedBatch({
      client: fakeClient as unknown as import('openai').default,
      texts: new Array(150).fill('x'),
      chunkSize: 100,
    });
    expect(result).toHaveLength(150);
    expect(fakeClient.embeddings.create).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm run test:ai`
Expected: FAIL.

- [ ] **Step 3: Implement embeddings**

`packages/ai/src/embeddings.ts`:

```ts
import OpenAI from 'openai';

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIM = 1536;

export interface EmbedTextOptions {
  client: OpenAI;
  text: string;
  model?: string;
}

export async function embedText(opts: EmbedTextOptions): Promise<number[]> {
  const res = await opts.client.embeddings.create({
    model: opts.model ?? EMBEDDING_MODEL,
    input: opts.text,
  });
  return res.data[0].embedding;
}

export interface EmbedBatchOptions {
  client: OpenAI;
  texts: string[];
  model?: string;
  chunkSize?: number;
}

export async function embedBatch(opts: EmbedBatchOptions): Promise<number[][]> {
  const chunkSize = opts.chunkSize ?? 100;
  const out: number[][] = [];
  for (let i = 0; i < opts.texts.length; i += chunkSize) {
    const slice = opts.texts.slice(i, i + chunkSize);
    const res = await opts.client.embeddings.create({
      model: opts.model ?? EMBEDDING_MODEL,
      input: slice,
    });
    out.push(...res.data.map((d) => d.embedding));
  }
  return out;
}

export function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm run test:ai`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/embeddings.ts packages/ai/test/embeddings.test.ts
git commit -m "feat(ai): add OpenAI embedding wrapper with batching"
```

---

### Task 3.3: Voiceprint enrollment + verification (HuggingFace pyannote)

Speaker embeddings via HuggingFace Inference API. Returns a 512-dim vector per audio clip; cosine similarity ≥ 0.75 → same speaker (threshold to be tuned with real fixtures).

**Files:**
- Create: `packages/ai/src/voiceprint.ts`
- Test: `packages/ai/test/voiceprint.test.ts`
- Test fixtures: `packages/ai/test/fixtures/voice-clip-elder-1.flac` (record yourself ~5 sec; commit), `voice-clip-elder-1-followup.flac` (same speaker, ~5 sec), `voice-clip-different-speaker.flac` (a different speaker, ~5 sec)

- [ ] **Step 1: Record test fixtures**

Record three short audio clips (5-10 sec each) using QuickTime / Audacity / phone:
- `voice-clip-elder-1.flac` — speaker A, 5 sec
- `voice-clip-elder-1-followup.flac` — same speaker A, different 5 sec
- `voice-clip-different-speaker.flac` — speaker B, 5 sec

Save as FLAC (or convert from WAV via `ffmpeg -i in.wav out.flac`). Place in `packages/ai/test/fixtures/`.

- [ ] **Step 2: Write the failing test**

`packages/ai/test/voiceprint.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractVoiceprint, compareVoiceprints, SAME_SPEAKER_THRESHOLD } from '../src/voiceprint';

const fixturesDir = resolve(__dirname, 'fixtures');
function load(name: string): Buffer {
  return readFileSync(resolve(fixturesDir, name));
}

const HF_TOKEN = process.env.HUGGINGFACE_TOKEN;

describe.skipIf(!HF_TOKEN)('voiceprint (live HF API)', () => {
  it('same speaker matches above threshold', async () => {
    const a = await extractVoiceprint({ token: HF_TOKEN!, audio: load('voice-clip-elder-1.flac') });
    const b = await extractVoiceprint({ token: HF_TOKEN!, audio: load('voice-clip-elder-1-followup.flac') });
    const sim = compareVoiceprints(a, b);
    expect(sim).toBeGreaterThan(SAME_SPEAKER_THRESHOLD);
  }, 30_000);

  it('different speakers fall below threshold', async () => {
    const a = await extractVoiceprint({ token: HF_TOKEN!, audio: load('voice-clip-elder-1.flac') });
    const c = await extractVoiceprint({ token: HF_TOKEN!, audio: load('voice-clip-different-speaker.flac') });
    const sim = compareVoiceprints(a, c);
    expect(sim).toBeLessThan(SAME_SPEAKER_THRESHOLD);
  }, 30_000);
});

describe('compareVoiceprints (pure logic)', () => {
  it('returns 1 for identical vectors', () => {
    const v = new Array(512).fill(0).map((_, i) => Math.sin(i));
    expect(compareVoiceprints(v, v)).toBeCloseTo(1, 5);
  });
  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(compareVoiceprints(a, b)).toBeCloseTo(0, 5);
  });
});
```

- [ ] **Step 3: Run test, verify fail**

Run: `npm run test:ai`
Expected: FAIL — `extractVoiceprint`, `compareVoiceprints` not defined.

- [ ] **Step 4: Implement voiceprint module**

`packages/ai/src/voiceprint.ts`:

```ts
import { HfInference } from '@huggingface/inference';

export const SAME_SPEAKER_THRESHOLD = 0.75;
export const VOICEPRINT_DIM = 512;

export interface ExtractOptions {
  token: string;
  audio: Buffer | Blob;
  model?: string;             // defaults to a pyannote speaker-embedding model
}

const DEFAULT_MODEL = 'pyannote/embedding';

export async function extractVoiceprint(opts: ExtractOptions): Promise<number[]> {
  const hf = new HfInference(opts.token);
  const result = await hf.audioToAudio({
    model: opts.model ?? DEFAULT_MODEL,
    data: opts.audio as Blob,
  });
  // pyannote returns embeddings as a flat Float32Array. The exact shape depends on model;
  // adjust if model returns differently. Verify in capability spike.
  const embedding = (result as unknown as { embedding: number[] }).embedding;
  if (!embedding || embedding.length !== VOICEPRINT_DIM) {
    throw new Error(
      `Unexpected voiceprint shape: got length ${embedding?.length ?? 'undefined'}, expected ${VOICEPRINT_DIM}`,
    );
  }
  return embedding;
}

export function compareVoiceprints(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('voiceprint length mismatch');
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
```

- [ ] **Step 5: Run test, verify pass**

Run: `npm run test:ai`
- Without `HUGGINGFACE_TOKEN` env var: pure-logic tests pass; live tests skipped. Acceptable.
- With `HUGGINGFACE_TOKEN` set: live tests should pass. If they don't, the model output shape doesn't match the assumption — debug `pyannote/embedding` output format and adjust `extractVoiceprint`.

```bash
HUGGINGFACE_TOKEN=hf_xxx npm run test:ai -- --testNamePattern="voiceprint"
```

- [ ] **Step 6: Commit**

```bash
git add packages/ai/src/voiceprint.ts packages/ai/test/voiceprint.test.ts packages/ai/test/fixtures/
git commit -m "feat(ai): add voiceprint extraction and comparison via pyannote"
```

---

### Task 3.4: Story extraction from call turns

Takes a list of `call_turns` and produces 1-N story drafts. Uses Claude Sonnet.

**Files:**
- Create: `packages/ai/src/extract-stories.ts`
- Test: `packages/ai/test/extract-stories.test.ts`
- Fixture: `packages/ai/test/fixtures/sample-call-turns.json`

- [ ] **Step 1: Create fixture**

`packages/ai/test/fixtures/sample-call-turns.json`:

```json
[
  {"id": "t1", "speaker": "susheela", "transcript": "Namaste Ajji, tell me about your wedding day.", "language": "kn"},
  {"id": "t2", "speaker": "elder", "transcript": "Oh my wedding! It was 1957 in Bhuj. We had a beautiful ceremony, my mother in law she gave me her own pearl necklace.", "language": "kn"},
  {"id": "t3", "speaker": "susheela", "transcript": "How wonderful. What about your school days?", "language": "kn"},
  {"id": "t4", "speaker": "elder", "transcript": "I went to a Marathi-medium school until 5th standard. My favorite teacher was Mrs. Joshi. She taught me poetry which I still remember.", "language": "kn"}
]
```

- [ ] **Step 2: Write the failing test**

`packages/ai/test/extract-stories.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractStories } from '../src/extract-stories';

const turns = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures/sample-call-turns.json'), 'utf8'),
);

describe('extractStories', () => {
  it('produces stories with required fields from a multi-theme call', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{
            type: 'text',
            text: JSON.stringify({
              stories: [
                {
                  title: 'Wedding day in Bhuj',
                  polished_text: 'It was 1957 in Bhuj...',
                  source_turn_ids: ['t2'],
                  language: 'kn',
                  theme: 'wedding',
                  people_mentioned: ['mother-in-law'],
                },
                {
                  title: 'Mrs. Joshi and the poetry',
                  polished_text: 'A Marathi-medium school...',
                  source_turn_ids: ['t4'],
                  language: 'kn',
                  theme: 'school days',
                  people_mentioned: ['Mrs. Joshi'],
                },
              ],
            }),
          }],
        }),
      },
    };

    const stories = await extractStories({
      client: fakeClient as unknown as import('@anthropic-ai/sdk').default,
      turns,
      elderName: 'Ajji',
    });

    expect(stories).toHaveLength(2);
    expect(stories[0].title).toBe('Wedding day in Bhuj');
    expect(stories[0].source_turn_ids).toEqual(['t2']);
    expect(stories[1].people_mentioned).toContain('Mrs. Joshi');
  });

  it('returns empty array when call has no extractable content', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify({ stories: [] }) }],
        }),
      },
    };
    const stories = await extractStories({
      client: fakeClient as unknown as import('@anthropic-ai/sdk').default,
      turns: [],
      elderName: 'Ajji',
    });
    expect(stories).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run test, verify fail**

Run: `npm run test:ai`
Expected: FAIL — `extractStories` not defined.

- [ ] **Step 4: Implement extractStories**

`packages/ai/src/extract-stories.ts`:

```ts
import Anthropic from '@anthropic-ai/sdk';
import { generateJSON, MODELS } from './anthropic';

export interface CallTurnInput {
  id: string;
  speaker: 'elder' | 'susheela';
  transcript: string;
  language?: string;
}

export interface ExtractedStory {
  title: string;
  polished_text: string;
  source_turn_ids: string[];
  language: string;
  theme: string;
  people_mentioned: string[];
}

const SYSTEM_PROMPT = `You are extracting stories from a recorded conversation between Susheela (an AI interviewer) and an elder family member.

A "story" is a self-contained narrative or memory the elder shared. One call may contain multiple stories on different topics. You must:

1. Group related elder turns into stories. Drop Susheela's prompts unless they contextualize the story.
2. PRESERVE the elder's voice, idiom, code-switching, cultural expressions. Polish only for grammar and flow.
3. Keep Hindi/Kannada/Gujarati/Urdu/Tamil/Telugu words intact when the elder used them.
4. Title each story warmly and specifically — not generic. Capture the essence.
5. List people the elder mentioned (proper nouns + relationship words like "mother-in-law").
6. Identify a short theme tag (free text, 1-3 words: "wedding", "school days", "first job", "festival memories", etc.).
7. Set language to the dominant language of the elder's turns (kn / gu / en / hi).
8. Source_turn_ids: the elder turn IDs that fed this story.

Return ONLY valid JSON with this structure:
{ "stories": [ { "title": ..., "polished_text": ..., "source_turn_ids": [...], "language": ..., "theme": ..., "people_mentioned": [...] } ] }

If the call has no real story material (e.g., elder declined to talk, only small talk), return { "stories": [] }.
No markdown fences. No commentary. Just JSON.`;

export interface ExtractStoriesOptions {
  client: Anthropic;
  turns: CallTurnInput[];
  elderName: string;
}

export async function extractStories(opts: ExtractStoriesOptions): Promise<ExtractedStory[]> {
  const userPrompt = `Elder's name: ${opts.elderName}
Conversation turns (JSON):
${JSON.stringify(opts.turns, null, 2)}

Extract stories.`;

  const result = await generateJSON<{ stories: ExtractedStory[] }>({
    client: opts.client,
    model: MODELS.sonnet,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    schema: {},
    maxTokens: 4096,
    temperature: 0.4,
  });
  return result.stories;
}
```

- [ ] **Step 5: Run test, verify pass**

Run: `npm run test:ai`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ai/src/extract-stories.ts packages/ai/test/extract-stories.test.ts packages/ai/test/fixtures/sample-call-turns.json
git commit -m "feat(ai): extract stories from call turns via Claude Sonnet"
```

---

### Task 3.5: Persona fact extraction

Distills elder turns into atomic persona facts (memory/opinion/advice/preference/relationship/event) for the persona index.

**Files:**
- Create: `packages/ai/src/extract-persona-facts.ts`
- Test: `packages/ai/test/extract-persona-facts.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/ai/test/extract-persona-facts.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractPersonaFacts } from '../src/extract-persona-facts';

const turns = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures/sample-call-turns.json'), 'utf8'),
);

describe('extractPersonaFacts', () => {
  it('produces typed atomic facts with source turn ids', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{
            type: 'text',
            text: JSON.stringify({
              facts: [
                {
                  fact_type: 'event',
                  text: 'Married in 1957 in Bhuj.',
                  source_turn_id: 't2',
                  confidence: 0.95,
                  language: 'kn',
                },
                {
                  fact_type: 'memory',
                  text: 'Mother-in-law gave her a pearl necklace at the wedding.',
                  source_turn_id: 't2',
                  confidence: 0.9,
                  language: 'kn',
                },
                {
                  fact_type: 'relationship',
                  text: 'Favorite teacher Mrs. Joshi taught poetry in Marathi-medium school.',
                  source_turn_id: 't4',
                  confidence: 0.85,
                  language: 'kn',
                },
              ],
            }),
          }],
        }),
      },
    };

    const facts = await extractPersonaFacts({
      client: fakeClient as unknown as import('@anthropic-ai/sdk').default,
      turns,
      elderName: 'Ajji',
    });

    expect(facts).toHaveLength(3);
    expect(facts[0].fact_type).toBe('event');
    expect(facts[1].fact_type).toBe('memory');
    expect(facts[2].fact_type).toBe('relationship');
    expect(facts.every((f) => f.confidence > 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm run test:ai`
Expected: FAIL.

- [ ] **Step 3: Implement extractPersonaFacts**

`packages/ai/src/extract-persona-facts.ts`:

```ts
import Anthropic from '@anthropic-ai/sdk';
import { generateJSON, MODELS } from './anthropic';
import type { CallTurnInput } from './extract-stories';

export type PersonaFactType =
  | 'memory'
  | 'opinion'
  | 'advice'
  | 'preference'
  | 'relationship'
  | 'event';

export interface ExtractedPersonaFact {
  fact_type: PersonaFactType;
  text: string;
  source_turn_id: string;
  confidence: number;       // 0..1
  language: string;
}

const SYSTEM_PROMPT = `You are building a per-elder persona index from a recorded conversation.

Your job is to distill the elder's turns into atomic, retrievable FACTS — short, self-contained statements suitable for embedding-based retrieval and for later persona synthesis.

For each fact, classify into one of:
- memory: A specific past experience the elder lived. ("My wedding was in 1957 in Bhuj.")
- opinion: A view, belief, or aesthetic preference the elder expressed. ("I think arranged marriages can work if both families are honest.")
- advice: Guidance the elder offered. ("If you marry, marry someone whose family you can sit with for a meal.")
- preference: A liked/disliked thing. ("I love rasam and bhindi together.")
- relationship: A claim about another person and the elder's relationship to them. ("Mrs. Joshi was my favorite teacher in 5th standard.")
- event: A datable real-world event from the elder's life. ("I joined my husband in Mumbai in 1962.")

Rules:
1. One fact per JSON entry. Atomic.
2. Preserve language and style — don't translate or sanitize.
3. Drop facts you're not at least 60% sure of (set confidence appropriately if you keep them).
4. Source turn must be an elder turn (not Susheela's).
5. If a turn yields multiple facts, emit multiple entries — same source_turn_id.
6. Don't invent facts not stated.

Return ONLY valid JSON: { "facts": [ { "fact_type": ..., "text": ..., "source_turn_id": ..., "confidence": ..., "language": ... } ] }
No markdown fences. No commentary.`;

export interface ExtractPersonaFactsOptions {
  client: Anthropic;
  turns: CallTurnInput[];
  elderName: string;
}

export async function extractPersonaFacts(
  opts: ExtractPersonaFactsOptions,
): Promise<ExtractedPersonaFact[]> {
  const elderTurns = opts.turns.filter((t) => t.speaker === 'elder');
  if (elderTurns.length === 0) return [];

  const userPrompt = `Elder's name: ${opts.elderName}
Elder turns (JSON):
${JSON.stringify(elderTurns, null, 2)}

Extract atomic persona facts.`;

  const result = await generateJSON<{ facts: ExtractedPersonaFact[] }>({
    client: opts.client,
    model: MODELS.sonnet,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    schema: {},
    maxTokens: 4096,
    temperature: 0.3,
  });
  return result.facts;
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm run test:ai`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/extract-persona-facts.ts packages/ai/test/extract-persona-facts.test.ts
git commit -m "feat(ai): extract atomic persona facts via Claude Sonnet"
```

---

### Task 3.6: Export public surface from @katha/ai

**Files:**
- Create: `packages/ai/src/index.ts`

- [ ] **Step 1: Write index**

```ts
export { generateJSON, createAnthropicClient, MODELS } from './anthropic';
export { embedText, embedBatch, createOpenAIClient, EMBEDDING_MODEL, EMBEDDING_DIM } from './embeddings';
export { extractVoiceprint, compareVoiceprints, SAME_SPEAKER_THRESHOLD, VOICEPRINT_DIM } from './voiceprint';
export { extractStories } from './extract-stories';
export type { CallTurnInput, ExtractedStory } from './extract-stories';
export { extractPersonaFacts } from './extract-persona-facts';
export type { ExtractedPersonaFact, PersonaFactType } from './extract-persona-facts';
```

- [ ] **Step 2: Type-check + commit**

Run: `cd packages/ai && npx tsc --noEmit`
Expected: clean.

```bash
git add packages/ai/src/index.ts
git commit -m "feat(ai): export public surface"
```

---

## Phase 4 — Edge Function shared utilities

### Task 4.1: _shared utility module

**Files:**
- Create: `supabase/functions/_shared/cors.ts`
- Create: `supabase/functions/_shared/supabase-admin.ts`
- Create: `supabase/functions/_shared/types.ts`

- [ ] **Step 1: Implement cors helper**

`supabase/functions/_shared/cors.ts`:

```ts
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  return null;
}
```

- [ ] **Step 2: Implement supabase-admin helper**

`supabase/functions/_shared/supabase-admin.ts`:

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';

export function getAdminClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

- [ ] **Step 3: Implement shared types**

`supabase/functions/_shared/types.ts`:

```ts
export type ElderLanguage = 'kn' | 'gu' | 'en' | 'hi';
export type ElderCountry = 'IN' | 'US';

export interface CallBrief {
  elder_id: string;
  elder_display_name: string;
  preferred_name?: string;
  relationship_label: string;
  language: ElderLanguage;
  is_first_call: boolean;
  family_intro_audio_url?: string;
  recent_summaries: string[];
  family_suggested_questions: string[];
  this_week_theme: string;
  voiceprint?: number[];
}

export interface ProviderTurnEvent {
  provider_call_id: string;
  speaker: 'elder' | 'susheela';
  transcript: string;
  language: string;
  audio_clip_url: string;
  started_at_ms: number;
  ended_at_ms: number;
}

export interface ProviderCallEndEvent {
  provider_call_id: string;
  status: 'completed' | 'voicemail' | 'no_answer' | 'declined' | 'failed';
  duration_seconds?: number;
  recording_url?: string;
  cost_cents?: number;
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared
git commit -m "feat(functions): add shared CORS, admin client, and types"
```

---

## Phase 5 — schedule-call Edge Function

### Task 5.1: Theme picker

**Files:**
- Create: `supabase/functions/schedule-call/theme.ts`
- Test: this is Deno; we'll use Deno's built-in test runner.

- [ ] **Step 1: Write theme picker**

`supabase/functions/schedule-call/theme.ts`:

```ts
import type { ElderLanguage } from '../_shared/types.ts';

export interface ThemeContext {
  is_first_call: boolean;
  language: ElderLanguage;
  recent_themes: string[];      // themes covered in last N calls
  family_suggested?: string;
  date: Date;                   // current date for festival/season awareness
}

const FIRST_CALL_THEME = 'a gentle introduction — one nice memory from this week';

const THEME_POOL: { theme: string; weight: number }[] = [
  { theme: 'childhood and school days', weight: 1 },
  { theme: 'how you met your spouse', weight: 1 },
  { theme: 'your wedding day', weight: 1 },
  { theme: 'food and recipes from home', weight: 1 },
  { theme: 'a festival or celebration that stays with you', weight: 1 },
  { theme: 'your first job or career', weight: 1 },
  { theme: 'a journey you took as a young person', weight: 1 },
  { theme: 'wisdom you would share with your grandchildren', weight: 1.2 },
  { theme: 'your siblings and growing up together', weight: 1 },
  { theme: 'songs or stories you remember from your childhood', weight: 1 },
  { theme: 'a time you had to be brave', weight: 1 },
  { theme: 'someone who shaped who you are', weight: 1 },
];

export function pickTheme(ctx: ThemeContext): string {
  if (ctx.family_suggested) return ctx.family_suggested;
  if (ctx.is_first_call) return FIRST_CALL_THEME;

  const recent = new Set(ctx.recent_themes.map((t) => t.toLowerCase()));
  const available = THEME_POOL.filter((t) => !recent.has(t.theme.toLowerCase()));
  const pool = available.length > 0 ? available : THEME_POOL;

  // weighted random
  const totalWeight = pool.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * totalWeight;
  for (const t of pool) {
    r -= t.weight;
    if (r <= 0) return t.theme;
  }
  return pool[0].theme;
}
```

- [ ] **Step 2: Write Deno test**

`supabase/functions/schedule-call/theme.test.ts`:

```ts
import { assertEquals, assertNotEquals } from 'jsr:@std/assert@1';
import { pickTheme } from './theme.ts';

Deno.test('first call returns the gentle intro theme', () => {
  const result = pickTheme({
    is_first_call: true,
    language: 'kn',
    recent_themes: [],
    date: new Date(),
  });
  assertEquals(result.includes('gentle'), true);
});

Deno.test('family-suggested theme overrides automatic', () => {
  const result = pickTheme({
    is_first_call: false,
    language: 'kn',
    recent_themes: [],
    family_suggested: 'tell me about Bhuj before partition',
    date: new Date(),
  });
  assertEquals(result, 'tell me about Bhuj before partition');
});

Deno.test('avoids recently-covered themes', () => {
  const recent = ['childhood and school days', 'your wedding day'];
  // run many times; none of the picks should be from the recent list
  for (let i = 0; i < 50; i++) {
    const t = pickTheme({
      is_first_call: false,
      language: 'kn',
      recent_themes: recent,
      date: new Date(),
    });
    assertEquals(recent.includes(t.toLowerCase()), false);
  }
});
```

- [ ] **Step 3: Run Deno tests**

Run: `cd supabase/functions/schedule-call && deno test --allow-all theme.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/schedule-call/theme.ts supabase/functions/schedule-call/theme.test.ts
git commit -m "feat(schedule-call): add theme picker with first-call and family-suggested rules"
```

---

### Task 5.2: Call brief assembly

**Files:**
- Create: `supabase/functions/schedule-call/brief.ts`

- [ ] **Step 1: Implement brief assembly**

`supabase/functions/schedule-call/brief.ts`:

```ts
import type { CallBrief, ElderLanguage } from '../_shared/types.ts';
import { pickTheme } from './theme.ts';

export interface BriefAssemblyInput {
  elder: {
    id: string;
    display_name: string;
    preferred_name: string | null;
    relationship_label: string;
    language: ElderLanguage;
    family_intro_audio_url: string | null;
    voiceprint: number[] | null;
    status: string;
  };
  recent_call_summaries: string[];           // most recent 3
  recent_themes: string[];
  family_suggested_questions: string[];      // from app's suggestion queue (Plan 2 will populate)
}

export function assembleBrief(input: BriefAssemblyInput): CallBrief {
  const isFirstCall = input.elder.status === 'pending_first_call';
  const familySuggested = input.family_suggested_questions[0];
  const theme = pickTheme({
    is_first_call: isFirstCall,
    language: input.elder.language,
    recent_themes: input.recent_themes,
    family_suggested: familySuggested,
    date: new Date(),
  });

  return {
    elder_id: input.elder.id,
    elder_display_name: input.elder.display_name,
    preferred_name: input.elder.preferred_name ?? undefined,
    relationship_label: input.elder.relationship_label,
    language: input.elder.language,
    is_first_call: isFirstCall,
    family_intro_audio_url: input.elder.family_intro_audio_url ?? undefined,
    recent_summaries: input.recent_call_summaries,
    family_suggested_questions: input.family_suggested_questions,
    this_week_theme: theme,
    voiceprint: input.elder.voiceprint ?? undefined,
  };
}

export function buildSystemPrompt(brief: CallBrief): string {
  const honorific =
    brief.preferred_name ?? `${brief.relationship_label}`;
  const intro = brief.is_first_call
    ? `This is your VERY FIRST call with ${honorific}. After the family voice intro plays, introduce yourself warmly, ask conversational consent for recording and family-sharing, then ask gently for one nice memory.`
    : `You have spoken with ${honorific} before. Open with a personal callback referencing a recent topic.`;

  const recentBlock =
    brief.recent_summaries.length > 0
      ? `\nRecent calls (newest first):\n${brief.recent_summaries.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
      : '';

  return `You are Susheela — a warm, curious, AI assistant who calls elderly family members on behalf of their loved ones to listen to their stories.

PERSONA:
- Curious, never interrogating. Ask "tell me more" rather than rapid-fire questions.
- Honor silence. Sit through 10-15 sec of thinking. Don't fill space.
- Code-switch naturally if ${honorific} mixes languages.
- Use honorifics — Ji, amma, paati, nana, dada — appropriate to the language.
- Never rush. Calls end on warmth, not on a timer.
- Validate feelings ("that must have been hard").
- Never moralize or contradict. Move forward respectfully.
- Remember accurately. Cite prior calls; never invent.

LANGUAGE: ${brief.language} (with comfortable code-switching to English where the elder does).

THEME FOR THIS CALL: ${brief.this_week_theme}

${intro}${recentBlock}

CUE LISTENING (always-on, structured outputs to webhook):
- TIME-CAPSULE cue: ${honorific} says "save this for [name] when [milestone]" → tag and gently confirm.
- ADVICE cue: utterances framed as guidance ("what I'd tell young people…") → tag.
- DISTRESS cue: tired, sad, upset — soften, offer to end gently, flag.
- CADENCE cue: "call me Tuesdays" / "I'll be traveling" → record.
- SHARING cue: "I want [Saroj] to hear this" → queue share-request.

CALL CLOSE:
- Acknowledge something specific ${honorific} shared.
- Preview next call's likely theme.
- Confirm next call date/time.
- Warm goodbye.

You are NOT a doctor or therapist. If ${honorific} expresses serious distress, soften, suggest they call their family member, end gracefully.`;
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/schedule-call/brief.ts
git commit -m "feat(schedule-call): assemble call brief and build system prompt"
```

---

### Task 5.3: schedule-call function entry point

**Files:**
- Create: `supabase/functions/schedule-call/index.ts`

- [ ] **Step 1: Implement function**

`supabase/functions/schedule-call/index.ts`:

```ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { CORS_HEADERS, handleCorsPreflight } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabase-admin.ts';
import { assembleBrief, buildSystemPrompt } from './brief.ts';

interface ScheduleCallRequest {
  elder_id: string;
  scheduled_at?: string;     // ISO; default: now
  family_suggested_question?: string;
}

Deno.serve(async (req) => {
  const cors = handleCorsPreflight(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  let body: ScheduleCallRequest;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: CORS_HEADERS });
  }

  if (!body.elder_id) {
    return new Response('elder_id required', { status: 400, headers: CORS_HEADERS });
  }

  const supabase = getAdminClient();

  // Load elder
  const { data: elder, error: elderErr } = await supabase
    .from('elders')
    .select('id, family_id, display_name, preferred_name, relationship_label, language, family_intro_audio_url, voiceprint, status')
    .eq('id', body.elder_id)
    .single();
  if (elderErr || !elder) {
    return new Response(`Elder not found: ${elderErr?.message}`, { status: 404, headers: CORS_HEADERS });
  }

  // Load recent call summaries (last 3)
  const { data: recentCalls } = await supabase
    .from('calls')
    .select('summary, theme')
    .eq('elder_id', body.elder_id)
    .eq('status', 'completed')
    .order('ended_at', { ascending: false })
    .limit(3);
  const recent_call_summaries = (recentCalls ?? []).map((c) => c.summary ?? '').filter(Boolean);
  const recent_themes = (recentCalls ?? []).map((c) => c.theme ?? '').filter(Boolean);

  // Assemble brief
  const brief = assembleBrief({
    elder: {
      id: elder.id,
      display_name: elder.display_name,
      preferred_name: elder.preferred_name,
      relationship_label: elder.relationship_label,
      language: elder.language,
      family_intro_audio_url: elder.family_intro_audio_url,
      voiceprint: elder.voiceprint as number[] | null,
      status: elder.status,
    },
    recent_call_summaries,
    recent_themes,
    family_suggested_questions: body.family_suggested_question ? [body.family_suggested_question] : [],
  });

  const systemPrompt = buildSystemPrompt(brief);

  // Insert calls row
  const { data: call, error: callErr } = await supabase
    .from('calls')
    .insert({
      elder_id: elder.id,
      family_id: elder.family_id,
      scheduled_at: body.scheduled_at ?? new Date().toISOString(),
      status: 'scheduled',
      theme: brief.this_week_theme,
      brief_json: brief,
      language: brief.language,
      is_first_call: brief.is_first_call,
    })
    .select('id')
    .single();
  if (callErr || !call) {
    return new Response(`Insert failed: ${callErr?.message}`, { status: 500, headers: CORS_HEADERS });
  }

  // Kick off the actual provider call. We delegate to the call-orchestrator's start endpoint
  // (to keep provider logic in one place). The orchestrator function wraps the @katha/calling
  // provider selector + startCall.
  const orchestratorUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/call-orchestrator/start`;
  const orchestratorRes = await fetch(orchestratorUrl, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      call_id: call.id,
      brief,
      system_prompt: systemPrompt,
    }),
  });

  if (!orchestratorRes.ok) {
    const text = await orchestratorRes.text();
    await supabase.from('calls').update({ status: 'failed' }).eq('id', call.id);
    return new Response(`Orchestrator start failed: ${text}`, { status: 502, headers: CORS_HEADERS });
  }

  return new Response(JSON.stringify({ call_id: call.id, brief }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
});
```

- [ ] **Step 2: Smoke-deploy and test**

Run:
```bash
npx supabase functions deploy schedule-call
```
Once Phase 6 is done, you'll be able to invoke this end-to-end. For now: deploy succeeds, function does not yet have `call-orchestrator/start` to call (will fail with 502 until Phase 6).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/schedule-call/index.ts
git commit -m "feat(schedule-call): function entry point with elder load, brief, and orchestrator handoff"
```

---

## Phase 6 — call-orchestrator Edge Function

The orchestrator is the centerpiece of the calling flow:
- `POST /call-orchestrator/start` — schedule-call calls this with a brief; orchestrator picks provider and starts the call.
- `POST /call-orchestrator/webhook` — provider posts events here: turn, end, voicemail, no_answer, etc.

### Task 6.1: Orchestrator routing skeleton

**Files:**
- Create: `supabase/functions/call-orchestrator/index.ts`
- Create: `supabase/functions/call-orchestrator/handlers.ts`

- [ ] **Step 1: Implement routing**

`supabase/functions/call-orchestrator/index.ts`:

```ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { CORS_HEADERS, handleCorsPreflight } from '../_shared/cors.ts';
import {
  handleStart,
  handleWebhookTurn,
  handleWebhookCallEnd,
  handleWebhookCallStart,
} from './handlers.ts';

Deno.serve(async (req) => {
  const cors = handleCorsPreflight(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/call-orchestrator/, '');

  try {
    if (req.method === 'POST' && path === '/start') {
      return await handleStart(req);
    }
    if (req.method === 'POST' && path === '/webhook') {
      const body = await req.json();
      switch (body.event) {
        case 'call_started': return await handleWebhookCallStart(body);
        case 'turn':         return await handleWebhookTurn(body);
        case 'call_ended':   return await handleWebhookCallEnd(body);
        default:
          return new Response(`Unknown event: ${body.event}`, {
            status: 400, headers: CORS_HEADERS,
          });
      }
    }
    return new Response('Not found', { status: 404, headers: CORS_HEADERS });
  } catch (e) {
    return new Response(`Error: ${(e as Error).message}`, {
      status: 500, headers: CORS_HEADERS,
    });
  }
});
```

- [ ] **Step 2: Implement handler stubs**

`supabase/functions/call-orchestrator/handlers.ts`:

```ts
import { CORS_HEADERS } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabase-admin.ts';
import type { CallBrief, ProviderTurnEvent, ProviderCallEndEvent } from '../_shared/types.ts';

interface StartRequest {
  call_id: string;
  brief: CallBrief;
  system_prompt: string;
}

export async function handleStart(req: Request): Promise<Response> {
  const body = (await req.json()) as StartRequest;
  // Implemented in Task 6.2
  throw new Error('handleStart: not yet implemented (Task 6.2)');
}

export async function handleWebhookCallStart(body: { provider_call_id: string }): Promise<Response> {
  // Implemented in Task 6.3
  throw new Error('handleWebhookCallStart: not yet implemented (Task 6.3)');
}

export async function handleWebhookTurn(body: ProviderTurnEvent & { event: 'turn' }): Promise<Response> {
  // Implemented in Task 6.4
  throw new Error('handleWebhookTurn: not yet implemented (Task 6.4)');
}

export async function handleWebhookCallEnd(body: ProviderCallEndEvent & { event: 'call_ended' }): Promise<Response> {
  // Implemented in Task 6.5
  throw new Error('handleWebhookCallEnd: not yet implemented (Task 6.5)');
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/call-orchestrator
git commit -m "feat(call-orchestrator): routing skeleton with handler stubs"
```

---

### Task 6.2: handleStart — pick provider and dial

**Files:**
- Modify: `supabase/functions/call-orchestrator/handlers.ts`

Edge Functions are Deno; importing `@katha/calling` (Node TS) directly is awkward. Two options:
1. Vendor the relevant calling code (Provider interface + Sarvam impl) into Deno-compatible source under `supabase/functions/call-orchestrator/calling/`.
2. Reimplement the Sarvam HTTP call inline in the handler.

For MVP simplicity and to avoid divergence: **option 2 (inline HTTP call)**. We keep the @katha/calling package for the mobile/web app's perspective and unit tests; the Deno function makes the same HTTP call directly. Document this in code.

- [ ] **Step 1: Implement handleStart**

Replace the `handleStart` stub in `handlers.ts`:

```ts
import { CORS_HEADERS } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabase-admin.ts';
import type { CallBrief, ProviderTurnEvent, ProviderCallEndEvent } from '../_shared/types.ts';

interface StartRequest {
  call_id: string;
  brief: CallBrief;
  system_prompt: string;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SARVAM_API_KEY = Deno.env.get('SARVAM_API_KEY')!;
const SARVAM_BASE = Deno.env.get('SARVAM_BASE_URL') ?? 'https://api.sarvam.ai';
const SARVAM_VOICE = Deno.env.get('SARVAM_VOICE_ID') ?? 'meera';
const PROVIDER_MODE = (Deno.env.get('PROVIDER_MODE') ?? 'production') as 'mock' | 'production';

export async function handleStart(req: Request): Promise<Response> {
  const body = (await req.json()) as StartRequest;
  const supabase = getAdminClient();

  // Load elder phone (decrypt — pgcrypto helper)
  const { data: elder, error: elderErr } = await supabase
    .from('elders')
    .select('phone_number_encrypted, country')
    .eq('id', body.brief.elder_id)
    .single();
  if (elderErr || !elder) {
    return new Response(`Elder not found: ${elderErr?.message}`, { status: 404 });
  }

  // Phone decryption: a SECURITY DEFINER RPC, called via supabase.rpc
  const { data: phone, error: phoneErr } = await supabase.rpc('get_elder_phone_e164', {
    elder_id_arg: body.brief.elder_id,
  });
  if (phoneErr || !phone) {
    return new Response(`Phone decrypt failed: ${phoneErr?.message}`, { status: 500 });
  }

  const webhookUrl = `${SUPABASE_URL}/functions/v1/call-orchestrator/webhook`;

  // Mark call dialing
  await supabase.from('calls').update({ status: 'dialing', provider: PROVIDER_MODE === 'mock' ? 'mock' : 'sarvam' })
    .eq('id', body.call_id);

  if (PROVIDER_MODE === 'mock') {
    // Don't actually dial; orchestrator will simulate via /webhook posts in tests.
    return new Response(JSON.stringify({ provider_call_id: `mock-${body.call_id}` }), {
      status: 200, headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    });
  }

  if (elder.country !== 'IN') {
    await supabase.from('calls').update({ status: 'failed' }).eq('id', body.call_id);
    return new Response('Only IN supported in MVP', { status: 400 });
  }

  // Call Sarvam
  const sarvamPayload = {
    to: phone,
    language: body.brief.language,
    voice_id: SARVAM_VOICE,
    system_prompt: body.system_prompt,
    first_message_audio_url: body.brief.is_first_call ? body.brief.family_intro_audio_url : undefined,
    webhook_url: webhookUrl,
    metadata: { call_id: body.call_id },
  };

  const sarvamRes = await fetch(`${SARVAM_BASE}/voice-bot/start`, {
    method: 'POST',
    headers: {
      'api-subscription-key': SARVAM_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify(sarvamPayload),
  });
  if (!sarvamRes.ok) {
    const text = await sarvamRes.text();
    await supabase.from('calls').update({ status: 'failed' }).eq('id', body.call_id);
    return new Response(`Sarvam start failed ${sarvamRes.status}: ${text}`, { status: 502 });
  }
  const sarvamJson = (await sarvamRes.json()) as { call_id: string };

  await supabase.from('calls').update({
    provider_call_id: sarvamJson.call_id,
  }).eq('id', body.call_id);

  return new Response(JSON.stringify({ provider_call_id: sarvamJson.call_id }), {
    status: 200, headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
}
```

Add the supporting pgcrypto RPC migration:

`supabase/migrations/017_phone_decrypt_rpc.sql`:

```sql
-- Phone decrypt RPC, service-role-only.
-- Phones are encrypted with pgp_sym_encrypt(phone, env_key) on insert.

CREATE OR REPLACE FUNCTION get_elder_phone_e164(elder_id_arg UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encrypted TEXT;
  decryption_key TEXT;
BEGIN
  -- Service role only
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  decryption_key := current_setting('app.phone_encryption_key', true);
  IF decryption_key IS NULL OR decryption_key = '' THEN
    RAISE EXCEPTION 'phone_encryption_key not configured';
  END IF;

  SELECT phone_number_encrypted INTO encrypted FROM elders WHERE id = elder_id_arg;
  IF encrypted IS NULL THEN RETURN NULL; END IF;

  RETURN pgp_sym_decrypt(encrypted::bytea, decryption_key);
END
$$;
```

Configure key via Supabase config:
```sql
-- Run once in Supabase dashboard or via migration:
ALTER DATABASE postgres SET app.phone_encryption_key = '<your-key>';
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase db push`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/call-orchestrator/handlers.ts supabase/migrations/017_phone_decrypt_rpc.sql
git commit -m "feat(call-orchestrator): handleStart picks provider and dials via Sarvam"
```

---

### Task 6.3: handleWebhookCallStart

**Files:**
- Modify: `supabase/functions/call-orchestrator/handlers.ts`

- [ ] **Step 1: Implement**

Replace the `handleWebhookCallStart` stub:

```ts
export async function handleWebhookCallStart(body: { provider_call_id: string; metadata?: { call_id?: string } }): Promise<Response> {
  const supabase = getAdminClient();
  const callId = body.metadata?.call_id;
  if (!callId) {
    // try lookup by provider_call_id
    const { data: c } = await supabase
      .from('calls')
      .select('id')
      .eq('provider_call_id', body.provider_call_id)
      .single();
    if (!c) return new Response('Unknown call', { status: 404 });
  }
  await supabase
    .from('calls')
    .update({ status: 'in_progress', started_at: new Date().toISOString() })
    .eq('provider_call_id', body.provider_call_id);
  return new Response('ok', { status: 200 });
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/call-orchestrator/handlers.ts
git commit -m "feat(call-orchestrator): mark call in_progress on call_started webhook"
```

---

### Task 6.4: handleWebhookTurn — store turn + voice verify

**Files:**
- Modify: `supabase/functions/call-orchestrator/handlers.ts`

This handler must:
1. Look up the call.
2. Insert call_turns row with transcript + audio_clip_url.
3. For elder turns: download audio clip, run voiceprint extract (HF Inference), compare against elder.voiceprint, store score + flag low-confidence turns.

Voiceprint logic lives client-side in @katha/ai but Edge Functions are Deno. We'll inline the same logic here as a Deno-compatible HTTP call to HuggingFace.

- [ ] **Step 1: Implement**

Replace the `handleWebhookTurn` stub:

```ts
const HF_TOKEN = Deno.env.get('HUGGINGFACE_TOKEN')!;
const SAME_SPEAKER_THRESHOLD = 0.75;

async function extractVoiceprintHF(audioUrl: string): Promise<number[]> {
  // Fetch audio bytes
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) throw new Error(`Could not fetch audio: ${audioRes.status}`);
  const audio = await audioRes.arrayBuffer();
  // Call HF Inference
  const hfRes = await fetch('https://api-inference.huggingface.co/models/pyannote/embedding', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HF_TOKEN}`,
      'Content-Type': 'audio/flac',
    },
    body: audio,
  });
  if (!hfRes.ok) {
    const text = await hfRes.text();
    throw new Error(`HF inference failed ${hfRes.status}: ${text}`);
  }
  const json = (await hfRes.json()) as { embedding: number[] };
  if (!json.embedding) throw new Error('HF response missing embedding');
  return json.embedding;
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function handleWebhookTurn(body: ProviderTurnEvent & { event: 'turn' }): Promise<Response> {
  const supabase = getAdminClient();

  // Look up the call
  const { data: call, error: callErr } = await supabase
    .from('calls')
    .select('id, elder_id, is_first_call')
    .eq('provider_call_id', body.provider_call_id)
    .single();
  if (callErr || !call) return new Response('Unknown call', { status: 404 });

  let voiceScore: number | null = null;

  if (body.speaker === 'elder') {
    try {
      const turnEmbedding = await extractVoiceprintHF(body.audio_clip_url);

      const { data: elder } = await supabase
        .from('elders')
        .select('voiceprint')
        .eq('id', call.elder_id)
        .single();

      if (elder?.voiceprint && Array.isArray(elder.voiceprint)) {
        voiceScore = cosine(turnEmbedding, elder.voiceprint as number[]);
      } else if (call.is_first_call) {
        // No voiceprint yet — enroll on first elder turn that's long enough
        const turnDurationMs = body.ended_at_ms - body.started_at_ms;
        if (turnDurationMs >= 3000) {
          await supabase
            .from('elders')
            .update({
              voiceprint: turnEmbedding,
              voiceprint_enrolled_at: new Date().toISOString(),
            })
            .eq('id', call.elder_id);
          voiceScore = 1.0;  // self-similarity
        }
      }
    } catch (e) {
      console.error('Voiceprint failed:', e);
      // proceed without score; mark unverified
    }
  }

  // Insert turn
  await supabase.from('call_turns').insert({
    call_id: call.id,
    speaker: body.speaker,
    audio_clip_url: body.audio_clip_url,
    transcript: body.transcript,
    language: body.language,
    started_at_ms: body.started_at_ms,
    ended_at_ms: body.ended_at_ms,
    voice_verification_score: voiceScore,
  });

  return new Response('ok', { status: 200 });
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/call-orchestrator/handlers.ts
git commit -m "feat(call-orchestrator): store turn with voiceprint enroll/verify"
```

---

### Task 6.5: handleWebhookCallEnd — mark call complete and trigger post-processing

**Files:**
- Modify: `supabase/functions/call-orchestrator/handlers.ts`

- [ ] **Step 1: Implement**

Replace the `handleWebhookCallEnd` stub:

```ts
export async function handleWebhookCallEnd(body: ProviderCallEndEvent & { event: 'call_ended' }): Promise<Response> {
  const supabase = getAdminClient();

  const { data: call, error: callErr } = await supabase
    .from('calls')
    .select('id, voice_verification_score')
    .eq('provider_call_id', body.provider_call_id)
    .single();
  if (callErr || !call) return new Response('Unknown call', { status: 404 });

  // Compute aggregate verification score
  const { data: turns } = await supabase
    .from('call_turns')
    .select('voice_verification_score, speaker')
    .eq('call_id', call.id)
    .eq('speaker', 'elder');
  const elderScores = (turns ?? [])
    .map((t: { voice_verification_score: number | null }) => t.voice_verification_score)
    .filter((s): s is number => typeof s === 'number');
  const aggregate =
    elderScores.length > 0
      ? elderScores.reduce((a, b) => a + b, 0) / elderScores.length
      : null;

  await supabase
    .from('calls')
    .update({
      status: body.status,
      ended_at: new Date().toISOString(),
      duration_seconds: body.duration_seconds,
      recording_url: body.recording_url,
      cost_cents: body.cost_cents,
      voice_verification_score: aggregate,
    })
    .eq('id', call.id);

  // Trigger post-call processing for completed calls only
  if (body.status === 'completed') {
    const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/post-call-process`;
    fetch(url, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ call_id: call.id }),
    }).catch((e) => console.error('post-call-process trigger failed', e));
    // fire-and-forget; ack the webhook fast
  }

  return new Response('ok', { status: 200 });
}
```

- [ ] **Step 2: Deploy**

Run: `npx supabase functions deploy call-orchestrator`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/call-orchestrator/handlers.ts
git commit -m "feat(call-orchestrator): finalize call on call_ended and trigger post-processing"
```

---

## Phase 7 — post-call-process Edge Function

### Task 7.1: post-call-process function entry point

**Files:**
- Create: `supabase/functions/post-call-process/index.ts`

The Deno function imports the @katha/ai logic by reimplementing it inline (because @katha/ai is Node TypeScript). To stay DRY, copy `extract-stories.ts`, `extract-persona-facts.ts`, `embeddings.ts`, `anthropic.ts` as Deno-compatible siblings under `supabase/functions/post-call-process/lib/`. They use `npm:` specifiers for Anthropic and OpenAI SDKs, which Deno supports.

- [ ] **Step 1: Mirror @katha/ai modules into Deno-compatible siblings**

Create:
- `supabase/functions/post-call-process/lib/anthropic.ts`
- `supabase/functions/post-call-process/lib/embeddings.ts`
- `supabase/functions/post-call-process/lib/extract-stories.ts`
- `supabase/functions/post-call-process/lib/extract-persona-facts.ts`

Each is the Deno-compatible mirror of `packages/ai/src/<same name>.ts`. Adjust imports:

`supabase/functions/post-call-process/lib/anthropic.ts`:

```ts
import Anthropic from 'npm:@anthropic-ai/sdk@0.30.0';

export interface GenerateJSONOptions {
  client: Anthropic;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  schema: object;
  maxTokens?: number;
  temperature?: number;
}

const FENCED = /```(?:json)?\n([\s\S]*?)\n```/;

export async function generateJSON<T = unknown>(opts: GenerateJSONOptions): Promise<T> {
  const res = await opts.client.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 2048,
    temperature: opts.temperature ?? 0.3,
    system: opts.systemPrompt,
    messages: [{ role: 'user', content: opts.userPrompt }],
  });
  const block = res.content.find((b: { type: string }) => b.type === 'text') as
    | { type: 'text'; text: string } | undefined;
  if (!block) throw new Error('No text block');
  const text = block.text.trim();
  const fenced = FENCED.exec(text);
  const candidate = fenced ? fenced[1] : text;
  return JSON.parse(candidate) as T;
}

export const MODELS = {
  sonnet: 'claude-sonnet-4-6',
  haiku:  'claude-haiku-4-5-20251001',
} as const;
```

`supabase/functions/post-call-process/lib/embeddings.ts`:

```ts
import OpenAI from 'npm:openai@4.60.0';

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIM = 1536;

export async function embedBatch(client: OpenAI, texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const slice = texts.slice(i, i + 100);
    const res = await client.embeddings.create({ model: EMBEDDING_MODEL, input: slice });
    out.push(...res.data.map((d) => d.embedding));
  }
  return out;
}
```

`supabase/functions/post-call-process/lib/extract-stories.ts` and `extract-persona-facts.ts`: copy contents from packages/ai versions, replacing the Anthropic import line with `import Anthropic from 'npm:@anthropic-ai/sdk@0.30.0';` and `from './anthropic'` with `from './anthropic.ts'`.

- [ ] **Step 2: Implement post-call-process index**

`supabase/functions/post-call-process/index.ts`:

```ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { CORS_HEADERS, handleCorsPreflight } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabase-admin.ts';
import Anthropic from 'npm:@anthropic-ai/sdk@0.30.0';
import OpenAI from 'npm:openai@4.60.0';
import { extractStories } from './lib/extract-stories.ts';
import { extractPersonaFacts } from './lib/extract-persona-facts.ts';
import { embedBatch } from './lib/embeddings.ts';
import { MODELS, generateJSON } from './lib/anthropic.ts';

interface PostCallRequest { call_id: string; }

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

Deno.serve(async (req) => {
  const cors = handleCorsPreflight(req);
  if (cors) return cors;
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const body = (await req.json()) as PostCallRequest;
  if (!body.call_id) return new Response('call_id required', { status: 400 });

  const supabase = getAdminClient();
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  // Load call + elder + turns
  const { data: call } = await supabase
    .from('calls')
    .select('id, elder_id, family_id, language, is_first_call, theme')
    .eq('id', body.call_id)
    .single();
  if (!call) return new Response('Call not found', { status: 404 });

  const { data: elder } = await supabase
    .from('elders')
    .select('display_name, preferred_name, relationship_label')
    .eq('id', call.elder_id)
    .single();
  if (!elder) return new Response('Elder not found', { status: 404 });

  const { data: turns } = await supabase
    .from('call_turns')
    .select('id, speaker, transcript, language, voice_verification_score')
    .eq('call_id', body.call_id)
    .order('started_at_ms', { ascending: true });
  if (!turns || turns.length === 0) {
    await supabase.from('calls').update({ summary: 'No turns captured.' }).eq('id', body.call_id);
    return new Response(JSON.stringify({ stories: 0, persona_facts: 0 }), {
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    });
  }

  const elderName = elder.preferred_name ?? elder.display_name;
  const turnInputs = turns.map((t) => ({
    id: t.id,
    speaker: t.speaker,
    transcript: t.transcript ?? '',
    language: t.language ?? call.language,
  }));

  // 1. Extract stories
  const stories = await extractStories({ client: anthropic, turns: turnInputs, elderName });

  // 2. Insert each story into capsules table
  for (const story of stories) {
    // Confirm voice_verified: true only if all source turns have score >= threshold
    const sourceTurns = turns.filter((t) => story.source_turn_ids.includes(t.id) && t.speaker === 'elder');
    const voiceVerified = sourceTurns.length > 0 && sourceTurns.every(
      (t) => typeof t.voice_verification_score === 'number' && t.voice_verification_score >= 0.75,
    );

    // Generate metadata via existing generate-metadata function (Claude Haiku)
    const metaRes = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-metadata`,
      {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ text: story.polished_text }),
      },
    );
    const metadata = metaRes.ok ? await metaRes.json() : { excerpt: null, category: null, mood: null, read_time_minutes: 1 };

    await supabase.from('capsules').insert({
      family_id: call.family_id,
      elder_id: call.elder_id,
      writer_id: null,
      raw_text: turnInputs.filter((t) => story.source_turn_ids.includes(t.id)).map((t) => t.transcript).join('\n\n'),
      polished_text: story.polished_text,
      title: story.title,
      excerpt: metadata.excerpt,
      category: metadata.category,
      mood: metadata.mood,
      read_time_minutes: metadata.read_time_minutes ?? 1,
      language: story.language,
      source_call_id: body.call_id,
      source_turn_ids: story.source_turn_ids,
      voice_verified: voiceVerified,
      privacy_flag: 'family',
      is_draft: false,
      is_unlocked: true,
      published_at: new Date().toISOString(),
    });
  }

  // 3. Extract persona facts (only voice-verified elder turns)
  const verifiedTurns = turnInputs.filter((t) => {
    const orig = turns.find((x) => x.id === t.id);
    return t.speaker === 'elder'
      && typeof orig?.voice_verification_score === 'number'
      && (orig.voice_verification_score as number) >= 0.75;
  });

  const facts = verifiedTurns.length > 0
    ? await extractPersonaFacts({ client: anthropic, turns: verifiedTurns, elderName })
    : [];

  if (facts.length > 0) {
    const factEmbeddings = await embedBatch(openai, facts.map((f) => f.text));
    const personaRows = facts.map((fact, i) => {
      const turn = turns.find((t) => t.id === fact.source_turn_id);
      return {
        elder_id: call.elder_id,
        source_turn_id: fact.source_turn_id,
        source_call_id: body.call_id,
        fact_type: fact.fact_type,
        text: fact.text,
        audio_clip_url: turn?.audio_clip_url ?? null,
        embedding: factEmbeddings[i],
        confidence: fact.confidence,
        voice_verified: true,
        language: fact.language,
      };
    });
    await supabase.from('persona_index').insert(personaRows);
  }

  // 4. Embed each call_turn for retrieval queries (only elder turns with content)
  const turnsToEmbed = turns.filter((t) => t.speaker === 'elder' && t.transcript && t.transcript.trim().length > 0);
  if (turnsToEmbed.length > 0) {
    const turnEmbeddings = await embedBatch(openai, turnsToEmbed.map((t) => t.transcript ?? ''));
    for (let i = 0; i < turnsToEmbed.length; i++) {
      await supabase
        .from('call_turns')
        .update({ embedding: turnEmbeddings[i] })
        .eq('id', turnsToEmbed[i].id);
    }
  }

  // 5. Generate a short call summary for next call's brief
  const summaryRes = await generateJSON<{ summary: string }>({
    client: anthropic,
    model: MODELS.haiku,
    systemPrompt: `Summarize this call in 1-2 sentences for use as context in the next call. Focus on what ${elderName} talked about and any threads to revisit.`,
    userPrompt: `Theme: ${call.theme}\nTurns:\n${turnInputs.map((t) => `${t.speaker}: ${t.transcript}`).join('\n')}\n\nReturn JSON: {"summary": "..."}`,
    schema: {},
    maxTokens: 256,
    temperature: 0.3,
  });

  // 6. If first call, mark elder active
  if (call.is_first_call) {
    await supabase.from('elders').update({ status: 'active' }).eq('id', call.elder_id);
  }

  await supabase.from('calls').update({ summary: summaryRes.summary }).eq('id', body.call_id);

  return new Response(JSON.stringify({
    stories: stories.length,
    persona_facts: facts.length,
    turns_embedded: turnsToEmbed.length,
  }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
});
```

- [ ] **Step 3: Deploy**

Run: `npx supabase functions deploy post-call-process`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/post-call-process
git commit -m "feat(post-call-process): extract stories, facts, embed turns, summarize call"
```

---

## Phase 8 — qa-retrieval Edge Function

### Task 8.1: qa-retrieval entry point

**Files:**
- Create: `supabase/functions/qa-retrieval/index.ts`
- Create: `supabase/functions/qa-retrieval/lib/anthropic.ts` (mirror, same as post-call-process)
- Create: `supabase/functions/qa-retrieval/lib/embeddings.ts` (mirror)

- [ ] **Step 1: Mirror lib files**

Copy `anthropic.ts` and `embeddings.ts` from `supabase/functions/post-call-process/lib/` into `supabase/functions/qa-retrieval/lib/`.

- [ ] **Step 2: Implement qa-retrieval**

`supabase/functions/qa-retrieval/index.ts`:

```ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { CORS_HEADERS, handleCorsPreflight } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabase-admin.ts';
import Anthropic from 'npm:@anthropic-ai/sdk@0.30.0';
import OpenAI from 'npm:openai@4.60.0';
import { generateJSON, MODELS } from './lib/anthropic.ts';
import { EMBEDDING_MODEL } from './lib/embeddings.ts';

interface QARequest {
  elder_id: string;
  question: string;
  top_k?: number;
}

interface QACitation {
  text: string;
  audio_clip_url: string | null;
  call_date: string | null;
  similarity: number;
  fact_type: string;
}

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

Deno.serve(async (req) => {
  const cors = handleCorsPreflight(req);
  if (cors) return cors;
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const body = (await req.json()) as QARequest;
  if (!body.elder_id || !body.question) {
    return new Response('elder_id and question required', { status: 400 });
  }
  const topK = body.top_k ?? 6;

  const supabase = getAdminClient();
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  // 1. Embed question
  const qEmb = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: body.question,
  });
  const qVec = qEmb.data[0].embedding;

  // 2. Retrieve from persona_index via RPC (cosine similarity)
  // We need an RPC because supabase-js doesn't support pgvector ops directly.
  const { data: matches, error: matchErr } = await supabase.rpc('search_persona_index', {
    elder_id_arg: body.elder_id,
    query_embedding: qVec,
    match_count: topK,
  });
  if (matchErr) {
    return new Response(`Search failed: ${matchErr.message}`, { status: 500 });
  }

  if (!matches || (matches as unknown[]).length === 0) {
    return new Response(JSON.stringify({
      answer: "I don't have anything from her about that yet — would you like to ask in your next call?",
      citations: [],
    }), { status: 200, headers: { ...CORS_HEADERS, 'content-type': 'application/json' } });
  }

  // 3. Compose answer with Claude Sonnet, grounded only in citations
  type Match = {
    fact_text: string;
    fact_type: string;
    audio_clip_url: string | null;
    similarity: number;
    call_started_at: string | null;
  };
  const typedMatches = matches as Match[];

  const citationsBlock = typedMatches.map((m, i) =>
    `[${i + 1}] (${m.fact_type}, ${m.call_started_at ?? 'unknown date'}): ${m.fact_text}`
  ).join('\n');

  const result = await generateJSON<{ answer: string; cited: number[] }>({
    client: anthropic,
    model: MODELS.sonnet,
    systemPrompt: `You answer questions about an elder family member based ONLY on a provided list of distilled facts from their recorded calls. You must:
- Quote or paraphrase from the facts; never invent.
- If the facts don't actually answer the question, say so warmly.
- Use the elder's voice and idiom where preserved.
- Return JSON: {"answer": "...", "cited": [1,2,3]} (cited is the 1-based indices of facts you used).`,
    userPrompt: `Question: ${body.question}

Facts:
${citationsBlock}

Answer using only these facts.`,
    schema: {},
    maxTokens: 1024,
    temperature: 0.3,
  });

  const citations: QACitation[] = (result.cited ?? []).map((i) => {
    const m = typedMatches[i - 1];
    if (!m) return null;
    return {
      text: m.fact_text,
      audio_clip_url: m.audio_clip_url,
      call_date: m.call_started_at,
      similarity: m.similarity,
      fact_type: m.fact_type,
    };
  }).filter((c): c is QACitation => c !== null);

  return new Response(JSON.stringify({ answer: result.answer, citations }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
});
```

- [ ] **Step 3: Add the search_persona_index RPC**

`supabase/migrations/018_persona_search_rpc.sql`:

```sql
CREATE OR REPLACE FUNCTION search_persona_index(
  elder_id_arg UUID,
  query_embedding vector(1536),
  match_count INT DEFAULT 6
)
RETURNS TABLE (
  fact_text TEXT,
  fact_type persona_fact_type,
  audio_clip_url TEXT,
  similarity FLOAT,
  call_started_at TIMESTAMPTZ
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    pi.text AS fact_text,
    pi.fact_type,
    pi.audio_clip_url,
    1 - (pi.embedding <=> query_embedding) AS similarity,
    c.started_at AS call_started_at
  FROM persona_index pi
  LEFT JOIN calls c ON c.id = pi.source_call_id
  WHERE pi.elder_id = elder_id_arg
    AND pi.voice_verified = true
  ORDER BY pi.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

- [ ] **Step 4: Apply migration + deploy function**

Run:
```bash
npx supabase db push
npx supabase functions deploy qa-retrieval
```
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/qa-retrieval supabase/migrations/018_persona_search_rpc.sql
git commit -m "feat(qa-retrieval): vector search + Claude-grounded answer with citations"
```

---

## Phase 9 — Operator scripts and end-to-end smoke

### Task 9.1: Seed test family + elder

**Files:**
- Create: `scripts/seed-test-family.ts`

This is a Node script (not Deno) so it can use the @katha/* workspaces.

- [ ] **Step 1: Implement seed script**

`scripts/seed-test-family.ts`:

```ts
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PHONE_KEY = process.env.PHONE_ENCRYPTION_KEY!;
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? 'gautam@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'changeme';
const TEST_ELDER_PHONE = process.env.TEST_ELDER_PHONE!;     // your real test phone, E.164
const TEST_ELDER_NAME = process.env.TEST_ELDER_NAME ?? 'Susheela';
const TEST_ELDER_LANG = process.env.TEST_ELDER_LANG ?? 'kn';

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // 1. Create test user (or fetch existing)
  let userId: string;
  const { data: signUp, error: signUpErr } = await supabase.auth.admin.createUser({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
  });
  if (signUpErr && !signUpErr.message.includes('already registered')) {
    throw signUpErr;
  }
  if (signUp?.user) {
    userId = signUp.user.id;
  } else {
    const { data: list } = await supabase.auth.admin.listUsers();
    const u = list.users.find((u) => u.email === TEST_USER_EMAIL);
    if (!u) throw new Error('User not found after create attempt');
    userId = u.id;
  }
  console.log('User:', userId);

  // 2. Create family
  const { data: family, error: famErr } = await supabase
    .from('families')
    .insert({ name: 'Test Family', invite_code: `TEST-${Date.now()}`, created_by: userId })
    .select('id')
    .single();
  if (famErr) throw famErr;
  console.log('Family:', family!.id);

  // 3. Create profile
  const { error: profErr } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      family_id: family!.id,
      display_name: 'Gautam',
      role: 'guardian',
      relationship_label: 'Grandson',
    });
  if (profErr) throw profErr;

  // 4. Encrypt phone via SQL (using the PHONE_ENCRYPTION_KEY)
  const phoneHash = await hashPhone(TEST_ELDER_PHONE);
  const { data: encrypted, error: encErr } = await supabase.rpc('encrypt_phone', {
    plaintext_phone: TEST_ELDER_PHONE,
  });
  if (encErr) throw encErr;

  // 5. Create elder
  const { data: elder, error: elderErr } = await supabase
    .from('elders')
    .insert({
      family_id: family!.id,
      display_name: TEST_ELDER_NAME,
      relationship_label: 'Grandmother',
      preferred_name: TEST_ELDER_NAME,
      language: TEST_ELDER_LANG,
      phone_number_encrypted: encrypted as string,
      phone_number_hash: phoneHash,
      country: 'IN',
      timezone: 'Asia/Kolkata',
      added_by: userId,
      status: 'pending_first_call',
    })
    .select('id')
    .single();
  if (elderErr) throw elderErr;
  console.log('Elder:', elder!.id);
  console.log('\nSeed complete. Set ELDER_ID env to:', elder!.id);
}

async function hashPhone(phone: string): Promise<string> {
  const enc = new TextEncoder().encode(phone);
  const hashBuf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Add the encrypt_phone RPC:

`supabase/migrations/019_encrypt_phone_rpc.sql`:

```sql
CREATE OR REPLACE FUNCTION encrypt_phone(plaintext_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  encryption_key := current_setting('app.phone_encryption_key', true);
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION 'phone_encryption_key not configured';
  END IF;
  RETURN encode(pgp_sym_encrypt(plaintext_phone, encryption_key), 'base64');
END
$$;
```

Note: `phone_number_encrypted` should accept base64. If your `pgp_sym_decrypt` reads bytea directly, change `017_phone_decrypt_rpc.sql`'s `encrypted::bytea` to `decode(encrypted, 'base64')`. Update accordingly.

- [ ] **Step 2: Apply migration + run seed**

```bash
npx supabase db push
npx ts-node scripts/seed-test-family.ts
```

Expected: console prints user/family/elder IDs. Save the elder id for next task.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-test-family.ts supabase/migrations/019_encrypt_phone_rpc.sql
git commit -m "feat(scripts): seed test family and elder with encrypted phone"
```

---

### Task 9.2: Trigger-test-call script + manual smoke

**Files:**
- Create: `scripts/trigger-test-call.ts`

- [ ] **Step 1: Implement trigger**

`scripts/trigger-test-call.ts`:

```ts
import { config } from 'dotenv';
config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ELDER_ID = process.env.ELDER_ID!;
const FAMILY_SUGGESTED = process.env.FAMILY_SUGGESTED;

async function main() {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/schedule-call`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${SERVICE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      elder_id: ELDER_ID,
      family_suggested_question: FAMILY_SUGGESTED,
    }),
  });
  if (!res.ok) {
    console.error('Schedule failed:', res.status, await res.text());
    process.exit(1);
  }
  const result = await res.json();
  console.log('Call queued:', result);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Mock-mode end-to-end smoke**

Set `PROVIDER_MODE=mock` in Supabase function env. Then:

```bash
ELDER_ID=<from seed> npx ts-node scripts/trigger-test-call.ts
```

Manually POST simulated webhook events:

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

# turn (elder) — needs a real audio clip URL for voiceprint to work; or use an HF-stub URL
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

Verify via SQL:
```sql
SELECT * FROM calls WHERE id = '<call_id>';                      -- status=completed, summary set
SELECT * FROM call_turns WHERE call_id = '<call_id>';            -- 2 rows, embedding non-null for elder turn
SELECT * FROM capsules WHERE source_call_id = '<call_id>';       -- 1+ stories
SELECT * FROM persona_index WHERE source_call_id = '<call_id>';  -- 1+ facts (if elder turn voice-verified)
```

- [ ] **Step 3: Q&A smoke**

```bash
curl -X POST $SUPABASE_URL/functions/v1/qa-retrieval \
  -H "authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "content-type: application/json" \
  -d "{\"elder_id\":\"$ELDER_ID\",\"question\":\"What did Ajji say about her wedding day?\"}"
```

Expected: an answer that quotes/paraphrases the wedding-day fact, plus a citation with audio_clip_url.

- [ ] **Step 4: Commit**

```bash
git add scripts/trigger-test-call.ts
git commit -m "feat(scripts): trigger-test-call helper for smoke testing"
```

---

### Task 9.3: First real call smoke (Gautam's elder)

This is a manual milestone — no code, no commit. Documented as a checklist so it doesn't get forgotten.

- [ ] **Step 1: Verify Sarvam dev account is funded and credentials in Supabase function env**

Run via Supabase Dashboard → Functions → Secrets:
- `SARVAM_API_KEY`
- `SARVAM_VOICE_ID`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `HUGGINGFACE_TOKEN`
- `PROVIDER_MODE=production`

- [ ] **Step 2: Have Gautam record a 20-second family voice intro**

Upload to `audio-archival` bucket under `family-intros/<elder_id>.flac`. Update `elders.family_intro_audio_url` to the signed URL.

- [ ] **Step 3: Tell elder a call is coming**

Out-of-band: text/call the elder to expect a call from a known Indian number at a specific time. Critical step — don't surprise them.

- [ ] **Step 4: Trigger the call**

```bash
ELDER_ID=<gautam-elder-id> npx ts-node scripts/trigger-test-call.ts
```

- [ ] **Step 5: Stay near the elder during the call**

If anything goes wrong (Susheela's voice is jarring, family intro doesn't play, elder is confused), be ready to call them yourself immediately afterward.

- [ ] **Step 6: After the call, verify**

- `calls` row: status=completed, voice_verification_score, recording_url
- `call_turns`: turns stored, voice scores reasonable
- `capsules`: 1+ stories generated, voice_verified=true
- `persona_index`: facts populated
- Q&A endpoint returns a sensible answer to "what did Ajji say about [theme]?"

- [ ] **Step 7: Document findings**

Create `docs/superpowers/research/first-call-postmortem.md` with: what worked, what didn't, threshold tuning ideas, language quality notes, elder reaction.

```bash
git add docs/superpowers/research/first-call-postmortem.md
git commit -m "docs: first-call postmortem"
```

---

## Self-review

After writing all tasks above, this section is the writer's sanity check.

**Spec coverage:**
- Spec §3 Loop 1 (capture) → Phases 5, 6, 7 ✓
- Spec §3 Loop 3 MVP (Q&A retrieval) → Phase 8 ✓
- Spec §4 first-call onboarding (consent capture) → partially: voiceprint enrollment in Task 6.4 covers the technical capture; the multi-consent persistence (recording/family-sharing/persona/voice-cloning/external-share) is not yet captured by the orchestrator. **Gap:** add a Task 6.6 for consent capture from explicit cue events. *Fixed below.*
- Spec §5 recurring call (theme picking, character system prompt, cue listening) → Tasks 5.1, 5.2 (theme + system prompt). **Gap:** cue parsing from turns is not yet wired — Susheela's system prompt asks for structured cues but the orchestrator never reads them. *Fixed below.*
- Spec §7 data model → Phase 1 migrations 012-015 + 016 (storage) + 017 (decrypt) + 018 (search) + 019 (encrypt). Missing: `share_links`, `digests` (those are Plan 3), capsule eviction of writer_id NOT NULL ✓.
- Spec §8 stack architecture → Phase 2 (provider abstraction), Phase 3 (AI utils), Phase 4-8 (functions) ✓.
- Spec §13 TBDs → embeddings provider locked to OpenAI text-embedding-3-small; voiceprint locked to pyannote/HF; Sarvam-specific bits flagged in Task 0.2 capability spike ✓.

**Gap fixes (added inline below):**

### Task 6.4-bis: Cue extraction during turn handling

Wire cue extraction into `handleWebhookTurn`. Add to `handlers.ts` after the voice-verify block, before the insert:

```ts
// Extract simple cues from elder transcripts via Claude Haiku
async function extractCuesQuick(transcript: string, language: string): Promise<Record<string, unknown>> {
  if (!transcript.trim()) return {};
  try {
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      temperature: 0.1,
      system: `Extract structured cues from an elder's spoken turn. Return JSON: {"time_capsule": {"recipient": "...", "condition": "..."} | null, "advice": {"topic": "..."} | null, "distress": {"severity": "mild|moderate|severe"} | null, "cadence": {"request": "..."} | null, "sharing_request": {"recipient_label": "..."} | null}. Set keys to null if not present.`,
      messages: [{ role: 'user', content: `Language: ${language}\nTurn: ${transcript}` }],
    });
    const block = res.content.find((b) => b.type === 'text') as { type: 'text'; text: string } | undefined;
    if (!block) return {};
    const fenced = /```(?:json)?\n([\s\S]*?)\n```/.exec(block.text);
    return JSON.parse(fenced ? fenced[1] : block.text);
  } catch (_) {
    return {};
  }
}
```

Use it in `handleWebhookTurn`:

```ts
let cues: Record<string, unknown> = {};
if (body.speaker === 'elder' && body.transcript) {
  cues = await extractCuesQuick(body.transcript, body.language);
}
// ...then in the insert:
await supabase.from('call_turns').insert({
  call_id: call.id,
  speaker: body.speaker,
  audio_clip_url: body.audio_clip_url,
  transcript: body.transcript,
  language: body.language,
  started_at_ms: body.started_at_ms,
  ended_at_ms: body.ended_at_ms,
  voice_verification_score: voiceScore,
  cues,
});
```

Cues stored on the turn become inputs to Plan 3 (sharing, time-capsules) without requiring re-processing.

### Task 6.4-ter: Consent capture during first call

When a turn's transcript contains explicit consent statements during a first call, persist into `elder_consents`. Add a small heuristic plus Haiku classifier:

```ts
async function detectConsents(transcript: string, language: string): Promise<Array<{ type: string; granted: boolean }>> {
  if (!transcript.trim()) return [];
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    temperature: 0.1,
    system: `Detect explicit yes/no consent statements in an elder's spoken turn. Categories: "recording", "family_sharing", "persona_use", "voice_cloning", "external_share". Return JSON: {"consents": [{"type": "recording", "granted": true}, ...]}. Empty array if none.`,
    messages: [{ role: 'user', content: `Language: ${language}\nTurn: ${transcript}` }],
  });
  const block = res.content.find((b) => b.type === 'text') as { type: 'text'; text: string } | undefined;
  if (!block) return [];
  const fenced = /```(?:json)?\n([\s\S]*?)\n```/.exec(block.text);
  try {
    const parsed = JSON.parse(fenced ? fenced[1] : block.text);
    return parsed.consents ?? [];
  } catch { return []; }
}
```

In `handleWebhookTurn`, when `call.is_first_call && body.speaker === 'elder'`:

```ts
if (call.is_first_call && body.speaker === 'elder') {
  const consents = await detectConsents(body.transcript, body.language);
  for (const c of consents) {
    await supabase.from('elder_consents').insert({
      elder_id: call.elder_id,
      consent_type: c.type,
      granted: c.granted,
      audio_url: body.audio_clip_url,
      transcript: body.transcript,
      language: body.language,
      call_id: call.id,
    });
  }
}
```

Both gap fixes folded into Task 6.4 — when implementing, include them in the same handler.

**Placeholder scan:** No "TBD" / "TODO" / "implement later" in code blocks. Sarvam endpoint paths are flagged for verification against the capability report (Task 0.2) — that's an explicit, scoped verification, not a placeholder.

**Type consistency:** `Provider`, `ProviderCallConfig`, `ProviderCallHandle` consistent across Tasks 2.1-2.5. `CallBrief`, `ProviderTurnEvent`, `ProviderCallEndEvent` consistent in `_shared/types.ts` and used everywhere. Persona fact types match between `packages/ai/src/extract-persona-facts.ts` and `015_persona_index.sql` (memory/opinion/advice/preference/relationship/event).

---

## Plan complete and saved to `docs/superpowers/plans/2026-05-10-calling-foundation.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — Dispatches a fresh subagent per task, with two-stage review between tasks. Fast iteration, isolated context per task.

2. **Inline Execution** — Executes tasks in this session using executing-plans, batched with checkpoints for review.

Which approach?
