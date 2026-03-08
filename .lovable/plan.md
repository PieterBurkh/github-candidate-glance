

## Plan: Fix Shortlist Score & Assessment on Longlist Page

### Issue 1: Score Display
Line 150 does `enrichment.overall_score * 100` — but the score is already 0–100 (LeadsPage uses `Math.round(enrichment.overall_score)` directly). Remove the `* 100`.

### Issue 2: Assessment Text
Line 73–82 builds assessment from criteria scores. Instead, pull the LLM-written assessment text from `enrichmentMap[login].evidence.find(e => e.criterion === "shortlist_rubric")?.evidence?.assessment`.

### Changes to `src/pages/LonglistResultsPage.tsx`

1. **Line 150**: Change `Math.round(enrichment.overall_score * 100)` → `Math.round(enrichment.overall_score)`

2. **Lines 73–83** (`summarizeAssessment`): Replace with lookup of LLM assessment:
   ```typescript
   const getAssessment = (login: string): string => {
     const entry = enrichmentMap[login];
     if (!entry?.evidence) return "";
     const rubric = entry.evidence.find((ev: any) => ev.criterion === "shortlist_rubric");
     return (rubric?.evidence as any)?.assessment || "";
   };
   ```

3. **Line 153**: Update call from `summarizeAssessment` → `getAssessment`

