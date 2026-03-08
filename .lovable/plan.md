

## Add Rubric Criteria to Bulk CSV Export

Expand the CSV download on the Shortlist page to include individual must-have and nice-to-have criteria scores and evidence — matching what's visible on the detail page, without changing the table UI.

### Changes

**`src/pages/LeadsPage.tsx`** — `downloadCsv` function only:
- Add the same `MUST_HAVE_KEYS` and `NICE_TO_HAVE_KEYS` constants (from `LeadDetailPage.tsx`)
- Extend CSV `headers` with columns for each criterion: `mh_{key}_score`, `mh_{key}_evidence` for must-haves and `nh_{key}_score`, `nh_{key}_evidence` for nice-to-haves
- In the row mapping, extract `rubric.must_have` and `rubric.nice_to_have` objects and output the score + evidence for each criterion
- No changes to the table UI itself

This adds ~20 extra columns to the CSV covering all rubric detail, making it useful for offline analysis.

