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
