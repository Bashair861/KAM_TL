-- Creates contract renewal notifications when accounts.renewal_date enters
-- the 30-day, 7-day, or renewal-day window.
-- Safe to run multiple times in Supabase SQL Editor.

begin;

alter table public.notifications
  add column if not exists recipient_profile_id uuid references public.profiles(id) on delete cascade,
  add column if not exists notification_key text,
  add column if not exists badge_key text,
  add column if not exists target_path text,
  add column if not exists read_at timestamptz;

create unique index if not exists notifications_recipient_key_idx
  on public.notifications (recipient_profile_id, notification_key);

create index if not exists notifications_recipient_read_idx
  on public.notifications (recipient_profile_id, read_at, created_at desc);

create index if not exists notifications_recipient_badge_idx
  on public.notifications (recipient_profile_id, badge_key, read_at);

create or replace function public.create_contract_renewal_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  days_left int;
  renewal_title text;
begin
  if new.renewal_date is null then
    if tg_op = 'UPDATE' and old.renewal_date is not null then
      update public.notifications
      set read = true,
          read_at = coalesce(read_at, now())
      where account_id = new.id
        and notification_key like ('contract-renewal:' || new.id || ':%')
        and read = false;
    end if;
    return new;
  end if;

  days_left := new.renewal_date - current_date;

  if tg_op = 'UPDATE'
    and (
      old.renewal_date is distinct from new.renewal_date
      or old.assigned_kam_id is distinct from new.assigned_kam_id
    )
  then
    update public.notifications
    set read = true,
        read_at = coalesce(read_at, now())
    where account_id = new.id
      and notification_key like ('contract-renewal:' || new.id || ':%')
      and read = false;
  end if;

  if days_left not in (30, 7, 0) then
    return new;
  end if;

  renewal_title := case
    when days_left = 0 then 'Contract renewal today: ' || coalesce(new.name, 'Account')
    when days_left = 7 then 'Contract renewal in 7 days: ' || coalesce(new.name, 'Account')
    else 'Contract renewal in 30 days: ' || coalesce(new.name, 'Account')
  end;

  insert into public.notifications (
    id,
    recipient_profile_id,
    notification_key,
    badge_key,
    target_path,
    title,
    body,
    account_id,
    time,
    type,
    read,
    read_at,
    created_at
  )
  select
    gen_random_uuid()::text,
    p.id,
    'contract-renewal:' || new.id || ':' || days_left || ':' || new.renewal_date || ':' || p.id,
    null,
    '/accounts/' || new.id,
    renewal_title,
    'Review the contract before the renewal window closes.',
    new.id,
    'Just now',
    'alert'::public.notif_type,
    false,
    null,
    now()
  from public.profiles p
  where p.is_active is distinct from false
    and (
      p.role::text = 'Head of KAM'
      or (p.role::text = 'KAM' and p.id = new.assigned_kam_id)
    )
  on conflict (recipient_profile_id, notification_key)
  do update set
    title = excluded.title,
    body = excluded.body,
    target_path = excluded.target_path,
    account_id = excluded.account_id,
    time = excluded.time,
    type = excluded.type,
    read = false,
    read_at = null,
    created_at = now();

  return new;
end;
$$;

drop trigger if exists accounts_contract_renewal_notifications on public.accounts;

create trigger accounts_contract_renewal_notifications
after insert or update of renewal_date, assigned_kam_id on public.accounts
for each row
execute function public.create_contract_renewal_notifications();

update public.accounts
set renewal_date = renewal_date
where renewal_date in (current_date, current_date + 7, current_date + 30);

commit;
