

## Plan: Add Longlist Runs Page + Longlist Page

The current nav flow is: **Initial list runs → Initial list → Shortlist**. We need to insert two new pages between "Initial list" and "Shortlist":

1. **Longlist runs** — where you trigger and monitor the 4-stage pipeline that processes initial list accounts
2. **Longlist** — the resulting filtered/scored list of accounts that made it through

### 1. Database Migration

**Table: `longlist_runs`** — tracks each longlist build job
- `id` (uuid PK), `source_run_id` (uuid, nullable — null means "all initial runs"), `status` (text: pending/running/paused/done), `progress` (jsonb — stage cursors, counts), `created_at`, `updated_at`

**Table: `longlist_candidates`** — one row per account processed
- `id` (uuid PK), `longlist_run_id` (uuid FK→longlist_runs), `login` (text), `stage` (text: pending/hydrated/repos_selected/parsed/scored/discarded)
- `discard_reason` (text nullable), `hydration` (jsonb), `candidate_repos` (jsonb), `repo_signals` (jsonb)
- `pre_score` (float default 0), `pre_confidence` (float default 0), `selection_tier` (text: exploit/explore/null)
- `created_at`, `updated_at`
- Unique on (longlist_run_id, login)

Both tables: RLS allow-all (no auth in this app).

### 2. Edge Function: `build-longlist/index.ts`

Resumable function (140s deadline + cursor pattern). Accepts `{ longlistRunId }`.

- **Stage 0**: Get unique `owner_login` from `repos` (filtered by source_run_id if set). For each, call GitHub API for account type + repos list. Early discard orgs, inactive, no-repos accounts.
- **Stage 1**: For each hydrated candidate, pick up to 8 repos (highest-star, most-recent, pinned).
- **Stage 2**: For each candidate repo, fetch tree + `package.json`. Compute deterministic signals (React/TS stack, depth, CI/tests, storybook, changelog, complex UI libs, anti-boilerplate penalties).
- **Stage 3**: Aggregate into PreScore + PreConfidence. Select top ~800 exploit + ~200 explore. Mark rest discarded.

Saves progress cursor to `longlist_runs.progress` on timeout; can be resumed.

### 3. New Pages

**`src/pages/LonglistRunsPage.tsx`** (`/longlist-runs`)
- Lists `longlist_runs` with status, candidate counts, created date
- "New Longlist Run" button (optionally select source initial-list run)
- "Resume" button for paused/timed-out runs
- Progress display: hydrated/discarded/scored/selected counts

**`src/pages/LonglistPage2.tsx`** (`/longlist-results`) — the actual Longlist view
- Table of `longlist_candidates` where `selection_tier` is exploit or explore
- Columns: login, PreScore, PreConfidence, tier (exploit/explore), key signals summary, link to GitHub
- Sortable by score/confidence, filterable by tier
- This is the "Longlist" — the accounts that survived the pipeline

### 4. NavBar + Routing Updates

**NavBar** links become:
```
Initial list runs | Initial list | Longlist runs | Longlist | Shortlist | Initial list approach | Job Desc
```

New icons: `Filter` for Longlist runs, `Users` for Longlist.

**App.tsx** — add routes:
- `/longlist-runs` → `LonglistRunsPage`
- `/longlist-results` → `LonglistPage2` (the longlist of surviving candidates)

### 5. Hooks

Add to `useSignalPipeline.ts`:
- `useLonglistRuns()` — fetch from `longlist_runs`
- `useStartLonglistRun(sourceRunId?)` — insert + invoke edge function
- `useResumeLonglistRun()` — invoke edge function with existing ID
- `useLonglistCandidates(longlistRunId?, tierFilter?)` — fetch scored candidates

### Implementation Order

1. Database migration (2 tables)
2. Edge function `build-longlist` (stages 0-3, resumable)
3. Hooks
4. LonglistRunsPage + LonglistPage (results)
5. NavBar + App.tsx routing

