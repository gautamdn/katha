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
  relationship_label TEXT NOT NULL,
  preferred_name TEXT,
  language TEXT NOT NULL CHECK (language IN ('kn', 'gu', 'en', 'hi')),
  phone_number_encrypted TEXT NOT NULL,
  phone_number_hash TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL CHECK (country IN ('IN', 'US')),
  timezone TEXT NOT NULL,
  added_by UUID NOT NULL REFERENCES profiles(id),
  voiceprint JSONB,
  voiceprint_enrolled_at TIMESTAMPTZ,
  status elder_status NOT NULL DEFAULT 'pending_first_call',
  family_intro_audio_url TEXT,
  call_cadence_days INT DEFAULT 7,
  preferred_call_time TIME,
  preferred_call_day INT,
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
  audio_url TEXT,
  transcript TEXT,
  language TEXT NOT NULL,
  call_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_elder_consents_elder_id ON elder_consents(elder_id);
CREATE INDEX idx_elder_consents_type ON elder_consents(elder_id, consent_type);

ALTER TABLE elders ENABLE ROW LEVEL SECURITY;
ALTER TABLE elder_consents ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Service role only insert consents"
  ON elder_consents FOR INSERT
  WITH CHECK (false);

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

CREATE EXTENSION IF NOT EXISTS pgcrypto;
