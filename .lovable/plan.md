

## Plan: Add Pause Button + Per-Run Resume Loading State

### Problem
1. Running searches have no "Pause" button — you have to wait for them to time out
2. When clicking "Resume", the loading spinner shows on **all** runs because `useResumeRun` has a single shared `isPending` state

### Changes

**`src/hooks/useSignalPipeline.ts`**
- Add a new `usePauseRun` mutation that updates the run's status to `"paused"` directly in the `runs` table (the edge function checks status and will stop on next iteration)

**`src/pages/RunsPage.tsx`**
- Add `useState<string | null>` to track which specific run ID is currently being resumed
- When clicking Resume, set the active run ID; clear it on success/error
- Show the spinner only on the run whose ID matches the active one
- Add a **Pause** button for runs with `status === "running"` — calls `usePauseRun` with the same per-run tracking pattern

**`supabase/functions/search-repos/index.ts`**
- Before each search iteration, re-fetch the run's `status` from the database. If it's been set to `"paused"`, stop the loop gracefully and save progress (watermarks, cursor, repo count) — same as the existing timeout logic

### UI Result
- Running searches show a "Pause" button
- Paused/timed-out searches show a "Resume" button  
- Only the specific run you clicked shows the loading spinner

