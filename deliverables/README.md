# Aether KAM / KAM_TL

Aether KAM is an internal Key Account Management portal for tracking enterprise accounts, KYC details, stakeholders, contracts, account health, escalations, retention/growth planning, meeting intelligence, and AI-assisted KAM workflows.

The application is built with React, TanStack Start, Supabase, and server-side integrations for Salesforce, Fireflies, Jira, Calendar, and AI-assisted account intelligence.

## Tech Stack

- React 19
- TanStack Start, TanStack Router, and TanStack Query
- Vite
- Supabase Auth and Postgres
- Tailwind CSS
- Radix UI components
- Lucide React icons
- Recharts
- Cloudflare/Vite hosting configuration

## Main Features

- Portfolio dashboard for account health, KPIs, contracts, escalations, and activity signals
- Account detail workspace with KYC/account fields, stakeholders, health scores, contracts, activity, retention/growth, and meeting history
- Salesforce account/contact lookup and controlled sync into internal account, KYC, contract, and stakeholder fields
- Fireflies meeting extraction, meeting summaries, action items, and opportunity detection
- Jira and calendar integration support
- AI-assisted KAM insights with prompt safety, output minimization, usage tracking, and cost dashboard
- Role-aware user management for Head of KAM workflows
- Notification automation for assignments, escalations, action items, and contract renewals
- Supabase RLS migrations for account-scoped data access

## Project Structure

```text
src/
  components/       Shared UI and layout components
  context/          Auth/session context
  data/             Reference and fallback data
  db/               Supabase schema, migrations, RLS policies, and seed scripts
  hooks/            Shared React hooks
  lib/              Client utilities, including Supabase client setup
  routes/           TanStack route files
  services/         Data access, integrations, AI, validation, and server functions
  types/            Shared type/reference files
  router.jsx        Router setup
  server.js         Server handlers, webhooks, scheduled jobs
  start.js          TanStack Start entrypoint
  styles.css        Global styles

docs/               Project documentation and generated security documents
scripts/            Verification and utility scripts
salesforce-local/   Local Salesforce helper files, gitignored
```

## Prerequisites

- Node.js installed and available on PATH
- npm installed with Node.js
- Supabase project access
- Required environment variables in `.env.local`

On Windows, if `npm` is installed but not recognized, confirm this folder is on PATH:

```powershell
C:\Program Files\nodejs
```

You can also run npm directly with:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run dev
```

## Setup

1. Install dependencies:

```powershell
npm install
```

2. Create `.env.local` in the project root.

Use real values from the team or local environment. Do not commit this file.

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

OPENAI_API_KEY=

SALESFORCE_INSTANCE_URL=
SALESFORCE_CLIENT_ID=
SALESFORCE_CLIENT_SECRET=
SALESFORCE_ACCESS_TOKEN=
SALESFORCE_ORG_ALIAS=

FIREFLIES_API_KEY=
FIREFLIES_WEBHOOK_SECRET=
FIREFLIES_SYNC_SECRET=

JIRA_BASE_URL=
JIRA_EMAIL=
JIRA_API_TOKEN=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

3. Start the development server:

```powershell
npm run dev
```

4. Open the local URL shown by Vite, usually:

```text
http://localhost:5173
```

## Available Scripts

```powershell
npm run dev
```

Starts the Vite development server.

```powershell
npm run build
```

Builds the application for production.

```powershell
npm run preview
```

Previews a production build locally.

```powershell
npm run lint
```

Runs ESLint across the project.

```powershell
npm run format
```

Formats the project with Prettier.

```powershell
npm run test
```

Runs the current verification suite:

- Retention/growth rules verification
- KAM AI security verification

```powershell
npm run seed
```

Runs the Supabase seed script.

## Database Setup

Database files live in `src/db`.

Important files include:

- `schema.sql` - base schema
- `setup-auth.sql` - auth/profile setup helpers
- `enable-rls.sql` - older RLS enablement file
- `secure-kam-ai-suggestions-rls.sql` - hardened KAM AI and account-scoped RLS policies
- `add-fireflies-secure-rls.sql` - Fireflies-specific RLS policies
- `add-user-management.sql` - user management support
- `add-notification-automation-triggers.sql` - notification automation
- `add-ai-usage-events.sql` - AI usage and cost tracking
- `seed.js` and `seed-imara-ihg-tkxel.sql` - seed data

When preparing a hosted environment, verify that hardened RLS migrations are applied and broad public read policies are removed from sensitive tables.

## Environment and Secrets

Do not commit real secrets.

The following are gitignored:

- `.env`
- `.env.local`
- `.env.*.local`
- `.dev.vars`
- `salesforce-local/`

Client-exposed variables must use the `VITE_` prefix only when they are safe to expose in the browser. Service-role keys, API keys, OAuth secrets, webhook secrets, and integration tokens must remain server-side.

## Integrations

### Supabase

Supabase is used for authentication, profiles, application data, RLS, and server-side privileged operations. Service-role access should only be used on the server after validating the signed-in user.

### Salesforce

Salesforce lookup and sync are used to retrieve Account and related Contact data. Sync should remain controlled and user-approved so unchecked fields are not overwritten.

### Fireflies

Fireflies integration supports meeting summaries, transcript-derived action items, webhook ingestion, and scheduled recent-meeting sync. Production deployments should require webhook and sync secrets.

### AI

AI features are focused on KAM assistance, field mapping, summarization, and account intelligence. The codebase includes prompt-injection checks, output minimization, and AI usage tracking.

## Security Notes

- Keep `.env.local` out of Git.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.
- Validate user access tokens before using server-side privileged clients.
- Keep Salesforce, Fireflies, Jira, Calendar, and AI credentials in server-only environment variables.
- Run AI security verification after changing AI prompts, AI schemas, or account intelligence behavior.
- Review RLS policies whenever adding new tables or changing account ownership logic.

Additional security documentation is available in `docs/`.

## Development Notes

- `src/routeTree.gen.js` is generated and gitignored.
- `node_modules`, `dist`, `.tanstack`, `.wrangler`, and local Salesforce artifacts are gitignored.
- The largest route is `src/routes/accounts.$accountId.jsx`; account detail changes should be tested carefully because many workflows meet there.
- Shared validation helpers live in `src/services/validation.js`.
- Supabase access and business data helpers are primarily in `src/services/db.js`.

## Recommended Before Pull Request

Run:

```powershell
npm run lint
npm run test
npm run build
```

Also check any related SQL migration manually if the change touches data access, RLS, service-role writes, integrations, or AI behavior.
