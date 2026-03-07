

# Resumable Search Runs

## Problem
Even a single-net search can require 240+ GitHub API calls, exceeding the 140s edge function limit. The function saves partial results but cannot continue from where it stopped.

## Solution
Store a progress cursor in `search_params` so runs can be resumed from where they left off. Add a "Resume" button to the UI.

## Changes

### 1. Edge Function (`supabase/functions/search-repos/index.ts`)

- Accept optional `runId` parameter to resume an existing run
- When `runId` is provided: load the run, read `search_params.cursor`, skip all loop iterations before the cursor position
- Cursor shape: `{ netIdx, queryIdx, bandIdx, sortIdx, page }` — indexes into the nested loops
- On timeout: save cursor + set status to `"paused"` (instead of `"completed"`)
- On natural completion: set status to `"completed"` with no cursor
- When resuming, re-collect already-flushed repos into `flushedKeys` by querying existing repos for that run
- Preserve existing `search_params` fields (nets, perPage, maxPages, repos_found) when updating cursor

### 2. Frontend Hook (`src/hooks/useSignalPipeline.ts`)

- Add `useResumeRun` mutation that calls `search-repos` with `{ runId }` (the edge function reads saved params from the run row)

### 3. UI (`src/pages/RunsPage.tsx`)

- Add `"paused"` to `statusConfig` with a `Pause` icon and amber styling
- Show a **Resume** button on paused runs (calls `useResumeRun`)
- Keep showing repo count and "Partial" indicator on paused runs

### Flow
```text
Start run (1 net) → runs ~140s, processes 200/240 queries
  → saves cursor {netIdx:0, queryIdx:1, bandIdx:4, sortIdx:0, page:3}
  → status = "paused"
  → UI shows amber "Paused" + Resume button

Click Resume → edge function loads cursor, skips to saved position
  → processes remaining 40 queries (~28s)
  → status = "completed"
```

