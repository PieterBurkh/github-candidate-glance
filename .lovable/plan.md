

# Filter Out Non-Real-People (Orgs, Bots, Archived Accounts)

## Problem
Currently the pipeline treats every repo owner as a candidate. This lets in GitHub organizations (e.g. `facebook`, `vercel`), bot accounts (e.g. `dependabot`, `renovate`), and other non-individual entities.

## Changes

### 1. `search-repos/index.ts` — skip org-owned repos at discovery time
- The GitHub Search API response includes `owner.type` (`"User"` vs `"Organization"`).
- Filter out items where `owner.type !== "User"` before inserting into `repos`.
- Store `owner.type` in the repo `metadata` for downstream use.

### 2. `enrich-repo/index.ts` — validate the person during enrichment
When fetching the GitHub user profile (`/users/{login}`), the response includes a `type` field. Add checks:
- **Skip organizations**: `profile.type === "Organization"` → don't create a `people` row.
- **Skip bots**: check for `[bot]` suffix in login, or `profile.type === "Bot"`, or known bot logins (`dependabot`, `renovate-bot`, `github-actions`, `greenkeeper`, etc.).
- **Skip sparse profiles**: optionally flag users with no `name`, no `bio`, no `blog`, and 0 followers as low-confidence (still store, but mark in profile).
- Store a `is_real_person: true/false` flag in the `profile` jsonb so the UI can filter.

### 3. `run-enrichment/index.ts` — skip non-user repos during batch processing
Before calling enrich-repo logic, check stored `metadata.owner_type` and skip `"Organization"` repos entirely to save API calls.

### 4. Frontend — filter leads
On the Leads page, only show people where `profile.is_real_person` is true (or not explicitly false). No DB schema change needed since `profile` is jsonb.

## Summary of filters (in order)
1. **Search time**: reject repos owned by orgs (`owner.type !== "User"`)
2. **Enrichment time**: reject bot accounts, mark sparse profiles
3. **Display time**: only show verified real people

