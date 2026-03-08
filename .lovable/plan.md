

## Plan: Remove Resume Button and Rename Paused to Ended

**File: `src/pages/RunsPage.tsx`**

1. In `statusConfig` (line 35): Change `paused` label from `"Paused"` to `"Ended"`
2. Remove the Resume button block (lines 194-214)
3. Remove resume-related badges: "Incomplete — resume to finish" (lines 161-165), "Partial — resume to continue" (lines 167-170), "Paused by you — resume to continue" (lines 172-176)
4. Remove unused imports/state: `useResumeRun`, `Play`, `activeRunId` state, `resumeRun` hook, `canResume`/`isThisResuming` variables

