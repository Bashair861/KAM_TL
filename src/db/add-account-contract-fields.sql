-- Adds account-level contract duration and renewal date fields, with matching
-- contract_details references for contract views.

alter table accounts
  add column if not exists renewal_date date,
  add column if not exists contract_duration text;

alter table contract_details
  add column if not exists renewal_date date;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'accounts'
      and column_name = 'renewal_days'
  ) then
    update accounts
    set renewal_date = (current_date + renewal_days)::date
    where renewal_date is null
      and renewal_days is not null;

    alter table accounts alter column renewal_days drop not null;
  end if;
end $$;

update accounts a
set contract_duration = cd.duration
from contract_details cd
where cd.account_id = a.id
  and a.contract_duration is null
  and cd.duration is not null;

update contract_details cd
set
  duration = coalesce(cd.duration, a.contract_duration),
  renewal_date = coalesce(cd.renewal_date, a.renewal_date)
from accounts a
where a.id = cd.account_id
  and (
    (cd.duration is null and a.contract_duration is not null)
    or (cd.renewal_date is null and a.renewal_date is not null)
  );

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
