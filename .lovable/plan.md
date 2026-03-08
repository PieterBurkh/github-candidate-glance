

## Automated Pipeline "Runs" Page

### Overview
A new page at `/pipeline` where clicking "New Run" triggers all three stages automatically in sequence: Initial List → Longlist → Shortlist. The frontend orchestrates stage transitions by polling a `pipeline_runs` table and calling a new `run-pipeline` edge function to advance stages. Results appear on the existing Shortlist page.

### 1. Database — New `pipeline_runs` table

```sql
CREATE TABLE public.pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage text NOT NULL DEFAULT 'pending',
  config jsonb NOT NULL DEFAULT '{}',
  run_id uuid,
  longlist_run_id uuid,
  shortlist_run_id uuid,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on pipeline_runs" ON public.pipeline_runs FOR ALL USING (true) WITH CHECK (true);
```

- `stage` values: `pending`, `initial_list`, `longlist`, `shortlist`, `completed`, `failed`
- `config`: stores `{ repo_limit: 50 }` (user-configurable)
- Foreign IDs link to the sub-run records created at each stage

### 2. Edge Function — `run-pipeline`

New file: `supabase/functions/run-pipeline/index.ts`

A lightweight state machine. Each call checks the current stage and either triggers the next stage or reports "still waiting":

| Current Stage | Action |
|---|---|
| `pending` | Call `search-repos` with `perPage=6, maxPages=1` (all 9 nets → ~54 repos). Save returned `runId`, set stage to `initial_list` |
| `initial_list` | Check `runs` record status. If `completed` → create `longlist_runs` with `source_run_id`, call `build-longlist`, set stage to `longlist`. If `paused` → re-invoke `search-repos` to resume |
| `longlist` | Check `longlist_runs` record status. If `done` → create `shortlist_runs`, call `run-shortlist` with `longlistRunId` param, set stage to `shortlist`. If `paused` → re-invoke `build-longlist` to resume |
| `shortlist` | Check `shortlist_runs` record status. If `done` → set stage to `completed`. If `paused` → re-invoke `run-shortlist` to resume |

If any sub-run is `failed`, set pipeline to `failed` with error message.

Add to `supabase/config.toml`:
```toml
[functions.run-pipeline]
verify_jwt = false
```

### 3. Modify `run-shortlist` — Add optional `longlistRunId` filtering

In `supabase/functions/run-shortlist/index.ts`:
- Accept optional `longlistRunId` from request body
- Pass it to `processShortlist`
- When present, add `.eq("longlist_run_id", longlistRunId)` to the candidate query (line ~38)
- When absent, keep current global behavior (backward-compatible)

### 4. Frontend Hook — `usePipelineRuns.ts`

New file: `src/hooks/usePipelineRuns.ts`

- `usePipelineRuns()` — fetches all `pipeline_runs` ordered by `created_at desc`, polls every 5s
- `useStartPipeline()` — inserts a `pipeline_runs` record with config, then invokes `run-pipeline`
- `useAdvancePipeline()` — mutation that calls `run-pipeline` with a `pipelineRunId` to check/advance

### 5. Frontend Page — `PipelineRunsPage.tsx`

New file: `src/pages/PipelineRunsPage.tsx` at route `/pipeline`

- **Header**: "Runs" title with description "End-to-end candidate discovery pipeline"
- **New Run section**: Input for repo limit (default 50), "New Run" button
- **Run list**: Each run shows:
  - Created timestamp
  - A 4-step indicator: Initial List → Longlist → Shortlist → Done (current stage highlighted)
  - Sub-run progress details (repos found, candidates scored, enriched count)
  - Status badge
- **Auto-advance**: For any run not `completed`/`failed`, a `useEffect` calls `advancePipeline` every 15s to push it forward
- Link to `/shortlist` for viewing final results

### 6. NavBar — Add "Runs" link

In `src/components/NavBar.tsx`, add after "Shortlist runs":
```
{ to: "/pipeline", label: "Runs", icon: Play }
```

### 7. App.tsx — Add route

```tsx
<Route path="/pipeline" element={<PipelineRunsPage />} />
```

### Technical Notes
- `search-repos` with `perPage=6, maxPages=1` across 9 nets yields ~54 repos max (close to 50 target)
- Data isolation: each stage passes its output ID to the next stage, so only newly discovered repos/candidates are processed
- Existing standalone pages/runs continue to work unchanged — `run-shortlist` without `longlistRunId` keeps global behavior
- The `run-pipeline` function is fast (just status checks + trigger calls), not long-running

