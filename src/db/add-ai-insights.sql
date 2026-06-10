-- Optional Phase 4 migration: persist AI recommendations and roadmap runs.
-- Run this in Supabase SQL Editor when you want Ask AI results to be saved.

do $$ begin
  create type ai_insight_scope as enum ('account', 'portfolio', 'retention', 'growth');
  create type ai_risk_level as enum ('low', 'medium', 'high', 'critical');
  create type ai_insight_status as enum ('draft', 'accepted', 'dismissed', 'converted_to_action');
exception when duplicate_object then null; end $$;

create table if not exists ai_insights (
  id uuid primary key default gen_random_uuid(),
  scope ai_insight_scope not null default 'account',
  account_id text references accounts(id) on delete cascade,
  requested_by uuid references profiles(id) on delete set null,
  prompt text not null,
  focus text not null default 'roadmap',
  timeframe text not null default '30_days',
  summary text,
  risk_level ai_risk_level not null default 'medium',
  confidence numeric,
  model text,
  source text,
  response jsonb not null default '{}'::jsonb,
  context_summary jsonb not null default '{}'::jsonb,
  status ai_insight_status not null default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists ai_insights_account_idx on ai_insights(account_id);
create index if not exists ai_insights_scope_idx on ai_insights(scope);
create index if not exists ai_insights_requested_by_idx on ai_insights(requested_by);
create index if not exists ai_insights_created_at_idx on ai_insights(created_at desc);
create index if not exists ai_insights_account_focus_status_idx
  on ai_insights(account_id, focus, status);

alter table ai_insights enable row level security;

grant select, insert, update, delete on ai_insights to anon, authenticated;

drop policy if exists "ai insights read" on ai_insights;
create policy "ai insights read" on ai_insights
  for select
  to anon, authenticated
  using (true);

drop policy if exists "ai insights insert" on ai_insights;
create policy "ai insights insert" on ai_insights
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "ai insights update" on ai_insights;
create policy "ai insights update" on ai_insights
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "ai insights delete" on ai_insights;
create policy "ai insights delete" on ai_insights
  for delete
  to anon, authenticated
  using (true);
