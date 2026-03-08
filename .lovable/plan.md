

## Delete Existing Shortlist Run Data

Clear all shortlist-related data so you can start fresh. There's 1 shortlist run, 20 people records, and 19 person_evidence records.

### Data to delete (in order, respecting foreign key dependencies)

1. **`person_evidence`** — delete all 19 rows
2. **`people`** — delete all 20 rows  
3. **`shortlist_runs`** — delete the 1 run

### Implementation

Use the database insert tool to run DELETE statements against these three tables. No code changes needed.

