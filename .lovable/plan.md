

# Decouple Search from Enrichment

## Problem
Currently, clicking "Search & Enrich" on the Runs page automatically triggers enrichment (`run-enrichment`) right after the search completes. The user wants runs to **only populate the longlist** — enrichment/shortlisting should be a separate, manual step later.

## Changes

### `src/pages/RunsPage.tsx`
1. **Remove auto-enrichment** from `handleNewRun` — only call `startRun.mutateAsync()`, don't call `runEnrichment.mutate()` after.
2. **Rename button** from "Search & Enrich" to "Search".
3. **Keep the "Enrich" button** on completed runs so enrichment can be triggered manually later when the user is ready to build the shortlist.

### No other changes needed
The longlist page already works — `useAllRepos()` aggregates all repos from all runs. The search-repos edge function already inserts repos into the `repos` table. Everything flows correctly once we stop auto-triggering enrichment.

| File | Change |
|------|--------|
| `src/pages/RunsPage.tsx` | Remove auto-enrich call, rename button label, show Enrich on completed runs |

