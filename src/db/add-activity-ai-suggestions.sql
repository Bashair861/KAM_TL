create table if not exists activity_ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  requested_by text,
  source_id text,
  title text not null,
  description text default '',
  health_area text default '',
  expected_lift text default '',
  reason text default '',
  source_reference text default '',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table activity_ai_suggestions
  add column if not exists account_id text,
  add column if not exists requested_by text,
  add column if not exists source_id text,
  add column if not exists title text,
  add column if not exists description text default '',
  add column if not exists health_area text default '',
  add column if not exists expected_lift text default '',
  add column if not exists reason text default '',
  add column if not exists source_reference text default '',
  add column if not exists status text not null default 'draft',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table activity_ai_suggestions
  alter column account_id type text using account_id::text,
  alter column requested_by type text using requested_by::text,
  alter column source_id type text using source_id::text,
  alter column title type text using title::text,
  alter column description type text using description::text,
  alter column health_area type text using health_area::text,
  alter column expected_lift type text using expected_lift::text,
  alter column reason type text using reason::text,
  alter column source_reference type text using source_reference::text,
  alter column status type text using status::text;

alter table activity_ai_suggestions
  drop constraint if exists activity_ai_suggestions_status_check;

alter table activity_ai_suggestions
  add constraint activity_ai_suggestions_status_check
  check (status in ('draft', 'converted_to_action', 'dismissed'));

create index if not exists activity_ai_suggestions_account_idx
  on activity_ai_suggestions(account_id);

create index if not exists activity_ai_suggestions_requested_by_idx
  on activity_ai_suggestions(requested_by);

create index if not exists activity_ai_suggestions_status_idx
  on activity_ai_suggestions(status);

create index if not exists activity_ai_suggestions_account_status_idx
  on activity_ai_suggestions(account_id, status);

alter table activity_ai_suggestions enable row level security;

grant select, insert, update, delete on activity_ai_suggestions to anon, authenticated;

drop policy if exists "activity ai suggestions read" on activity_ai_suggestions;
create policy "activity ai suggestions read" on activity_ai_suggestions
  for select
  to anon, authenticated
  using (true);

drop policy if exists "activity ai suggestions insert" on activity_ai_suggestions;
create policy "activity ai suggestions insert" on activity_ai_suggestions
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "activity ai suggestions update" on activity_ai_suggestions;
create policy "activity ai suggestions update" on activity_ai_suggestions
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "activity ai suggestions delete" on activity_ai_suggestions;
create policy "activity ai suggestions delete" on activity_ai_suggestions
  for delete
  to anon, authenticated
  using (true);
