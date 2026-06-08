-- Ensures Supabase has the target columns used by Salesforce Account-object sync.
-- Run in Supabase SQL Editor after creating the matching Salesforce Account fields.

begin;

alter table public.accounts
  add column if not exists contract_value bigint,
  add column if not exists arr bigint,
  add column if not exists renewal_date date,
  add column if not exists contract_type contract_type,
  add column if not exists last_touch text,
  add column if not exists primary_contact_name text,
  add column if not exists primary_contact_role text,
  add column if not exists contract_duration text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'accounts'
      and column_name = 'renewal_days'
  ) then
    update public.accounts
    set renewal_date = (current_date + renewal_days)::date
    where renewal_date is null
      and renewal_days is not null;

    alter table public.accounts alter column renewal_days drop not null;
  end if;
end $$;

alter table public.contract_details
  add column if not exists type text,
  add column if not exists duration text,
  add column if not exists renewal_date date,
  add column if not exists auto_renew boolean default false,
  add column if not exists non_terminator boolean default false,
  add column if not exists min_one_year boolean default false,
  add column if not exists price_hike text,
  add column if not exists backup_exists boolean default false,
  add column if not exists critical_resources int default 0,
  add column if not exists customer_feedback text;

alter table public.retention_growth
  add column if not exists service text,
  add column if not exists offered boolean default false,
  add column if not exists delivered boolean default false;

create index if not exists retention_growth_account_service_idx
  on public.retention_growth (account_id, service);

do $$ begin
  create policy "authenticated can insert contract details"
    on public.contract_details for insert to authenticated
    with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated can update contract details"
    on public.contract_details for update to authenticated
    using (true)
    with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated can insert retention growth"
    on public.retention_growth for insert to authenticated
    with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated can update retention growth"
    on public.retention_growth for update to authenticated
    using (true)
    with check (true);
exception when duplicate_object then null;
end $$;

commit;
