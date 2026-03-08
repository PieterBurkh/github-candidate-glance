

## Plan: Simplify Initial List Run Form

Remove the "Results Per Query" and "Max Pages" inputs from the New Run form. Keep the search nets selection as-is. Hardcode `perPage: 30, maxPages: 1` in the start call.

### Changes to `src/pages/RunsPage.tsx`

1. Remove `perPage` and `maxPages` state variables
2. Remove the two number input fields and their containing `<div className="flex gap-4">`
3. Update `handleNewRun` to: `startRun.mutateAsync({ nets: selectedNets, perPage: 30, maxPages: 1 })`

No backend changes needed.

