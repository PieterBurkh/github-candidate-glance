

# Make Timed-Out Runs Visible and Resumable

## Problem
Pre-resumable runs have `status: "completed"` with `search_params.timed_out: true`. They appear as green "Completed" in the UI, hiding the fact they only captured partial data. Users can't tell which runs need to be resumed.

## Changes

### `src/pages/RunsPage.tsx`

1. **Detect legacy timed-out runs**: Check `search_params.timed_out === true` on runs with `status === "completed"` and treat them visually as incomplete.

2. **Add a new visual state**: Show an amber "Timed Out" badge with a warning icon for these runs, distinct from both "Completed" and "Paused".

3. **Show Resume button**: Display a Resume button on both `"paused"` runs AND legacy timed-out `"completed"` runs, so users can re-run them to fill in missing data.

4. **Add a "Re-run" approach for legacy runs**: Since legacy runs don't have a saved cursor, the Resume button will start a fresh search with the same `nets`/`perPage`/`maxPages` params but under a new run. Alternatively, we can invoke the edge function with the existing `runId` — the edge function already handles resume with no cursor by starting from the beginning and skipping already-flushed repos via `flushedKeys`.

### Implementation detail

In the run card rendering, add logic like:
```
const isLegacyTimedOut = run.status === "completed" && (run.search_params as any)?.timed_out === true;
```

- If `isLegacyTimedOut`: show amber "Timed Out — Incomplete" badge + Resume button
- Resume calls `resumeRun.mutate(run.id)` — the edge function will load the run, find no cursor, but will skip repos already in `flushedKeys`, effectively re-running only queries that may yield new unique repos

This is a single-file UI change to `RunsPage.tsx`.

