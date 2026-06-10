-- Migration: seed kpi_data for existing health_scores rows
-- Run once in Supabase SQL Editor.
-- Sets area-specific KPI section templates on every health_scores row
-- where kpi_data is currently NULL (all seeded accounts).
-- metricId is null — sections still score correctly via checkbox weights.

UPDATE public.health_scores
SET kpi_data = CASE area

  WHEN 'relationship' THEN '[
    {"id":"kpi-relationship-0","name":"CEO & Executive Engagement","metricId":null,"fields":[
      {"id":"relationship-0-0","label":"CEO-to-CEO meeting held this quarter","weight":40,"checked":false},
      {"id":"relationship-0-1","label":"Director-level meeting completed on schedule","weight":35,"checked":false},
      {"id":"relationship-0-2","label":"Executive sponsor actively engaged","weight":25,"checked":false}
    ]},
    {"id":"kpi-relationship-1","name":"Meeting Cadence","metricId":null,"fields":[
      {"id":"relationship-1-0","label":"Monthly cadence meetings held on schedule","weight":50,"checked":false},
      {"id":"relationship-1-1","label":"Action items closed before next cycle","weight":30,"checked":false},
      {"id":"relationship-1-2","label":"Meeting notes shared within 24 hours","weight":20,"checked":false}
    ]},
    {"id":"kpi-relationship-2","name":"Cooperation & Trust","metricId":null,"fields":[
      {"id":"relationship-2-0","label":"Client responsive to requests within 48 hours","weight":60,"checked":false},
      {"id":"relationship-2-1","label":"Joint planning or roadmap session completed","weight":40,"checked":false}
    ]}
  ]'::jsonb

  WHEN 'project' THEN '[
    {"id":"kpi-project-0","name":"Delivery Performance","metricId":null,"fields":[
      {"id":"project-0-0","label":"Sprint or milestone delivered on time","weight":50,"checked":false},
      {"id":"project-0-1","label":"Defect rate within agreed threshold","weight":30,"checked":false},
      {"id":"project-0-2","label":"No critical production incidents this cycle","weight":20,"checked":false}
    ]},
    {"id":"kpi-project-1","name":"Quality & Feedback","metricId":null,"fields":[
      {"id":"project-1-0","label":"Client feedback positive this cycle","weight":55,"checked":false},
      {"id":"project-1-1","label":"Feedback actioned and communicated back to client","weight":45,"checked":false}
    ]},
    {"id":"kpi-project-2","name":"Scope & Change Control","metricId":null,"fields":[
      {"id":"project-2-0","label":"Change requests formally reviewed and documented","weight":50,"checked":false},
      {"id":"project-2-1","label":"No unmanaged scope creep this cycle","weight":50,"checked":false}
    ]}
  ]'::jsonb

  WHEN 'white_space' THEN '[
    {"id":"kpi-white_space-0","name":"Service Penetration","metricId":null,"fields":[
      {"id":"white_space-0-0","label":"More than 3 active services currently delivered","weight":50,"checked":false},
      {"id":"white_space-0-1","label":"At least 1 new service proposed this quarter","weight":50,"checked":false}
    ]},
    {"id":"kpi-white_space-1","name":"Upsell & Growth Signals","metricId":null,"fields":[
      {"id":"white_space-1-0","label":"Upsell opportunity identified and logged in CRM","weight":50,"checked":false},
      {"id":"white_space-1-1","label":"White-space pitch scheduled with decision maker","weight":50,"checked":false}
    ]},
    {"id":"kpi-white_space-2","name":"Account Intelligence","metricId":null,"fields":[
      {"id":"white_space-2-0","label":"Account notes updated this month","weight":40,"checked":false},
      {"id":"white_space-2-1","label":"Competitive landscape reviewed","weight":30,"checked":false},
      {"id":"white_space-2-2","label":"Stakeholder map current and verified","weight":30,"checked":false}
    ]}
  ]'::jsonb

  WHEN 'contract' THEN '[
    {"id":"kpi-contract-0","name":"Contract Terms","metricId":null,"fields":[
      {"id":"contract-0-0","label":"Auto-renew clause in place","weight":35,"checked":false},
      {"id":"contract-0-1","label":"Non-terminator clause signed","weight":35,"checked":false},
      {"id":"contract-0-2","label":"Minimum one-year lock confirmed","weight":30,"checked":false}
    ]},
    {"id":"kpi-contract-1","name":"Compliance & Renewal","metricId":null,"fields":[
      {"id":"contract-1-0","label":"Process compliance score above 7 out of 10","weight":50,"checked":false},
      {"id":"contract-1-1","label":"Renewal conversation initiated 90 days before expiry","weight":50,"checked":false}
    ]},
    {"id":"kpi-contract-2","name":"Commercial Terms","metricId":null,"fields":[
      {"id":"contract-2-0","label":"Annual price-hike clause agreed and documented","weight":55,"checked":false},
      {"id":"contract-2-1","label":"Annual contract review meeting scheduled","weight":45,"checked":false}
    ]}
  ]'::jsonb

  WHEN 'csat' THEN '[
    {"id":"kpi-csat-0","name":"NPS & Surveys","metricId":null,"fields":[
      {"id":"csat-0-0","label":"NPS score collected and above 7 this quarter","weight":45,"checked":false},
      {"id":"csat-0-1","label":"Quarterly satisfaction survey completed","weight":35,"checked":false},
      {"id":"csat-0-2","label":"Low-score responses addressed within 2 weeks","weight":20,"checked":false}
    ]},
    {"id":"kpi-csat-1","name":"Support Quality","metricId":null,"fields":[
      {"id":"csat-1-0","label":"Support tickets resolved within SLA","weight":55,"checked":false},
      {"id":"csat-1-1","label":"CSAT rating of 4 or above on closed tickets","weight":45,"checked":false}
    ]},
    {"id":"kpi-csat-2","name":"Executive Sentiment","metricId":null,"fields":[
      {"id":"csat-2-0","label":"Executive sponsor expressed positive sentiment","weight":55,"checked":false},
      {"id":"csat-2-1","label":"No major complaints or unresolved escalations","weight":45,"checked":false}
    ]}
  ]'::jsonb

  WHEN 'risk' THEN '[
    {"id":"kpi-risk-0","name":"Competitive Risk","metricId":null,"fields":[
      {"id":"risk-0-0","label":"Competitor activity monitored and documented","weight":45,"checked":false},
      {"id":"risk-0-1","label":"Defense strategy or counter-proposal ready","weight":55,"checked":false}
    ]},
    {"id":"kpi-risk-1","name":"Relationship & POC Risk","metricId":null,"fields":[
      {"id":"risk-1-0","label":"Key POC stable — no resignation or transfer risk","weight":50,"checked":false},
      {"id":"risk-1-1","label":"C-level sponsor accessible and engaged","weight":50,"checked":false}
    ]},
    {"id":"kpi-risk-2","name":"Financial Risk","metricId":null,"fields":[
      {"id":"risk-2-0","label":"Invoice paid within agreed payment terms","weight":55,"checked":false},
      {"id":"risk-2-1","label":"No overdue balance outstanding","weight":45,"checked":false}
    ]},
    {"id":"kpi-risk-3","name":"Operational Risk","metricId":null,"fields":[
      {"id":"risk-3-0","label":"Compliance and regulatory requirements met","weight":50,"checked":false},
      {"id":"risk-3-1","label":"No geopolitical disruptions impacting delivery","weight":50,"checked":false}
    ]}
  ]'::jsonb

  WHEN 'resource' THEN '[
    {"id":"kpi-resource-0","name":"Backup & Continuity","metricId":null,"fields":[
      {"id":"resource-0-0","label":"Backup engineer assigned for every critical role","weight":55,"checked":false},
      {"id":"resource-0-1","label":"Knowledge transfer documentation up to date","weight":45,"checked":false}
    ]},
    {"id":"kpi-resource-1","name":"Staffing Stability","metricId":null,"fields":[
      {"id":"resource-1-0","label":"No unplanned attrition on account this month","weight":50,"checked":false},
      {"id":"resource-1-1","label":"Planned leaves managed without delivery impact","weight":50,"checked":false}
    ]},
    {"id":"kpi-resource-2","name":"Critical Resource Retention","metricId":null,"fields":[
      {"id":"resource-2-0","label":"Critical resources engaged and retained","weight":55,"checked":false},
      {"id":"resource-2-1","label":"Succession plan in place for key technical roles","weight":45,"checked":false}
    ]}
  ]'::jsonb

  WHEN 'financial' THEN '[
    {"id":"kpi-financial-0","name":"Revenue Performance","metricId":null,"fields":[
      {"id":"financial-0-0","label":"Monthly billing target met","weight":50,"checked":false},
      {"id":"financial-0-1","label":"ARR growth on track versus annual plan","weight":50,"checked":false}
    ]},
    {"id":"kpi-financial-1","name":"Margin & Efficiency","metricId":null,"fields":[
      {"id":"financial-1-0","label":"Resource utilization above 80 percent","weight":50,"checked":false},
      {"id":"financial-1-1","label":"Cost overruns within 5 percent of budget","weight":50,"checked":false}
    ]},
    {"id":"kpi-financial-2","name":"Commercial Growth","metricId":null,"fields":[
      {"id":"financial-2-0","label":"Upsell or expansion proposal submitted this quarter","weight":55,"checked":false},
      {"id":"financial-2-1","label":"Renewal pipeline initiated before 90-day mark","weight":45,"checked":false}
    ]}
  ]'::jsonb

END
WHERE kpi_data IS NULL;

-- Verify: should return 0 rows after running
SELECT id, account_id, area FROM public.health_scores WHERE kpi_data IS NULL;
