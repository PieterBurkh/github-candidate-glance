

## Remove Exploit/Explore Tier Model

Remove the tier concept entirely from both the data hook and the results page. The longlist simply shows all deduplicated candidates scoring 70+ sorted by score.

### Changes

**`src/hooks/useLonglistPipeline.ts`**
- Remove `DynamicLonglistCandidate` type — hook returns `LonglistCandidate[]` directly
- Remove `countQualitySignals` helper function
- Remove `tierFilter` parameter from `useDynamicLonglist`
- Simplify: after dedup, just return `unique` (already sorted by score)

**`src/pages/LonglistResultsPage.tsx`**
- Remove tier filter dropdown
- Remove `tierFilter` state
- Remove Tier column from table (header + cell with Badge)
- Update hook call: `useDynamicLonglist()` with no args

