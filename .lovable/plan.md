

## Remove Tier Column from Shortlist Table

The explore/exploit tier distinction was removed from the pipeline logic, so the Tier column on the Shortlist page is now meaningless. Remove it from the visible table (keep in CSV if present for backward compatibility with older data).

### Changes — `src/pages/LeadsPage.tsx`

1. **Remove the "Tier" `<TableHead>`** from the table header row
2. **Remove the corresponding `<TableCell>`** that renders `selection_tier` badge
3. Keep any tier data in the CSV export in case old records have it populated

No other files affected.

