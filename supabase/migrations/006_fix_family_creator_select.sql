-- Fix: After INSERT into families, the chained .select() fails because
-- the user's profile.family_id is still NULL (not yet linked).
-- The existing SELECT policy only allows family members (by family_id),
-- so the creator can't read back the row they just inserted.
--
-- Solution: Allow the creator to always see their family.

CREATE POLICY "Creators can view own family" ON families
  FOR SELECT USING (created_by = auth.uid());
