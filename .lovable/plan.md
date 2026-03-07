

# Fix: search-repos Edge Function Timeout

## Problem

The run `c62ae670` is stuck at "running" and will never complete. The edge function hit its **150-second timeout** before finishing all queries. The logs confirm GitHub 403 rate-limit errors starting partway through, and then the function was shut down.

**Why**: 9 nets x ~2-3 queries x 2-3 star bands x 2 sorts = **~100+ sequential GitHub API calls**, each with 300ms delay (plus 5s on rate-limit). This far exceeds the 150s edge function limit. The status update to "pending" at the end never executes.

## Solution: Incremental Insert + Graceful Timeout

Instead of collecting all repos in memory then inserting at the end, **insert repos incrementally** as each query completes, and use a timer to gracefully stop before the timeout hits.

### Changes to `supabase/functions/search-repos/index.ts`

1. **Add a deadline timer** (~140s). Before each query iteration, check if we're close to timeout. If so, break out of loops early.

2. **Insert repos incrementally** after each net completes (or every ~20 queries), not all at the end. This way repos found before timeout are preserved.

3. **Always update run status** in a `finally` block:
   - If all queries completed: status = `"pending"`
   - If timed out early: status = `"pending"` (partial results, but usable) with a note in `search_params` like `"timed_out": true`

4. **Reduce delay** from 300ms to 200ms, and from 5000ms to 2000ms on rate-limit (the function can't afford 5s waits).

5. **Track progress** — update the run's `updated_at` and a `search_params.repos_found` counter periodically so the UI can show progress.

### Changes to `src/pages/RunsPage.tsx`

- Show a "timed out" indicator if `search_params.timed_out` is true, so you know the run was partial.

### No other files change

The longlist page, enrichment, and leads pages all work fine with partial results.

## Technical Detail

```text
search-repos flow (revised):
  1. Create run (status: "running")
  2. Start deadline = Date.now() + 140_000
  3. For each net → query → band → sort:
     a. If Date.now() > deadline → break all loops
     b. Fetch GitHub API
     c. On 403/429 → wait 2s, skip (don't wait 5s)
     d. Collect in repoMap
     e. Every 30 queries or end-of-net: flush repoMap to DB
  4. Finally: insert remaining repos, update status to "pending"
```

## Files changed

| File | Change |
|------|--------|
| `supabase/functions/search-repos/index.ts` | Add deadline, incremental inserts, finally block |
| `src/pages/RunsPage.tsx` | Show partial/timed-out indicator on run cards |

