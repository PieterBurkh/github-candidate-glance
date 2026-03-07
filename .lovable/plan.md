

## Simplify Shortlist Rubric: Remove Non-Frontend Criteria

### Changes in `supabase/functions/enrich-candidate/index.ts`

**Remove from MUST_HAVE_CRITERIA:**
- `technical_leadership`
- `english_communication`

New must-haves (4 criteria):
1. `react_typescript` — weight 2.0
2. `rich_app_architecture` — weight 2.0
3. `performance_profiling` — weight 1.5
4. `docs_versioning` — weight 1.0

**Repo selection:** Update `selectTopRepos` to prefer repos where `language` is TypeScript/JavaScript/HTML/CSS before falling back to others.

**Hard gate:** If `react_typescript.score < 0.25`, auto-set status to `"NO"`.

**Weighted scoring formula:**
```
weighted_must = (react*2 + arch*2 + perf*1.5 + docs*1) / 6.5
```

**LLM prompt/schema changes:**
- Remove `technical_leadership` and `english_communication` from the tool schema `required` and `properties`
- Remove their descriptions from the system prompt
- Sharpen prompt to emphasize this is a **frontend/UI engineering** role — penalize candidates with no client-side work

**Evidence payload:** Remove `technical_leadership` and `english_communication` from `must_haves` in stored evidence.

Everything else (nice-to-haves at 20% weight, thresholds, assessment field) stays the same.

