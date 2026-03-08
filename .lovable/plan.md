

## Remove Automated LLM Shortlist Verdict (Frontend + Backend)

Remove the `shortlist_status` automated verdict from both the UI and the backend enrichment logic. The manual `review_status` is the only classification that matters now.

### Frontend — `src/pages/LeadsPage.tsx`

1. **Remove the "Status" column** — delete `<TableHead>` (line 199) and `<TableCell>` (lines 249-259) that render the `shortlist_status` badge
2. **Remove the Status filter dropdown** (lines 148-159) — the `statusFilter` select for SHORTLIST/NEEDS_REVIEW/NO/pending
3. **Remove `statusFilter` state** and any filtering logic that references `shortlist_status`
4. Keep `shortlist_status` in CSV export for backward compatibility

### Backend — `supabase/functions/enrich-candidate/index.ts`

1. **Remove the shortlist verdict logic** (lines 415-423) — the `if/else` that computes `shortlistStatus` as SHORTLIST/NEEDS_REVIEW/NO
2. **Remove the hard-gate early return** (lines 380-402) — the block that auto-sets "NO" when `reactScore < 0.25` and returns early. Instead, still save the person with their score but no verdict.
3. **Stop writing `shortlist_status`** in all upsert calls (lines 439-442, 444-446, 349-350) — remove `shortlist_status` from the update/insert payloads. The column keeps its default `'pending'` value.
4. **Remove the `shortlist_status` from the response** (lines 399, 471-473) — return `overall_pct` and scores only

### Backend — `supabase/functions/run-shortlist/index.ts`

1. **Remove `getStats()` function** (lines counting SHORTLIST/NEEDS_REVIEW/NO statuses) — these stats are now meaningless
2. **Simplify progress tracking** to just track `total`, `enriched`, and `failed` counts (no more `shortlisted`/`needs_review`/`rejected` in progress)

### Frontend — `src/pages/ShortlistRunsPage.tsx`

1. Remove display of `p.shortlisted`, `p.needs_review` stats from run progress badges since those won't be computed anymore

No database schema changes needed — the `shortlist_status` column can remain with its default value.

