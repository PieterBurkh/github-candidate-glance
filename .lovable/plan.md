

## Replace LLM Commentary with Must-haves & Nice-to-haves Columns

### Problem
The current "LLM Commentary" column tries to display old `code_quality` evidence that doesn't exist in the new shortlist rubric. Need two new columns showing must-haves and nice-to-haves scores with reasoning.

### Backend: Update `enrich-candidate` edge function

Add two new fields to the LLM tool call schema:
- `must_haves_commentary` (string): 1-2 sentence summary of must-have scores reasoning
- `nice_to_haves_commentary` (string): 1-2 sentence summary of nice-to-have scores reasoning

Include both in the `evidencePayload` stored in `person_evidence.evidence`.

### Frontend: Update `LeadsPage.tsx`

Replace the single "LLM Commentary" column (lines 104, 192-218) with two columns:

**Column 1: "Must-haves"**
- Shows `must_avg` score (e.g. "72%") 
- Below it, the `must_haves_commentary` text in small muted font
- Tooltip on the score badge showing individual must-have criterion scores

**Column 2: "Nice-to-haves"**  
- Shows `nice_avg` score (e.g. "45%")
- Below it, the `nice_to_haves_commentary` text in small muted font
- Tooltip on the score badge showing individual nice-to-have criterion scores

### Data access
The evidence is stored under criterion `shortlist_rubric` in `person_evidence`. The frontend already fetches this via `useShortlistEnrichment`. Extract the rubric evidence like:
```ts
const rubric = enrichment?.evidence?.find(e => e.criterion === "shortlist_rubric")?.evidence;
// rubric.must_avg, rubric.nice_avg, rubric.must_haves_commentary, rubric.nice_to_haves_commentary
```

