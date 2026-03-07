

## Fix Score Display — Remove `/100` Division

The `overall_score` in the database is already in the 0-100 range (e.g. 92, 90, 87). The current code divides by 100, producing 0-1% values.

### Changes in `src/pages/LeadsPage.tsx`:

1. **Table display (line 214)**: Change `(enrichment.overall_score / 100).toFixed(0)` → `enrichment.overall_score`
2. **CSV export (line 59)**: Change `(e.overall_score / 100).toFixed(1)` → `e.overall_score`

Two-line fix.

