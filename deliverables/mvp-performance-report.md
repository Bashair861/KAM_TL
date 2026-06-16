# KAM TL MVP Performance Report

Generated: 2026-06-11  
Scope: Local production build and static application audit for the KAM TL MVP  
Branch audited: `Integration` local working copy, which was 1 commit behind `origin/Integration` at audit start  
Command used: `npm.cmd run build`

## Executive Summary

The MVP is functional and production-buildable. The application is acceptable for a demo or controlled MVP rollout, but it has clear performance pressure points:

- The dashboard and Client 360 areas are the primary speed risks.
- The Client 360 route is very large and should be split before broader usage.
- TanStack Query is helping with caching and async UX, but some high-value queries still load eagerly.
- External integrations such as OpenAI, Google Calendar, Jira, Salesforce, Fireflies, and news lookup are the biggest response-time variables.
- The build passes, but Vite reports large chunks, which means first-load JavaScript can be improved.

Overall MVP performance rating: **MVP-ready with optimization required before scale**.

## Measured Build Results

| Metric | Application Response | Evidence | Impact |
|---|---|---|---|
| Production build | Passed successfully | `npm.cmd run build` completed | App can be packaged for deployment |
| Client modules transformed | 2,106 modules | Vite build output | Moderate-to-large frontend dependency graph |
| SSR modules transformed | 2,284 modules | Vite build output | Server bundle also carries significant app logic |
| Client build time | ~11.32s | Vite client output | Healthy for local build |
| SSR build time | ~10.96s | Vite SSR output | Healthy for local build |
| Bundle warning | Present | Vite warned that some chunks exceed 500 KB | Main performance concern for initial load |

## Largest Client Assets

| Asset | Size | Performance Meaning |
|---|---:|---|
| `index-DiHs-VEw.js` | 723.49 KB | Main/dashboard-level chunk is large |
| `accounts._accountId-CAA2C01h.js` | 458.65 KB | Client 360 route is heavy |
| `styles-CkaHFRHH.css` | 103.40 KB | CSS size is acceptable but worth monitoring |
| `index-DZc4Ztun.js` | 35.23 KB | Secondary dashboard chunk |
| `dialog-BIqATDtS.js` | 29.57 KB | Dialog UI primitives add shared UI cost |
| `utils-B0jYv4a0.js` | 27.12 KB | Shared utility bundle |
| `escalations-C33lprlb.js` | 23.55 KB | Escalations page is moderate |

Application response: route-level chunking exists, but the main dashboard and Client 360 chunks are still large enough to affect first load, especially on slower laptops, VPNs, or mobile networks.

## Largest Server Assets

| Asset | Size | Performance Meaning |
|---|---:|---|
| `accounts._accountId-D44UcU9T.js` | 904.05 KB | Server-side Client 360 route is very large |
| `server-vYXHKVCR.js` | 715.72 KB | Server runtime bundle is large |
| `index-B80FucMh.js` | 700.32 KB | Server dashboard/index bundle is large |
| `router-BCTgSP97.js` | 225.95 KB | Router/runtime overhead is moderate |
| `db-DljA8qbz.js` | 203.95 KB | Database service module is broad |

Application response: the server can render and serve the app, but large server bundles may increase cold start cost if deployed to an edge/serverless runtime.

## Source Hotspots

| File | Size / Complexity | Application Response |
|---|---:|---|
| `src/routes/accounts.$accountId.jsx` | 467.43 KB, 12,272 lines | Biggest route; many tabs/features live in one route |
| `src/routes/index.jsx` | 56.46 KB, 1,384 lines | Dashboard is feature-rich but still manageable |
| `src/routes/escalations.jsx` | 38.83 KB, 880 lines | Moderate route complexity |
| `src/services/db.js` | 134.37 KB | Central DB service is large and broad |
| `src/services/ai.js` | 56.37 KB | Ask AI has meaningful complexity from security, masking, and model fallback |
| `src/services/calendar.js` | 38.38 KB | Calendar integration adds external API latency risk |

Application response: the app has grown beyond a small MVP code shape. It still works, but the biggest modules should be decomposed to improve load speed, maintainability, and future AI feature expansion.

## Data Fetching and Runtime Behavior

| Factor | Current Application Response | Evidence | Performance Risk |
|---|---|---|---|
| TanStack Query usage | Strong async/caching foundation | 37 `useQuery` hooks | Good, but cache settings are inconsistent |
| Mutations | Many interactive write paths | 53 `useMutation` hooks | Good UX potential, but invalidation can trigger extra refetches |
| Server functions | Full-stack logic is colocated | 50 `createServerFn` usages | Good architecture, but server endpoints need timing logs |
| Dashboard initial load | Loads accounts, escalations, action items, news, calendar | 5 queries, 3 mutations, 4 server functions | Can feel slow if Supabase or external APIs are slow |
| Client 360 load | Very feature-rich and query-heavy | 17 queries, 28 mutations, 6 server functions | Highest route-level latency and bundle risk |
| News data | Cached for long intervals | `staleTime` and `refetchInterval` set to 12 hours | Good for speed and API cost |
| Calendar data | Cached briefly | `staleTime` set to 5 minutes | Good MVP balance |
| Account tabs | Many features live in one route file | 12k+ line route | Needs lazy loading by tab |

## External Integration Impact

