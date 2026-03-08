<p align="center">
  <img src="./public/favicon.ico" alt="Hash Hiring Tool logo" width="96" height="96" />
</p>
 
# Hash Hiring Tool
 
Internal recruiting tool for sourcing and evaluating frontend engineers from GitHub activity.
 
## Overview
 
This project combines a React frontend with Supabase tables and Edge Functions to run a 3-stage sourcing pipeline:
 
1. `Initial List`: GitHub repo discovery across predefined search nets.
2. `Longlist`: deterministic candidate scoring from GitHub metadata.
3. `Shortlist`: LLM-assisted rubric evaluation with evidence and outreach draft generation.
 
The app is optimized for operational use by recruiters/hiring managers: run orchestration, candidate review states, CSV export, and per-candidate deep dives.
 
## Product Areas (Routes)
 
| Route | Purpose |
| --- | --- |
| `/start` | onboarding + workflow explanation |
| `/sourcing` | run orchestration for Initial List / Longlist / Shortlist |
| `/longlist` | global Initial List repository view |
| `/longlist-results` | merged longlist candidate view (sorted + unsorted) |
| `/shortlist` | enriched candidates table + filters + CSV export |
| `/leads/:login` | candidate detail page with rubric breakdown + outreach draft |
| `/approach` | methodology docs for all 3 stages |
| `/job` | target role/job description |
 
## Architecture
 
### Frontend
 
- React 18 + TypeScript + Vite
- React Router for route-level pages
- TanStack Query for server state
- Supabase JS client for data + function invocation
- Tailwind CSS + shadcn/ui components
 
### Backend (Supabase)
 
- Postgres tables for runs, repos, candidates, evidence
- Edge Functions:
  - `search-repos` (Initial List discovery with auto-continue)
  - `build-longlist` (candidate seeding/hydration/scoring)
  - `run-shortlist` + `enrich-candidate` (LLM shortlist enrichment)
  - `run-enrichment` + `enrich-repo` (repo-level enrichment path)
 
## Data Model (Core Tables)
 
- `runs`, `repos`, `repo_signals`
- `longlist_runs`, `longlist_candidates`
- `shortlist_runs`
- `people`, `person_evidence`
- `pipeline_runs` (orchestration/logging support)
 
Migrations live in `supabase/migrations`.
 
## Local Development
 
### Prerequisites
 
- Node.js 18+ (Node 20 recommended)
- npm
- Supabase project access (for hosted backend) or Supabase CLI (for local backend)
 
### 1) Install and run frontend
 
```bash
npm install
npm run dev
```
 
Frontend runs on `http://localhost:8080`.
 
### 2) Configure frontend environment (`.env`)
 
Required variables:
 
```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```
 
### 3) Configure Supabase Edge Function secrets
 
Set in Supabase project secrets (or local function env):
 
- `GITHUB_TOKEN` (recommended to avoid strict anonymous rate limits)
- `LOVABLE_API_KEY` (required for LLM-powered enrichment functions)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
 
## Scripts
 
```bash
npm run dev         # start Vite dev server
npm run build       # production build
npm run build:dev   # development-mode build
npm run preview     # preview build output
npm run lint        # ESLint
npm run test        # Vitest (run once)
npm run test:watch  # Vitest watch mode
```
 
## Operational Notes
 
- GitHub API limits are a hard constraint; long-running stages are chunked and resumable.
- `search-repos` stores cursor/checkpoint state and self-invokes to continue automatically.
- Longlist scoring is deterministic (metadata-based), shortlist scoring is LLM-based.
- Review statuses are persisted in `people.review_status` (`pending`, `shortlisted`, `on_hold`, `rejected`).
- This is an internal tool; RLS policies are permissive (`USING (true)` / `WITH CHECK (true)`).
 
## Pipeline Rules (Current Implementation)
 
- Longlist candidate display focuses on `pre_score` between `70` and `82`.
- Shortlist run ingestion currently processes candidates with `pre_score >= 70`.
- Shortlist table applies location-aware score gates:
  - Germany / UK: `> 50`
  - Rest of Europe: `> 65`
  - Rest of World: `> 80`
 
## Repository Structure
 
```text
src/
  components/          # shared UI + domain components
  hooks/               # React Query hooks for runs/candidates/enrichment
  pages/               # route-level screens
  integrations/supabase/
supabase/
  functions/           # edge functions for pipeline stages
  migrations/          # schema evolution
public/
  favicon.ico          # project logo used above
```
 
## Testing
 
- Test setup is in `src/test/setup.ts`.
- Example test exists in `src/test/example.test.ts`.
