

## Plan: Hide "Initial list" from Navigation

Remove the "Initial list" link (line 8) from the NavBar links array and remove the unused `List` icon import.

### `src/components/NavBar.tsx`
- Remove `{ to: "/longlist", label: "Initial list", icon: List }` from the links array
- Remove `List` from the lucide-react import

