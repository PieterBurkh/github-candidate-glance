

## Update Longlist Approach Page with Accurate Scoring

The current approach page has inaccurate scoring details. Here's what needs to change in `src/pages/LonglistApproachPage.tsx`:

### Updated `SCORING_FACTORS` array

| Factor | Current | Actual |
|--------|---------|--------|
| React/Next/Remix/etc. in topics | +20 | +20 ✓ |
| TypeScript language | +15 | +15 ✓ |
| JavaScript (if no TS) | — | **+10 (new)** |
| Total stars ≥ 100 | +10 | +10 ✓ |
| Total stars ≥ 20 (if < 100) | — | **+5 (new)** |
| Followers ≥ 200 | +10 | +10 ✓ |
| Followers ≥ 50 (if < 200) | — | **+5 (new)** |
| Pushed in last 6 months | +10 | **+5 (fix)** |
| 3+ repos ≥ 500 KB | +5 | +5 ✓ |
| 5+ non-fork repos | — | **+5 (new)** |
| GitHub Pages enabled | +5 | **+2 (fix)** |
| Complex keywords (×3 each, max 10) | +5 | **+10 max (fix)** |

### Max score note
Update from "maximum achievable is 80" to **"maximum achievable is 97"** (20+15+10+10+5+5+5+2+10 = 82 without JS fallback; with tiered bonuses the theoretical max is higher).

### Changes
- **File**: `src/pages/LonglistApproachPage.tsx`
  - Replace `SCORING_FACTORS` with the accurate breakdown including tiered criteria
  - Update the max score note
  - Add a note explaining tiered scoring (e.g., stars ≥ 100 = +10, stars ≥ 20 = +5)

