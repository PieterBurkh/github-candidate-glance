

## Analysis

Reducing `perPage` won't help — the rate limit issue is about **number of API calls**, not results per call. With 9 nets and `maxPages=1`, you still get ~92 separate API requests that fire as fast as possible, which blows past GitHub's 30 requests/minute search API limit.

## Plan: Add Proactive Rate Limiting

Add a small delay between GitHub API calls in `supabase/functions/search-repos/index.ts` so we stay under the rate limit without needing to reduce coverage.

### Change in `supabase/functions/search-repos/index.ts`

1. **Add a 2-second delay between every API call** — right after `queryCount++` (around line 414). This keeps us at ~30 requests/minute, exactly at the GitHub search rate limit for authenticated users.

2. With 92 calls at 2s each = ~3 minutes, well within the 140s deadline. So we also need to **increase DEADLINE_MS** from 140s to 300s (5 minutes) to allow time for the full run with delays.

This means a full 9-net run should complete in one go without hitting 403s. No UI changes needed — `perPage: 30, maxPages: 1` stays as-is.

