

## Plan: Optimize `build-longlist` for speed — lightweight scoring + parallel + auto-resume

### What changes

**Single file: `supabase/functions/build-longlist/index.ts`** — rewrite the processing loop.

### Three optimizations

**1. Drop package.json and tree fetches entirely**
Currently each candidate needs ~19 API calls (user + repos + 2 per selected repo). The new approach uses **only 2 API calls per candidate**: user profile + repos list. Scoring uses metadata already in the repos list response:
- `language` → TypeScript/JS detection
- `topics` → React/Next/Remix keywords
- `stargazers_count`, `size`, `pushed_at` → quality/activity signals
- `has_pages` → docs signal

This is the biggest win: eliminates 16 of 19 API calls per candidate.

**2. Parallel processing**
Process 5 candidates concurrently using `Promise.all`. Each candidate does 2 API calls in parallel (user + repos). ~500-700 candidates per 140s invocation instead of ~70.

**3. Batch DB writes**
Collect candidate updates in memory, flush every 50 records via `upsert` instead of one write per candidate.

### What stays the same
- Resume button stays — no auto-chaining yet
- `paused` status on timeout or rate limit
- Stage 3 selection logic (exploit top 800 + explore 200) unchanged
- `LonglistRunsPage.tsx` and `useLonglistPipeline.ts` unchanged
- Scoring heuristic (React +20, TS +15, stars tiers, followers tiers) stays, just computed from repo metadata instead of package.json

### New scoring signals (from repo list metadata only)
| Signal | Source | Points |
|--------|--------|--------|
| TypeScript/JS language | repo.language | +15/+10 |
| React/Next/Remix topics | repo.topics | +20 |
| Stars ≥100 / ≥20 | repo.stargazers_count | +10/+5 |
| Followers ≥200 / ≥50 | user.followers | +10/+5 |
| Recent activity (pushed <6mo) | repo.pushed_at | +5 |
| Non-trivial size (>500KB) | repo.size | +5 |
| Multiple repos (>5 non-fork) | count | +5 |
| Has GitHub Pages | repo.has_pages | +2 |

### Expected performance
- ~500-700 candidates per Resume click (up from ~70)
- Full 16K list in ~25-30 Resume clicks over ~60 min
- You can verify results appear in the Longlist after each resume