| Integration | Application Response | Speed Impact | Recommendation |
|---|---|---|---|
| Supabase | Primary data source for accounts, tasks, health scores, users, notifications | Core page speed depends on Supabase query latency and RLS/index quality | Add query timing logs and check indexes on `account_id`, `assigned_kam_id`, `health_score_id`, `created_at` |
| OpenAI | Used for Ask AI, summaries, recommendations, insights | Can be slow due to model latency and context size | Continue using concise prompts, masked context, usage tracking, and fallback handling |
| Google Calendar | Dashboard calendar and scheduling integration | External API latency and OAuth/token refresh can delay calendar widgets | Keep 5-minute cache; load calendar after core dashboard content |
| Jira | Escalation import and analysis | External network/API dependency | Run Jira actions on user demand, not page load |
| Salesforce | Account lookup/sync | External network/API dependency | Keep sync explicit and avoid blocking dashboard render |
| Fireflies | Meeting summaries and action extraction | Potentially heavy transcript/API processing | Keep transcript/AI processing async or on-demand |
| Portfolio News | Public news refresh | External fetch + parsing can be slow | Current 12-hour cache is good for MVP |

## Current Strengths

- Production build passes.
- TanStack Query gives caching, loading states, invalidation, and mutation control.
- News and calendar already use cache windows, preventing constant refreshes.
- Dashboard role scoping reduces data size for regular KAM users.
- Ask AI has model fallback, masking, demasking, usage logging, and role-based access control.
- Heavy external integrations are mostly handled through server functions instead of directly in UI code.
- Route-level splitting exists; not everything is shipped as one file.

## Current Performance Risks

| Risk | Why It Matters | Severity |
|---|---|---|
| Main dashboard bundle is large | First page load can slow down | High |
| Client 360 route is too large | Loading and navigating to accounts can feel heavy | High |
| Client 360 has many queries | Network waterfalls can happen if queries run together without prioritization | High |
| `db.js` is a broad service module | Server/client bundling can pull more logic than needed | Medium |
| External APIs affect perceived speed | AI, Calendar, Jira, Salesforce, Fireflies can vary by network/provider | Medium |
| Build warns about chunks > 500 KB | Indicates future Lighthouse/Web Vitals risk | Medium |
| Limited runtime timing telemetry | We know build size, but not exact production TTFB/LCP/INP yet | Medium |

## Recommended Optimization Roadmap

### Priority 1: Before Demo / Short Term

1. Keep dashboard core data first, external widgets second.
2. Avoid loading Google Calendar until session/profile is available, which is already mostly done.
3. Keep portfolio news on 12-hour cache.
4. Ensure demo environment uses production build, not dev server.
5. Add simple timing logs around dashboard server functions and Supabase calls.

### Priority 2: Before Wider MVP Usage

1. Split `accounts.$accountId.jsx` by tab using lazy-loaded components.
2. Lazy load AI panels, meeting history, Fireflies, retention/growth, activity score, and education sections.
3. Add route-level suspense/loading states for account sub-tabs.
4. Split `db.js` into focused modules such as `accounts-db.js`, `tasks-db.js`, `ai-db.js`, `calendar-db.js`, and `notifications-db.js`.
5. Add stale times for account-level queries where real-time freshness is not required.
6. Add Supabase indexes for high-frequency filters.

### Priority 3: Scale / Production Hardening

1. Add Web Vitals collection for LCP, INP, CLS, TTFB.
2. Track server-function duration and Supabase query duration.
3. Track external API latency separately from app latency.
4. Add bundle analyzer reporting to CI.
5. Use manual chunks for large shared libraries if needed.
6. Add pagination or virtualization for long lists such as history, tasks, meetings, and action items.

## Suggested Performance KPIs

| KPI | MVP Target | Notes |
|---|---:|---|
| Dashboard initial usable render | < 2.5s on office Wi-Fi | Excluding first cold server start |
| Client 360 initial usable render | < 3.5s | This is the hardest route |
| Ask AI first response | < 8-12s | Depends heavily on OpenAI model and context size |
| Calendar widget response | < 2s cached, < 6s uncached | Depends on Google API |
| Route bundle size | < 300 KB per major route | Client 360 currently exceeds this |
| Main dashboard JS gzip | < 180 KB ideal | Current output indicates ~220 KB gzip for main large chunk |
| Server function p95 | < 1s for DB-only, < 12s for AI | Separate DB and AI targets |

## Application Response by Factor

| Factor | Our Application Response |
|---|---|
| Large dashboard bundle | App builds and works, but initial JS is heavier than ideal |
| Large Client 360 route | Feature-rich page works, but route should be split by tab |
| Data caching | Good foundation via TanStack Query; news/calendar caching already applied |
| Server-side work | TanStack Start server functions centralize sensitive work and integrations |
| Database access | Supabase is the primary bottleneck candidate; role-scoped queries help |
| AI requests | Protected by guardrails, masking, demasking, usage logging, and fallback model selection |
| External APIs | Mostly on-demand or cached, but still affect perceived speed |
| Mobile performance | Likely acceptable for dashboard viewing, but Client 360 may be heavy |
| Demo readiness | Good if using production build and stable network |
| Scale readiness | Needs bundle splitting, telemetry, and DB/index review |

## Final Assessment

The MVP is in a healthy functional state and can be demoed. The biggest performance concern is not correctness; it is payload and complexity concentration. The dashboard and Client 360 have accumulated many capabilities, and that is normal for a fast-moving MVP. The next architectural step should be to split heavy routes into lazy-loaded feature modules and add runtime telemetry so performance decisions are based on actual user timings, not only build output.

Recommended next action: **optimize Client 360 first**, because it is the largest route, has the most queries, and carries the highest risk of slow navigation as more account intelligence is added.
