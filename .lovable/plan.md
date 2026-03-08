

## Add Score Column to Shortlist Table

### Changes — `src/pages/LeadsPage.tsx`

1. Add a **"Score"** `<TableHead>` after the Followers column (right-aligned, width ~20)
2. Add a corresponding `<TableCell>` displaying `enrichmentMap[login].overall_score` as a percentage (e.g., "72%"), right-aligned, with muted styling for zero/missing values

