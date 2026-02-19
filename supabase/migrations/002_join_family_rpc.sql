-- Allow users to look up a family by invite code before they are a member.
-- SECURITY DEFINER bypasses RLS (which otherwise requires family membership for SELECT).
-- Returns only id and name to minimize data exposure.

CREATE OR REPLACE FUNCTION lookup_family_by_invite_code(code TEXT)
RETURNS TABLE (id UUID, name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT f.id, f.name
  FROM families f
  WHERE f.invite_code = code
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
