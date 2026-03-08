

## Add Review Status Column to Shortlist

### Database
Add `review_status` column to `people` table:
```sql
ALTER TABLE public.people ADD COLUMN review_status text NOT NULL DEFAULT 'pending';
```

### Hook (`src/hooks/useShortlistData.ts`)
- Add `review_status` to `EnrichmentEntry` and populate from query
- Add `useUpdateReviewStatus(login, status)` mutation that updates `people.review_status` where `login = ?`, invalidates `shortlist-enrichment`

### UI (`src/pages/LeadsPage.tsx`)
- Add `reviewFilter` state
- Add "Review" filter dropdown in toolbar: All, Pending, Shortlisted, On hold, Rejected
- Add "Review" column with inline `<Select>` per row (values: `pending`, `shortlisted`, `on_hold`, `rejected`)
- Display labels: Pending, Shortlisted, On hold, Rejected
- Badge colors: Pending = outline, Shortlisted = green/default, On hold = secondary, Rejected = destructive
- Include `review_status` in CSV export

