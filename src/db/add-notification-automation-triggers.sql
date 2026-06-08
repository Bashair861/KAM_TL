-- Database automation for all KAM notification scenarios.
-- Safe to run multiple times in Supabase SQL Editor.
--
-- Covers:
-- 1. Account assignment notifications + Accounts Portfolio sidebar badge.
-- 2. New escalation notifications + Escalations sidebar badge.
-- 3. Contract renewal notifications at 30 days, 7 days, and renewal day.
-- 4. New action item notifications from tasks, activities, and activity_rule_activities.

begin;

create extension if not exists "pgcrypto";

alter table public.accounts
  add column if not exists assigned_kam_id uuid references public.profiles(id);

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

grant select, insert, update on public.notifications to authenticated;

create or replace function public.notification_recipients_for_account(
  p_account_id text,
  p_extra_kam_id uuid default null
)
returns table (
  profile_id uuid,
  profile_name text,
  profile_role text
)
language sql
security definer
set search_path = public
as $$
  select distinct on (p.id)
    p.id,
    p.name,
    p.role::text
  from public.profiles p
  left join public.accounts a
    on a.id = p_account_id
  where p.is_active is distinct from false
    and (
      p.role::text = 'Head of KAM'
      or (
        p.role::text = 'KAM'
        and p.id = coalesce(p_extra_kam_id, a.assigned_kam_id)
      )
    )
  order by p.id;
$$;

