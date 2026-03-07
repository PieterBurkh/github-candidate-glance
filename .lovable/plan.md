

## New Page: Longlist Approach (`/longlist-approach`)

Create a documentation page explaining how the pipeline transforms the Initial List into the Longlist, following the same visual style as the existing `/approach` page.

### Content Structure

Based on the `build-longlist` function logic, the page will explain these stages:

1. **Overview** — Brief intro: deterministic filtering using GitHub metadata (no LLM calls), designed for high throughput across 16k+ candidates.

2. **Stage 1: Seeding & Deduplication** — Unique `owner_login` values are extracted from the Initial List repos. Cross-run deduplication ensures logins already processed in previous runs are skipped.

3. **Stage 2: Hydration & Repo Selection** — For each candidate, fetch their GitHub profile and top repos. Select up to 8 representative repos (top 4 by stars, top 2 by recent push, fill remaining). Discard candidates that are organizations, not found, or have zero repos.

4. **Stage 3: Metadata Scoring** — A deterministic `pre_score` (0–100) based on: React/TS presence (+20/+15), star count, follower count, recency, repo size, complexity keywords, and GitHub Pages. A `pre_confidence` score (0–1) reflects data completeness. Candidates scoring ≥80 are immediately assigned "exploit" tier.

5. **Stage 4: Global Selection** — Triggered only when ALL candidates across ALL runs are processed. Fills quotas: 800 exploit (top scorers) + 200 explore (diverse signal candidates with ≥2 quality signals). Remaining candidates are discarded.

6. **Scoring Breakdown** — A visual breakdown of what contributes to the pre_score (React +20, TypeScript +15, Stars ≥100 +10, Followers ≥200 +10, etc.)

### File Changes

1. **`src/pages/LonglistApproachPage.tsx`** — New page, same layout pattern as `ApproachPage.tsx` (NavBar + Cards).

2. **`src/components/NavBar.tsx`** — Add nav link: `{ to: "/longlist-approach", label: "Longlist approach", icon: BookOpen }` after the existing "Initial list approach" link.

3. **`src/App.tsx`** — Add route: `<Route path="/longlist-approach" element={<LonglistApproachPage />} />`

