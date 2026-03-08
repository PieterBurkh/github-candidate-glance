

## Add AI-Generated Outreach Draft

### How it works

During enrichment, the LLM already receives the candidate's name, profile, and full repo evidence. We add one more required field (`outreach_draft`) to the tool call schema with instructions to produce a personalized 2-3 sentence message. The LLM fills it in — no separate API call needed.

### Changes

**1. Edge function (`supabase/functions/enrich-candidate/index.ts`)**

- Add `outreach_draft` to `toolProperties` with a description instructing the LLM to write a personalized outreach following this template structure:
  - Greet by first name
  - Reference specific repos/skills from the evidence
  - Mention Hash's mission (open-source platform for knowledge graphs)
  - Ask about the Frontend Engineer position
- Add `outreach_draft` to `toolRequired`
- Include `outreach_draft` in `evidencePayload` (line ~458) so it's stored in the `person_evidence.evidence` JSONB

**2. Shortlist table (`src/pages/LeadsPage.tsx`)**

- Add an "Outreach" column after Assessment showing the draft (truncated, with tooltip for full text — same pattern as Assessment column)
- Include `outreach_draft` in CSV export

**3. Candidate detail page (`src/pages/LeadDetailPage.tsx`)**

- Add an "Outreach Draft" card after the Assessment card
- Show full message text with a copy-to-clipboard button

**4. No database migration needed** — stored in existing `person_evidence.evidence` JSONB field

Note: Only newly enriched candidates will have outreach drafts. Previously processed candidates would need re-enrichment to generate one.

