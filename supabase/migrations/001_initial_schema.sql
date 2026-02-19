-- Katha: Initial Database Schema
-- Run with: npx supabase db push

-- ─── Enums ───────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('guardian', 'writer', 'reader');
CREATE TYPE unlock_type AS ENUM ('immediate', 'date', 'age', 'milestone');

-- ─── Families ────────────────────────────────────────────
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL DEFAULT substr(md5(random()::text), 1, 8),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Profiles ────────────────────────────────────────────
-- Extends auth.users with app-specific data
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'writer',
  relationship_label TEXT, -- "Nani", "Dada", "Mom", etc.
  language_preferences TEXT[] DEFAULT '{}',
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Children ────────────────────────────────────────────
CREATE TABLE children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Capsules ────────────────────────────────────────────
CREATE TABLE capsules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  writer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id UUID REFERENCES children(id) ON DELETE SET NULL, -- null = for all children

  -- Content
  raw_text TEXT NOT NULL,
  polished_text TEXT,
  audio_url TEXT,
  audio_duration_seconds INTEGER,

  -- AI-generated metadata
  title TEXT,
  excerpt TEXT,
  category TEXT,
  mood TEXT,
  read_time_minutes INTEGER,

  -- Time capsule settings
  unlock_type unlock_type NOT NULL DEFAULT 'immediate',
  unlock_date TIMESTAMPTZ,
  unlock_age INTEGER CHECK (unlock_age > 0 AND unlock_age <= 100),
  unlock_milestone TEXT,
  is_surprise BOOLEAN NOT NULL DEFAULT false,
  is_unlocked BOOLEAN NOT NULL DEFAULT false,

  -- Meta
  is_private BOOLEAN NOT NULL DEFAULT false,
  is_draft BOOLEAN NOT NULL DEFAULT true,
  language TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

-- ─── Capsule Photos ──────────────────────────────────────
CREATE TABLE capsule_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capsule_id UUID NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  display_order INTEGER NOT NULL DEFAULT 0
);

-- ─── Reactions ───────────────────────────────────────────
CREATE TABLE reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capsule_id UUID NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(capsule_id, user_id) -- One reaction per user per capsule
);

-- ─── Prompt History ──────────────────────────────────────
CREATE TABLE prompt_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  writer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  category TEXT,
  was_used BOOLEAN NOT NULL DEFAULT false,
  shown_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

-- ─── Indexes ─────────────────────────────────────────────
CREATE INDEX idx_profiles_family ON profiles(family_id);
CREATE INDEX idx_children_family ON children(family_id);
CREATE INDEX idx_capsules_family ON capsules(family_id);
CREATE INDEX idx_capsules_writer ON capsules(writer_id);
CREATE INDEX idx_capsules_child ON capsules(child_id);
CREATE INDEX idx_capsules_published ON capsules(published_at) WHERE is_draft = false;
CREATE INDEX idx_capsules_unlock ON capsules(unlock_date) WHERE is_unlocked = false;
CREATE INDEX idx_capsule_photos_capsule ON capsule_photos(capsule_id);
CREATE INDEX idx_reactions_capsule ON reactions(capsule_id);
CREATE INDEX idx_prompt_history_writer ON prompt_history(writer_id);

-- ─── Row Level Security ──────────────────────────────────
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE capsules ENABLE ROW LEVEL SECURITY;
ALTER TABLE capsule_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_history ENABLE ROW LEVEL SECURITY;

-- Families: members can read their own family
CREATE POLICY "Family members can view their family" ON families
  FOR SELECT USING (
    id IN (SELECT family_id FROM profiles WHERE profiles.id = auth.uid())
  );

CREATE POLICY "Users can create families" ON families
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- Profiles: family members can see each other
CREATE POLICY "Family members can view profiles" ON profiles
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- Children: family members can view, guardians can manage
CREATE POLICY "Family members can view children" ON children
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM profiles WHERE profiles.id = auth.uid())
  );

CREATE POLICY "Guardians can manage children" ON children
  FOR ALL USING (
    family_id IN (
      SELECT family_id FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'guardian'
    )
  );

-- Capsules: family members can read unlocked, writers can manage own
CREATE POLICY "Family can view unlocked capsules" ON capsules
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM profiles WHERE profiles.id = auth.uid())
    AND is_draft = false
    AND (is_unlocked = true OR writer_id = auth.uid())
  );

CREATE POLICY "Writers can manage own capsules" ON capsules
  FOR ALL USING (writer_id = auth.uid());

-- Photos: follow capsule access
CREATE POLICY "Family can view capsule photos" ON capsule_photos
  FOR SELECT USING (
    capsule_id IN (
      SELECT id FROM capsules 
      WHERE family_id IN (SELECT family_id FROM profiles WHERE profiles.id = auth.uid())
      AND is_draft = false AND is_unlocked = true
    )
  );

CREATE POLICY "Writers can manage own capsule photos" ON capsule_photos
  FOR ALL USING (
    capsule_id IN (SELECT id FROM capsules WHERE writer_id = auth.uid())
  );

-- Reactions: family members can react
CREATE POLICY "Family can view reactions" ON reactions
  FOR SELECT USING (
    capsule_id IN (
      SELECT id FROM capsules 
      WHERE family_id IN (SELECT family_id FROM profiles WHERE profiles.id = auth.uid())
    )
  );

CREATE POLICY "Users can manage own reactions" ON reactions
  FOR ALL USING (user_id = auth.uid());

-- Prompt history: writers can see their own
CREATE POLICY "Writers can view own prompts" ON prompt_history
  FOR SELECT USING (writer_id = auth.uid());

CREATE POLICY "Writers can manage own prompts" ON prompt_history
  FOR ALL USING (writer_id = auth.uid());

-- ─── Auto-create profile on signup ──────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'writer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Auto-unlock capsules (run via cron/scheduled function) ──
CREATE OR REPLACE FUNCTION unlock_due_capsules()
RETURNS INTEGER AS $$
DECLARE
  unlocked_count INTEGER;
BEGIN
  UPDATE capsules
  SET is_unlocked = true
  WHERE is_unlocked = false
    AND is_draft = false
    AND unlock_type = 'date'
    AND unlock_date <= now();
  
  GET DIAGNOSTICS unlocked_count = ROW_COUNT;
  RETURN unlocked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
