-- Run this entire file in Supabase SQL Editor (once) before running npm run seed

-- ── extensions ───────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── enums ─────────────────────────────────────────────────────────────────────
do $$ begin
  create type account_status   as enum ('healthy', 'at-risk', 'critical');
  create type retention_risk   as enum ('Low', 'Medium', 'High');
  create type contract_type    as enum ('Staff Augmented', 'Time Based', 'Retainer', 'Project');
  create type account_tier     as enum ('Enterprise', 'Growth', 'Strategic');
  create type influence_type   as enum ('Champion', 'Decision Maker', 'Influencer', 'Blocker');
  create type health_area      as enum ('relationship', 'project', 'white_space', 'contract', 'csat', 'risk', 'resource', 'financial');
  create type activity_area    as enum ('Relationship', 'Project', 'Resource', 'Financial', 'Profit');
  create type activity_status  as enum ('Open', 'In Progress', 'Done');
  create type rag_status       as enum ('R', 'A', 'G');
  create type priority_level   as enum ('P1', 'P2', 'P3');
  create type notif_type       as enum ('action', 'alert', 'info');
  create type confidence_level as enum ('Low', 'Medium', 'High');
  create type user_role        as enum ('CEO', 'Head of KAM', 'KAM');
exception when duplicate_object then null; end $$;

-- ── profiles ─────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id         uuid primary key,
  name       text not null,
  initials   text not null,
  role       user_role not null default 'KAM',
  email      text,
  created_at timestamptz default now()
);

-- ── accounts ─────────────────────────────────────────────────────────────────
create table if not exists accounts (
  id                   text primary key,
  name                 text not null,
  short_code           text not null,
  industry             text not null,
  tier                 account_tier not null,
  health               numeric not null,
  trend                numeric not null default 0,
  contract_value       bigint not null,
  arr                  bigint not null,
  renewal_days         int not null,
  contract_type        contract_type not null,
  last_touch           text,
  status               account_status not null default 'healthy',
  retention_risk       retention_risk not null default 'Low',
  growth_upside        bigint not null default 0,
  white_space_count    int not null default 0,
  cooperation          numeric,
  service_consumption  numeric,
  meetings_per_month   int,
  contract_compliance  numeric,
  primary_contact_name text,
  primary_contact_role text,
  founded              int,
  employees            text,
  region               text,
  description          text,
  business_info        text,
  client_history       text,
  revenue              text,
  mrr_arr              text,
  is_startup           boolean not null default false,
  engagement_tenure    text,
  team_size            int,
  competitors          text[],
  main_business_flow   text,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- ── stakeholders ──────────────────────────────────────────────────────────────
create table if not exists stakeholders (
  id           uuid primary key default gen_random_uuid(),
  account_id   text not null references accounts(id) on delete cascade,
  name         text not null,
  role         text not null,
  influence    influence_type not null,
  email        text,
  last_contact text,
  created_at   timestamptz default now()
);

-- ── health_scores ─────────────────────────────────────────────────────────────
create table if not exists health_scores (
  id         uuid primary key default gen_random_uuid(),
  account_id text not null references accounts(id) on delete cascade,
  area       health_area not null,
  score      numeric not null,
  updated_at timestamptz default now(),
  unique (account_id, area)
);

-- ── health_metrics ────────────────────────────────────────────────────────────
create table if not exists health_metrics (
  id              uuid primary key default gen_random_uuid(),
  health_score_id uuid not null references health_scores(id) on delete cascade,
  label           text not null,
  value           numeric not null,
  hint            text
);

-- ── contract_details ──────────────────────────────────────────────────────────
create table if not exists contract_details (
  id                 uuid primary key default gen_random_uuid(),
  account_id         text not null unique references accounts(id) on delete cascade,
  type               text,
  duration           text,
  auto_renew         boolean default false,
  non_terminator     boolean default false,
  min_one_year       boolean default false,
  price_hike         text,
  swot_s             text,
  swot_w             text,
  swot_o             text,
  swot_t             text,
  customer_feedback  text,
  backup_exists      boolean default false,
  leaves_this_month  int default 0,
  critical_resources int default 0,
  updated_at         timestamptz default now()
);

-- ── activities ────────────────────────────────────────────────────────────────
create table if not exists activities (
  id            text primary key,
  account_id    text not null references accounts(id) on delete cascade,
  area          activity_area not null,
  title         text not null,
  owner         text,
  due           text,
  status        activity_status not null default 'Open',
  rag           rag_status not null default 'G',
  expected_lift text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── retention_growth ─────────────────────────────────────────────────────────
create table if not exists retention_growth (
  id            uuid primary key default gen_random_uuid(),
  account_id    text not null references accounts(id) on delete cascade,
  service       text not null,
  offered       boolean not null default false,
  delivered     boolean not null default false,
  applicable    boolean not null default true,
  tracking_note text
);

-- ── education_log ─────────────────────────────────────────────────────────────
create table if not exists education_log (
  id         uuid primary key default gen_random_uuid(),
  account_id text not null references accounts(id) on delete cascade,
  date       text not null,
  topic      text not null,
  approach   text,
  outcome    text,
  created_at timestamptz default now()
);

-- ── escalations ───────────────────────────────────────────────────────────────
create table if not exists escalations (
  id                   text primary key,
  account_id           text not null references accounts(id) on delete cascade,
  title                text not null,
  priority             priority_level not null default 'P3',
  sla_remaining_hours  numeric,
  opened_at            text,
  rca                  text,
  description          text,
  recommendation       text,
  realistic_check      text,
  client_feedback      text,
  stakeholders         text[],
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- ── escalation_action_items ───────────────────────────────────────────────────
create table if not exists escalation_action_items (
  id            uuid primary key default gen_random_uuid(),
  escalation_id text not null references escalations(id) on delete cascade,
  label         text not null,
  done          boolean not null default false
);

-- ── opportunities ─────────────────────────────────────────────────────────────
create table if not exists opportunities (
  id          text primary key,
  account_id  text not null references accounts(id) on delete cascade,
  title       text not null,
  source      text,
  signal_date text,
  potential   bigint,
  confidence  confidence_level not null default 'Medium',
  next_step   text,
  created_at  timestamptz default now()
);

-- ── notifications ─────────────────────────────────────────────────────────────
create table if not exists notifications (
  id         text primary key,
  title      text not null,
  body       text,
  account_id text references accounts(id) on delete set null,
  time       text,
  type       notif_type not null default 'info',
  read       boolean not null default false,
  created_at timestamptz default now()
);

-- ── RLS: disable for now (anon key has full access for seeding) ───────────────
alter table profiles               disable row level security;
alter table accounts               disable row level security;
alter table stakeholders           disable row level security;
alter table health_scores          disable row level security;
alter table health_metrics         disable row level security;
alter table contract_details       disable row level security;
alter table activities             disable row level security;
alter table retention_growth       disable row level security;
alter table education_log          disable row level security;
alter table escalations            disable row level security;
alter table escalation_action_items disable row level security;
alter table opportunities          disable row level security;
alter table notifications          disable row level security;
