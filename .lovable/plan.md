

## Update Shortlist to Use Score-Based Selection

The `run-shortlist` edge function currently selects candidates using `selection_tier IN ('exploit', 'explore')`. Since we removed tiers, it needs to select candidates with `pre_score >= 70` instead, ordered by highest score first so the best candidates get enriched first.

### Change: `supabase/functions/run-shortlist/index.ts`

Replace the Step 1 query (lines 36-47) that filters by `selection_tier` with a query that filters by `pre_score >= 70`, ordered by `pre_score` descending, and deduplicates by login (keeping highest score):

```typescript
// Step 1: Get all candidates scoring 70+ ordered by score desc
const allCandidates: { login: string; pre_score: number }[] = [];
let from = 0;
while (true) {
  const { data: page } = await sb.from("longlist_candidates")
    .select("login, pre_score")
    .gte("pre_score", 70)
    .order("pre_score", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (!page || page.length === 0) break;
  allCandidates.push(...page);
  if (page.length < PAGE_SIZE) break;
  from += PAGE_SIZE;
}
// Deduplicate by login, keep highest score
const seen = new Map<string, number>();
for (const c of allCandidates) {
  if (!seen.has(c.login) || c.pre_score > seen.get(c.login)!) {
    seen.set(c.login, c.pre_score);
  }
}
const uniqueLogins = [...seen.keys()]; // already in score-descending order
```

Also update comments to remove tier references. The rest of the pipeline (enrichment batching, self-chaining, pause/resume) stays the same.

