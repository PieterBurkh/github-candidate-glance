

## Plan: Remove Action Buttons from Initial List Runs

**File: `src/pages/RunsPage.tsx`**

Remove the following buttons from each run card (lines 203-268):
- "Initial list" link button
- "Pause" button
- "Enrich" button
- "View Leads" link button

Keep only the "Resume" button (for paused/timed-out runs) since that's functionally necessary to continue interrupted runs.

Also clean up unused imports: `Link`, `Zap`, `ArrowRight`, `List`, `Pause`, `useRunEnrichment`, `usePauseRun`, and related state (`activeRunId` for pause).

