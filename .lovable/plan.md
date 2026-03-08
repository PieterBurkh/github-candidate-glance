

## Add Location Category, LinkedIn & Email Columns

GitHub profile data (`location`, `email`, `blog`) is **already fetched and stored** in the `people.profile` JSONB during enrichment. This is purely a UI display task — no backend or schema changes needed.

### Location categorization

Add a utility function that maps the free-text GitHub `location` field to one of four buckets:

- **Germany** — matches "Germany", "Berlin", "Munich", "Hamburg", "Frankfurt", "Deutschland", etc.
- **UK** — matches "United Kingdom", "London", "UK", "England", "Scotland", etc.
- **Rest of Europe** — matches known European country/city names
- **Rest of World** — anything else that has a location value
- **N/A** — no location set on GitHub

### Changes

**1. New utility: `src/lib/categorizeLocation.ts`**
- Simple keyword-matching function returning one of the 5 categories
- Used by both the table and detail page

**2. Shortlist table (`src/pages/LeadsPage.tsx`)**
- Add **Location** column showing the categorized badge (Germany / UK / Europe / World / N/A)
- Add **Email** column showing the email if available from GitHub profile, "N/A" otherwise
- Add **LinkedIn** column — extract from `blog` or `bio` fields if it contains "linkedin.com", show link or "N/A"
- Add location filter dropdown (Germany / UK / Rest of Europe / Rest of World)

**3. Candidate detail page (`src/pages/LeadDetailPage.tsx`)**
- Add LinkedIn link in the profile header (next to existing blog/email) if detected
- Location category badge next to the raw location text

**4. CSV export**
- Add `location_category`, `email`, `linkedin` columns

### LinkedIn detection

GitHub has no dedicated LinkedIn field. The function will scan `blog` and `bio` for URLs containing `linkedin.com/in/` and extract the URL. This catches ~60-70% of users who put their LinkedIn in those fields.

### No database or edge function changes needed
All data is already stored in `people.profile` from the GitHub API response.

