-- ─────────────────────────────────────────────────────────────────────────────
-- seed-imara-ihg-tkxel.sql
-- Run once in Supabase SQL Editor.
-- Populates realistic, presentation-ready data for Imara-IHG and Tkxel accounts.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  ihg_id    text;
  tkxel_id  text;
  hs_id     uuid;
BEGIN

  -- ── Locate accounts ──────────────────────────────────────────────────────────
  SELECT id INTO ihg_id   FROM public.accounts WHERE name ILIKE '%Imara%' OR name ILIKE '%IHG%' LIMIT 1;
  SELECT id INTO tkxel_id FROM public.accounts WHERE name ILIKE '%Tkxel%' LIMIT 1;

  IF ihg_id   IS NULL THEN RAISE EXCEPTION 'Imara-IHG account not found. Check the accounts table.'; END IF;
  IF tkxel_id IS NULL THEN RAISE EXCEPTION 'Tkxel account not found. Check the accounts table.';     END IF;

  -- ════════════════════════════════════════════════════════════════════════════
  --  IMARA-IHG  —  InterContinental Hotels Group
  --  Enterprise hospitality client. Salesforce transformation + digital ops.
  -- ════════════════════════════════════════════════════════════════════════════

  UPDATE public.accounts SET
    name                 = 'Imara-IHG',
    short_code           = 'IH',
    industry             = 'Hospitality & Tourism',
    tier                 = 'Enterprise',
    health               = 84,
    trend                = 3.2,
    contract_value       = 3200000,
    arr                  = 3200000,
    renewal_date         = '2027-01-15',
    contract_duration    = '36 months',
    contract_type        = 'Retainer',
    last_touch           = '2 days ago',
    status               = 'healthy',
    retention_risk       = 'Low',
    growth_upside        = 850000,
    white_space_count    = 3,
    cooperation          = 8.5,
    service_consumption  = 8.2,
    meetings_per_month   = 6,
    contract_compliance  = 9.0,
    primary_contact_name = 'Eric Pearson',
    primary_contact_role = 'Chief Commercial & Technology Officer',
    founded              = 1946,
    employees            = '345,000+',
    region               = 'EMEA',
    description          = 'Global hospitality giant — Salesforce-led digital transformation across 6,600+ properties in 100+ countries.',
    business_info        = 'IHG (InterContinental Hotels Group) is one of the world''s largest hotel companies, operating 19 brands including InterContinental, Holiday Inn, Crowne Plaza, Kimpton, and Six Senses. Revenue model: franchise fees, managed-hotel commissions, and IHG One Rewards loyalty monetisation. Core platforms: proprietary Central Reservations System, AI-powered Revenue Management (3,500+ properties), and Salesforce-native commercial stack. Tkxel partnership scope: Salesforce Sales Cloud + Service Cloud implementation, AI guest-sentiment integrations, loyalty-programme API bridge, and hotel-operations mobile tooling.',
    client_history       = 'Engagement started Q2 2024 with a full Salesforce Sales Cloud and Service Cloud rollout for IHG''s global commercial team. Go-live completed 11 weeks ahead of schedule. Scope expanded Q4 2024 to include an AI-powered guest sentiment module and a Salesforce-native loyalty API connector. Two executive QBRs held — both resulted in approved scope expansions. NPS from IHG tech leadership: 74. No escalations to date. Renewal conversation initiated Q1 2026.',
    revenue              = '$4.62B (FY24)',
    mrr_arr              = NULL,
    is_startup           = FALSE,
    engagement_tenure    = '2y 1m',
    team_size            = 18,
    competitors          = ARRAY['Accenture', 'Capgemini', 'IBM iX'],
    main_business_flow   = 'Central Reservations System → Property Management System → IHG One Rewards loyalty bridge → AI Revenue Management → Salesforce Service Cloud (guest issues) → BI analytics. Tkxel owns: Salesforce layer, loyalty API connector, AI sentiment module, and hotel-ops mobile app.',
    linkedin_url         = 'https://www.linkedin.com/company/ihg-intercontinental-hotels-group/',
    website_url          = 'https://www.ihg.com'
  WHERE id = ihg_id;

  -- ── Stakeholders ─────────────────────────────────────────────────────────────
  DELETE FROM public.stakeholders WHERE account_id = ihg_id;
  INSERT INTO public.stakeholders (id, account_id, name, role, influence, email, last_contact) VALUES
    (gen_random_uuid(), ihg_id, 'Eric Pearson',     'Chief Commercial & Technology Officer', 'Decision Maker', 'e.pearson@ihg.com',    '3 days ago'),
    (gen_random_uuid(), ihg_id, 'Daniel Blanchard', 'Chief Technology Officer',              'Champion',       'd.blanchard@ihg.com',  '1 week ago'),
    (gen_random_uuid(), ihg_id, 'Noni Gonzalez',    'VP Global Technology Systems',          'Influencer',     'n.gonzalez@ihg.com',   '2 weeks ago'),
    (gen_random_uuid(), ihg_id, 'Sarah Mitchell',   'Salesforce Programme Lead',             'Champion',       's.mitchell@ihg.com',   'Yesterday');

  -- ── Health scores ─────────────────────────────────────────────────────────────
  DELETE FROM public.health_scores WHERE account_id = ihg_id;

  -- Relationship 8.8
  INSERT INTO public.health_scores (id, account_id, area, score, kpi_data) VALUES (gen_random_uuid(), ihg_id, 'relationship', 8.8,
  '[
    {"id":"kpi-relationship-0","name":"CEO & Executive Engagement","metricId":null,"fields":[
      {"id":"relationship-0-0","label":"CEO-to-CEO meeting held this quarter","weight":40,"checked":true},
      {"id":"relationship-0-1","label":"Director-level meeting completed on schedule","weight":35,"checked":true},
      {"id":"relationship-0-2","label":"Executive sponsor actively engaged","weight":25,"checked":true}]},
    {"id":"kpi-relationship-1","name":"Meeting Cadence","metricId":null,"fields":[
      {"id":"relationship-1-0","label":"Monthly cadence meetings held on schedule","weight":50,"checked":true},
      {"id":"relationship-1-1","label":"Action items closed before next cycle","weight":30,"checked":false},
      {"id":"relationship-1-2","label":"Meeting notes shared within 24 hours","weight":20,"checked":true}]},
    {"id":"kpi-relationship-2","name":"Cooperation & Trust","metricId":null,"fields":[
      {"id":"relationship-2-0","label":"Client responsive to requests within 48 hours","weight":60,"checked":true},
      {"id":"relationship-2-1","label":"Joint planning or roadmap session completed","weight":40,"checked":true}]}
  ]'::jsonb);

  -- Project 8.5
  INSERT INTO public.health_scores (id, account_id, area, score, kpi_data) VALUES (gen_random_uuid(), ihg_id, 'project', 8.5,
  '[
    {"id":"kpi-project-0","name":"Delivery Performance","metricId":null,"fields":[
      {"id":"project-0-0","label":"Sprint or milestone delivered on time","weight":50,"checked":true},
      {"id":"project-0-1","label":"Defect rate within agreed threshold","weight":30,"checked":true},
      {"id":"project-0-2","label":"No critical production incidents this cycle","weight":20,"checked":true}]},
    {"id":"kpi-project-1","name":"Quality & Feedback","metricId":null,"fields":[
      {"id":"project-1-0","label":"Client feedback positive this cycle","weight":55,"checked":true},
      {"id":"project-1-1","label":"Feedback actioned and communicated back to client","weight":45,"checked":false}]},
    {"id":"kpi-project-2","name":"Scope & Change Control","metricId":null,"fields":[
      {"id":"project-2-0","label":"Change requests formally reviewed and documented","weight":50,"checked":true},
      {"id":"project-2-1","label":"No unmanaged scope creep this cycle","weight":50,"checked":true}]}
  ]'::jsonb);

  -- White Space 7.5
  INSERT INTO public.health_scores (id, account_id, area, score, kpi_data) VALUES (gen_random_uuid(), ihg_id, 'white_space', 7.5,
  '[
    {"id":"kpi-white_space-0","name":"Service Penetration","metricId":null,"fields":[
      {"id":"white_space-0-0","label":"More than 3 active services currently delivered","weight":50,"checked":true},
      {"id":"white_space-0-1","label":"At least 1 new service proposed this quarter","weight":50,"checked":true}]},
    {"id":"kpi-white_space-1","name":"Upsell & Growth Signals","metricId":null,"fields":[
      {"id":"white_space-1-0","label":"Upsell opportunity identified and logged in CRM","weight":50,"checked":true},
      {"id":"white_space-1-1","label":"White-space pitch scheduled with decision maker","weight":50,"checked":false}]},
    {"id":"kpi-white_space-2","name":"Account Intelligence","metricId":null,"fields":[
      {"id":"white_space-2-0","label":"Account notes updated this month","weight":40,"checked":true},
      {"id":"white_space-2-1","label":"Competitive landscape reviewed","weight":30,"checked":true},
      {"id":"white_space-2-2","label":"Stakeholder map current and verified","weight":30,"checked":false}]}
  ]'::jsonb);

  -- Contract 8.8
  INSERT INTO public.health_scores (id, account_id, area, score, kpi_data) VALUES (gen_random_uuid(), ihg_id, 'contract', 8.8,
  '[
    {"id":"kpi-contract-0","name":"Contract Terms","metricId":null,"fields":[
      {"id":"contract-0-0","label":"Auto-renew clause in place","weight":35,"checked":true},
      {"id":"contract-0-1","label":"Non-terminator clause signed","weight":35,"checked":true},
      {"id":"contract-0-2","label":"Minimum one-year lock confirmed","weight":30,"checked":true}]},
    {"id":"kpi-contract-1","name":"Compliance & Renewal","metricId":null,"fields":[
      {"id":"contract-1-0","label":"Process compliance score above 7 out of 10","weight":50,"checked":true},
      {"id":"contract-1-1","label":"Renewal conversation initiated 90 days before expiry","weight":50,"checked":false}]},
    {"id":"kpi-contract-2","name":"Commercial Terms","metricId":null,"fields":[
      {"id":"contract-2-0","label":"Annual price-hike clause agreed and documented","weight":55,"checked":true},
      {"id":"contract-2-1","label":"Annual contract review meeting scheduled","weight":45,"checked":true}]}
  ]'::jsonb);

  -- CSAT 8.3
  INSERT INTO public.health_scores (id, account_id, area, score, kpi_data) VALUES (gen_random_uuid(), ihg_id, 'csat', 8.3,
  '[
    {"id":"kpi-csat-0","name":"NPS & Surveys","metricId":null,"fields":[
      {"id":"csat-0-0","label":"NPS score collected and above 7 this quarter","weight":45,"checked":true},
      {"id":"csat-0-1","label":"Quarterly satisfaction survey completed","weight":35,"checked":true},
      {"id":"csat-0-2","label":"Low-score responses addressed within 2 weeks","weight":20,"checked":false}]},
    {"id":"kpi-csat-1","name":"Support Quality","metricId":null,"fields":[
      {"id":"csat-1-0","label":"Support tickets resolved within SLA","weight":55,"checked":true},
      {"id":"csat-1-1","label":"CSAT rating of 4 or above on closed tickets","weight":45,"checked":true}]},
    {"id":"kpi-csat-2","name":"Executive Sentiment","metricId":null,"fields":[
      {"id":"csat-2-0","label":"Executive sponsor expressed positive sentiment","weight":55,"checked":true},
      {"id":"csat-2-1","label":"No major complaints or unresolved escalations","weight":45,"checked":true}]}
  ]'::jsonb);

  -- Risk 7.8
  INSERT INTO public.health_scores (id, account_id, area, score, kpi_data) VALUES (gen_random_uuid(), ihg_id, 'risk', 7.8,
  '[
    {"id":"kpi-risk-0","name":"Competitive Risk","metricId":null,"fields":[
      {"id":"risk-0-0","label":"Competitor activity monitored and documented","weight":45,"checked":true},
      {"id":"risk-0-1","label":"Defense strategy or counter-proposal ready","weight":55,"checked":false}]},
    {"id":"kpi-risk-1","name":"Relationship & POC Risk","metricId":null,"fields":[
      {"id":"risk-1-0","label":"Key POC stable — no resignation or transfer risk","weight":50,"checked":true},
      {"id":"risk-1-1","label":"C-level sponsor accessible and engaged","weight":50,"checked":true}]},
    {"id":"kpi-risk-2","name":"Financial Risk","metricId":null,"fields":[
      {"id":"risk-2-0","label":"Invoice paid within agreed payment terms","weight":55,"checked":true},
      {"id":"risk-2-1","label":"No overdue balance outstanding","weight":45,"checked":true}]},
    {"id":"kpi-risk-3","name":"Operational Risk","metricId":null,"fields":[
      {"id":"risk-3-0","label":"Compliance and regulatory requirements met","weight":50,"checked":true},
      {"id":"risk-3-1","label":"No geopolitical disruptions impacting delivery","weight":50,"checked":true}]}
  ]'::jsonb);

  -- Resources 8.5
  INSERT INTO public.health_scores (id, account_id, area, score, kpi_data) VALUES (gen_random_uuid(), ihg_id, 'resource', 8.5,
  '[
    {"id":"kpi-resource-0","name":"Backup & Continuity","metricId":null,"fields":[
      {"id":"resource-0-0","label":"Backup engineer assigned for every critical role","weight":55,"checked":true},
      {"id":"resource-0-1","label":"Knowledge transfer documentation up to date","weight":45,"checked":false}]},
    {"id":"kpi-resource-1","name":"Staffing Stability","metricId":null,"fields":[
      {"id":"resource-1-0","label":"No unplanned attrition on account this month","weight":50,"checked":true},
      {"id":"resource-1-1","label":"Planned leaves managed without delivery impact","weight":50,"checked":true}]},
    {"id":"kpi-resource-2","name":"Critical Resource Retention","metricId":null,"fields":[
      {"id":"resource-2-0","label":"Critical resources engaged and retained","weight":55,"checked":true},
      {"id":"resource-2-1","label":"Succession plan in place for key technical roles","weight":45,"checked":true}]}
  ]'::jsonb);

  -- Financial 9.0
  INSERT INTO public.health_scores (id, account_id, area, score, kpi_data) VALUES (gen_random_uuid(), ihg_id, 'financial', 9.0,
  '[
    {"id":"kpi-financial-0","name":"Revenue Performance","metricId":null,"fields":[
      {"id":"financial-0-0","label":"Monthly billing target met","weight":50,"checked":true},
      {"id":"financial-0-1","label":"ARR growth on track versus annual plan","weight":50,"checked":true}]},
    {"id":"kpi-financial-1","name":"Margin & Efficiency","metricId":null,"fields":[
      {"id":"financial-1-0","label":"Resource utilization above 80 percent","weight":50,"checked":true},
      {"id":"financial-1-1","label":"Cost overruns within 5 percent of budget","weight":50,"checked":true}]},
    {"id":"kpi-financial-2","name":"Commercial Growth","metricId":null,"fields":[
      {"id":"financial-2-0","label":"Upsell or expansion proposal submitted this quarter","weight":55,"checked":true},
      {"id":"financial-2-1","label":"Renewal pipeline initiated before 90-day mark","weight":45,"checked":false}]}
  ]'::jsonb);

  -- ── Contract details ──────────────────────────────────────────────────────────
  DELETE FROM public.contract_details WHERE account_id = ihg_id;
  INSERT INTO public.contract_details
    (id, account_id, type, duration, renewal_date, auto_renew, non_terminator, min_one_year,
     price_hike, swot_s, swot_w, swot_o, swot_t, customer_feedback,
     backup_exists, leaves_this_month, critical_resources)
  VALUES (
    gen_random_uuid(), ihg_id, 'Retainer', '36 months', '2027-01-15',
    TRUE, TRUE, TRUE,
    '5% YoY',
    'Deep Salesforce expertise embedded in IHG''s commercial stack; high switching cost after 2-year integration.',
    'Dependency on 2 senior Salesforce architects; APAC timezone coverage gap for late-night IHG operations.',
    'APAC hotel-management rollout ($420K), AI guest-personalisation module ($280K), loyalty-programme Salesforce integration ($150K).',
    'Accenture and Capgemini actively pitching IHG''s CIO for cloud-native infrastructure work adjacent to our scope.',
    '"The booking conversion uplift of 18% speaks for itself — your team''s Salesforce depth is genuinely world-class." — Eric Pearson, Chief Commercial & Technology Officer',
    TRUE, 1, 4
  );

  -- ── Retention / growth services ───────────────────────────────────────────────
  DELETE FROM public.retention_growth WHERE account_id = ihg_id;
  INSERT INTO public.retention_growth (id, account_id, service, offered, delivered, applicable, tracking_note) VALUES
    (gen_random_uuid(), ihg_id, 'Salesforce Sales Cloud',           TRUE,  TRUE,  TRUE,  'Live across IHG''s global commercial team. Booking conversion up 18% YoY.'),
    (gen_random_uuid(), ihg_id, 'Salesforce Service Cloud',         TRUE,  TRUE,  TRUE,  'Guest-issue resolution SLA met 97% of the time since go-live.'),
    (gen_random_uuid(), ihg_id, 'Hotel-Ops Mobile App',             TRUE,  TRUE,  TRUE,  'Deployed across 320 properties. Housekeeping task completion +22%.'),
    (gen_random_uuid(), ihg_id, 'AI Guest Sentiment Module',        TRUE,  FALSE, TRUE,  'In final UAT. Go-live target: July 2026. Pilot at 15 properties showing 4.1/5 guest score.'),
    (gen_random_uuid(), ihg_id, 'Loyalty Programme API Bridge',     TRUE,  TRUE,  TRUE,  'IHG One Rewards connector live. 4.2M loyalty events processed per month.'),
    (gen_random_uuid(), ihg_id, 'APAC Property Management Rollout', FALSE, FALSE, TRUE,  'White-space — IHG APAC leadership expressed interest in Q1 2026 QBR. Proposal to be drafted Q3 2026.'),
    (gen_random_uuid(), ihg_id, 'Revenue Analytics Platform',       FALSE, FALSE, TRUE,  'White-space — IHG''s current BI tool contract expires Jan 2027. Opportunity to pitch Salesforce Analytics Cloud.'),
    (gen_random_uuid(), ihg_id, 'ServiceNow ITSM Integration',      FALSE, FALSE, FALSE, 'Not applicable — IHG runs ServiceNow internally with a dedicated team.');

  -- ── Opportunities ─────────────────────────────────────────────────────────────
  DELETE FROM public.opportunities WHERE account_id = ihg_id;
  INSERT INTO public.opportunities (id, account_id, title, source, signal_date, potential, confidence, next_step) VALUES
    (gen_random_uuid(), ihg_id, 'APAC Hotel-Management System Rollout',         'Executive QBR — Q1 2026',            '2026-02-18', 420000, 'High',   'Draft scoping proposal by end of Q2 2026. Engage Noni Gonzalez for technical sign-off.'),
    (gen_random_uuid(), ihg_id, 'AI-Powered Guest Personalisation Module',      'Daniel Blanchard — discovery call',  '2026-01-09', 280000, 'Medium', 'Present prototype at July go-live review. Tie ROI to NPS improvement data.'),
    (gen_random_uuid(), ihg_id, 'Salesforce Analytics Cloud — BI Replacement',  'Renewal planning meeting',           '2026-03-05', 150000, 'Medium', 'Monitor incumbent BI contract expiry (Jan 2027). Pitch in October renewal window.');

  -- ── Activities ────────────────────────────────────────────────────────────────
  DELETE FROM public.activities WHERE account_id = ihg_id;
  INSERT INTO public.activities (id, account_id, area, title, owner, due, status, rag, expected_lift) VALUES
    (gen_random_uuid(), ihg_id, 'Relationship', 'Q2 2026 QBR deck — include booking-conversion ROI slide',      'Bashair Ahmad', 'In 8d',    'In Progress', 'G', '+0.4 relationship'),
    (gen_random_uuid(), ihg_id, 'Project',       'AI Guest Sentiment Module — final UAT sign-off with Sarah Mitchell', 'Bashair Ahmad', 'In 12d',   'In Progress', 'A', 'Unblock go-live'),
    (gen_random_uuid(), ihg_id, 'Profit',        'Pitch APAC property-management rollout to Eric Pearson',      'Bashair Ahmad', 'In 45d',   'Open',        'G', '+$420K ARR'),
    (gen_random_uuid(), ihg_id, 'Resource',      'Assign backup Salesforce architect — current lead on leave Aug', 'Bashair Ahmad', 'In 30d',   'Open',        'A', 'Risk mitigation'),
    (gen_random_uuid(), ihg_id, 'Financial',     'Initiate renewal conversation 6 months ahead of Jan 2027 date', 'Bashair Ahmad', 'In 20d',   'Open',        'G', 'Secure 36-month extension');

  -- ── Escalations ───────────────────────────────────────────────────────────────
  DELETE FROM public.escalation_action_items WHERE escalation_id IN (SELECT id FROM public.escalations WHERE account_id = ihg_id);
  DELETE FROM public.escalations WHERE account_id = ihg_id;
  -- No active P1 escalations — account is healthy. One historical P2 resolved.

  -- ── Education log ─────────────────────────────────────────────────────────────
  DELETE FROM public.education_log WHERE account_id = ihg_id;
  INSERT INTO public.education_log (id, account_id, date, topic, approach, outcome) VALUES
    (gen_random_uuid(), ihg_id, 'JAN 14, 2026', 'Salesforce AI Features — Agentforce & Einstein Copilot',          'Live demo + hands-on sandbox session with IHG''s Salesforce team (8 attendees)',    'IHG approved inclusion of Einstein Copilot in the AI Guest Sentiment module scope.'),
    (gen_random_uuid(), ihg_id, 'SEP 10, 2025', 'IHG Tech Architecture Deep Dive — CRS & PMS Integration Patterns', 'Technical workshop with Daniel Blanchard and Noni Gonzalez (3-hour session)',          'Identified 2 integration points for the loyalty API bridge; reduced estimated build time by 3 weeks.'),
    (gen_random_uuid(), ihg_id, 'MAY 22, 2025', 'Salesforce Service Cloud — Guest-Issue Workflow Design',           'Process-mapping workshop with Sarah Mitchell and IHG''s contact-centre ops lead',   'Agreed workflow blueprints adopted as the final design. Go-live 6 weeks later.');

  -- ── Notifications ─────────────────────────────────────────────────────────────
  DELETE FROM public.notifications WHERE account_id = ihg_id;
  INSERT INTO public.notifications (id, account_id, title, body, time, type, read) VALUES
    (gen_random_uuid(), ihg_id, 'QBR prep due in 8 days — Imara-IHG',     'Booking-conversion ROI slide not yet drafted. Eric Pearson confirmed for June 18.', '2h ago',    'action', FALSE),
    (gen_random_uuid(), ihg_id, 'AI module UAT window opens tomorrow',     'Sarah Mitchell has cleared the test environment. Final UAT must complete by Jun 22.',  '4h ago',    'alert',  FALSE),
    (gen_random_uuid(), ihg_id, 'APAC opportunity — pitch window opening', 'IHG APAC budget planning starts Q3. Proposal draft should be ready by Jul 1.',         '1 day ago', 'info',   TRUE);


  -- ════════════════════════════════════════════════════════════════════════════
  --  TKXEL  —  Software Development & IT Services
  --  Growth-tier client. Staff augmentation + cloud engineering.
  -- ════════════════════════════════════════════════════════════════════════════

  UPDATE public.accounts SET
    name                 = 'Tkxel',
    short_code           = 'TK',
    industry             = 'Software Development & IT Services',
    tier                 = 'Growth',
    health               = 78,
    trend                = 1.8,
    contract_value       = 1450000,
    arr                  = 1450000,
    renewal_date         = '2026-09-30',
    contract_duration    = '24 months',
    contract_type        = 'Staff Augmented',
    last_touch           = 'Yesterday',
    status               = 'healthy',
    retention_risk       = 'Low',
    growth_upside        = 380000,
    white_space_count    = 2,
    cooperation          = 8.0,
    service_consumption  = 7.5,
    meetings_per_month   = 4,
    contract_compliance  = 9.0,
    primary_contact_name = 'Umair Javed',
    primary_contact_role = 'CEO & Founder',
    founded              = 2008,
    employees            = '1,200+',
    region               = 'North America',
    description          = 'Fast-growing IT services firm. Staff augmentation across Salesforce, cloud, and AI engineering tracks.',
    business_info        = 'Tkxel is a global software development and IT services company headquartered in Reston, Virginia, with delivery centres across Pakistan and MENA. Core services: custom software development, AI-led digital transformation, Salesforce implementation, Microsoft Azure cloud migration, and enterprise mobility solutions. Recognised on the Inc. 5000 fastest-growing companies list. Revenue model: staff augmentation, fixed-price project engagements, and managed-services retainers. Certified Salesforce Partner, Microsoft Gold Partner, and AWS Advanced Partner.',
    client_history       = 'Engagement started Q4 2024 with a staff-augmentation arrangement to support Tkxel''s internal Salesforce practice scaling — 6 certified developers onboarded. Q1 2025 scope extended to include a Microsoft Azure cloud migration workstream for a Tkxel enterprise client project. Strong day-to-day cooperation from the COO. CEO engaged at quarterly reviews. One minor delivery delay in Feb 2025 (resolved within SLA). Renewal approaching Sep 2026.',
    revenue              = '$170.6M (2025)',
    mrr_arr              = NULL,
    is_startup           = FALSE,
    engagement_tenure    = '1y 8m',
    team_size            = 12,
    competitors          = ARRAY['Perficient', 'Sapient', 'Infosys BPM'],
    main_business_flow   = 'Client acquisition → discovery & scoping → resource allocation → sprint delivery → QA → deployment → managed support. Our engineers integrate directly into Tkxel project teams as embedded specialists.',
    linkedin_url         = 'https://www.linkedin.com/company/tkxel/',
    website_url          = 'https://www.tkxel.com'
  WHERE id = tkxel_id;

  -- ── Stakeholders ─────────────────────────────────────────────────────────────
  DELETE FROM public.stakeholders WHERE account_id = tkxel_id;
  INSERT INTO public.stakeholders (id, account_id, name, role, influence, email, last_contact) VALUES
    (gen_random_uuid(), tkxel_id, 'Umair Javed', 'CEO & Founder',      'Decision Maker', 'umair@tkxel.com',  '1 week ago'),
    (gen_random_uuid(), tkxel_id, 'Wajih',        'Chief Operations Officer', 'Champion',  'wajih@tkxel.com',  'Yesterday'),
    (gen_random_uuid(), tkxel_id, 'Asad Ali',     'VP Engineering',    'Influencer',     'asad@tkxel.com',   '3 days ago');

  -- ── Health scores ─────────────────────────────────────────────────────────────
  DELETE FROM public.health_scores WHERE account_id = tkxel_id;

  -- Relationship 8.0
  INSERT INTO public.health_scores (id, account_id, area, score, kpi_data) VALUES (gen_random_uuid(), tkxel_id, 'relationship', 8.0,
  '[
    {"id":"kpi-relationship-0","name":"CEO & Executive Engagement","metricId":null,"fields":[
      {"id":"relationship-0-0","label":"CEO-to-CEO meeting held this quarter","weight":40,"checked":false},
      {"id":"relationship-0-1","label":"Director-level meeting completed on schedule","weight":35,"checked":true},
      {"id":"relationship-0-2","label":"Executive sponsor actively engaged","weight":25,"checked":true}]},
    {"id":"kpi-relationship-1","name":"Meeting Cadence","metricId":null,"fields":[
      {"id":"relationship-1-0","label":"Monthly cadence meetings held on schedule","weight":50,"checked":true},
      {"id":"relationship-1-1","label":"Action items closed before next cycle","weight":30,"checked":true},
      {"id":"relationship-1-2","label":"Meeting notes shared within 24 hours","weight":20,"checked":true}]},
    {"id":"kpi-relationship-2","name":"Cooperation & Trust","metricId":null,"fields":[
      {"id":"relationship-2-0","label":"Client responsive to requests within 48 hours","weight":60,"checked":true},
      {"id":"relationship-2-1","label":"Joint planning or roadmap session completed","weight":40,"checked":false}]}
  ]'::jsonb);

  -- Project 8.2
  INSERT INTO public.health_scores (id, account_id, area, score, kpi_data) VALUES (gen_random_uuid(), tkxel_id, 'project', 8.2,
  '[
    {"id":"kpi-project-0","name":"Delivery Performance","metricId":null,"fields":[
      {"id":"project-0-0","label":"Sprint or milestone delivered on time","weight":50,"checked":true},
      {"id":"project-0-1","label":"Defect rate within agreed threshold","weight":30,"checked":true},
      {"id":"project-0-2","label":"No critical production incidents this cycle","weight":20,"checked":true}]},
    {"id":"kpi-project-1","name":"Quality & Feedback","metricId":null,"fields":[
      {"id":"project-1-0","label":"Client feedback positive this cycle","weight":55,"checked":true},
      {"id":"project-1-1","label":"Feedback actioned and communicated back to client","weight":45,"checked":false}]},
    {"id":"kpi-project-2","name":"Scope & Change Control","metricId":null,"fields":[
      {"id":"project-2-0","label":"Change requests formally reviewed and documented","weight":50,"checked":true},
      {"id":"project-2-1","label":"No unmanaged scope creep this cycle","weight":50,"checked":true}]}
  ]'::jsonb);

  -- White Space 6.5
  INSERT INTO public.health_scores (id, account_id, area, score, kpi_data) VALUES (gen_random_uuid(), tkxel_id, 'white_space', 6.5,
  '[
    {"id":"kpi-white_space-0","name":"Service Penetration","metricId":null,"fields":[
      {"id":"white_space-0-0","label":"More than 3 active services currently delivered","weight":50,"checked":false},
      {"id":"white_space-0-1","label":"At least 1 new service proposed this quarter","weight":50,"checked":true}]},
    {"id":"kpi-white_space-1","name":"Upsell & Growth Signals","metricId":null,"fields":[
      {"id":"white_space-1-0","label":"Upsell opportunity identified and logged in CRM","weight":50,"checked":true},
      {"id":"white_space-1-1","label":"White-space pitch scheduled with decision maker","weight":50,"checked":false}]},
    {"id":"kpi-white_space-2","name":"Account Intelligence","metricId":null,"fields":[
      {"id":"white_space-2-0","label":"Account notes updated this month","weight":40,"checked":true},
      {"id":"white_space-2-1","label":"Competitive landscape reviewed","weight":30,"checked":false},
      {"id":"white_space-2-2","label":"Stakeholder map current and verified","weight":30,"checked":true}]}
  ]'::jsonb);

  -- Contract 8.5
  INSERT INTO public.health_scores (id, account_id, area, score, kpi_data) VALUES (gen_random_uuid(), tkxel_id, 'contract', 8.5,
  '[
    {"id":"kpi-contract-0","name":"Contract Terms","metricId":null,"fields":[
      {"id":"contract-0-0","label":"Auto-renew clause in place","weight":35,"checked":true},
      {"id":"contract-0-1","label":"Non-terminator clause signed","weight":35,"checked":false},
      {"id":"contract-0-2","label":"Minimum one-year lock confirmed","weight":30,"checked":true}]},
    {"id":"kpi-contract-1","name":"Compliance & Renewal","metricId":null,"fields":[
      {"id":"contract-1-0","label":"Process compliance score above 7 out of 10","weight":50,"checked":true},
      {"id":"contract-1-1","label":"Renewal conversation initiated 90 days before expiry","weight":50,"checked":false}]},
    {"id":"kpi-contract-2","name":"Commercial Terms","metricId":null,"fields":[
      {"id":"contract-2-0","label":"Annual price-hike clause agreed and documented","weight":55,"checked":true},
      {"id":"contract-2-1","label":"Annual contract review meeting scheduled","weight":45,"checked":true}]}
  ]'::jsonb);

  -- CSAT 7.8
  INSERT INTO public.health_scores (id, account_id, area, score, kpi_data) VALUES (gen_random_uuid(), tkxel_id, 'csat', 7.8,
  '[
    {"id":"kpi-csat-0","name":"NPS & Surveys","metricId":null,"fields":[
      {"id":"csat-0-0","label":"NPS score collected and above 7 this quarter","weight":45,"checked":false},
      {"id":"csat-0-1","label":"Quarterly satisfaction survey completed","weight":35,"checked":true},
      {"id":"csat-0-2","label":"Low-score responses addressed within 2 weeks","weight":20,"checked":true}]},
    {"id":"kpi-csat-1","name":"Support Quality","metricId":null,"fields":[
      {"id":"csat-1-0","label":"Support tickets resolved within SLA","weight":55,"checked":true},
      {"id":"csat-1-1","label":"CSAT rating of 4 or above on closed tickets","weight":45,"checked":true}]},
    {"id":"kpi-csat-2","name":"Executive Sentiment","metricId":null,"fields":[
      {"id":"csat-2-0","label":"Executive sponsor expressed positive sentiment","weight":55,"checked":true},
      {"id":"csat-2-1","label":"No major complaints or unresolved escalations","weight":45,"checked":true}]}
  ]'::jsonb);

  -- Risk 7.5
  INSERT INTO public.health_scores (id, account_id, area, score, kpi_data) VALUES (gen_random_uuid(), tkxel_id, 'risk', 7.5,
  '[
    {"id":"kpi-risk-0","name":"Competitive Risk","metricId":null,"fields":[
      {"id":"risk-0-0","label":"Competitor activity monitored and documented","weight":45,"checked":true},
      {"id":"risk-0-1","label":"Defense strategy or counter-proposal ready","weight":55,"checked":false}]},
    {"id":"kpi-risk-1","name":"Relationship & POC Risk","metricId":null,"fields":[
      {"id":"risk-1-0","label":"Key POC stable — no resignation or transfer risk","weight":50,"checked":true},
      {"id":"risk-1-1","label":"C-level sponsor accessible and engaged","weight":50,"checked":false}]},
    {"id":"kpi-risk-2","name":"Financial Risk","metricId":null,"fields":[
      {"id":"risk-2-0","label":"Invoice paid within agreed payment terms","weight":55,"checked":true},
      {"id":"risk-2-1","label":"No overdue balance outstanding","weight":45,"checked":true}]},
    {"id":"kpi-risk-3","name":"Operational Risk","metricId":null,"fields":[
      {"id":"risk-3-0","label":"Compliance and regulatory requirements met","weight":50,"checked":true},
      {"id":"risk-3-1","label":"No geopolitical disruptions impacting delivery","weight":50,"checked":true}]}
  ]'::jsonb);

  -- Resources 8.0
  INSERT INTO public.health_scores (id, account_id, area, score, kpi_data) VALUES (gen_random_uuid(), tkxel_id, 'resource', 8.0,
  '[
    {"id":"kpi-resource-0","name":"Backup & Continuity","metricId":null,"fields":[
      {"id":"resource-0-0","label":"Backup engineer assigned for every critical role","weight":55,"checked":true},
      {"id":"resource-0-1","label":"Knowledge transfer documentation up to date","weight":45,"checked":false}]},
    {"id":"kpi-resource-1","name":"Staffing Stability","metricId":null,"fields":[
      {"id":"resource-1-0","label":"No unplanned attrition on account this month","weight":50,"checked":true},
      {"id":"resource-1-1","label":"Planned leaves managed without delivery impact","weight":50,"checked":true}]},
    {"id":"kpi-resource-2","name":"Critical Resource Retention","metricId":null,"fields":[
      {"id":"resource-2-0","label":"Critical resources engaged and retained","weight":55,"checked":true},
      {"id":"resource-2-1","label":"Succession plan in place for key technical roles","weight":45,"checked":false}]}
  ]'::jsonb);

  -- Financial 8.2
  INSERT INTO public.health_scores (id, account_id, area, score, kpi_data) VALUES (gen_random_uuid(), tkxel_id, 'financial', 8.2,
  '[
    {"id":"kpi-financial-0","name":"Revenue Performance","metricId":null,"fields":[
      {"id":"financial-0-0","label":"Monthly billing target met","weight":50,"checked":true},
      {"id":"financial-0-1","label":"ARR growth on track versus annual plan","weight":50,"checked":true}]},
    {"id":"kpi-financial-1","name":"Margin & Efficiency","metricId":null,"fields":[
      {"id":"financial-1-0","label":"Resource utilization above 80 percent","weight":50,"checked":true},
      {"id":"financial-1-1","label":"Cost overruns within 5 percent of budget","weight":50,"checked":false}]},
    {"id":"kpi-financial-2","name":"Commercial Growth","metricId":null,"fields":[
      {"id":"financial-2-0","label":"Upsell or expansion proposal submitted this quarter","weight":55,"checked":true},
      {"id":"financial-2-1","label":"Renewal pipeline initiated before 90-day mark","weight":45,"checked":false}]}
  ]'::jsonb);

  -- ── Contract details ──────────────────────────────────────────────────────────
  DELETE FROM public.contract_details WHERE account_id = tkxel_id;
  INSERT INTO public.contract_details
    (id, account_id, type, duration, renewal_date, auto_renew, non_terminator, min_one_year,
     price_hike, swot_s, swot_w, swot_o, swot_t, customer_feedback,
     backup_exists, leaves_this_month, critical_resources)
  VALUES (
    gen_random_uuid(), tkxel_id, 'Staff Augmented', '24 months', '2026-09-30',
    TRUE, FALSE, TRUE,
    '4% YoY',
    'Embedded engineers integrate seamlessly with Tkxel project teams; minimal onboarding friction due to shared tech stack.',
    'Non-terminator clause not yet signed; CEO engagement limited to quarterly touchpoints only.',
    'Managed-services retainer upgrade ($180K); AI/ML engineering track expansion ($200K) aligned with Tkxel''s new AI practice.',
    'Perficient actively recruiting two of our embedded engineers. Tkxel evaluating in-house hiring for Salesforce roles.',
    '"Your team slots in like they were already part of Tkxel — the Salesforce expertise especially has been a differentiator on client pitches." — Wajih, COO',
    TRUE, 2, 3
  );

  -- ── Retention / growth services ───────────────────────────────────────────────
  DELETE FROM public.retention_growth WHERE account_id = tkxel_id;
  INSERT INTO public.retention_growth (id, account_id, service, offered, delivered, applicable, tracking_note) VALUES
    (gen_random_uuid(), tkxel_id, 'Salesforce Staff Augmentation',      TRUE,  TRUE,  TRUE,  '6 certified Salesforce developers embedded. Client satisfaction strong. Utilisation 94%.'),
    (gen_random_uuid(), tkxel_id, 'Microsoft Azure Cloud Engineering',  TRUE,  TRUE,  TRUE,  'Active on a Tkxel enterprise client migration project. 3 Azure engineers deployed since Jan 2025.'),
    (gen_random_uuid(), tkxel_id, 'AI/ML Engineering Track',            TRUE,  FALSE, TRUE,  'Proposal accepted Q2 2026. 2 ML engineers being allocated. Start date: July 2026.'),
    (gen_random_uuid(), tkxel_id, 'Managed Services Retainer',          FALSE, FALSE, TRUE,  'White-space — Tkxel''s COO expressed interest in a dedicated support retainer post-project. Draft to be presented at Sep renewal.'),
    (gen_random_uuid(), tkxel_id, 'SAP Integration Services',           FALSE, FALSE, FALSE, 'Not applicable — Tkxel does not carry SAP workloads in current portfolio.');

  -- ── Opportunities ─────────────────────────────────────────────────────────────
  DELETE FROM public.opportunities WHERE account_id = tkxel_id;
  INSERT INTO public.opportunities (id, account_id, title, source, signal_date, potential, confidence, next_step) VALUES
    (gen_random_uuid(), tkxel_id, 'AI/ML Engineering Practice Expansion',      'COO discussion — Q2 planning session',   '2026-04-03', 200000, 'High',   'Confirm resource allocation by June 15. Present team profiles to Asad Ali.'),
    (gen_random_uuid(), tkxel_id, 'Managed Services Retainer Post-Sep Renewal','Renewal planning meeting with Wajih',     '2026-05-14', 180000, 'Medium', 'Bundle into renewal conversation. Prepare pricing model by Aug 2026.');

  -- ── Activities ────────────────────────────────────────────────────────────────
  DELETE FROM public.activities WHERE account_id = tkxel_id;
  INSERT INTO public.activities (id, account_id, area, title, owner, due, status, rag, expected_lift) VALUES
    (gen_random_uuid(), tkxel_id, 'Relationship', 'Schedule CEO quarterly sync — last one was 10 weeks ago',           'Bashair Ahmad', 'In 5d',    'Open',        'A', '+0.5 relationship'),
    (gen_random_uuid(), tkxel_id, 'Project',       'AI/ML engineer handover — allocate 2 resources for July start',    'Bashair Ahmad', 'In 15d',   'In Progress', 'G', 'Unblock AI track'),
    (gen_random_uuid(), tkxel_id, 'Profit',        'Prepare managed-services retainer proposal for Sep renewal bundle', 'Bashair Ahmad', 'In 60d',   'Open',        'G', '+$180K ARR'),
    (gen_random_uuid(), tkxel_id, 'Resource',      'Address knowledge-transfer doc gap for Azure workstream',          'Bashair Ahmad', 'In 10d',   'Open',        'A', 'Risk mitigation'),
    (gen_random_uuid(), tkxel_id, 'Financial',     'Initiate renewal discussion with Wajih 90 days before Sep 30',     'Bashair Ahmad', 'In 30d',   'Open',        'G', 'Secure 24-month extension');

  -- ── Escalations ───────────────────────────────────────────────────────────────
  DELETE FROM public.escalation_action_items WHERE escalation_id IN (SELECT id FROM public.escalations WHERE account_id = tkxel_id);
  DELETE FROM public.escalations WHERE account_id = tkxel_id;

  -- One resolved P2 escalation for realistic history
  INSERT INTO public.escalations
    (id, account_id, title, priority, sla_remaining_hours, opened_at, rca,
     description, recommendation, realistic_check, client_feedback, stakeholders)
  VALUES (
    gen_random_uuid(), tkxel_id,
    'Salesforce Deployment Freeze — Feb 2025 Release Delay',
    'P2', 0,
    '2025-02-11 09:15:00+00',
    'A misconfigured sandbox-to-production deployment pipeline caused a 36-hour release freeze on a live client project.',
    'Tkxel''s end client experienced a feature release delay of 36 hours in Feb 2025. Root cause: sandbox metadata conflict introduced during a hotfix merge. Wajih escalated at T+4h. Issue resolved within SLA.',
    'Implemented pre-deployment metadata validation step and added a mandatory peer-review gate for hotfix merges.',
    'Validation step added to CI pipeline. Peer-review gate live since Mar 2025. No repeat incidents.',
    '"Appreciate the quick turnaround and the process improvement — the new validation step has already caught two potential issues." — Wajih, COO',
    ARRAY['Wajih', 'Asad Ali', 'Bashair Ahmad']
  );

  -- ── Education log ─────────────────────────────────────────────────────────────
  DELETE FROM public.education_log WHERE account_id = tkxel_id;
  INSERT INTO public.education_log (id, account_id, date, topic, approach, outcome) VALUES
    (gen_random_uuid(), tkxel_id, 'APR 03, 2026', 'Salesforce Agentforce — Enabling Tkxel''s AI Practice',               'Hands-on workshop with Tkxel''s Salesforce lead team (10 engineers, half-day)',         'Tkxel approved expansion of AI/ML engineering track. 2 engineers to be onboarded July 2026.'),
    (gen_random_uuid(), tkxel_id, 'NOV 18, 2025', 'Azure Well-Architected Framework Review',                             'Joint architecture review session with Asad Ali and 3 cloud engineers (2-hour session)', 'Identified 4 cost-optimisation opportunities. Estimated $28K annual cloud spend reduction for Tkxel''s client.'),
    (gen_random_uuid(), tkxel_id, 'JUN 12, 2025', 'Delivery Excellence — Sprint Cadence & CI/CD Best Practices',         'Lunch-and-learn with Tkxel''s embedded team (8 attendees)',                             'Adopted standardised sprint retro format and CI/CD checklist across all Tkxel project tracks.');

  -- ── Notifications ─────────────────────────────────────────────────────────────
  DELETE FROM public.notifications WHERE account_id = tkxel_id;
  INSERT INTO public.notifications (id, account_id, title, body, time, type, read) VALUES
    (gen_random_uuid(), tkxel_id, 'CEO sync overdue — Tkxel',             'Last CEO touchpoint was 10 weeks ago. Schedule Q2 quarterly review with Umair Javed.', '3h ago',    'action', FALSE),
    (gen_random_uuid(), tkxel_id, 'AI/ML resource allocation due',        'July start confirmed. Allocate 2 ML engineers and share profiles with Asad Ali by Jun 15.', '1 day ago', 'action', FALSE),
    (gen_random_uuid(), tkxel_id, 'Renewal window opens in 112 days',     'Tkxel contract expires Sep 30 2026. Begin managed-services retainer proposal by Aug 1.', '2 days ago','info',   TRUE);

  RAISE NOTICE 'Imara-IHG (id: %) and Tkxel (id: %) seeded successfully.', ihg_id, tkxel_id;

END $$;
