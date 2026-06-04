-- Migration: create tasks table
-- Run once in Supabase SQL Editor

-- ── enum ──────────────────────────────────────────────────────────────────────
do $$ begin
  create type task_type as enum ('Informational', 'Action Item');
exception when duplicate_object then null; end $$;

-- ── table ─────────────────────────────────────────────────────────────────────
create table if not exists tasks (
  id                uuid        primary key default gen_random_uuid(),
  name              text        not null,
  description       text,
  type              task_type   not null,

  -- Relationship: account (TEXT — accounts.id uses text slugs, not uuid)
  account_id        text        references accounts(id) on delete cascade,

  -- Relationship: escalation (TEXT — escalations.id uses text slugs, not uuid)
  escalation_id     text        references escalations(id) on delete set null,

  -- Relationship: health metric (UUID — health_metrics.id is uuid)
  health_metric_id  uuid        references health_metrics(id) on delete set null,

  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ── indexes ───────────────────────────────────────────────────────────────────
create index if not exists tasks_account_id_idx       on tasks(account_id);
create index if not exists tasks_escalation_id_idx    on tasks(escalation_id);
create index if not exists tasks_health_metric_id_idx on tasks(health_metric_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table tasks enable row level security;

-- Anyone authenticated (or anon) can read tasks
create policy "tasks: public read"
  on tasks for select
  using (true);

-- Authenticated users can insert tasks
create policy "tasks: authenticated insert"
  on tasks for insert
  to authenticated
  with check (true);

-- Authenticated users can update tasks
create policy "tasks: authenticated update"
  on tasks for update
  to authenticated
  using (true);

-- Authenticated users can delete tasks
create policy "tasks: authenticated delete"
  on tasks for delete
  to authenticated
  using (true);
