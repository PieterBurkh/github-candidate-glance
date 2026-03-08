

## Problem

The backend's Selection stage (lines 343-346 in `build-longlist`) marks all candidates outside the top 800/200 as `stage = 'discarded', discard_reason = 'below_threshold'`. So ~15,000 scored candidates are stamped as "discarded" even though they have valid scores. The client filter `.not("stage", "eq", "discarded")` correctly excludes real discards (orgs, 404s) but also excludes these below_threshold candidates.

## Fix (two parts)

### 1. Client-side: Distinguish real discards from below_threshold
In `useDynamicLonglist`, change the filter to exclude only truly invalid candidates:

```typescript
// Instead of:
.not("stage", "eq", "discarded")
.gt("pre_score", 0)

// Use:
.gt("pre_score", 0)
.not("discard_reason", "in", '("organization","not_found","no_repos")')
```

This includes `below_threshold` candidates (who have scores) while still excluding orgs/404s/empty accounts.

### 2. Backend: Stop discarding below_threshold candidates
In `build-longlist/index.ts`, remove the block (lines 343-346) that bulk-marks remaining scored candidates as `stage = 'discarded', discard_reason = 'below_threshold'`. Instead, leave them as `stage = 'scored'` with no `selection_tier`. The client-side dynamic selection handles ranking anyway.

### 3. Data fix: Restore already-discarded below_threshold candidates
Run an UPDATE to set `stage = 'scored'` for all candidates currently marked `discard_reason = 'below_threshold'`, so existing data is corrected.

