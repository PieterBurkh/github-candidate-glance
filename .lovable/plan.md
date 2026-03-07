

# Add Global Longlist Page + Approach Page

## What we're building

Two new pages:

1. **Global Longlist page** (`/longlist`) — aggregates repos from ALL runs into one unified table (deduplicated by `full_name`). This is the master "longlist of all leads" across every search run.

2. **Approach page** (`/approach`) — a documentation page explaining how the longlist search works: the net-based strategy, README searching, star banding, dual sorting, etc. Clear and readable for non-technical stakeholders.

Also: add a **Shortlist** nav link (`/shortlist`) as a placeholder page — no generation logic, just a stub saying "Shortlist coming soon."

## Changes

### 1. `src/hooks/useSignalPipeline.ts`
- Add `useAllRepos()` hook — fetches all repos across all runs, deduplicates by `full_name` (keeping the entry with most `matched_nets`), returns unified list.

### 2. `src/pages/GlobalLonglistPage.tsx` (new)
- Reuses the same table layout as `LonglistPage` (sort by stars/pushed_at, filter by net)
- But uses `useAllRepos()` instead of `useRunRepos(runId)`
- Shows which run(s) found each repo
- Header: "Longlist — {N} unique repos from {M} runs"

### 3. `src/pages/ApproachPage.tsx` (new)
- Static content page describing the search methodology:
  - The 9 nets and what each targets
  - Why `in:readme` matters (catches untagged repos)
  - Star banding strategy (avoids giant-project bias)
  - Dual sorting (stars + updated)
  - Deduplication and net merging
  - What comes next (enrichment → shortlist)

### 4. `src/pages/ShortlistPage.tsx` (new)
- Placeholder page: "Shortlist — Coming Soon" with a brief description of what it will do

### 5. `src/components/NavBar.tsx`
- Add nav links: Longlist, Shortlist, Approach
- Updated order: Runs | Longlist | Shortlist | Leads | Approach | Job Description

### 6. `src/App.tsx`
- Add routes: `/longlist`, `/shortlist`, `/approach`

## Files

| File | Change |
|------|--------|
| `src/hooks/useSignalPipeline.ts` | Add `useAllRepos()` |
| `src/pages/GlobalLonglistPage.tsx` | New — unified repo table |
| `src/pages/ApproachPage.tsx` | New — methodology docs |
| `src/pages/ShortlistPage.tsx` | New — placeholder |
| `src/components/NavBar.tsx` | Add 3 nav links |
| `src/App.tsx` | Add 3 routes |

No backend/database changes needed.

