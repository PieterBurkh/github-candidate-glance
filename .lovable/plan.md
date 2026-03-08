

## Show only candidates scoring 70–82 in the Longlist

Single change in `src/hooks/useLonglistPipeline.ts`: in `useDynamicLonglist`, add `.gte("pre_score", 70)` to the query. This replaces `.gt("pre_score", 0)` and naturally limits to 70–82 (82 is the current max). Also fix the NULL discard_reason bug by switching to `.or()` filter.

### Changes in `src/hooks/useLonglistPipeline.ts`

In the `useDynamicLonglist` query, replace:
```typescript
.gt("pre_score", 0)
.not("discard_reason", "in", '("organization","not_found","no_repos")')
```
With:
```typescript
.gte("pre_score", 70)
.or('discard_reason.is.null,and(discard_reason.not.in.("organization","not_found","no_repos"))')
```

Also update the subtitle in `LonglistResultsPage.tsx` from "400 exploit + 100 explore" to reflect the score filter (e.g., "Candidates scoring 70–82").

