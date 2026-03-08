
## Plan: Filter Shortlist by Location-Based Score Thresholds

Update the `LeadsPage.tsx` filtering logic to apply different score thresholds based on location category:

| Location | Minimum Score |
|----------|---------------|
| UK | > 50% |
| Germany | > 50% |
| Rest of Europe | > 65% |
| Rest of World | > 80% |
| N/A | Excluded (or include at 80%?) |

### Changes to `src/pages/LeadsPage.tsx`

**In the `enrichedOnly` filter function (lines 50-59):**

Add a helper function to determine if a candidate meets the score threshold for their location:

```typescript
function meetsLocationThreshold(score: number, location: LocationCategory): boolean {
  switch (location) {
    case "Germany":
    case "UK":
      return score > 50;
    case "Rest of Europe":
      return score > 65;
    case "Rest of World":
      return score > 80;
    default: // N/A
      return false; // Exclude candidates without location
  }
}
```

**Update the filter logic** to include this threshold check:
- Get the candidate's `overall_score` and `location` from enrichment
- Apply `meetsLocationThreshold()` to filter candidates

**Update the page subtitle** to clarify the filtering logic (e.g., "Filtered by location-based score thresholds").
