

## Plan: Hide Longlist from Navigation

Remove the Longlist entry from the navbar in `src/components/NavBar.tsx` (line 8: `{ to: "/longlist-results", label: "Longlist", icon: Users }`).

The route will still exist in `App.tsx` for direct access, just won't be visible in the nav.

