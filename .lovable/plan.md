

# Expand Search Queries to Job-Mapped Nets + Add Longlist View

## What changes

### 1. Rewrite `search-repos` query packs (edge function)

Replace the 3 hardcoded topic-only queries with ~20 job-mapped query packs organized into nets:

- **Net A — Core stack**: `topic:react language:TypeScript` + a README variant (`react typescript in:name,description,readme`) to catch untagged repos
- **Net B — Meta-frameworks**: nextjs, vite+react, remix variants (topic + readme)
- **Net C — Component libraries / docs**: storybook, docusaurus, typedoc in README
- **Net D — Versioning discipline**: changesets, semantic-release, changelog in README
- **Net E — Performance**: web-vitals, lighthouse, profiler in README
- **Net F — Accessibility**: wcag, aria, a11y in README
- **Net G — Complex UI patterns**: bpmn, reactflow, xstate in README
- **Net H — CRDT / realtime**: yjs, automerge, crdt in README
- **Net I — WASM**: webassembly, wasm-pack in README

All packs include `archived:false mirror:false template:false`.

Each query pack also stores a `net` label (e.g. "core-stack", "performance") so we can tag repos with which net discovered them.

**Diversified sorting**: Each query runs twice — once with `sort=stars` and once with `sort=updated` — doubling coverage without duplicates (dedup via `seen` set).

**Star bands**: For high-volume nets (A, B), run with `stars:5..50`, `stars:50..500`, `stars:>=500` to avoid giant-project bias. Specialist nets (F-I) use lower thresholds (`stars:>=1` or `stars:>=2`).

**Store net metadata**: Each repo's `metadata` gets a new `matched_nets: string[]` field so we know which nets found it. If a repo is found by multiple queries, merge the nets.

### 2. Update `search-repos` to accept a `nets` parameter

Instead of accepting raw `queries`, accept an optional `nets` string array (e.g. `["core-stack", "performance", "a11y"]`) to run a subset. Default: all nets. This lets the UI offer net selection later.

The `search_params` stored on the run will include which nets were used.

### 3. Add a "Longlist" page — repos discovered by the run

New page at `/runs/:runId/longlist` showing all repos from a run as a table:

- Columns: Repo name (linked to GitHub), Stars, Language, Pushed date, Matched Nets (as badges), Owner
- Sortable by stars / pushed date
- Filter by net (dropdown)
- Pagination or virtual scroll for large lists

This gives visibility into what the search found before enrichment.

### 4. Wire up the longlist

- Add a `useRunRepos(runId)` hook to `useSignalPipeline.ts` that fetches repos for a given run
- Add route `/runs/:runId/longlist` in `App.tsx`
- Add "View Longlist" button on each run card in `RunsPage` (alongside existing "View Leads" and "Enrich")
- Add nav link or breadcrumb from longlist back to run

### 5. Update RunsPage "New Run" form

- Show which nets will be searched (checklist of net labels, all selected by default)
- Keep minStars and perPage controls
- Update the description text to reflect the broader search

## Files changed

| File | Change |
|------|--------|
| `supabase/functions/search-repos/index.ts` | Rewrite with net-based query packs, dual sorting, star bands, net metadata |
| `src/hooks/useSignalPipeline.ts` | Add `useRunRepos(runId)` hook |
| `src/pages/LonglistPage.tsx` | New page — repo table with sort/filter |
| `src/pages/RunsPage.tsx` | Add "View Longlist" button, net selection in form |
| `src/App.tsx` | Add `/runs/:runId/longlist` route |

## What stays the same

- `enrich-repo` — no changes (LLM scoring untouched)
- `run-enrichment` — no changes
- LeadsPage, LeadDetailPage — no changes
- Database schema — no migrations needed (repos.metadata is JSONB, just richer content)

