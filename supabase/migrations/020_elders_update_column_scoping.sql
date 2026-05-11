-- 020_elders_update_column_scoping.sql
-- Tighten elders UPDATE policy: family members can update only safe fields.
-- Sensitive fields (voiceprint, phone_number_encrypted, phone_number_hash, status,
-- family_intro_audio_url) require service role.

DROP POLICY IF EXISTS "Family members can update their elders" ON elders;

CREATE POLICY "Family members can update non-sensitive elder fields"
  ON elders FOR UPDATE
  USING (family_id = get_my_family_id())
  WITH CHECK (family_id = get_my_family_id());

-- Column-level grants: revoke broad UPDATE from authenticated, grant only safe columns.
REVOKE UPDATE ON elders FROM authenticated;
GRANT UPDATE (
  display_name,
  relationship_label,
  preferred_name,
  language,
  call_cadence_days,
  preferred_call_time,
  preferred_call_day,
  timezone
) ON elders TO authenticated;
