

## Remove Pre-score, Repos, and Score Columns from Shortlist Table

Keep only: #, Candidate, Review, Location, Email, Followers, Assessment, and the external link column.

### Changes — `src/pages/LeadsPage.tsx`

1. **Remove 3 `<TableHead>` entries**: "Pre-score" (line 184), "Repos" (line 191), "Score" (line 192)
2. **Remove corresponding 3 `<TableCell>` blocks** in the table body for `pre_score`, `public_repos`, and `overall_score`
3. **Update sort default** — currently sorts by "enriched" (overall_score). Since Score column is removed, switch default sort to pre_score descending (still useful for ordering even if not displayed), or remove the sort dropdown entirely since there's only one meaningful sort now
4. Keep all fields in CSV export for data completeness

