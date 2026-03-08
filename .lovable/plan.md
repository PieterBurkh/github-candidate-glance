
## Plan: Create "Start Here" Landing Page

Add a comprehensive documentation page as the default entry point with the exact content provided.

### Changes

**1. New file: `src/pages/StartHerePage.tsx`**
- Full documentation page with NavBar
- Sections:
  - **Introduction**: Tool overview with link to `/job` (Front-end Engineer job description)
  - **Two capabilities**: Review shortlist / Add new candidates
  - **Shortlist section**: Link to `/shortlist`, explains LLM assessment methodology, status options (pending/shortlist/on hold/reject), download feature, sorting/filtering, individual candidate cards with accounts, name, assessments, and personalized outreach messages
  - **Add New Candidates section**: Link to `/sourcing`, explains the 3-step pipeline (Initial List Run → Longlist Run → Shortlist Run) with descriptions, link to `/approach` for methodology
  - **GitHub API warning**: Alert about 5,000 calls/hour limit
  - **Footer**: Pleasant closing message with contact (Kamil)
- Uses Card components for visual structure, inline links throughout

**2. Update `src/components/NavBar.tsx`**
- Add "Start Here" as first nav item: `{ to: "/start", label: "Start Here", icon: Home }`
- Order: Start Here → Shortlist → Sourcing → Sourcing Methodology → Job Desc

**3. Update `src/App.tsx`**
- Import `StartHerePage`
- Add route: `/start` → `<StartHerePage />`
- Change default redirect from `/sourcing` to `/start`
