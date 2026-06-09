-- Fix RLS for Score Marking Metrics snapshot saves.
-- The app uses upsert on activity_score_history, so existing rows need UPDATE access.
-- Run once in Supabase SQL Editor.

alter table public.activity_score_history enable row level security;

grant select, insert, update, delete on public.activity_score_history to anon, authenticated;

drop policy if exists "activity_score_history select" on public.activity_score_history;
create policy "activity_score_history select"
  on public.activity_score_history
  for select
  to anon, authenticated
  using (true);

drop policy if exists "activity_score_history insert" on public.activity_score_history;
create policy "activity_score_history insert"
  on public.activity_score_history
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "activity_score_history update" on public.activity_score_history;
create policy "activity_score_history update"
  on public.activity_score_history
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "activity_score_history delete" on public.activity_score_history;
create policy "activity_score_history delete"
  on public.activity_score_history
  for delete
  to anon, authenticated
  using (true);
