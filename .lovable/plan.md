

## Fix: Pipeline stuck in `initial_list` due to race conditions

### Root Cause

Two bugs are causing the pipeline to get stuck:

1. **Race condition creating duplicate runs**: The frontend fires `advance` calls every ~5 seconds (from both the 15s interval AND immediate-on-mount calls). When two calls hit the `pending` or `paused` handlers simultaneously, each one invokes `search-repos`, creating orphan `runs` records. The DB shows 8+ orphaned runs created from a single pipeline run.

2. **Blocking await on long-running functions**: `run-pipeline` awaits `invokeFunction("search-repos", ...)` which can take up to 140 seconds. Edge functions time out before that completes, causing the resume to silently fail.

### Fix in `run-pipeline/index.ts`

**Optimistic stage updates**: Update the pipeline stage BEFORE invoking sub-functions, so concurrent calls see the updated stage and skip.

- **`pending` handler**: First create a `runs` record via direct DB insert, update pipeline_runs to `initial_list` with the new run_id, THEN fire `search-repos` without awaiting (fire-and-forget via `fetch()` without `.json()`).
- **`initial_list` paused handler**: Fire `search-repos` resume as fire-and-forget instead of awaiting. Return `{ resumed: true }`.
- **`longlist` paused handler**: Same fire-and-forget pattern for `build-longlist`.
- **`shortlist` paused handler**: Same for `run-shortlist`.

### Fix in `PipelineRunsPage.tsx`

- Remove the immediate `advance.mutate(run.id)` call on mount — only use the 15s interval. This halves the concurrent call rate.
- Add a guard: skip the advance call if one is already in-flight (`advance.isPending`).

### Changes

| File | Change |
|---|---|
| `supabase/functions/run-pipeline/index.ts` | Optimistic stage updates + fire-and-forget for long-running sub-functions |
| `src/pages/PipelineRunsPage.tsx` | Remove advance-on-mount, add isPending guard to interval |

