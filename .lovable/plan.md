

## Plan: Revamp Longlist Results Page

### Summary

Replace the current Longlist table (which shows pre_score and confidence) with a new layout that:
- Shows whether each candidate has been **sorted** (exists in the `people` table)
- Shows **shortlist score** and **assessment** for sorted candidates
- Always shows all sorted candidates + at least 200 unsorted candidates (expanding below pre_score 70 if needed)
- Adds a filter for sorted/unsorted

### Data Changes

**`src/hooks/useLonglistPipeline.ts`** — Update `useDynamicLonglist`:
- Remove the `.gte("pre_score", 70)` and `.lte("pre_score", 82)` filters — fetch ALL scored candidates ordered by `pre_score` desc
- The page will handle the selection logic client-side

### Page Changes

**`src/pages/LonglistResultsPage.tsx`**:

1. **Fetch enrichment data** — import and use `useShortlistEnrichment()` to get the `enrichmentMap` (keyed by login)

2. **Selection logic** (client-side):
   - Deduplicate by login (keep highest pre_score) — same as now
   - Split into two groups:
     - **Sorted**: login exists in `enrichmentMap` → always included
     - **Unsorted**: login NOT in `enrichmentMap`
   - From unsorted, take all with `pre_score >= 70`. If fewer than 200, continue adding candidates with lower scores until 200 unsorted are reached
   - Merge sorted + selected unsorted, sort by: sorted first (by shortlist score desc), then unsorted (by pre_score desc)

3. **New columns** (replacing Score and Confidence):
   - **Sorted** — "Yes" / "No" badge
   - **Shortlist Score** — `enrichmentMap[login].overall_score` as percentage, or "–" if unsorted
   - **Assessment** — truncated text from rubric evidence, or "–" if unsorted
   - Keep: Login, Key Signals, external link

4. **Filter** — Add a select dropdown: All / Sorted / Unsorted

5. **Update subtitle** to show count breakdown (e.g., "150 sorted · 200 unsorted")

### No backend changes needed.

