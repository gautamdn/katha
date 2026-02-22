-- Update capsule SELECT policy so locked non-surprise capsules
-- are visible to family members (sealed envelope in feed).
-- Previously only unlocked capsules + writer's own were visible.

DROP POLICY IF EXISTS "Family can view unlocked capsules" ON capsules;
DROP POLICY IF EXISTS "Family can view visible capsules" ON capsules;

CREATE POLICY "Family can view visible capsules" ON capsules
  FOR SELECT USING (
    family_id = get_my_family_id()
    AND is_draft = false
    AND (
      is_unlocked = true
      OR writer_id = auth.uid()
      OR (is_unlocked = false AND is_surprise = false)
    )
  );
