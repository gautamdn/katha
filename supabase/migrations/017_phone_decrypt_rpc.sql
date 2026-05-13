-- Phone decrypt RPC, service-role-only.
-- Phones are stored as base64-encoded pgp_sym_encrypt output (from encrypt_phone RPC, Task 9.1).
-- decode(encrypted, 'base64') converts the base64 text back to bytea before decryption.
--
-- Requires app.phone_encryption_key GUC set per environment:
--   ALTER DATABASE postgres SET app.phone_encryption_key = '<key>';

CREATE OR REPLACE FUNCTION get_elder_phone_e164(elder_id_arg UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encrypted TEXT;
  decryption_key TEXT;
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  decryption_key := current_setting('app.phone_encryption_key', true);
  IF decryption_key IS NULL OR decryption_key = '' THEN
    RAISE EXCEPTION 'phone_encryption_key not configured';
  END IF;

  SELECT phone_number_encrypted INTO encrypted FROM elders WHERE id = elder_id_arg;
  IF encrypted IS NULL THEN RETURN NULL; END IF;

  RETURN pgp_sym_decrypt(decode(encrypted, 'base64'), decryption_key);
END
$$;
