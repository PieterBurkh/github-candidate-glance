

# Fix: Only Show Verified Real People in Leads

## Problem
The current frontend filter uses `is_real_person !== false`, which passes through all records where the field is simply missing (e.g., entries created before the filter was added). Organizations like Meta, Ant Design, TanStack, Supabase, Expo, Ionic, etc. all lack the `is_real_person` field entirely, so they slip through.

## Changes

### 1. Frontend filter (`src/pages/LeadsPage.tsx`)
Change filter from `p.profile?.is_real_person !== false` to `p.profile?.is_real_person === true`. This ensures only explicitly verified real people are shown.

### 2. Enrichment backfill logic (`supabase/functions/run-enrichment/index.ts`)
During the person rollup phase, re-check any person missing `is_real_person` in their profile. Fetch their GitHub profile type and update the flag. This cleans up legacy data on the next run.

### 3. Optional: one-time database cleanup
Run a query to delete or flag existing `people` rows that are clearly organizations (those without `is_real_person: true` in their profile JSONB). This removes stale org entries like "facebook", "ant-design", etc.

