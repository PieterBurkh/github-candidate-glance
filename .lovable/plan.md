

## Clear All Shortlist Data

There are currently 3 shortlist runs, 181 people records, and 108 person_evidence records.

I will delete all data from these three tables in the correct order (child tables first to avoid foreign key issues):

1. **Delete all `person_evidence`** rows (108 rows)
2. **Delete all `people`** rows (181 rows)
3. **Delete all `shortlist_runs`** rows (3 rows)

This gives you a clean slate to re-run the shortlist pipeline from scratch. No schema changes needed — just data deletion.

