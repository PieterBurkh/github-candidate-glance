

## Add Assessment to Lead Detail Page

The `shortlist_rubric` evidence entry stores an `assessment` field (a 2-3 sentence LLM evaluation). The detail page already fetches all `person_evidence` rows but doesn't surface the assessment text.

### Change: `src/pages/LeadDetailPage.tsx`

Add an "Assessment" card between the profile header and the evidence section. Extract it from the `shortlist_rubric` evidence entry:

1. Find the `shortlist_rubric` entry from `evidence` array: `evidence?.find(ev => ev.criterion === "shortlist_rubric")`
2. Read `(rubricEvidence.evidence as any)?.assessment`
3. Render a card with the assessment text below the profile header, before "Signal Evidence"

The card will show the assessment paragraph with a subtle styling — similar to how it appears as a tooltip on the shortlist table, but fully visible here.

