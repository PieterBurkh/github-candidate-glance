
Root cause (based on current code + logs):
1) The function is still bounded by platform execution time (~140s in logs), even though `DEADLINE_MS` is set to 300s.
2) `search-repos` currently fires up to ~90 GitHub Search calls in one invocation (full 9-net run), with fixed 2s pacing.
3) 2s pacing is right at the Search API minute ceiling; with jitter/shared token usage it still hits 403s.
4) After 20 consecutive 403/429s, code sets `timedOut = true`, and final status becomes `paused` with cursor.

Why it paused again:
- Not because `perPage`/`maxPages` are wrong.
- Because the function does too much in one invocation and treats repeated rate-limit responses as a pause condition.

Implementation plan to eliminate manual pausing:
1) Refactor `supabase/functions/search-repos/index.ts` into chunked auto-continuation
- Keep current cursor/watermark model.
- Add hard chunk guards (example: `MAX_CALLS_PER_PASS` + soft time budget around 100–110s).
- When chunk limit is reached, checkpoint cursor/page_watermarks, keep run in `running`, and self-invoke `search-repos` with `{ runId }` to continue automatically.
- Only mark `completed` when all loops are fully exhausted.

2) Add adaptive rate-limit handling (instead of consecutive-error pausing)
- Parse GitHub headers (`x-ratelimit-remaining`, `x-ratelimit-reset`, `retry-after`) on each response.
- Increase baseline delay slightly (e.g. 2200–2500ms).
- If near zero remaining, checkpoint and exit current pass for auto-continue (instead of hammering and accumulating 403s).
- Treat 403/429 as controlled “yield + continue later,” not as “pause requiring user resume.”

3) Preserve explicit user pause behavior
- If status check finds user-set `paused`, stop and keep status `paused` (no auto-continue).
- Distinguish stop reasons in `search_params.phase` (`user_paused`, `auto_continuing`, `rate_limit_yield`, `completed`) for UI clarity.

4) Update client expectations in `src/hooks/useSignalPipeline.ts` (minimal)
- Ensure start/resume mutation accepts “accepted/running” responses (not only final repoCount).
- Keep current polling-driven UI behavior; no route/UI redesign required.

5) Optional UX polish in `src/pages/RunsPage.tsx`
- If `search_params.phase === "auto_continuing"` show a small badge like “Continuing automatically” so users don’t think they must click Resume.

Technical details:
- Files to change:
  - `supabase/functions/search-repos/index.ts` (main logic)
  - `src/hooks/useSignalPipeline.ts` (response typing/handling)
  - `src/pages/RunsPage.tsx` (optional status badge)
- No database migration required.
- Existing run cursor/watermark schema already supports resumable chunk execution.

Validation plan:
1) Start a full 9-net run and confirm it stays `running` across multiple internal passes and ends `completed` without manual Resume.
2) Check logs for:
   - multiple “auto-continue queued” passes
   - no long 403 streaks
   - final completion with cursor cleared
3) Verify manual Pause still works and does not auto-resume.
4) Verify Resume still works for genuinely user-paused runs.
