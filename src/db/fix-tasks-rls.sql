-- ============================================================
-- Enable write access on tasks table for Jira escalation import.
-- Run once in Supabase SQL Editor.
-- ============================================================

alter table public.tasks enable row level security;

grant select, insert, update, delete on public.tasks to anon, authenticated;

do $$ begin
  create policy "tasks select"
    on public.tasks for select to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "tasks insert"
    on public.tasks for insert to anon, authenticated
    with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "tasks update"
    on public.tasks for update to anon, authenticated
    using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "tasks delete"
    on public.tasks for delete to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;
