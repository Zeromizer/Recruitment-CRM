# Recruitment CRM - Codebase Documentation

> **Last Updated:** December 2024
> **Branch:** claude/refactor-and-document-ARVGR
> **Owner:** Cornerstone Global Partners (CGP) Personnel

This document provides a comprehensive map of the Recruitment CRM codebase for quick reference and onboarding.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Directory Structure](#directory-structure)
4. [Core Data Models](#core-data-models)
5. [Key Files Reference](#key-files-reference)
6. [Frontend Architecture](#frontend-architecture)
7. [Services & Integrations](#services--integrations)
8. [Database Schema](#database-schema)
9. [API Endpoints](#api-endpoints)
10. [Candidate Workflow](#candidate-workflow)
11. [Configuration](#configuration)
12. [Development Guide](#development-guide)
13. [Refactoring Notes](#refactoring-notes)

---

## Project Overview

A full-stack recruitment CRM designed for temp/contract staffing agencies. The system handles:
- **AI-powered resume screening** using Claude AI
- **Candidate pipeline management** with Kanban boards
- **Interview scheduling and tracking**
- **Microsoft Outlook integration** for email processing
- **Telegram/WhatsApp bots** for candidate interactions
- **Activity logging** for all candidate touchpoints

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.0 | UI framework |
| TypeScript | 5.9.3 | Type safety |
| Vite | 7.2.4 | Build tool & dev server |
| TailwindCSS | 3.4.19 | Styling |
| TanStack Query | 5.90.12 | Server state management |
| React Router | 7.11.0 | Client-side routing |
| Lucide React | - | Icon library |
| date-fns | - | Date utilities |

### Backend & Services
| Technology | Purpose |
|------------|---------|
| Supabase | PostgreSQL database + REST API |
| Anthropic Claude | AI resume screening (claude-haiku-4-5-20251001) |
| Microsoft Graph | Outlook email integration |
| Google Sheets API | Job roles & logging |
| Deno | Edge functions runtime |

### Bot Services (telegram-bot/)
| Technology | Purpose |
|------------|---------|
| Telegraf | Telegram bot framework |
| Telethon (Python) | Telegram client |
| FastAPI + Uvicorn | WhatsApp bot server |
| Walichat API | WhatsApp integration |

---

## Directory Structure

```
Recruitment-CRM/
├── src/                           # Main React application
│   ├── pages/                     # Page components (8 pages)
│   │   ├── Dashboard.tsx          # Overview, metrics, today's actions
│   │   ├── Tasks.tsx              # Task management
│   │   ├── Candidates.tsx         # Candidate list with filters
│   │   ├── CandidateDetail.tsx    # Single candidate profile (largest file)
│   │   ├── Pipeline.tsx           # Kanban board
│   │   ├── Interviews.tsx         # Interview calendar
│   │   ├── Activities.tsx         # Activity log
│   │   └── Settings.tsx           # Configuration
│   ├── components/                # Reusable components
│   │   ├── Layout.tsx             # Main layout with sidebar
│   │   ├── AddCandidateModal.tsx  # Resume upload + AI screening
│   │   ├── CallOutcomeModal.tsx   # Call outcome tracking
│   │   └── ResumeConverterModal.tsx # CGP template converter
│   ├── services/                  # External integrations
│   │   ├── aiScreening.ts         # Claude AI screening
│   │   ├── emailMonitoring.ts     # Outlook polling
│   │   ├── microsoftAuth.ts       # Microsoft OAuth
│   │   └── resumeConverter.ts     # Resume format conversion
│   ├── hooks/
│   │   └── useData.ts             # React Query hooks (CRUD)
│   ├── lib/
│   │   └── supabase.ts            # Supabase client + demo data
│   ├── types/
│   │   └── index.ts               # TypeScript interfaces
│   ├── assets/
│   │   └── cgp-logo.svg           # Brand logo
│   ├── App.tsx                    # React Router setup
│   ├── main.tsx                   # Entry point
│   └── index.css                  # Tailwind imports
├── supabase/
│   └── functions/
│       └── parse-resume/
│           └── index.ts           # Edge function for resume parsing
├── telegram-bot/                  # Bot services
│   ├── src/                       # TypeScript bot source
│   │   ├── bot.ts                 # Telegraf bot setup
│   │   ├── config.ts              # Configuration
│   │   └── handlers/              # Message handlers
│   ├── shared/                    # Python utilities
│   │   ├── database.py            # Supabase operations
│   │   ├── ai_screening.py        # Claude integration
│   │   ├── resume_parser.py       # PDF parsing
│   │   ├── google_sheets.py       # Sheets logging
│   │   └── spam_protection.py     # Whitelist/blacklist
│   ├── main.py                    # Telegram bot entry
│   ├── whatsapp_bot.py            # WhatsApp bot (FastAPI)
│   ├── requirements.txt           # Python dependencies
│   └── package.json               # Node dependencies
├── public/                        # Static assets
│   ├── favicon.svg
│   ├── 404.html                   # SPA redirect for GitHub Pages
│   └── template.docx.b64          # Word template (base64)
├── .github/
│   └── workflows/
│       └── deploy.yml             # GitHub Pages deployment
├── package.json                   # Main app dependencies
├── vite.config.ts                 # Vite configuration
├── tailwind.config.js             # Tailwind + CGP brand colors
├── tsconfig.json                  # TypeScript config
└── .env.example                   # Environment variables template
```

---

## Core Data Models

### Candidate
The central entity representing a job applicant.

```typescript
interface Candidate {
  // Identity
  id: string;
  created_at: string;
  updated_at: string;
  date_received: string;
  full_name: string;
  email: string | null;
  phone: string | null;

  // Source & Application
  source: 'Seek' | 'FastJobs' | 'Indeed' | 'LinkedIn' | 'Direct' | 'Referral' | 'Email' | 'WhatsApp' | 'Telegram';
  applied_role: string | null;
  resume_url: string | null;

  // AI Screening
  ai_score: number | null;              // 1-10
  ai_category: 'Top Candidate' | 'Review' | 'Rejected' | null;
  citizenship_status: 'SC' | 'PR' | 'Not Identified' | 'Foreign' | null;
  ai_summary: string | null;
  ai_reasoning: string | null;

  // Pipeline Status (18 possible values)
  current_status: CandidateStatus;
  assigned_recruiter: string | null;
  matched_roles: string[] | null;

  // Client Submission
  client_submitted_to: string | null;
  submission_date: string | null;

  // Interview
  interview_date: string | null;
  interview_outcome: 'Passed' | 'Failed' | 'Pending' | 'No Show' | null;

  // Offer
  offer_date: string | null;
  offer_status: 'Pending' | 'Accepted' | 'Declined' | 'Negotiating' | null;

  // Placement
  start_date: string | null;
  contract_end_date: string | null;
  hourly_rate: number | null;
  bill_rate: number | null;
  placement_status: 'Active' | 'Completed' | 'Terminated Early' | null;

  // Follow-up
  notes: string | null;
  last_contact_date: string | null;
  next_action: string | null;
  next_action_date: string | null;
}
```

### CandidateStatus
18 possible status values tracking the recruitment lifecycle:

```typescript
type CandidateStatus =
  // Entry stages
  | 'new_application'
  | 'ai_screened'
  | 'human_reviewed'

  // Active pipeline
  | 'shortlisted'
  | 'submitted_to_client'
  | 'interview_scheduled'
  | 'interview_completed'
  | 'offer_extended'
  | 'offer_accepted'
  | 'placement_started'
  | 'placement_completed'

  // Rejection stages
  | 'rejected_ai'
  | 'rejected_human'
  | 'rejected_client'

  // Hold/Exit states
  | 'on_hold'
  | 'withdrawn'
  | 'blacklisted';
```

### Activity
Logs all candidate interactions.

```typescript
interface Activity {
  id: string;
  created_at: string;
  candidate_id: string | null;
  candidate_name: string | null;
  activity_date: string;
  activity_type: string;
  direction: 'Inbound' | 'Outbound' | 'Internal';
  channel: 'Email' | 'Phone' | 'WhatsApp' | 'In-Person' | 'Portal' | 'System';
  subject: string | null;
  details: string | null;
  related_job: string | null;
  related_client: string | null;
  outcome: string | null;
  follow_up_required: boolean;
  follow_up_date: string | null;
  follow_up_action: string | null;
  logged_by: string | null;
}
```

### Interview
Tracks interview scheduling and outcomes.

```typescript
interface Interview {
  id: string;
  created_at: string;
  candidate_id: string | null;
  candidate_name: string | null;
  client_company: string | null;
  job_role: string | null;
  interview_round: '1st' | '2nd' | '3rd' | 'Final' | 'Assessment';
  interview_type: 'Phone' | 'Video' | 'In-Person' | 'Assessment Center';
  interview_date: string | null;
  interview_time: string | null;
  duration_minutes: number;
  location: string | null;
  interviewer_name: string | null;
  interviewer_title: string | null;
  prep_notes_sent: boolean;
  candidate_confirmed: boolean;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'No Show';
  outcome: 'Passed' | 'Failed' | 'Pending' | 'No Show' | null;
  client_feedback: string | null;
  candidate_feedback: string | null;
  next_steps: string | null;
  notes: string | null;
}
```

---

## Key Files Reference

| File | Lines | Description |
|------|-------|-------------|
| `src/pages/CandidateDetail.tsx` | ~1064 | Complex candidate profile with all interactions, activities, interviews |
| `src/lib/supabase.ts` | ~766 | Supabase client, demo data, database schema SQL |
| `src/hooks/useData.ts` | ~550 | All React Query hooks for CRUD operations |
| `src/pages/Settings.tsx` | ~608 | Integration configs, Microsoft OAuth, email monitoring |
| `src/pages/Tasks.tsx` | ~456 | Task management page |
| `src/pages/Activities.tsx` | ~439 | Chronological activity log |
| `src/pages/Dashboard.tsx` | ~402 | Overview metrics and today's actions |
| `src/services/emailMonitoring.ts` | ~376 | Microsoft Outlook polling service |
| `src/pages/Candidates.tsx` | ~362 | Candidate list with search/filters |
| `src/components/AddCandidateModal.tsx` | ~300+ | Resume upload with AI screening |
| `src/services/resumeConverter.ts` | ~300+ | Resume to CGP template conversion |
| `src/pages/Interviews.tsx` | ~247 | Interview calendar grouped by day |
| `src/services/microsoftAuth.ts` | ~245 | Microsoft OAuth flow |
| `src/types/index.ts` | ~238 | All TypeScript interfaces and types |
| `src/services/aiScreening.ts` | ~228 | Claude AI resume screening |
| `src/pages/Pipeline.tsx` | ~167 | Kanban board with drag-and-drop |
| `src/components/Layout.tsx` | ~155 | Main sidebar layout |

---

## Frontend Architecture

### Page Routing (App.tsx)
```
/                    → Dashboard
/tasks               → Tasks
/candidates          → Candidates list
/candidates/:id      → CandidateDetail
/pipeline            → Pipeline (Kanban)
/interviews          → Interviews calendar
/activities          → Activities log
/settings            → Settings
/auth/callback       → OAuth callback (redirects to /settings)
```

### State Management

**Server State:** TanStack React Query
- All data fetching through custom hooks in `useData.ts`
- Automatic caching, refetching, and invalidation
- Realtime subscriptions via Supabase channels

**Local State:** React useState
- UI state (modals, filters, search terms)
- Form state

### Data Hooks (useData.ts)

```typescript
// Candidates
useCandidates()              // Fetch all candidates
useCandidate(id)             // Fetch single candidate
useCreateCandidate()         // Create new candidate
useUpdateCandidate()         // Update candidate fields
useUpdateCandidateStatus()   // Update status only
useSearchCandidates(term, filters) // Search with filters
usePipelineCandidates()      // Group by pipeline stage

// Activities
useActivities()              // Fetch all activities
useCandidateActivities(id)   // Activities for one candidate
useCreateActivity()          // Log new activity

// Interviews
useInterviews()              // Fetch all interviews
useCandidateInterviews(id)   // Interviews for one candidate
useUpdateInterview()         // Update interview
useUpcomingInterviews()      // Group by today/tomorrow/week

// Dashboard
useDashboardMetrics()        // Aggregated metrics

// Realtime
useRealtimeSubscription()    // Subscribe to database changes
```

---

## Services & Integrations

### AI Screening (aiScreening.ts)

**Flow:**
1. Fetch job roles from Google Sheets
2. Send resume (base64 PDF) + job roles to Claude API
3. Claude analyzes resume, extracts data, provides score
4. Log result to Google Sheets (optional)
5. Return structured ScreeningResult

**Key Functions:**
```typescript
fetchJobRoles(): Promise<JobRole[]>
screenResume(pdfBase64, emailSubject, jobRoles): Promise<ScreeningResult>
logToGoogleSheets(result, emailSubject): Promise<void>
performFullScreening(input): Promise<ScreeningResult>
fileToBase64(file): Promise<string>
```

### Email Monitoring (emailMonitoring.ts)

**Flow:**
1. Poll Outlook every 30 seconds for unread "Application" emails
2. Extract PDF attachments from emails
3. Run AI screening on each PDF
4. Mark email as read
5. Trigger callback with results

**Key Functions:**
```typescript
startPolling(): void
stopPolling(): void
triggerManualPoll(): Promise<void>
setMonitoringEnabled(enabled): void
getMonitoringStatus(): MonitoringStatus
registerCallbacks({ onEmailProcessed, onStatusChange, onError }): void
```

### Microsoft Auth (microsoftAuth.ts)

**OAuth Flow:**
1. User clicks "Connect Microsoft"
2. Redirect to Microsoft login
3. Return with authorization code
4. Exchange code for access + refresh tokens
5. Store tokens in localStorage
6. Auto-refresh before expiration

**Key Functions:**
```typescript
startMicrosoftAuth(): void        // Initiate OAuth flow
handleAuthCallback(): Promise<void> // Handle callback
getValidAccessToken(): Promise<string | null>
isConnected(): boolean
disconnect(): void
```

### Resume Converter (resumeConverter.ts)

Converts parsed resume data to CGP Word template format.

**Key Functions:**
```typescript
parseResume(pdfBase64): Promise<ParsedResume>
generateCGPResume(parsedResume): Promise<Blob>
```

---

## Database Schema

### Tables

```sql
-- Candidates table
CREATE TABLE candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  date_received TIMESTAMPTZ DEFAULT NOW(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source TEXT,
  applied_role TEXT,
  ai_score INTEGER CHECK (ai_score >= 1 AND ai_score <= 10),
  ai_category TEXT,
  citizenship_status TEXT,
  ai_summary TEXT,
  ai_reasoning TEXT,
  resume_url TEXT,
  current_status TEXT DEFAULT 'new_application',
  assigned_recruiter TEXT,
  matched_roles TEXT[],
  client_submitted_to TEXT,
  submission_date DATE,
  interview_date DATE,
  interview_outcome TEXT,
  offer_date DATE,
  offer_status TEXT,
  start_date DATE,
  contract_end_date DATE,
  hourly_rate DECIMAL,
  bill_rate DECIMAL,
  placement_status TEXT,
  notes TEXT,
  last_contact_date DATE,
  next_action TEXT,
  next_action_date DATE
);

-- Activities table
CREATE TABLE activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  candidate_name TEXT,
  activity_date TIMESTAMPTZ DEFAULT NOW(),
  activity_type TEXT,
  direction TEXT,
  channel TEXT,
  subject TEXT,
  details TEXT,
  related_job TEXT,
  related_client TEXT,
  outcome TEXT,
  follow_up_required BOOLEAN DEFAULT FALSE,
  follow_up_date DATE,
  follow_up_action TEXT,
  logged_by TEXT
);

-- Interviews table
CREATE TABLE interviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  candidate_name TEXT,
  client_company TEXT,
  job_role TEXT,
  interview_round TEXT,
  interview_type TEXT,
  interview_date DATE,
  interview_time TIME,
  duration_minutes INTEGER DEFAULT 60,
  location TEXT,
  interviewer_name TEXT,
  interviewer_title TEXT,
  prep_notes_sent BOOLEAN DEFAULT FALSE,
  candidate_confirmed BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'Scheduled',
  outcome TEXT,
  client_feedback TEXT,
  candidate_feedback TEXT,
  next_steps TEXT,
  notes TEXT
);
```

### Security & Triggers

```sql
-- Enable Row Level Security
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for authenticated users)
CREATE POLICY "Allow all" ON candidates FOR ALL USING (true);
CREATE POLICY "Allow all" ON activities FOR ALL USING (true);
CREATE POLICY "Allow all" ON interviews FOR ALL USING (true);

-- Auto-update timestamp trigger
CREATE TRIGGER update_candidates_updated_at
  BEFORE UPDATE ON candidates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## API Endpoints

### Supabase REST API
Base URL: `${VITE_SUPABASE_URL}/rest/v1`

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/candidates` | GET, POST, PATCH | Candidate CRUD |
| `/activities` | GET, POST, PATCH | Activity logging |
| `/interviews` | GET, POST, PATCH | Interview management |

### Claude AI API
Endpoint: `https://api.anthropic.com/v1/messages`
Model: `claude-haiku-4-5-20251001`

### Microsoft Graph API
Base URL: `https://graph.microsoft.com/v1.0`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/me` | GET | User info |
| `/me/messages` | GET | Fetch emails |
| `/me/messages/{id}` | PATCH | Mark as read |
| `/me/messages/{id}/attachments` | GET | Get attachments |

### Google Sheets API
Spreadsheet ID: `1jT-Xosd4W3ev7WTGiRHxupW_a7xBQ_Y0mn2ncoX65al`

| Endpoint | Description |
|----------|-------------|
| `GET /spreadsheets/{id}/values/{range}` | Fetch job roles |
| `POST ${APPS_SCRIPT_URL}` | Log screening results |

### Supabase Edge Function
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/functions/v1/parse-resume` | POST | Parse resume with Claude |

---

## Candidate Workflow

### Status Flow
```
new_application
      │
      ▼
ai_screened ─────────────────────► rejected_ai
      │
      ▼
human_reviewed ──────────────────► rejected_human
      │
      ▼
shortlisted ─────────────────────► on_hold / withdrawn
      │
      ▼
submitted_to_client ─────────────► rejected_client
      │
      ▼
interview_scheduled
      │
      ▼
interview_completed
      │
      ▼
offer_extended
      │
      ▼
offer_accepted
      │
      ▼
placement_started
      │
      ▼
placement_completed
```

### Pipeline Stages (Kanban)
7 stages visible in the pipeline view:
1. **Shortlisted** - Ready to submit to clients
2. **Submitted** - Sent to client for review
3. **Interview Scheduled** - Interview date set
4. **Interview Done** - Interview completed
5. **Offer** - Offer extended
6. **Accepted** - Offer accepted
7. **Placed** - Placement started

---

## Configuration

### Environment Variables

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Anthropic Claude
VITE_ANTHROPIC_API_KEY=sk-ant-...

# Google Sheets
VITE_GOOGLE_SHEETS_API_KEY=your-key
VITE_GOOGLE_APPS_SCRIPT_URL=https://script.google.com/...

# Microsoft OAuth
VITE_MICROSOFT_CLIENT_ID=your-client-id
VITE_MICROSOFT_TENANT_ID=common
```

### Tailwind Configuration

Custom CGP brand colors:
```javascript
colors: {
  'cgp-red': '#C41E3A',
  'cgp-red-dark': '#9A1830',
  'cgp-red-light': '#E8345A',
}

animation: {
  'filter-pulse': 'filterPulse 2s ease-in-out infinite',
  'bounce-subtle': 'bounceSub 1s ease-in-out infinite',
}
```

---

## Development Guide

### Getting Started
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint
```

### Project Conventions

1. **File Naming**: PascalCase for components, camelCase for utilities
2. **Type Safety**: Strict TypeScript enabled
3. **State Management**: React Query for server state, useState for UI state
4. **Styling**: TailwindCSS utility classes
5. **Icons**: Lucide React
6. **Date Handling**: date-fns

### Key Patterns

**Demo Mode**: When Supabase is not configured, the app runs with demo data stored in `src/lib/supabase.ts`. This allows testing without a database connection.

**Realtime Updates**: The `useRealtimeSubscription` hook subscribes to Supabase channels for live updates across all tables.

**Error Handling**: Services use try/catch with meaningful error messages. API errors are thrown and handled by React Query.

---

## Refactoring Notes

### Current Code Quality
The codebase is well-organized with clear separation of concerns:
- Types are centralized in `src/types/index.ts`
- All data hooks are in `src/hooks/useData.ts`
- External integrations are in `src/services/`
- Page components are self-contained in `src/pages/`

### Potential Improvements

1. **Demo Data Separation**
   - Move demo data from `supabase.ts` to a separate `src/lib/demoData.ts` file
   - Reduces file size and improves maintainability

2. **Component Extraction**
   - `CandidateDetail.tsx` (1064 lines) could be split into smaller components:
     - CandidateHeader
     - CandidateInfo
     - CandidateActivities
     - CandidateInterviews
     - CandidateNotes

3. **Constants Centralization**
   - Create `src/constants/` directory for:
     - API endpoints
     - Status mappings
     - UI configurations

4. **Error Boundary**
   - Add React error boundaries for graceful error handling

5. **Loading States**
   - Implement skeleton loaders for better UX during data fetching

6. **Form Validation**
   - Add form validation library (e.g., Zod + React Hook Form)

7. **Testing**
   - Add unit tests for services
   - Add integration tests for key flows

### Files to Watch
- `CandidateDetail.tsx` - Largest page component, consider splitting
- `supabase.ts` - Contains demo data that could be separated
- `emailMonitoring.ts` - Complex polling logic, well-documented

---

## Quick Reference

### Common Operations

**Add a new candidate source:**
1. Update `CandidateSource` type in `src/types/index.ts`
2. Update `SOURCE_OPTIONS` array in `src/types/index.ts`
3. Update filter options in `Candidates.tsx`

**Add a new candidate status:**
1. Update `CandidateStatus` type in `src/types/index.ts`
2. Update `STATUS_LABELS` mapping in `src/types/index.ts`
3. Update `PIPELINE_STAGES` if applicable
4. Update status filtering in relevant pages

**Add a new page:**
1. Create component in `src/pages/`
2. Add route in `App.tsx`
3. Add navigation item in `Layout.tsx`

**Add a new API integration:**
1. Create service file in `src/services/`
2. Export types and functions
3. Create React Query hooks if needed

---

*This documentation should be kept updated as the codebase evolves.*
