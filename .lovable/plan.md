

## Clear Shortlist Data

Delete all rows from the three shortlist-related tables in the correct order (respecting foreign key dependencies):

1. **`person_evidence`** — depends on `people`, delete first
2. **`repo_signals`** — depends on `repos`, delete next  
3. **`people`** — delete last

### Execution

Run these three DELETE statements:

```sql
DELETE FROM person_evidence;
DELETE FROM repo_signals;
DELETE FROM people;
```

No schema or code changes needed — this is purely a data wipe to prepare for the new shortlist pipeline.

