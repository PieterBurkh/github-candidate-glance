
# GitHub Candidate Scanner — MVP Plan

## Overview
A single-page tool that uses the GitHub Search API to discover Senior Frontend Engineer candidates and displays them as scannable cards with expertise signals and top repo stats.

## Architecture
- **Frontend**: Single-page React app with candidate card grid
- **Backend**: Lovable Cloud edge function that proxies GitHub API calls (hides the GitHub token, handles rate limits, does the data processing)

## Edge Function: `github-candidates`
- Accepts a request to search for candidates
- Uses GitHub Search API (`/search/users`) with query like `language:typescript language:javascript` filtered by followers/repos to find relevant developers
- For each user found (capped at ~20 for MVP):
  - Fetches their public repos (`/users/{username}/repos`)
  - Checks repo languages and topics for React, TypeScript, HTML, CSS signals
  - Finds the repo with max stars and the repo with max forks
- Returns processed candidate data to the frontend
- Uses a stored GitHub personal access token (secret) for 5,000 req/hr limit

## Frontend: Single Page
- **Header**: Role title "Senior Frontend Engineer" with a brief static description
- **Candidate Grid**: Cards showing:
  - Avatar + name/handle (linked to GitHub profile)
  - 4 expertise badges: React ✓/✗, TypeScript ✓/✗, HTML ✓/✗, CSS ✓/✗
  - Top starred repo: star count + linked repo name
  - Top forked repo: fork count + linked repo name
- **Loading state**: Skeleton cards while data loads
- **Error states**: Per-card degraded view ("Couldn't fetch repos") with profile link still shown
- **Sort control**: Toggle between sort by max stars / max forks

## Expertise Heuristic
Simple and transparent — a candidate gets a ✓ for a technology if any of their public repos:
- Have that language in GitHub's detected languages, OR
- Have a matching topic tag (e.g., "react", "typescript")

## Session Caching
Use React Query's built-in cache to avoid re-fetching on re-renders within the same session.
