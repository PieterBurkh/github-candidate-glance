

## Remove LinkedIn Everywhere

LinkedIn data isn't useful since almost no GitHub users expose it. Remove all references.

### Changes

**1. `src/lib/categorizeLocation.ts`**
- Delete the `extractLinkedIn` function entirely

**2. `src/pages/LeadsPage.tsx`**
- Remove `Linkedin` from lucide imports
- Remove `extractLinkedIn` from categorizeLocation import
- Remove `linkedin` from CSV headers and row data
- Remove the LinkedIn `<TableHead>` column (line 199)
- Remove the LinkedIn `<TableCell>` block (lines 296-305)
- Remove the `linkedIn` variable assignment (line 216)

**3. `src/pages/LeadDetailPage.tsx`**
- Remove `Linkedin` from lucide imports
- Remove `extractLinkedIn` from categorizeLocation import
- Remove the LinkedIn link block in the profile header (lines 130-142)

No database changes needed — LinkedIn was never stored as a dedicated column, just extracted on-the-fly from the GitHub profile JSONB.

