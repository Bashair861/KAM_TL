-- Grant SELECT to anon + authenticated roles on all public tables
grant select on all tables in schema public to anon;
grant select on all tables in schema public to authenticated;

-- Make sure future tables also get the grant
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant select on tables to authenticated;

-- Double-check RLS is off on every table
alter table profiles                disable row level security;
alter table accounts                disable row level security;
alter table stakeholders            disable row level security;
alter table health_scores           disable row level security;
alter table health_metrics          disable row level security;
alter table contract_details        disable row level security;
alter table activities              disable row level security;
alter table retention_growth        disable row level security;
alter table education_log           disable row level security;
alter table escalations             disable row level security;
alter table escalation_action_items disable row level security;
alter table opportunities           disable row level security;
alter table notifications           disable row level security;
