-- ============================================================
-- Fix RLS for escalations tables so Jira import can upsert.
-- Upsert requires SELECT in addition to INSERT/UPDATE.
-- Run once in Supabase SQL Editor.
-- ============================================================

alter table public.escalations enable row level security;
alter table public.escalation_action_items enable row level security;

grant select, insert, update, delete on public.escalations to anon, authenticated;
grant select, insert, update, delete on public.escalation_action_items to anon, authenticated;

-- SELECT (needed by upsert to check row existence)
do $$ begin
  create policy "escalations select"
    on public.escalations for select to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "escalation_action_items select"
    on public.escalation_action_items for select to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;

-- INSERT
do $$ begin
  create policy "escalations insert"
    on public.escalations for insert to anon, authenticated
    with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "escalation_action_items insert"
    on public.escalation_action_items for insert to anon, authenticated
    with check (true);
exception when duplicate_object then null;
end $$;

-- UPDATE
do $$ begin
  create policy "escalations update"
    on public.escalations for update to anon, authenticated
    using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "escalation_action_items update"
    on public.escalation_action_items for update to anon, authenticated
    using (true) with check (true);
exception when duplicate_object then null;
end $$;

-- DELETE
do $$ begin
  create policy "escalations delete"
    on public.escalations for delete to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "escalation_action_items delete"
    on public.escalation_action_items for delete to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;
