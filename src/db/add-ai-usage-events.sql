-- Tracks OpenAI token usage and estimated cost for the Head of KAM AI cost dashboard.
-- Run this in Supabase SQL Editor before expecting the AI Costs page to show live data.

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'openai',
  feature text not null,
  agent text,
  model text not null,
  account_id text references public.accounts(id) on delete set null,
  requester_profile_id uuid references public.profiles(id) on delete set null,
  requester_name text,
  requester_role text,
  input_tokens integer not null default 0,
  cached_input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  input_cost_usd numeric(12,6) not null default 0,
  cached_input_cost_usd numeric(12,6) not null default 0,
  output_cost_usd numeric(12,6) not null default 0,
  tool_cost_usd numeric(12,6) not null default 0,
  estimated_cost_usd numeric(12,6) not null default 0,
  pricing_known boolean not null default true,
  request_status text not null default 'success',
  pricing_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_usage_events
  add column if not exists requester_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists requester_name text,
  add column if not exists requester_role text;

create index if not exists ai_usage_events_created_at_idx
  on public.ai_usage_events (created_at desc);
create index if not exists ai_usage_events_feature_idx
  on public.ai_usage_events (feature, agent, model);
create index if not exists ai_usage_events_account_idx
  on public.ai_usage_events (account_id);
create index if not exists ai_usage_events_requester_idx
  on public.ai_usage_events (requester_profile_id, requester_role);

alter table public.ai_usage_events enable row level security;

drop policy if exists "Head of KAM can read AI usage events" on public.ai_usage_events;
create policy "Head of KAM can read AI usage events"
  on public.ai_usage_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role::text = 'Head of KAM'
        and p.is_active is not false
    )
  );
