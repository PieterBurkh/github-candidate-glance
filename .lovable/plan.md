

## Plan: Make Table Rows Clickable to Open Candidate Card

**File: `src/pages/LeadsPage.tsx`**

1. Import `useNavigate` from `react-router-dom`
2. Add `const navigate = useNavigate()` in the component
3. Add `onClick` + `cursor-pointer` to each `<TableRow>` that navigates to `/leads/${c.login}`
4. On the Review `<TableCell>`, add `onClick={(e) => e.stopPropagation()}` to prevent row navigation when interacting with the review dropdown
5. Same `stopPropagation` on the external link button cell and email link cell

