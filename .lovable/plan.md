

## Add CSV Download to Candidate Detail Page

Add a "Download CSV" button next to the Back button on `LeadDetailPage.tsx` that exports all visible candidate data as a single-row CSV.

### CSV contents
- **Profile**: login, name, email, location, location_category, company, blog, followers, public_repos
- **Scores**: overall_score, shortlist_status, review_status
- **Assessment**: assessment text, outreach_draft
- **Must-haves**: each criterion key with score + evidence
- **Nice-to-haves**: each criterion key with score + evidence
- **Repos evaluated**: comma-separated list

### Changes

**`src/pages/LeadDetailPage.tsx`**
- Add `Download` icon import from lucide
- Add a `handleDownloadCsv` function that builds headers + row from `person` and `evidence` data, creates a Blob, and triggers download
- Place a "Download CSV" button in the header row next to the Back button

