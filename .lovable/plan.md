

## Rename "Enriched" to "Score" and fix percentage display

### Changes in `src/pages/LeadsPage.tsx`:

1. **Rename column header** from "Enriched" to "Score"
2. **Rename sort option** from "Sort by Enriched" to "Sort by Score"
3. **Fix score display** — currently shows `(enrichment.overall_score * 100).toFixed(0)%` but `overall_score` appears to be already in 0-10000 range (showing 9200 instead of 92%). Divide by 100 to get 0-100 percentage.
4. **Remove the Progress bar** next to the score — just show the percentage number
5. **Update CSV export** — same score fix for the `enriched_score` column

