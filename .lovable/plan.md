

## Delete the latest longlist run

There is one longlist run: `29618a1f-1e8e-4439-bd1d-3d0b5b36c8cd` (status: paused, created Mar 7).

### Action
Run a database migration to delete:
1. All `longlist_candidates` rows where `longlist_run_id = '29618a1f-...'`
2. The `longlist_runs` row itself

This is a simple two-statement DELETE migration. No code changes needed.

