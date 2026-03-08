
## Plan: Remove Email & Followers from Shortlist Table, Add Email to Candidate Detail Card

### 1. `src/pages/LeadsPage.tsx` — Remove Email and Followers columns

- Remove `<TableHead>` for Email (line 192) and Followers (line 194)
- Remove `<TableCell>` for Email (lines 259-268) and Followers (lines 269-278)
- Remove `max-w-[280px]` constraint on Assessment column to let it use freed space
- Remove unused `Users` and `Mail` imports
- Keep email/followers in CSV export (data still valuable for export)

### 2. `src/pages/LeadDetailPage.tsx` — Add Email near Outreach Draft

- Add an email display section right above the Outreach Draft card, showing the candidate's email with a mailto link and copy button, so it's easy to grab when composing outreach.
