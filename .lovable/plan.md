

## Plan: Simplify Shortlist Runs + Keep Pause

### Changes

**`supabase/functions/run-shortlist/index.ts`:**
- Remove self-chaining logic — run processes what it can within timeout, then marks `done`
- Keep cooperative pause check (if status changed to `paused`, stop and mark `done` with progress)
- When rate limited → mark `done` (not `paused`) with rate limit info in progress
- Each run is independent; new runs auto-discover unprocessed candidates

**`src/hooks/useShortlistPipeline.ts`:**
- Remove `useResumeShortlistRun` hook
- Keep `usePauseShortlistRun` (sets status to `paused`, edge function will see it and stop)

**`src/pages/ShortlistRunsPage.tsx`:**
- Remove Resume button and imports
- Keep Pause button (visible only when status is `running`)
- Statuses: Pending, Running, Paused (terminal — means "stopped by user"), Done, Failed
- Keep rate limit info display

### Behavior
1. "New Shortlist Run" → processes highest-scoring unassessed candidates until timeout or all done → `done`
2. User clicks "Pause" → edge function sees status change, stops, marks `done`
3. Next "New Shortlist Run" picks up remaining unassessed candidates automatically

