

## Replace Must-haves & Nice-to-haves Columns with Single Assessment Column

### Backend: `supabase/functions/enrich-candidate/index.ts`
- Replace `must_haves_commentary` and `nice_to_haves_commentary` with a single `assessment` field (string, 2-3 sentences)
- Update the system prompt to instruct the LLM: "Provide an `assessment`: 2-3 sentences explaining why you gave this overall score — what stood out (good or bad) in the candidate's repos, citing specific repositories or patterns observed."
- Update the tool call schema: remove `must_haves_commentary` and `nice_to_haves_commentary`, add `assessment`
- Update the evidencePayload to store `assessment` instead of the two commentary fields

### Frontend: `src/pages/LeadsPage.tsx`
- Remove the two columns "Must-haves" and "Nice-to-haves" (both header and body cells)
- Add a single "Assessment" column (min-width ~280px) that shows the `rubric.assessment` text in small muted font, line-clamped to 3 lines
- Keep the tooltip with full text on hover for longer assessments

