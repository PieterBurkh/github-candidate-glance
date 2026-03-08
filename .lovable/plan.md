

## Plan: Remove Pipeline Runs Feature

Delete the Pipeline Runs page, its hook, edge function, and nav link. Keep the `pipeline_runs` database table (no harm leaving it; avoids a migration).

### Files to delete
- `src/pages/PipelineRunsPage.tsx`
- `src/hooks/usePipelineRuns.ts`
- `supabase/functions/run-pipeline/index.ts`

### Files to edit

**`src/App.tsx`**
- Remove the `PipelineRunsPage` import and the `/pipeline` route

**`src/components/NavBar.tsx`**
- Remove the `{ to: "/pipeline", label: "Runs", icon: Play }` entry from the links array
- Remove the `Play` icon import if unused

**`supabase/config.toml`**
- Remove the `[functions.run-pipeline]` section

