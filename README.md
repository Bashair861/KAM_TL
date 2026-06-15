# Aether KAM

Aether KAM is an internal **Key Account Management (KAM) portal** for an IT services organization. It gives KAMs, Heads of KAM, and CEOs a single place to track client health, contracts, retention/growth opportunities, escalations, activities, and meeting intelligence — with AI-assisted recommendations layered on top.

> Status: actively developed. Originally built as a static prototype, it is progressively wired to a real Supabase backend.

## Tech Stack

- **Frontend**: React 19 (JS/JSX) + Tailwind CSS v4
- **Routing/SSR**: TanStack Router (file-based routes) + TanStack Start (server functions via `createServerFn`)
- **Data fetching**: TanStack Query (React Query)
- **Backend**: Supabase (PostgreSQL, Auth, Row Level Security)
- **Build tool**: Vite 7
- **Hosting**: Cloudflare Pages / Workers (`wrangler`, `nodejs_compat`)
- **AI providers**: OpenAI (primary) and Google Gemini (fallback) for AI suggestions and summaries
- **Integrations**: Salesforce, Jira, Fireflies.ai, Google Calendar

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (or access to the shared dev project)
- (Optional) Python 3 — required for SOW document parsing

### Install

```bash
npm install
```

### Environment Variables

Create a `.env.local` file in the project root (this file is gitignored — never commit secrets).

| Variable | Required for |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Core app — Supabase client (browser + server) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only privileged operations (seeding, user admin, sync, AI) |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | AI suggestions, summaries, meeting fallback agent |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Fallback AI provider for LinkedIn/website summaries |
| `SALESFORCE_INSTANCE_URL`, `SALESFORCE_LOGIN_URL`, `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET` (or `SALESFORCE_ACCESS_TOKEN` / `SALESFORCE_ORG_ALIAS`) | Salesforce account lookup & field sync |
| `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY` | Jira escalation/issue sync |
| `FIREFLIES_API_KEY`, `FIREFLIES_WEBHOOK_SECRET`, `FIREFLIES_SYNC_SECRET` | Fireflies.ai meeting transcripts & webhooks |
| `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI` | Google Calendar integration |
| `SOW_PYTHON_COMMAND` | Optional override for the Python interpreter used to parse SOW uploads |

See [`docs/Aether-KAM-Security-Documentation.docx`](docs/Aether-KAM-Security-Documentation.docx) for the full security model, including how client vs. server-only secrets are separated.

### Run the app

```bash
npm run dev      # starts the Vite dev server (http://localhost:5174 or similar)
```

### Seed the database

```bash
npm run seed     # populates Supabase with sample accounts, profiles, and related data
```

### Build / Preview

```bash
npm run build
npm run preview
```

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the local dev server |
| `npm run build` | Production build |
| `npm run build:dev` | Development-mode build |
| `npm run preview` | Preview a production build locally |
| `npm run seed` | Seed the Supabase database (`src/db/seed.js`) |
| `npm run lint` | Run ESLint |
| `npm run format` | Run Prettier (write mode) |
| `npm test` | Runs `verify:retention-growth-rules` and `verify:kam-ai-security` regression checks |

## Roles & Permissions

| Role | Read | Write | Scope |
|---|---|---|---|
| **CEO** | Yes | No | All accounts (read-only) |
| **Head of KAM** | Yes | Yes | All accounts, plus user management, account creation, and KAM assignment |
| **KAM** | Yes | Yes | Only accounts assigned to them (`assigned_kam_id`) |

Unknown/unset roles default to `KAM` (least privilege). Access is enforced both in the UI and at the database layer via Supabase Row Level Security.

## Project Structure

```
src/
├── routes/              # File-based routes (pages)
├── components/          # Shared UI components
├── context/             # AuthContext (session + profile)
├── data/                # Static reference data, ROLE_PERMISSIONS, normalizeRole
├── services/            # All Supabase queries/mutations + server functions
│   ├── db.js            # Single data-access module for the client
│   ├── salesforce*.js   # Salesforce lookup + sync
│   ├── jira*.js         # Jira escalation sync + AI insights
│   ├── fireflies-*.js   # Meeting transcript agents
│   ├── ai*.js           # AI suggestions, usage tracking & cost dashboard
│   └── ...
├── lib/                  # Supabase client, utils, error handling
└── db/                   # SQL migrations, RLS policies, seed scripts
```

## Key Pages

| Route | Description |
|---|---|
| `/` | Home / portfolio dashboard |
| `/accounts` | Accounts portfolio (list view) |
| `/accounts/$accountId` | Account detail — overview, score matrices, contract, retention & growth, activity, escalations |
| `/contracts` | Contracts overview |
| `/contract-detail/$accountId` | Contract detail for an account |
| `/strategy` | Strategy / retention & growth planning |
| `/educate` | Education log |
| `/escalations` | Escalations tracker |
| `/users` | User management (Head of KAM only) |
| `/ai-costs` | AI usage & cost dashboard (Head of KAM only) |
| `/login`, `/set-password` | Authentication |
| `/calendar/callback` | Google Calendar OAuth callback |

## Security

A detailed security architecture document — covering authentication, RBAC, Row Level Security, secrets management, AI safety controls, third-party integrations, and recommendations — is available at:

📄 [`docs/Aether-KAM-Security-Documentation.docx`](docs/Aether-KAM-Security-Documentation.docx)
