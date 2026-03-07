

## Problem: Infinite auto-continue loop during GitHub rate limit

The logs show a clear pattern:
1. Function starts, hits GitHub rate limit on every candidate ("GitHub rate limit hit" x100)
2. Processes **0 candidates**, pauses with "13062 pending"
3. Auto-continues immediately, hits rate limit again
4. Repeat infinitely — burning function invocations without progress

The `rateLimited` flag correctly stops processing, but the auto-continue at line 396 fires unconditionally — even when zero candidates were processed due to rate limiting.

## Fix

**File: `supabase/functions/build-longlist/index.ts`** (~line 392-405)

Two changes:

1. **When rate-limited, check GitHub's rate limit reset time** before auto-continuing. Call `https://api.github.com/rate_limit` to get `reset` timestamp, then only auto-continue if reset is within ~3 minutes. Otherwise, set status to `"paused"` and stop (user can resume later, or we schedule a delayed retry).

2. **Skip auto-continue when 0 candidates were processed** due to rate limiting. Add a guard:

```typescript
// Only auto-continue if we actually made progress OR if not rate-limited
if (totalProcessed > 0 || !rateLimited) {
  const functionUrl = `${SUPABASE_URL}/functions/v1/build-longlist`;
  fetch(functionUrl, { ... }).catch(...);
  console.log(`Auto-continuing...`);
} else if (rateLimited) {
  // Check when rate limit resets
  const rlRes = await githubFetch("https://api.github.com/rate_limit");
  // Actually use raw fetch since githubFetch returns null on 403
  const rlRaw = await fetch("https://api.github.com/rate_limit", {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
  });
  const rlData = await rlRaw.json();
  const resetAt = rlData?.rate?.reset; // unix timestamp
  const waitMs = resetAt ? (resetAt * 1000 - Date.now()) : 3600_000;
  const waitMin = Math.ceil(waitMs / 60000);
  
  // Update progress with rate limit info
  await sb.from("longlist_runs").update({
    status: "paused",
    progress: { ...progressObj, rate_limited: true, reset_at: resetAt, wait_minutes: waitMin },
  }).eq("id", longlistRunId);
  
  console.log(`Rate limited. Resets in ${waitMin} minutes. Stopping auto-continue.`);
}
```

This stops the infinite loop. The run stays paused with rate limit info visible in the UI. User can manually resume after the rate limit resets (~1 hour from first hit).

