

## Understanding the Request

Currently, Stage 3 (selection of top 800 exploit + 200 explore) triggers when the **current run's** pending candidates reach zero. But since runs are now batched (each run only processes new/unseen logins), Stage 3 should only trigger once **every unique login from the entire initial list** has been processed across all runs.

## Plan: Global Stage 3 Trigger

### Changes to `supabase/functions/build-longlist/index.ts`

**1. Replace the current run-scoped completion check with a global check**

After processing the current run's pending candidates to zero, instead of immediately running Stage 3, compare:
- Total unique `owner_login` values in `repos` table (optionally filtered by `source_run_id`)
- Total distinct logins in `longlist_candidates` across ALL runs where `stage` is `scored` or `discarded` (i.e., not `pending`)

Only trigger Stage 3 if these counts match (all logins have been processed).

**2. Make Stage 3 selection cross-run**

When Stage 3 triggers, the exploit/explore selection should query `longlist_candidates` across **all runs** (not filtered by `longlist_run_id`), so the top 1,000 are chosen from the entire candidate pool:
- Count inline exploit candidates across all runs
- Fill exploit slots (up to 800) from top scorers across all runs
- Assign explore tier (up to 200) from remaining across all runs
- Discard the rest across all runs

**3. Mark the triggering run as "done" and update progress with global stats**

The run that triggers Stage 3 gets status `"done"` with global totals. Previous completed runs remain as-is (their candidates now have selection tiers assigned).

