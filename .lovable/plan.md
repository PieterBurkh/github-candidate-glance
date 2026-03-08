

## Fix Score Display on Lead Detail Page

The `overall_score` is stored as a value like 85 (not 0.85), but the detail page multiplies by 100, producing "8500%".

### Changes — `src/pages/LeadDetailPage.tsx`

1. **Line 237** — Change `{(person.overall_score * 100).toFixed(0)}%` to `{Math.round(person.overall_score)}%`
2. **Line 104 (CSV export)** — Change `(person.overall_score * 100).toFixed(1)` to `person.overall_score.toFixed(1)` so the CSV also exports the correct value

