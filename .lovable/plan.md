

## Plan: Update Approach Pages to Match Current Implementation

I found several discrepancies between the documentation and the actual code. Here's what needs to change:

### Longlist Approach (`LonglistApproachPage.tsx`)

**Problem**: Still describes the old exploit/explore tier system that was removed.

1. **Overview**: Change "4 stages" to "3 stages: Seeding, Hydration, and Scoring"
2. **Stage 3 (Scoring)**: Remove the paragraph about candidates scoring ≥80 being assigned the "exploit" tier. Replace with: candidates with `pre_score` between 70 and 82 are considered selected for the Longlist — no tiers, no global selection step.
3. **Stage 4 (Global Selection)**: Remove entirely. Replace with a simple "Selection" card explaining that selection is purely score-based: any candidate scoring 70–82 is included. No quotas, no exploit/explore.

### Initial List Approach (`ApproachPage.tsx`)

**Problem**: "What Comes Next" section describes an outdated pipeline.

1. Update to accurately describe the actual next steps:
   - **Longlist**: Candidates are extracted from repo owners, hydrated with GitHub metadata, and scored deterministically (0–100). Those scoring 70–82 proceed.
   - **Shortlist**: Selected candidates are evaluated by an LLM against a rubric to produce a final overall score.

### Shortlist Approach (`ShortlistApproachPage.tsx`)

**Problem**: Multiple mismatches with the actual `enrich-candidate` edge function.

1. **Overview**: Replace "exploit/explore candidates" with "candidates scoring 70–82 from the Longlist"
2. **Stage 1 — Repo selection**: The code selects up to **4 repos** (not "pinned/maintained/contributed" — it picks top 2 by stars, top 2 by most recently pushed, then fills). Update the selection rules. Also the artifacts list mentions "PR/issue samples" which the code does NOT collect — remove that row.
3. **Must-haves**: The page lists **6** criteria but the code only has **4** weighted must-haves:
   - `react_typescript` (weight 2.0)
   - `rich_app_architecture` (weight 2.0)
   - `performance_profiling` (weight 1.5)
   - `docs_versioning` (weight 1.0)
   
   Remove "Technical leadership + standards mediation" and "English communication + async comfort" from the must-haves list. Add weight information.

4. **Nice-to-haves**: These 6 match the code — keep as-is.
5. **Scoring formula**: Add that must-haves use **weighted** averaging (not simple average). Show the weights.
6. **Decision rules**: The code doesn't implement "NEEDS REVIEW" or "SHORTLIST" status labels — it just computes `overall_pct` and stores it. Simplify to just show the formula without the three-tier decision boxes, or note that these are informational thresholds.

### No backend changes needed — documentation only.

