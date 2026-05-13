CREATE OR REPLACE FUNCTION encrypt_phone(plaintext_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  encryption_key := current_setting('app.phone_encryption_key', true);
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION 'phone_encryption_key not configured';
  END IF;
  RETURN encode(pgp_sym_encrypt(plaintext_phone, encryption_key), 'base64');
END
$$;
