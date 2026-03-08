

## Dynamic Longlist: Top 400 Exploit + 100 Explore

Update the Longlist Results page to always show a live top-500 view (400 exploit + 100 explore) computed client-side from all scored candidates across runs.

### Changes

**`src/hooks/useLonglistPipeline.ts`** — add `useDynamicLonglist` hook:
- Fetch all candidates with `pre_score > 0` and `stage = 'scored'` (or non-null `selection_tier`), ordered by `pre_score desc`
- Client-side: top 400 → "exploit", next best 100 by signal diversity → "explore"
- Each candidate gets a `computed_tier` property

**`src/pages/LonglistResultsPage.tsx`**:
- Switch from `useLonglistCandidates` to `useDynamicLonglist`
- Use `computed_tier` instead of `selection_tier` for display and filtering
- Update subtitle to reflect "500 candidates"

**`src/pages/LonglistApproachPage.tsx`**:
- Update the Stage 4 description from 800/200 to 400/100

