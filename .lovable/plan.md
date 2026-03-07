

# Fix Run Status Bug + Update Stale Run

## Problem
The `finally` block in `search-repos/index.ts` (line 308-319) always overwrites the run status to `"pending"`, regardless of whether the search succeeded or failed. This is because `finally` runs after `return`, clobbering any meaningful status.

## Changes

### 1. Fix `supabase/functions/search-repos/index.ts`
- Track success/failure with a variable (`let succeeded = false`)
- Set `succeeded = true` before the success return
- In the `finally` block, set status to:
  - `"completed"` if `succeeded` is true
  - `"failed"` if `succeeded` is false (error path)
- Preserve the `timed_out` and `repos_found` metadata

### 2. Update the stale run directly
- Use a database migration to update run `8ad45f04-cc15-419e-8845-afded9710e5c` from `"pending"` to `"completed"` since it found 790 repos successfully (`timed_out: false`)

| What | Detail |
|------|--------|
| Edge function fix | Track success state, set `completed` or `failed` in `finally` |
| Data fix | Update run `8ad45f04...` status to `completed` |

