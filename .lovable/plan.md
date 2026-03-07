

# Fix: Remove 1,000-Row Query Cap

## Problem
The database contains **3,907 repo rows** (3,771 unique repos, 3,426 unique owners), but the frontend only fetches the first 1,000 due to the default query limit. This means ~73% of discovered repos are invisible in the longlist.

## Solution
Add a `fetchAllRows` helper that paginates using `.range()` in batches of 1,000, and apply it to all queries that could exceed 1,000 rows.

## Changes

### `src/hooks/useSignalPipeline.ts`

1. **Add a `fetchAllRows` utility function** that takes a Supabase query builder, loops with `.range(from, from+999)` in batches of 1,000, and concatenates all results until a batch returns fewer than 1,000 rows.

2. **Update `useAllRepos`** — replace the single `.select("*")` call with the paginated helper so all 3,900+ rows are fetched.

3. **Update `useRunRepos`** — same pagination fix (a single run could have 3,000+ repos).

4. **Update `useLeads`** — the sub-query fetching repo IDs (`.select("id").eq("run_id", runId)`) and the "all people" query both need pagination.

5. **Update `useRuns`** repo count helper — the `.select("run_id")` call in `useRuns` that counts repos per run needs pagination.

No database changes, no edge function changes, no new files. Just fixing the frontend fetch cap.

