-- Drop all tables in reverse dependency order, then run schema.sql again

drop table if exists notifications             cascade;
drop table if exists opportunities             cascade;
drop table if exists escalation_action_items   cascade;
drop table if exists escalations               cascade;
drop table if exists education_log             cascade;
drop table if exists retention_growth          cascade;
drop table if exists activities                cascade;
drop table if exists contract_details          cascade;
drop table if exists health_metrics            cascade;
drop table if exists health_scores             cascade;
drop table if exists stakeholders              cascade;
drop table if exists accounts                  cascade;
drop table if exists profiles                  cascade;

-- Drop enums
drop type if exists account_status   cascade;
drop type if exists retention_risk   cascade;
drop type if exists contract_type    cascade;
drop type if exists account_tier     cascade;
drop type if exists influence_type   cascade;
drop type if exists health_area      cascade;
drop type if exists activity_area    cascade;
drop type if exists activity_status  cascade;
drop type if exists rag_status       cascade;
drop type if exists priority_level   cascade;
drop type if exists notif_type       cascade;
drop type if exists confidence_level cascade;
drop type if exists user_role        cascade;
