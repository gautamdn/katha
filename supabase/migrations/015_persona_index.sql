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
