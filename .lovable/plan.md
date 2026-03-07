

# Repo-First Signal Extraction Pipeline

## Overview
Replace the current user-search approach with a **repo-first** pipeline: discover repos matching specific criteria, extract structured signals from each, then roll up to people (leads) with scored evidence. This is a fundamental rearchitecture of both backend and frontend.

## Phased Approach
Given the scope, I recommend building this in phases. **Phase 1** (this implementation) covers the full pipeline for **Criterion #1 (React+TS+CSS)** plus baseline identity, with the architecture designed to plug in Criteria B-J later.

---

## Database Schema (5 tables)

```text
runs
  id (uuid PK)
  status (text: pending/running/completed/failed)
  search_params (jsonb) -- query config
  created_at, updated_at

repos
  id (uuid PK)
  run_id (FK runs)
  full_name (text, unique per run)
  metadata (jsonb) -- stars, forks, topics, languages, created/pushed dates
  owner_login (text)
  created_at

repo_signals
  id (uuid PK)
  repo_id (FK repos)
  criterion (text) -- e.g. 'react_ts_css', 'documentation', 'versioning'
  signal_value (float 0-1)
  confidence (float 0-1)
  evidence (jsonb[]) -- [{url, snippet, label}]
  notes (text)
  created_at

people
  id (uuid PK)
  login (text, unique)
  profile (jsonb) -- name, avatar, bio, blog, email, orgs, etc.
  overall_score (float)
  created_at, updated_at

person_evidence
  id (uuid PK)
  person_id (FK people)
  repo_id (FK repos, nullable)
  criterion (text)
  score (float)
  evidence (jsonb[])
  created_at
```

No RLS needed -- this is a single-user internal tool with no auth.

---

## Edge Functions (3 functions, replacing the single `github-candidates`)

### 1. `search-repos` (new)
- Accepts search config: min stars, pushed-after date, topics
- Runs multiple GitHub repo search queries (the union strategy from the spec):
  - `topic:react language:TypeScript archived:false fork:false`
  - `topic:nextjs language:TypeScript`
  - `topic:tailwindcss topic:react language:TypeScript`
- Deduplicates results, creates a `run` row, inserts discovered `repos`
- Returns run ID + count

### 2. `enrich-repo` (new)
- Accepts `repo_id` or `full_name`
- Fetches from GitHub API:
  - Repo metadata (languages breakdown, topics, dates, stars, forks)
  - Key files: `package.json`, `tsconfig.json`, `tailwind.config.*`, `postcss.config.*`, `vite.config.*`, `next.config.*`
  - Directory listing of root + `src/` to detect structure (`components/`, `pages/`, `app/`)
  - Releases/tags list
  - README content (first 5KB)
- Runs **Criterion #1 scoring** (React evidence, TS evidence, CSS evidence, substantial gate)
- Stores results in `repo_signals`
- Identifies repo owner, upserts into `people` table, creates `person_evidence`
- Returns the enriched repo + signals

### 3. `run-enrichment` (new, orchestrator)
- Accepts `run_id`
- Loads all repos for that run, calls `enrich-repo` logic for each (batched, 3 at a time)
- After all repos processed, runs person rollup: for each person, picks max score across their repos per criterion
- Updates `people.overall_score`
- Updates `run.status` to completed

Delete the old `github-candidates` function.

---

## Criterion #1 Scoring Logic (inside `enrich-repo`)

Implemented exactly as specified:

- **ReactScore**: 1.0 if `react` in package.json dependencies; 0.7 if topic match + TSX bytes; else 0
- **TSScore**: 1.0 if tsconfig.json exists AND TS/TSX bytes >= 50KB; 0.7 if bytes high but no tsconfig; else 0
- **CssScore**: min(1.0, sum of weights) -- tailwind=0.5, postcss=0.2, styling-lib=0.3, CSS bytes=0.2
- **Substantial gate**: TS/TSX bytes >= 50KB AND pushed within 18 months AND no template keywords in description/README
- **Final**: `0.4*React + 0.4*TS + 0.2*CSS` (only if substantial gate passes)

Evidence array stores URLs to the exact files that triggered each signal.

---

## Frontend Pages (4 pages)

### Runs page (`/` -- replaces current Index)
- List of past runs with status, date, repo count
- "New Run" button opens a config form: min stars, date cutoff, topic filters
- Click a run to see its leads

### Leads page (`/runs/:runId/leads`)
- Grid of lead cards (people), sorted by overall score
- Each card: avatar, name, login, overall score bar, top criterion badges, top repo link
- Filter/sort controls: by score, by criterion

### Lead detail (`/leads/:login`)
- Full profile info (bio, blog, orgs)
- Per-criterion breakdown with score, confidence, evidence links
- List of their repos with per-repo scores

### Repo detail (`/repos/:fullName`)
- Repo metadata (stars, forks, languages chart, topics)
- Criterion #1 signal breakdown with clickable evidence (links to package.json, tsconfig, etc. on GitHub)
- Substantial gate result with explanation

### Job description page (`/job`)
- Kept as-is

### Navigation
- Top nav bar with: Runs | Leads | Job Description

---

## Technical Notes

- All GitHub API calls go through edge functions (token stays server-side)
- Rate limit management: batch processing with delays, 3 concurrent enrichments
- React Query for data fetching with appropriate cache times
- Recharts for score visualization on lead/repo detail pages
- The architecture is designed so adding Criteria B-J later means adding scoring modules to `enrich-repo` and new UI sections -- no structural changes needed

