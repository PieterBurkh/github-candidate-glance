

## Hide Outreach Column from Shortlist Table

Remove the Outreach column from the visible table on the Shortlist page, while keeping it in the CSV export and on the individual candidate detail page.

### Changes — `src/pages/LeadsPage.tsx`

1. **Remove table header** (line 219): Delete `<TableHead className="min-w-[220px]">Outreach</TableHead>`
2. **Remove table cell** (lines 355-370): Delete the entire `<TableCell>` block rendering `rubric.outreach_draft`
3. **Keep CSV export unchanged** — `outreach_draft` stays in the download

No other files affected.

