

## Add Pause Functionality to Shortlist Runs

### Frontend Changes

**`src/hooks/useShortlistPipeline.ts`** — Add `usePauseShortlistRun` mutation:
- Updates the `shortlist_runs` row directly: sets `status` to `"paused"` via Supabase client
- The running `run-shortlist` edge function already checks status before each batch — when it sees `"paused"`, it will stop processing

**`src/pages/ShortlistRunsPage.tsx`** — Add a Pause button:
- Show on runs with `status === "running"` (next to where Resume appears for paused runs)
- Uses the `Pause` icon (already imported)
- Calls `pauseRun.mutate(run.id)`

### Backend Change

**`supabase/functions/run-shortlist/index.ts`** — Add a status check inside the batch loop:
- Before processing each batch, re-fetch the run's status from `shortlist_runs`
- If status is `"paused"`, stop processing immediately (no self-chain)
- This makes the pause cooperative — the current batch finishes, then the function exits cleanly

### Summary of flow
1. User clicks Pause on a running run
2. Frontend sets `shortlist_runs.status = 'paused'` in DB
3. The edge function's next batch-loop iteration reads the status, sees "paused", and exits without self-chaining
4. UI shows the Pause icon and Resume button

