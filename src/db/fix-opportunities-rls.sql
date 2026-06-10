-- Fix RLS for Opportunity tab summary scans and opportunity action workflows.
-- Run once in Supabase SQL Editor.

alter table public.opportunities enable row level security;

grant select, insert, update, delete on public.opportunities to anon, authenticated;

drop policy if exists "opportunities select" on public.opportunities;
create policy "opportunities select"
  on public.opportunities
  for select
  to anon, authenticated
  using (true);

drop policy if exists "opportunities insert" on public.opportunities;
create policy "opportunities insert"
  on public.opportunities
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "opportunities update" on public.opportunities;
create policy "opportunities update"
  on public.opportunities
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "opportunities delete" on public.opportunities;
create policy "opportunities delete"
  on public.opportunities
  for delete
  to anon, authenticated
  using (true);
