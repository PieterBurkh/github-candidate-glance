

## Build the Shortlist Edge Functions

The run is pending because the `run-shortlist` and `enrich-candidate` edge functions don't exist yet. The frontend creates the DB record but the actual processing never starts.

### What to build

**1. `supabase/functions/enrich-candidate/index.ts`** — Per-person enrichment

- Input: `{ login: string }`
- Fetch candidate's repos from GitHub (`GET /users/{login}/repos?per_page=30&sort=pushed`)
- Select best 4 repos (top starred, most recent, most maintained)
- Per repo: fetch README (truncated to 4k), package.json (deps only), tsconfig.json (strict flags), CHANGELOG (last 2 entries), check presence of `.storybook/`, `.github/workflows/`, test dirs
- Single LLM call via Lovable AI gateway (`google/gemini-3-flash-preview`) with structured tool_call returning 12 subscores
- Compute `overall_pct = round(100 * (0.80 * must_avg + 0.20 * nice_avg))`
- Determine status: `SHORTLIST` (>=65 AND must>=0.60), `NEEDS_REVIEW` (>=65 but must<0.60), `NO` otherwise
- Upsert into `people` table (login, profile, overall_score, shortlist_status)
- Insert into `person_evidence` with criterion `"shortlist_rubric"` containing all 12 subscores + evidence

**2. `supabase/functions/run-shortlist/index.ts`** — Orchestrator

- Follows the same `EdgeRuntime.waitUntil` + self-chaining pattern as `build-longlist`
- Input: `{ shortlistRunId: string }`
- Fetches exploit/explore candidates from `longlist_candidates` that don't yet have a `people` record with `shortlist_status != 'pending'`
- Processes in batches of 5 with 3s pause between batches
- Calls `enrich-candidate` for each login
- Updates `shortlist_runs` progress (total, enriched, shortlisted, needs_review, failed)
- Handles rate limits (GitHub 403/429) — pauses with reset_at metadata
- Auto-continues via self-chaining fetch if deadline approaching but work remains
- On completion, marks run as `done`

**3. Config update** — Add to `supabase/config.toml`:
```toml
[functions.enrich-candidate]
verify_jwt = false

[functions.run-shortlist]
verify_jwt = false
```

### Key patterns reused from existing code
- GitHub helpers with rate limit detection (from `build-longlist`)
- Lovable AI gateway with structured tool_call (from `enrich-repo`)
- `EdgeRuntime.waitUntil` for background processing + 202 immediate response
- Self-chaining for long-running jobs
- Progress tracking via `shortlist_runs.progress` JSONB

### 12-criterion LLM rubric (structured tool_call)

**Must-haves** (6, averaged, 80% weight): React+TS, Rich app architecture, Docs+versioning, Performance profiling, Technical leadership, English communication

**Nice-to-haves** (6, averaged, 20% weight): BPMN/UML UIs, WCAG 2.2, Semver library, CRDTs, WASM, Canvas/WebGL

Each scored 0/0.25/0.50/0.75/1.00 with evidence citations.

