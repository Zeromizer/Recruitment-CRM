# Recruiter CRM

A modern CRM for recruiters managing temp/contract roles. Built with React, TypeScript, and Supabase.

## Features

- **Dashboard**: Pipeline metrics, today's follow-ups, interviews, and placements
- **Candidates**: Searchable, filterable list with AI screening scores
- **Pipeline**: Kanban-style board for tracking candidate progress
- **Interviews**: Upcoming interviews grouped by day
- **Activities**: Chronological log of all interactions
- **Settings**: Supabase connection status and integration details

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom navy/coral theme
- **Backend**: Supabase (PostgreSQL + REST API)
- **State Management**: TanStack Query (React Query v5)
- **Routing**: React Router v6
- **Icons**: Lucide React
- **Date Handling**: date-fns

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The app works with demo data when Supabase isn't configured.

## Database Setup

Run the SQL schema in your Supabase SQL Editor (found in Settings page).

## Power Automate Integration

POST new candidates from your screening workflow:

```
POST https://{project}.supabase.co/rest/v1/candidates
Headers:
  apikey: {anon_key}
  Authorization: Bearer {anon_key}
  Content-Type: application/json
  Prefer: return=representation

Body: {
  full_name, email, phone, source, applied_role,
  ai_score, ai_category, citizenship_status,
  ai_summary, ai_reasoning, resume_url,
  current_status: "ai_screened"
}
```

## License

Private - Cornerstone Global Partners
