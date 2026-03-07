

## Add CSV Download to Shortlist Page

### Change: `src/pages/LeadsPage.tsx`

Add a "Download CSV" button next to the filters. On click, serialize the currently filtered/sorted `sorted` array into CSV with columns: rank, login, name, pre_score, tier, status, followers, repos, enriched_score, assessment.

Use a simple helper that builds CSV string, creates a Blob, and triggers download via a temporary anchor element. No new dependencies needed.

