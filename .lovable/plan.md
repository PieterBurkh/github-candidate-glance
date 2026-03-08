

## The Real Problem

You've scraped ~19K repos but only fetched page 1 of each query. GitHub allows up to ~33 pages (1,000 results) per query. With 102 query combinations, there are potentially **~100K repos** you haven't seen yet — not because they're new on GitHub, but because you never paginated deep enough.

## The Approach: "Page-Forward" Discovery

Instead of re-running the same pages, **track how deep we've already gone** for each query combination, and on the next run, start from where we left off.

```text
Run 1:  query "topic:react stars:5..20 sort:stars" → pages 1-3
Run 2:  same query → skip pages 1-3, start at page 4-6
Run 3:  same query → skip pages 1-6, start at page 7-9
...until we hit GitHub's 1,000-result cap (page ~33 at perPage=30)
```

This means:
- **Every API call returns genuinely unseen repos** — no waste
- **No extra API calls** — same budget, all new results
- **Works with mature repos** — not limited to recently created ones
- **Self-limiting** — once all pages are exhausted for a query, it skips it entirely

## Technical Changes

| File | Change |
|---|---|
| `supabase/functions/search-repos/index.ts` | Add a new table query or use `runs.search_params` to store a `page_watermarks` map: `{ "net:query:band:sort" → lastPageFetched }`. On each new run, load watermarks from the most recent completed run and start each combination from `lastPage + 1`. Save updated watermarks in `search_params` when the run completes. |

### Detail

1. **Before the loop**: Load `page_watermarks` from the latest completed run's `search_params`
2. **For each (net, query, band, sort)**: Compute a stable key like `"core-stack|0|0|0"`. Look up `startPage = watermarks[key] + 1` (default 1 if no prior run)
3. **Paginate**: Fetch pages `startPage` through `startPage + maxPages - 1`
4. **On completion**: Save the updated watermarks back to `search_params`
5. **Cap at page 34** (GitHub's hard limit of 1,000 results at perPage=30): mark that combination as "exhausted" and skip in future runs

### What this gives you

With `perPage=100, maxPages=10`:
- Run 1 covers results 1–1,000 → captures up to 1,000 per query (hits GitHub cap)
- With `perPage=30, maxPages=10`: Run 1 covers results 1–300, Run 2 covers 301–600, Run 3 covers 601–900, etc.
- Across all 102 combinations, you could discover **up to ~100K unique repos** over several runs with zero duplication

