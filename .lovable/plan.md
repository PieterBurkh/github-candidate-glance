

# Replace Keyword Scoring with LLM-Powered Code Quality Assessment

## Overview

Replace the current `scoreCriterion1` heuristic in `enrich-repo` with a multi-step pipeline: fetch the repo tree, build an evidence pack of ~8-20 representative files, send them to Lovable AI (Gemini Flash) for structured scoring, and store category-level breakdowns with evidence snippets.

## Architecture

```text
enrich-repo (rewritten)
  │
  ├─ Step 1: Repo Snapshot (deterministic)
  │    GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1
  │    + languages, topics, releases from existing metadata
  │
  ├─ Step 2: Evidence Pack Builder (deterministic sampling)
  │    Classify repo kind (app | library | monorepo | unknown)
  │    Select 8-20 files by priority rules
  │    Fetch file contents (truncated to ~200 lines each, ~100KB total budget)
  │
  ├─ Step 3: LLM Review (Lovable AI, gemini-3-flash-preview)
  │    Send evidence pack + metadata → tool_call for structured output
  │    Returns category scores + evidence citations
  │
  └─ Step 4: Store results
       Upsert repo_signals with category breakdown
       Update person_evidence with new score
```

## Changes

### 1. Rewrite `supabase/functions/enrich-repo/index.ts`

**Remove**: `scoreCriterion1`, `TEMPLATE_KEYWORDS`, all the keyword/gate logic.

**Add**:

- **`fetchRepoTree(fullName, branch)`** — calls GitHub recursive tree API, returns array of file paths + sizes.

- **`classifyRepo(tree, packageJson)`** — deterministic classification:
  - Library: `exports` in package.json, rollup/tsup config, src/index.ts as sole entry
  - App: next.config.*, vite.config.*, pages/, app/, routes/, public/
  - Monorepo: packages/, apps/ directories
  - Unknown: fallback

- **`buildEvidencePack(tree, fullName, branch, repoKind)`** — selects files by priority:
  1. Always: package.json, tsconfig.json, lint/format/build/test configs
  2. Core code: entry points (src/main.tsx, src/index.tsx, app/layout.tsx), root App.tsx, router setup
  3. Components: 2-3 largest non-generated files from src/components/**
  4. Hooks: 1-2 from src/hooks/**
  5. State: redux/zustand/query files if present
  6. Hard excludes: lockfiles, dist/, build/, coverage/, *.d.ts, node_modules, minified
  - Token budget: ~100KB total. Large files get first 200 + last 100 lines.
  - Returns `{ path, content }[]` plus metadata about what was sampled.

- **`llmReview(evidencePack, metadata)`** — calls Lovable AI gateway with tool calling for structured output. Categories scored 0-1:
  - **Architecture** (project structure, separation of concerns, routing)
  - **Type Safety** (TypeScript usage, strictness, type coverage)
  - **Code Quality** (naming, patterns, error handling, DRY)
  - **Tooling** (linting, testing, build config, CI)
  - **Styling** (CSS approach, consistency, responsiveness)
  - Each category returns: `{ score, confidence, evidence: [{ file, snippet, comment }] }`
  - Overall score = weighted average of categories.

- **Person upsert + evidence storage** — keep existing logic, just use the new score.

### 2. Update `supabase/config.toml`

Add `verify_jwt = false` for enrich-repo (already exists, just confirm).

### 3. Update `repo_signals` usage

The `criterion` field changes from `"react_ts_css"` to `"code_quality"`. The `evidence` JSONB now stores category breakdowns with file-level citations. The `notes` field stores the repo classification and sampling summary.

### 4. Update `run-enrichment/index.ts`

- Increase batch delay to account for LLM calls (~2-3s per repo).
- Reduce batch size from 3 to 2 to stay within rate limits.

### 5. Update Lead Detail UI (`src/pages/LeadDetailPage.tsx`)

- Show category breakdown (Architecture, Type Safety, Code Quality, Tooling, Styling) as individual progress bars.
- Show evidence snippets with file path links and LLM comments.
- Handle both old `"react_ts_css"` and new `"code_quality"` criterion gracefully.

### 6. Update Leads list (`src/pages/LeadsPage.tsx`)

- Update badge from "React+TS" to show top category or overall quality tier (e.g., "A-tier", "B-tier").

## LLM Prompt Design (inside edge function)

The system prompt instructs the model to act as a senior code reviewer. It receives the evidence pack as a structured list of `{path, content}` objects plus repo metadata (stars, topics, languages). It must respond via tool calling with the 5 category scores, each with 1-3 evidence citations pointing to specific files and short code excerpts.

## Rate Limit Considerations

- Lovable AI has per-minute rate limits. Batch size reduced to 2 with 3s delays.
- Each LLM call sends ~50-100KB of code — well within Gemini Flash context window.
- If 429 received, exponential backoff before retry (max 2 retries).

## What stays the same

- `search-repos` — unchanged
- Person filtering (is_real_person) — unchanged
- Database schema — no migrations needed, same tables used with richer JSONB content

