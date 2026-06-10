-- Adds a persisted workflow stage for the Escalations > Open board.
-- Run this in Supabase SQL Editor before using the move-stage buttons.

alter table public.escalations
  add column if not exists stage text not null default 'Triage';

update public.escalations
set stage = 'Triage'
where stage is null or stage not in ('Triage', 'In Progress', 'Awaiting Client');

alter table public.escalations
  drop constraint if exists escalations_stage_check;

alter table public.escalations
  add constraint escalations_stage_check
  check (stage in ('Triage', 'In Progress', 'Awaiting Client'));

create index if not exists escalations_stage_idx
  on public.escalations (stage, updated_at desc);
