-- 021_phone_crypto_key_param.sql
-- Refactor phone encrypt/decrypt RPCs to accept the encryption key as a parameter
-- instead of reading it from an app.phone_encryption_key GUC.
--
-- Why: Supabase's managed Postgres restricts `ALTER DATABASE ... SET app.*` even
-- for the project's `postgres` user (only `supabase_admin` is allowed). The
-- original Plan 1 design (migrations 017 + 019) assumed a database-resident key
-- via GUC; that approach is unworkable on managed Supabase. Discovered during
-- Plan 1 validation (2026-05-13).
--
-- Trade-off: the key now travels over the wire on every RPC call (inside the
-- TLS-encrypted service-role connection) instead of resting in the DB.
-- Operationally simpler — rotation is just an env var change, no DB superuser
-- needed. For production-grade key custody, upgrade to Supabase Vault later.

CREATE OR REPLACE FUNCTION encrypt_phone(plaintext_phone TEXT, encryption_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION 'encryption_key parameter required';
  END IF;
  RETURN encode(pgp_sym_encrypt(plaintext_phone, encryption_key), 'base64');
END
$$;

CREATE OR REPLACE FUNCTION get_elder_phone_e164(elder_id_arg UUID, encryption_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  encrypted TEXT;
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION 'encryption_key parameter required';
  END IF;
  SELECT phone_number_encrypted INTO encrypted FROM elders WHERE id = elder_id_arg;
  IF encrypted IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_decrypt(decode(encrypted, 'base64'), encryption_key);
END
$$;

-- Drop the no-key-parameter versions from migrations 017 + 019 to avoid
-- ambiguous-overload errors.
DROP FUNCTION IF EXISTS encrypt_phone(TEXT);
DROP FUNCTION IF EXISTS get_elder_phone_e164(UUID);
