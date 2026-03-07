

# Increase Search Coverage: maxPages=10 + Finer Star Bands

## Changes

### 1. `supabase/functions/search-repos/index.ts`
- **Finer star bands** on the two high-volume nets (`core-stack`, `meta-frameworks`):
  - `["5..20", "20..50", "50..200", "200..500", "500..2000", ">=2000"]` (6 bands instead of 3)
  - This bypasses GitHub's 1,000-result-per-query cap by narrowing each slice
- Other nets keep current bands (their universes are small enough)

### 2. `src/pages/RunsPage.tsx`
- Change default `maxPages` state from `1` to `10`
- Add a `maxPages` input field next to `perPage` so users can tune it
- Change default `perPage` from `30` to `100` (GitHub max)

### 3. `src/hooks/useSignalPipeline.ts`
- Pass `maxPages` through `useStartRun` mutation alongside `nets` and `perPage`

### Expected impact
- ~10x more results per query (10 pages × 100 results vs 1 × 30)
- Finer star bands on big nets → access repos previously hidden behind the 1,000 cap
- Estimated 80%+ coverage in 2-4 runs (~5-10 min total)
- Stays within GitHub's 5,000 calls/hour authenticated limit

| File | Change |
|------|--------|
| `supabase/functions/search-repos/index.ts` | Finer star bands on core-stack & meta-frameworks |
| `src/pages/RunsPage.tsx` | Default maxPages=10, perPage=100, add maxPages input |
| `src/hooks/useSignalPipeline.ts` | Pass maxPages param |

