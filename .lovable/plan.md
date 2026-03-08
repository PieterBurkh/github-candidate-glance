

## Plan: Consolidate Run Pages into "Sourcing New Candidates"

Merge the three run pages (Initial List Runs, Longlist Runs, Shortlist Runs) into a single page with tabs to switch between them. Add a single nav link called "Sourcing New Candidates".

### New file: `src/pages/SourcingPage.tsx`
- A wrapper page with `<NavBar />` and `<Tabs>` (using existing Radix tabs component)
- Three tabs: "Initial List Runs", "Longlist Runs", "Shortlist Runs"
- Each tab renders the **content** (not the full page with NavBar) of the respective runs page
- To avoid duplication, refactor each runs page to export its content as a separate component

### Refactor existing pages
**`src/pages/RunsPage.tsx`** — Extract the inner content (everything inside the NavBar wrapper) into an exported `RunsContent` component. Keep the default export as-is for the standalone route (which we'll remove from routing but keep the file for the component).

**`src/pages/LonglistRunsPage.tsx`** — Same: export a `LonglistRunsContent` component.

**`src/pages/ShortlistRunsPage.tsx`** — Same: export a `ShortlistRunsContent` component.

### `src/components/NavBar.tsx`
- Remove the three separate run links: "Initial list runs" (`/`), "Longlist runs" (`/longlist-runs`), "Shortlist runs" (`/shortlist-runs`)
- Add one link: `{ to: "/sourcing", label: "Sourcing", icon: Search }`
- Update the home route active check since `/` is no longer the runs page

### `src/App.tsx`
- Add route `/sourcing` → `SourcingPage`
- Change `/` to redirect to `/sourcing` (or make `/sourcing` the home page)
- Remove standalone `/shortlist-runs` and `/longlist-runs` routes
- Keep `/runs/:runId/*` routes as-is