create or replace function public.upsert_kam_notification(
  p_recipient_profile_id uuid,
  p_notification_key text,
  p_badge_key text,
  p_target_path text,
  p_title text,
  p_body text,
  p_account_id text,
  p_type public.notif_type default 'info'::public.notif_type
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_recipient_profile_id is null or nullif(trim(p_notification_key), '') is null then
    return;
  end if;

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
  values (
    gen_random_uuid()::text,
    p_recipient_profile_id,
    p_notification_key,
    p_badge_key,
    p_target_path,
    p_title,
    p_body,
    p_account_id,
    'Just now',
    p_type,
    false,
    null,
    now()
  )
  on conflict (recipient_profile_id, notification_key)
  do update set
    badge_key = excluded.badge_key,
    target_path = excluded.target_path,
    title = excluded.title,
    body = excluded.body,
    account_id = excluded.account_id,
    time = excluded.time,
    type = excluded.type,
    read = false,
    read_at = null,
    created_at = now();
end;
$$;

create or replace function public.notify_action_item_created(
  p_account_id text,
  p_action_item_id text,
  p_action_title text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  account_name text;
  recipient record;
  inserted_count int := 0;
begin
  if p_account_id is null or nullif(trim(p_action_item_id), '') is null then
    return 0;
  end if;

  select coalesce(a.name, 'Account')
  into account_name
  from public.accounts a
  where a.id = p_account_id;

  account_name := coalesce(account_name, 'Account');

  for recipient in
    select * from public.notification_recipients_for_account(p_account_id)
  loop
    perform public.upsert_kam_notification(
      recipient.profile_id,
      'action-item-created:' || p_action_item_id || ':' || recipient.profile_id,
      null,
      '/accounts/' || p_account_id,
      'New action item: ' || account_name,
      coalesce(nullif(trim(p_action_title), ''), 'A new action item was created for this account.'),
      p_account_id,
      'action'::public.notif_type
    );
    inserted_count := inserted_count + 1;
  end loop;

  return inserted_count;
end;
$$;

create or replace function public.ensure_contract_renewal_notifications_for_account(
  p_account_id text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.accounts%rowtype;
  days_left int;
  renewal_title text;
  recipient record;
  inserted_count int := 0;
begin
  select *
  into account_row
  from public.accounts
  where id = p_account_id;

  if not found or account_row.renewal_date is null then
    return 0;
  end if;

  days_left := account_row.renewal_date - current_date;

  if days_left not in (30, 7, 0) then
    return 0;
  end if;

  renewal_title := case
    when days_left = 0 then 'Contract renewal today: ' || coalesce(account_row.name, 'Account')
    when days_left = 7 then 'Contract renewal in 7 days: ' || coalesce(account_row.name, 'Account')
    else 'Contract renewal in 30 days: ' || coalesce(account_row.name, 'Account')
  end;

  for recipient in
    select * from public.notification_recipients_for_account(account_row.id)
  loop
    perform public.upsert_kam_notification(
      recipient.profile_id,
      'contract-renewal:' || account_row.id || ':' || days_left || ':' || account_row.renewal_date || ':' || recipient.profile_id,
      null,
      '/accounts/' || account_row.id,
      renewal_title,
      'Review the contract before the renewal window closes.',
      account_row.id,
      'alert'::public.notif_type
    );
    inserted_count := inserted_count + 1;
  end loop;

  return inserted_count;
end;
$$;

create or replace function public.ensure_contract_renewal_notifications_for_due_windows()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row record;
  inserted_count int := 0;
begin
  for account_row in
    select id
    from public.accounts
    where renewal_date in (current_date, current_date + 7, current_date + 30)
  loop
    inserted_count := inserted_count
      + public.ensure_contract_renewal_notifications_for_account(account_row.id);
  end loop;

  return inserted_count;
end;
$$;

create or replace function public.notify_account_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient record;
  kam_name text;
  body_text text;
begin
  if new.assigned_kam_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.assigned_kam_id is not distinct from new.assigned_kam_id
  then
    return new;
  end if;

  update public.notifications
  set read = true,
      read_at = coalesce(read_at, now())
  where account_id = new.id
    and notification_key like ('account-assigned:' || new.id || ':%')
    and read = false;

  select p.name
  into kam_name
  from public.profiles p
  where p.id = new.assigned_kam_id;

  for recipient in
    select * from public.notification_recipients_for_account(new.id, new.assigned_kam_id)
  loop
    body_text := case
      when recipient.profile_id = new.assigned_kam_id
        then 'This account has been added to your portfolio.'
      else coalesce(kam_name, 'A KAM') || ' is now assigned to this account.'
    end;

    perform public.upsert_kam_notification(
      recipient.profile_id,
      'account-assigned:' || new.id || ':' || new.assigned_kam_id || ':' || recipient.profile_id,
      'accounts',
      '/accounts/' || new.id,
      case
        when recipient.profile_id = new.assigned_kam_id
          then 'New account assigned: ' || coalesce(new.name, 'Account')
        else 'Account assigned: ' || coalesce(new.name, 'Account')
      end,
      body_text,
      new.id,
      'info'::public.notif_type
    );
  end loop;

  return new;
end;
$$;

create or replace function public.notify_escalation_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient record;
  account_name text;
begin
  select coalesce(a.name, 'Account')
  into account_name
  from public.accounts a
  where a.id = new.account_id;

  account_name := coalesce(account_name, 'Account');

  for recipient in
    select * from public.notification_recipients_for_account(new.account_id)
  loop
    perform public.upsert_kam_notification(
      recipient.profile_id,
      'escalation-created:' || new.id || ':' || recipient.profile_id,
      'escalations',
      '/escalations',
      'New escalation: ' || account_name,
      coalesce(nullif(trim(new.title), ''), 'A new escalation was created for this account.'),
      new.account_id,
      'alert'::public.notif_type
    );
  end loop;

  return new;
end;
$$;

create or replace function public.notify_contract_renewal_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

  perform public.ensure_contract_renewal_notifications_for_account(new.id);
  return new;
end;
$$;

create or replace function public.notify_task_action_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.account_id is not null
    and coalesce(new.type::text, '') = 'Action Item'
  then
    perform public.notify_action_item_created(new.account_id, new.id::text, new.name);
  end if;

  return new;
end;
$$;

create or replace function public.notify_activity_action_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_action_item_created(new.account_id, new.id::text, new.title);
  return new;
end;
$$;

create or replace function public.notify_activity_rule_action_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_action_item_created(new.account_id, new.id::text, new.title);
  return new;
end;
$$;

drop trigger if exists accounts_assignment_notifications on public.accounts;
create trigger accounts_assignment_notifications
after insert or update of assigned_kam_id on public.accounts
for each row
execute function public.notify_account_assignment();

drop trigger if exists escalations_created_notifications on public.escalations;
create trigger escalations_created_notifications
after insert on public.escalations
for each row
execute function public.notify_escalation_created();

drop trigger if exists accounts_contract_renewal_notifications on public.accounts;
create trigger accounts_contract_renewal_notifications
after insert or update of renewal_date, assigned_kam_id on public.accounts
for each row
execute function public.notify_contract_renewal_change();

drop trigger if exists activities_action_item_notifications on public.activities;
create trigger activities_action_item_notifications
after insert on public.activities
for each row
execute function public.notify_activity_action_item();

do $$
begin
  if to_regclass('public.tasks') is not null then
    execute 'drop trigger if exists tasks_action_item_notifications on public.tasks';
    execute 'create trigger tasks_action_item_notifications after insert on public.tasks for each row execute function public.notify_task_action_item()';
  end if;
end $$;

do $$
begin
  if to_regclass('public.activity_rule_activities') is not null then
    execute 'drop trigger if exists activity_rule_action_item_notifications on public.activity_rule_activities';
    execute 'create trigger activity_rule_action_item_notifications after insert on public.activity_rule_activities for each row execute function public.notify_activity_rule_action_item()';
  end if;
end $$;

select public.ensure_contract_renewal_notifications_for_due_windows();

do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron is not available or cannot be enabled. Schedule public.ensure_contract_renewal_notifications_for_due_windows() daily from Supabase cron if needed.';
  end;

  if to_regnamespace('cron') is not null then
    begin
      execute $sql$select cron.unschedule('kam_contract_renewal_notifications')$sql$;
    exception when others then
      null;
    end;

    begin
      execute $sql$select cron.schedule(
        'kam_contract_renewal_notifications',
        '5 0 * * *',
        'select public.ensure_contract_renewal_notifications_for_due_windows();'
      )$sql$;
    exception when others then
      raise notice 'Could not schedule pg_cron job. Schedule public.ensure_contract_renewal_notifications_for_due_windows() daily from Supabase cron if needed. Error: %', sqlerrm;
    end;
  end if;
end $$;

commit;
