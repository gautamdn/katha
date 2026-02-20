-- Fix: RLS policies on profiles self-reference the profiles table,
-- causing "infinite recursion detected in policy for relation profiles".
--
-- Solution: Create a SECURITY DEFINER helper function to get the current
-- user's family_id without triggering RLS, then use it in policies.

-- Helper: get current user's family_id (bypasses RLS)
CREATE OR REPLACE FUNCTION get_my_family_id()
RETURNS UUID AS $$
  SELECT family_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Drop the recursive policies
DROP POLICY IF EXISTS "Family members can view profiles" ON profiles;
DROP POLICY IF EXISTS "Family members can view their family" ON families;
DROP POLICY IF EXISTS "Family members can view children" ON children;
DROP POLICY IF EXISTS "Family can view unlocked capsules" ON capsules;
DROP POLICY IF EXISTS "Family can view capsule photos" ON capsule_photos;
DROP POLICY IF EXISTS "Family can view reactions" ON reactions;

-- Users can always view their own profile (even before joining a family)
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

-- Family members can view each other's profiles (non-recursive)
CREATE POLICY "Family members can view profiles" ON profiles
  FOR SELECT USING (
    family_id IS NOT NULL AND family_id = get_my_family_id()
  );

-- Families: members can read their own family (non-recursive)
CREATE POLICY "Family members can view their family" ON families
  FOR SELECT USING (id = get_my_family_id());

-- Children: family members can view (non-recursive)
CREATE POLICY "Family members can view children" ON children
  FOR SELECT USING (family_id = get_my_family_id());

-- Capsules: family members can read unlocked (non-recursive)
CREATE POLICY "Family can view unlocked capsules" ON capsules
  FOR SELECT USING (
    family_id = get_my_family_id()
    AND is_draft = false
    AND (is_unlocked = true OR writer_id = auth.uid())
  );

-- Photos: follow capsule access (non-recursive)
CREATE POLICY "Family can view capsule photos" ON capsule_photos
  FOR SELECT USING (
    capsule_id IN (
      SELECT id FROM capsules
      WHERE family_id = get_my_family_id()
        AND is_draft = false AND is_unlocked = true
    )
  );

-- Reactions: family members can view (non-recursive)
CREATE POLICY "Family can view reactions" ON reactions
  FOR SELECT USING (
    capsule_id IN (
      SELECT id FROM capsules
      WHERE family_id = get_my_family_id()
    )
  );
