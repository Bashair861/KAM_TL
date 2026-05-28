-- ============================================================
-- setup-auth.sql
-- Run this AFTER creating auth users in Supabase Dashboard
-- (Authentication → Users → Add user)
-- ============================================================

-- Step 1: Trigger — auto-creates a profile row whenever a new
--         auth user signs up. Falls back to email-derived name
--         so it works for any future user additions too.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
  _initials text;
BEGIN
  -- Derive a display name from email prefix (e.g. "julian.drake" → "Julian Drake")
  _name := initcap(replace(split_part(new.email, '@', 1), '.', ' '));
  -- Build initials from first letters of each word (max 2)
  _initials := upper(
    substring(_name, 1, 1) ||
    coalesce(substring(_name from '(?i) ([a-z])'), '')
  );

  INSERT INTO public.profiles (id, name, initials, role, email)
  VALUES (new.id, _name, _initials, 'KAM', new.email)
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

-- Drop trigger first so this script is re-runnable
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- Step 2: After creating users in the Supabase Dashboard, run
--         the UPDATE statements below to give them the correct
--         names, initials, and roles from the seed data.
--
--         Replace the emails if you used different ones.
-- ============================================================

-- Julian Drake — Head of KAM (read + write, all accounts)
UPDATE public.profiles
SET    name     = 'Julian Drake',
       initials = 'JD',
       role     = 'Head of KAM'
WHERE  email    = 'julian@aether.io';

-- Maya Lin — KAM (read + write, own accounts)
UPDATE public.profiles
SET    name     = 'Maya Lin',
       initials = 'ML',
       role     = 'KAM'
WHERE  email    = 'maya@aether.io';

-- Bashair Ahmad — KAM (read + write, own accounts)
UPDATE public.profiles
SET    name     = 'Bashair Ahmad',
       initials = 'BA',
       role     = 'KAM'
WHERE  email    = 'bashair@aether.io';


-- ============================================================
-- Step 3 (optional): Verify the profiles were updated
-- ============================================================
SELECT id, name, initials, role, email FROM public.profiles;
