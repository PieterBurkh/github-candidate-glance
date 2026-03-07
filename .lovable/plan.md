

# Add Job Description Page

## What
Add a new `/job` page that displays the full Senior Frontend Engineer job description from HASH, with a link back to the original posting. The candidates page header will link to it.

## Changes

### 1. New page: `src/pages/JobDescription.tsx`
- Clean, readable layout matching the existing design system
- Sections: About HASH, About the Role, What You'll Work On, Requirements (Must Have / Nice to Have), Benefits
- All content hardcoded from the provided job description
- External link to the original Gem posting at the top
- Meta badges: Berlin (Germany), Engineering, In office, Full-time
- Back link to candidates page (`/`)

### 2. Update `src/App.tsx`
- Add route: `/job` pointing to the new `JobDescription` page

### 3. Update `src/pages/Index.tsx`
- Make the "Senior Frontend Engineer" header title a clickable link to `/job`
- Add a small "View job description" link below the subtitle

## Design approach
- Reuse existing Tailwind classes and `Card` component for consistent styling
- Use `lucide-react` icons for badges (MapPin, Building, Clock, Briefcase)
- Responsive, single-column prose layout capped at `max-w-3xl`

