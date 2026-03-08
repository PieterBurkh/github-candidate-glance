

## Problem

When you click "Pause", the mutation sets the run's status to `"pausing"` in the database. The idea is that the *running* edge function will notice this on its next loop iteration and gracefully stop, then set the status to `"paused"` in its `finally` block.

But if the edge function has **already finished** (timed out, completed, or crashed), there's nothing running to pick up the `"pausing"` status and transition it to `"paused"`. So it stays stuck as "Pausing…" forever.

## Fix

Set the status directly to `"paused"` instead of `"pausing"`. Update the edge function to check for `"paused"` (instead of `"pausing"`) as the stop signal.

| File | Change |
|---|---|
| `src/hooks/useSignalPipeline.ts` | In `usePauseRun`, change the status update from `"pausing"` to `"paused"` |
| `supabase/functions/search-repos/index.ts` | Change the pause check from `status === "pausing"` to `status === "paused"` (line 396) |
| `src/pages/RunsPage.tsx` | Remove the `"pausing"` status config entry (no longer needed). Update `canPause` to check `run.status === "running"` (already does). Update `canResume` — already handles `"paused"`. |

The UI will immediately show "Paused" with a Resume button when you click Pause. If the function is still running, it will see `"paused"` on its next check and stop gracefully. If it's already done, the status is already correct.

