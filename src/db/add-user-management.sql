-- Run this in Supabase SQL Editor to enable the All Users management page.

alter table public.profiles
  add column if not exists is_active boolean not null default true;

update public.profiles
set is_active = true
where is_active is null;

create or replace function public.current_user_is_head_of_kam()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.role = 'Head of KAM'::public.user_role
      and p.is_active = true
      and (
        p.id = auth.uid()
        or lower(p.email) = lower(
          coalesce(auth.jwt() ->> 'email', current_setting('request.jwt.claim.email', true))
        )
      )
  );
$$;

grant execute on function public.current_user_is_head_of_kam() to anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;

create or replace function public.normalized_profile_role(profile_role text)
returns public.user_role
language sql
stable
as $$
  select case
    when profile_role = 'C Level' then 'CEO'
    when profile_role in ('CEO', 'Head of KAM', 'KAM') then profile_role
    else 'KAM'
  end::public.user_role;
$$;

create or replace function public.create_managed_profile(
  profile_id uuid,
  profile_name text,
  profile_initials text,
  profile_email text,
  profile_role text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  new_profile public.profiles;
begin
  if not public.current_user_is_head_of_kam() then
    raise exception 'Only Head of KAM can create users' using errcode = '42501';
  end if;

  insert into public.profiles (id, name, initials, role, email, is_active)
  values (
    profile_id,
    btrim(profile_name),
    upper(btrim(profile_initials)),
    public.normalized_profile_role(profile_role),
    lower(btrim(profile_email)),
    true
  )
  returning * into new_profile;

  return new_profile;
end;
$$;

create or replace function public.update_managed_profile_role(
  profile_id uuid,
  profile_role text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  if not public.current_user_is_head_of_kam() then
    raise exception 'Only Head of KAM can update users' using errcode = '42501';
  end if;

  update public.profiles
  set role = public.normalized_profile_role(profile_role)
  where id = profile_id
  returning * into updated_profile;

  return updated_profile;
end;
$$;

create or replace function public.update_managed_profile_status(
  profile_id uuid,
  profile_is_active boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  if not public.current_user_is_head_of_kam() then
    raise exception 'Only Head of KAM can update users' using errcode = '42501';
  end if;

  update public.profiles
  set is_active = profile_is_active
  where id = profile_id
  returning * into updated_profile;

  return updated_profile;
end;
$$;

grant execute on function public.normalized_profile_role(text) to authenticated;
grant execute on function public.create_managed_profile(uuid, text, text, text, text) to authenticated;
grant execute on function public.update_managed_profile_role(uuid, text) to authenticated;
grant execute on function public.update_managed_profile_status(uuid, boolean) to authenticated;

drop policy if exists "head of kam can insert profiles" on public.profiles;
drop policy if exists "head of kam can update profiles" on public.profiles;

create policy "head of kam can insert profiles"
on public.profiles
for insert
to authenticated
with check (public.current_user_is_head_of_kam());

create policy "head of kam can update profiles"
on public.profiles
for update
to authenticated
using (public.current_user_is_head_of_kam())
with check (public.current_user_is_head_of_kam());
