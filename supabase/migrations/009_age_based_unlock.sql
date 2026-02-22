-- Age-based capsule unlock function.
-- Joins capsules with children to check if the child has reached the unlock age.
-- Called by a cron job alongside unlock_due_capsules().

CREATE OR REPLACE FUNCTION unlock_age_based_capsules()
RETURNS INTEGER AS $$
DECLARE
  unlocked_count INTEGER;
BEGIN
  UPDATE capsules c
  SET is_unlocked = true
  FROM children ch
  WHERE c.is_unlocked = false
    AND c.is_draft = false
    AND c.unlock_type = 'age'
    AND c.child_id = ch.id
    AND c.unlock_age IS NOT NULL
    AND (ch.date_of_birth + (c.unlock_age || ' years')::interval) <= now();

  GET DIAGNOSTICS unlocked_count = ROW_COUNT;
  RETURN unlocked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
