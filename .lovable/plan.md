

## Display Rubric Criteria on Lead Detail Page

Update `LeadDetailPage.tsx` to show the per-criterion scores from the `shortlist_rubric` evidence, replacing the current generic "Signal Evidence" section that doesn't understand the rubric format.

### What you'll see on the candidate card

After the Assessment card, a new **Evaluation Breakdown** section will show:

1. **Must-Haves** — 4 criteria with progress bars, scores, and evidence text:
   - React & TypeScript (weight 2.0)
   - Rich App Architecture (weight 2.0)
   - Performance Profiling (weight 1.5)
   - Docs & Versioning (weight 1.0)
   - Weighted average displayed as a summary

2. **Nice-to-Haves** — 6 criteria with progress bars and evidence:
   - BPMN/UML UIs, WCAG Accessibility, Semver/Library Maintenance, CRDTs, WASM, Canvas/WebGL
   - Simple average displayed as a summary

3. **Repos Evaluated** — list of GitHub repos that were analyzed

Each criterion shows a labeled progress bar (0–100%), the score value, and the LLM's evidence text explaining why.

### Technical changes

**File: `src/pages/LeadDetailPage.tsx`**

- Add a criteria label map (e.g., `react_typescript` → "React & TypeScript")
- Extract the `shortlist_rubric` evidence entry
- Render two grouped cards (Must-Haves, Nice-to-Haves) with per-criterion `Progress` bars + evidence text
- Show `repos_evaluated` as linked items
- Remove/simplify the legacy "Signal Evidence" loop that currently doesn't render rubric data properly

