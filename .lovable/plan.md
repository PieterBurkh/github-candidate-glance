

## Add Review Status Selector to Candidate Detail Page

Add the same review status dropdown (Pending / Shortlisted / On hold / Rejected) to the individual candidate detail page, synced with the shortlist table via the same `useUpdateReviewStatus` mutation and shared query cache.

### Changes

**`src/pages/LeadDetailPage.tsx`**
- Import `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue` and `Badge`
- Import `useUpdateReviewStatus` from `@/hooks/useShortlistData`
- Import `useShortlistEnrichment` (to read current review_status) OR read it from `person.review_status` directly
- Add a Review Status `<Select>` widget in the profile header card (next to the score), using the same `REVIEW_OPTIONS`, `reviewBadgeVariant`, and `reviewLabel` helpers (extracted or duplicated)
- On change, call `updateReview.mutate({ login, status })` which updates the `people` table and invalidates the `shortlist-enrichment` query — keeping both pages in sync automatically via React Query cache invalidation

The existing `useUpdateReviewStatus` hook already handles the mutation and cache invalidation, so both the table and detail page will reflect changes immediately.

