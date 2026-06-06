-- Optional calendar integration migration.
-- Run this in Supabase SQL Editor before using the dashboard Connect calendar button.
--
-- Token note:
-- This MVP stores Google OAuth tokens server-side and keeps RLS enabled with no
-- browser-readable policies. In production, add database-level encryption
-- through Supabase Vault/pgsodium or an equivalent secrets layer.

create table if not exists calendar_connections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  provider text not null default 'google',
  provider_account_id text,
  email text not null,
  display_name text,
  calendar_id text not null default 'primary',
  calendar_label text not null default 'Primary calendar',
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  connected boolean not null default true,
  sync_status text not null default 'connected',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, provider, email, calendar_id)
);

create table if not exists calendar_oauth_states (
  id uuid primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  redirect_origin text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists calendar_connections_profile_idx
  on calendar_connections(profile_id);

create index if not exists calendar_connections_provider_idx
  on calendar_connections(provider);

create index if not exists calendar_oauth_states_profile_idx
  on calendar_oauth_states(profile_id);

create index if not exists calendar_oauth_states_expires_idx
  on calendar_oauth_states(expires_at);

alter table calendar_connections enable row level security;
alter table calendar_oauth_states enable row level security;

-- Intentionally no public RLS policies:
-- calendar token rows should only be accessed through server functions using
-- SUPABASE_SERVICE_ROLE_KEY.
