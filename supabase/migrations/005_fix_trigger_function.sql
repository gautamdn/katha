-- Recreate the trigger function with explicit error handling.
-- The previous version may fail silently on type casting issues.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _display_name TEXT;
  _role user_role;
BEGIN
  _display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    split_part(NEW.email, '@', 1)
  );

  BEGIN
    _role := (NEW.raw_user_meta_data->>'role')::user_role;
  EXCEPTION WHEN OTHERS THEN
    _role := 'writer';
  END;

  IF _role IS NULL THEN
    _role := 'writer';
  END IF;

  INSERT INTO public.profiles (id, display_name, role)
  VALUES (NEW.id, _display_name, _role);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
