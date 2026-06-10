-- Migration: add DELETE RLS policy on accounts table
-- Run once in Supabase SQL Editor.
-- Required for Head of KAM to delete accounts via the UI.
-- UI enforces the Head of KAM restriction — DB enforces authenticated-only.

create policy "accounts: authenticated delete"
  on public.accounts for delete
  to authenticated
  using (true);
