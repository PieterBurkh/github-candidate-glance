

## Frontend: Shortlist Runs Page + Shortlist Approach Page

Three frontend deliverables to complete the shortlist UI layer. No backend/edge function changes in this step.

---

### 1. New page: `src/pages/ShortlistApproachPage.tsx`

A documentation page (like `LonglistApproachPage.tsx`) explaining the longlist-to-shortlist methodology. Content sections:

- **Overview** -- Person-centric LLM evaluation of exploit/explore candidates using compact GitHub evidence packs. Not full codebases.
- **Stage 1: Evidence Pack Assembly** -- Repo selection rules (max 4: pinned, most active, most maintained, contributed). Per-repo artifacts collected (README 4k chars, package.json deps, tsconfig strict flags, CHANGELOG last 2 entries, presence flags, releases summary, PR/issue samples max 3).
- **Stage 2: LLM Scoring** -- Single Gemini call per candidate. 12-criterion rubric with 0/0.25/0.50/0.75/1.00 scale.
- **Must-haves (80% weight)** -- Table listing 6 criteria: React+TS, Rich apps/architecture, Docs+versioning, Performance profiling, Technical leadership, English communication. Each with strong/weak evidence examples.
- **Nice-to-haves (20% weight)** -- Table listing 6 criteria: BPMN/UML UIs, WCAG 2.2, Semver library maintenance, CRDTs, WASM, Canvas/WebGL.
- **Scoring Formula** -- `overall_pct = round(100 * (0.80 * must_haves_score + 0.20 * nice_haves_score))`
- **Decision Rules** -- SHORTLIST if overall_pct >= 65 AND must >= 0.60; NEEDS_REVIEW if overall_pct >= 65 but confidence < 0.60; NO otherwise.
- **Anti-gaming Rules** -- Downweight templates, tutorials, forks; stars/forks as context only.

Route: `/shortlist-approach`

---

### 2. New page: `src/pages/ShortlistRunsPage.tsx`

Modeled directly on `LonglistRunsPage.tsx`. Shows a list of shortlist enrichment runs with:

- "New Shortlist Run" button that will call the `run-shortlist` edge function (to be built later)
- Run cards showing status (pending/running/paused/done/failed), progress badges (total candidates, enriched, shortlisted, needs_review, failed)
- Resume button for paused runs (rate-limited scenarios)

This requires a new `shortlist_runs` table in the database:

```sql
CREATE TABLE shortlist_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending',
  progress jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE shortlist_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to shortlist_runs" ON shortlist_runs FOR ALL USING (true) WITH CHECK (true);
```

New hooks in `src/hooks/useShortlistPipeline.ts`:
- `useShortlistRuns()` -- fetches shortlist_runs ordered by created_at desc, polls every 5s
- `useStartShortlistRun()` -- inserts a run record and invokes `run-shortlist` edge function
- `useResumeShortlistRun()` -- invokes `run-shortlist` with existing run ID

Route: `/shortlist-runs`

---

### 3. Update `src/pages/LeadsPage.tsx` (Shortlist table)

Add a `shortlist_status` filter dropdown (All / SHORTLIST / NEEDS_REVIEW / NO) alongside the existing tier filter. Update the `useShortlistEnrichment` hook to also return `shortlist_status` from the `people` table. Display status as a colored badge in a new column.

This requires a DB migration to add the column:

```sql
ALTER TABLE people ADD COLUMN shortlist_status text DEFAULT 'pending';
```

---

### 4. Update NavBar

Add two new nav items:
- `{ to: "/shortlist-runs", label: "Shortlist runs", icon: Filter }` -- between Longlist and Shortlist
- `{ to: "/shortlist-approach", label: "Shortlist approach", icon: BookOpen }` -- after Longlist approach

---

### 5. Update `src/App.tsx` routes

Add routes for `/shortlist-runs` and `/shortlist-approach`.

