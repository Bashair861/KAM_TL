-- Enable RLS on every table (fixes the security warnings)
alter table profiles                enable row level security;
alter table accounts                enable row level security;
alter table stakeholders            enable row level security;
alter table health_scores           enable row level security;
alter table health_metrics          enable row level security;
alter table contract_details        enable row level security;
alter table activities              enable row level security;
alter table retention_growth        enable row level security;
alter table education_log           enable row level security;
alter table escalations             enable row level security;
alter table escalation_action_items enable row level security;
alter table opportunities           enable row level security;
alter table notifications           enable row level security;

-- Add a public SELECT policy on every table so the app can read data
-- (anyone with the anon key can read — write is still blocked)

create policy "public read" on profiles                for select using (true);
create policy "public read" on accounts                for select using (true);
create policy "public read" on stakeholders            for select using (true);
create policy "public read" on health_scores           for select using (true);
create policy "public read" on health_metrics          for select using (true);
create policy "public read" on contract_details        for select using (true);
create policy "public read" on activities              for select using (true);
create policy "public read" on retention_growth        for select using (true);
create policy "public read" on education_log           for select using (true);
create policy "public read" on escalations             for select using (true);
create policy "public read" on escalation_action_items for select using (true);
create policy "public read" on opportunities           for select using (true);
create policy "public read" on notifications           for select using (true);
