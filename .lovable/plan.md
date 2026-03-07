

## Reset All Shortlist Evaluations

Clear all existing shortlist scoring data so you can re-run with the new frontend-focused methodology.

### Data operations (using SQL data tool, not migrations):

1. **Delete all person_evidence rows** — removes all LLM commentary and scoring evidence
2. **Reset people table** — set `overall_score = 0` and `shortlist_status = 'pending'` for all rows
3. **Reset shortlist_runs** — set all runs to `status = 'completed'` and clear progress (so they don't interfere with new runs)

No code or schema changes needed — just three data cleanup queries.

