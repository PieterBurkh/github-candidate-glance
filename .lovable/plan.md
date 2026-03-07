

## Bug: Seeding query hits the 1000-row default limit

The repos table has **30,312 rows** (16,444 unique logins), but the seeding query on line 200-202 does a single unpaginated fetch:

```typescript
let query = sb.from("repos").select("owner_login");
const { data: repos } = await query;
```

Supabase returns at most **1,000 rows** by default. So `allLogins` only contains ~885 unique logins from the first 1,000 rows. The dedup check then finds all 885 already processed, seeds 0 new candidates, and the run finishes instantly with the old data.

## Fix

**File**: `supabase/functions/build-longlist/index.ts` (lines 200-203)

Paginate the repos query the same way the rest of the codebase handles large tables:

```typescript
// Fetch ALL owner_logins from repos, paginated
const allRepoLogins: string[] = [];
let from = 0;
while (true) {
  let query = sb.from("repos").select("owner_login");
  if (run.source_run_id) query = query.eq("run_id", run.source_run_id);
  const { data: page } = await query.range(from, from + PAGE_SIZE - 1);
  if (!page || page.length === 0) break;
  allRepoLogins.push(...page.map((r: any) => r.owner_login));
  if (page.length < PAGE_SIZE) break;
  from += PAGE_SIZE;
}
const allLogins = [...new Set(allRepoLogins)];
```

This replaces lines 200-203 and uses the existing `PAGE_SIZE` (500) constant. Everything else stays the same -- the dedup check and seeding logic are already correct; they just weren't receiving the full list.

