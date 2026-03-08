
Current live status (from backend right now):
- Pipeline run `4589ce99-b53c-4efd-8629-9baf40c1cace` is still at stage `initial_list`.
- Linked initial-list run `62e5373c-c67d-4858-b325-ce17a59bde3a` is currently `paused` (not completed).
- It has found `477` repos so far.
- `search_params` shows `timed_out: true` and `cursor: null`.

Why it is still in Initial List:
- The orchestrator only moves to Longlist when `runs.status = completed`.
- Your run keeps timing out in chunks (expected for larger runs), but resume progress is not being checkpointed correctly.
- Because `cursor` is `null`, each resume starts from the beginning instead of continuing where it left off, so it can loop in Initial List for a long time.

What’s happening operationally:
- The UI is sending advance calls (confirmed by successful `run-pipeline` response: `{"stage":"initial_list","resumed":true}`).
- Each resume re-launches `search-repos`, but without a valid cursor checkpoint it reprocesses early query space.
- Net effect: repo count can still creep up, but completion is delayed/stalled and pipeline stage does not advance.

Implementation plan to fix this permanently:
1. Fix cursor persistence in `search-repos` by moving `lastCursor` to a scope shared with `finally` (so real cursor state is saved on timeout).
2. Save cursor atomically whenever timing out/pausing, and verify resume starts from that cursor position.
3. Add explicit status metadata (`phase`, `last_checkpoint_at`, `resume_count`) so Initial List progress is transparent.
4. Add a guard in `run-pipeline` for “timed_out + null cursor” to fail fast with actionable error instead of silent looping.
5. Validate end-to-end with a large run (`per_page=10`, `max_pages=5`) and confirm stage transitions Initial List → Longlist.
