

## Filter Shortlist to Only Show Enriched Candidates

Currently the Shortlist page pulls ALL longlist candidates and shows "Pending" for unenriched ones. The user wants candidates to only appear on the shortlist once they have been enriched via LLM.

### Change

**`src/pages/LeadsPage.tsx`** — After fetching longlist candidates and enrichment data, filter to only include candidates that have an entry in `enrichmentMap`:

```ts
const enrichedOnly = (candidates || []).filter(c => enrichmentMap[c.login]);
```

Then sort/render from `enrichedOnly` instead of `candidates`. Update the count text accordingly (e.g. "X enriched candidates"). The empty state message should say something like "No enriched candidates yet. Run enrichment on longlist candidates to populate the shortlist."

Default sort should change to `"enriched"` since all candidates will have scores.

