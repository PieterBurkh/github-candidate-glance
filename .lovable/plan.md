

## Plan: Inline exploit selection + deduplicated longlist runs

### Changes to `supabase/functions/build-longlist/index.ts`

**1. Inline exploit assignment during batch processing**

In the batch write loop (~line 242), when building the update payload for each scored candidate, if `pre_score >= 80`, include `selection_tier: "exploit"` in the payload. This makes high-scorers appear on the longlist immediately.

**2. Adjusted Stage 3 finalization**

When all candidates are scored and Stage 3 triggers:
- Count existing exploit candidates (already assigned inline)
- Fill remaining exploit slots up to 800 from top unassigned scored candidates
- Apply explore tier (up to 200) as before
- Discard the rest

**3. Deduplicate seeding across runs**

In the seeding section (~line 168), after collecting unique logins from `repos`, query `longlist_candidates` for all logins that already exist in **any previous** longlist run. Filter those out before inserting new candidates. This ensures each new run only processes fresh logins.

```text
repos table → unique logins
                ↓
minus logins already in longlist_candidates (any run)
                ↓
insert remaining as "pending"
```

