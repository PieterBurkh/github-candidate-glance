

## Plan: Consolidate Approach Pages into "Search & Scoring Approach"

Same pattern as the Sourcing page — one page with three tabs.

### New file: `src/pages/ApproachOverviewPage.tsx`
- NavBar + Tabs with three tabs: "Initial List", "Longlist", "Shortlist"
- Each tab renders the content extracted from the existing approach pages

### Refactor existing pages
- **`src/pages/ApproachPage.tsx`** — Export an `ApproachContent` component (everything below NavBar)
- **`src/pages/LonglistApproachPage.tsx`** — Export a `LonglistApproachContent` component
- **`src/pages/ShortlistApproachPage.tsx`** — Export a `ShortlistApproachContent` component

### `src/components/NavBar.tsx`
- Replace the three separate approach links ("Initial list approach", "Longlist approach", "Shortlist approach") with one: `{ to: "/approach", label: "Search & Scoring", icon: BookOpen }`

### `src/App.tsx`
- Change `/approach` route to render `ApproachOverviewPage`
- Remove `/longlist-approach` and `/shortlist-approach` routes

