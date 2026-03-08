

## Fix: Include all scored candidates in dynamic longlist

**Bug**: `useDynamicLonglist` filters by `stage = 'scored'`, which excludes ~15,310 candidates marked `below_threshold` by the backend — including 655 with scores of 70+.

**Fix** in `src/hooks/useLonglistPipeline.ts`:

- In `useDynamicLonglist`, remove `.eq("stage", "scored")` and replace with `.not("stage", "eq", "discarded")` (to still exclude org/not_found/no_repos discards)
- Keep `.gt("pre_score", 0)` which already filters out unscored candidates

This one-line change expands the candidate pool from ~1,039 to ~16,000+, letting the 400 exploit / 100 explore selection work across the full scored population.

