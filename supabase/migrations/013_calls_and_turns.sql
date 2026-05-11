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
