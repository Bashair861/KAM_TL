-- ============================================================
-- add-kam-assignment.sql
-- Run in Supabase SQL Editor ONCE.
-- Adds assigned_kam_id to accounts + sets initial assignments.
-- ============================================================

-- 1. Add column (safe to re-run)
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS assigned_kam_id uuid REFERENCES public.profiles(id);

-- 2. Initial KAM assignments
--    Julian Drake (Head of KAM): axiom, cloudpeak, northwind
--    Maya Lin (KAM):             starlight, vertex
UPDATE public.accounts
  SET assigned_kam_id = '00000000-0000-0000-0000-000000000001'
  WHERE id IN ('axiom', 'cloudpeak', 'northwind');

UPDATE public.accounts
  SET assigned_kam_id = '00000000-0000-0000-0000-000000000002'
  WHERE id IN ('starlight', 'vertex');

-- 3. RLS UPDATE policy so authenticated users can reassign KAMs
DO $$ BEGIN
  CREATE POLICY "authenticated can update accounts"
    ON public.accounts FOR UPDATE TO authenticated
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Verify
SELECT id, name, assigned_kam_id FROM public.accounts ORDER BY id;
