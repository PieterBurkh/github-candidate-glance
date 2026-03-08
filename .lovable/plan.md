

## Plan: Simplify Longlist Selection — Score-Only Model (70–82)

Remove all exploit/explore tier logic. A candidate is "selected" simply by having `pre_score` between 70 and 82 (inclusive). No `selection_tier` column writes needed — selection is purely score-based.

### Edge function: `supabase/functions/build-longlist/index.ts`

1. **Remove `INLINE_EXPLOIT_THRESHOLD` constant** (line 17)
2. **Remove inline exploit assignment** during processing (lines 278–280) — stop setting `selection_tier`
3. **Remove entire Stage 3 global selection block** (lines 288–345) — the exploit/explore tier logic
4. **Simplify final stats**: count candidates with `pre_score >= 70 AND pre_score <= 82` as "selected" for progress reporting, instead of counting by `selection_tier`

### Client hook: `src/hooks/useLonglistPipeline.ts`

1. **`useLonglistCandidates`**: Remove `selection_tier` filters. Instead filter by `pre_score >= 70` and `pre_score <= 82`. Remove `tierFilter` parameter.
2. **`useDynamicLonglist`**: Simplify to just query `pre_score >= 70 AND pre_score <= 82`, remove the `discard_reason` filter (scored candidates already passed discard), deduplicate by login keeping highest score.

### UI: `src/pages/LonglistResultsPage.tsx`

- Update subtitle to reflect "score 70–82" range (already close, just ensure accuracy)

### No DB migration needed
The `selection_tier` column stays in the table but is simply no longer written to or read.

