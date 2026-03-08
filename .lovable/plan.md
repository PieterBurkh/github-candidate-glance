
## Plan: Fix Back Button to Navigate to Shortlist

**File: `src/pages/LeadDetailPage.tsx`** (line 157)

Change the `Link` destination from `"/"` to `"/shortlist"`:
```tsx
<Link to="/shortlist">
```

This ensures clicking "Back" returns users to the shortlist page where they came from.
