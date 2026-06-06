-- Ensures notification read state persists after opening the bell or clicking Mark all read.
-- Safe to run multiple times in Supabase SQL Editor.

begin;

alter table public.notifications
  add column if not exists recipient_profile_id uuid references public.profiles(id) on delete cascade,
  add column if not exists notification_key text,
  add column if not exists badge_key text,
  add column if not exists target_path text,
  add column if not exists read_at timestamptz;

update public.notifications
set read_at = coalesce(read_at, created_at, now())
where read = true
  and read_at is null;

create unique index if not exists notifications_recipient_key_idx
  on public.notifications (recipient_profile_id, notification_key);

create index if not exists notifications_recipient_read_idx
  on public.notifications (recipient_profile_id, read_at, created_at desc);

create index if not exists notifications_recipient_badge_idx
  on public.notifications (recipient_profile_id, badge_key, read_at);

grant select, insert, update on public.notifications to authenticated;

do $$ begin
  create policy "authenticated can read notifications"
    on public.notifications for select to authenticated
    using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated can insert notifications"
    on public.notifications for insert to authenticated
    with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated can update notifications"
    on public.notifications for update to authenticated
    using (true)
    with check (true);
exception when duplicate_object then null;
end $$;

commit;
