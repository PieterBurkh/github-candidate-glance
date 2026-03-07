

The rate limit info is already stored in the run's `progress` JSON when it pauses. It just needs to be shown in the **Longlist Runs** page (`/longlist-runs`), right next to the existing pending/scored/selected counts on each run card.

### Change

**File: `src/pages/LonglistRunsPage.tsx`** — after the "pending" badge (~line 96), add:

```typescript
{p.rate_limited && (
  <span className="text-xs text-red-600 font-medium">
    ⏳ Rate limited — resets {p.reset_at
      ? `at ${new Date(p.reset_at * 1000).toLocaleTimeString()}`
      : `in ~${p.wait_minutes || '?'} min`}
  </span>
)}
```

That's it — one small addition to the existing run card. It will appear on the **Longlist Runs** page (`/longlist-runs`) inline with the other progress stats whenever a run is paused due to rate limiting.

