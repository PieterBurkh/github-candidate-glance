

## Auto-Continue for Longlist Runs

When the processing loop hits the 140s deadline, instead of pausing and waiting for a manual "Resume" click, the function will automatically re-invoke itself to continue processing.

### Changes

**File: `supabase/functions/build-longlist/index.ts`** (lines ~380-392)

At the point where the function currently sets status to `"paused"`, add a self-invocation call:

1. After updating the run status to `"paused"` and logging, add a `fetch()` call to the same edge function URL with the same `longlistRunId`
2. Use the service role key for authorization
3. The re-invocation is fire-and-forget — no need to await the response body

```typescript
// After the pause update (~line 392), add:
const functionUrl = `${SUPABASE_URL}/functions/v1/build-longlist`;
fetch(functionUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  },
  body: JSON.stringify({ longlistRunId }),
}).catch(err => console.error("Auto-continue failed:", err));

console.log(`Auto-continuing longlist run ${longlistRunId}...`);
```

This is a minimal change — only ~8 lines added at the pause point. The function already handles resumption correctly (it picks up `pending` candidates), so the self-call just automates what the "Resume" button did manually.

