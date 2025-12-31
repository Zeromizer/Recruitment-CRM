# Recruitment CRM - Codebase Documentation

> **Last Updated:** December 2024
> **Branch:** main
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
11. [Bot System & Knowledgebase](#bot-system--knowledgebase)
12. [Configuration](#configuration)
13. [Development Guide](#development-guide)

---

## Project Overview

A full-stack recruitment CRM designed for temp/contract staffing agencies. The system handles:
- **AI-powered resume screening** using Claude AI
- **Candidate pipeline management** with Kanban boards
- **Interview scheduling and tracking**
- **Microsoft Outlook integration** for email processing
- **Telegram/WhatsApp bots** for candidate interactions
- **Activity logging** for all candidate touchpoints
- **Bot configuration & training** with dynamic knowledgebase
- **Semantic search** with vector embeddings (RAG)
- **Job scoring criteria management** synced with Google Sheets

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
| jszip | - | Document/zip handling |
| mammoth | - | Word document parsing |
| pdfjs-dist | - | PDF manipulation |

### Backend & Services
| Technology | Purpose |
|------------|---------|
| Supabase | PostgreSQL database + REST API + Edge Functions |
| Anthropic Claude | AI resume screening (claude-haiku-4-5-20251001) |
| Microsoft Graph | Outlook email integration |
| Google Sheets API | Job roles & logging |
| pgvector | Vector embeddings for semantic search |
| Deno | Edge functions runtime |

### Bot Services (telegram-bot/)
| Technology | Purpose |
|------------|---------|
| Telegraf | Telegram bot framework |
| Telethon (Python) | Telegram client |
| FastAPI + Uvicorn | WhatsApp bot server |
| Walichat API | WhatsApp integration |
| OpenAI | Vector embeddings generation |

---

## Directory Structure

```
Recruitment-CRM/
├── src/                           # Main React application
│   ├── pages/                     # Page components (10 pages)
│   │   ├── Dashboard.tsx          # Overview, metrics, today's actions
│   │   ├── Tasks.tsx              # Task management
│   │   ├── Candidates.tsx         # Candidate list with filters
│   │   ├── CandidateDetail.tsx    # Single candidate profile
│   │   ├── Pipeline.tsx           # Kanban board
│   │   ├── Interviews.tsx         # Interview calendar
│   │   ├── Activities.tsx         # Activity log
│   │   ├── Settings.tsx           # Configuration
│   │   ├── BotConfig.tsx          # Bot configuration dashboard (NEW)
│   │   └── JobScoring.tsx         # Job scoring criteria management (NEW)
│   ├── components/                # Reusable components
│   │   ├── Layout.tsx             # Main layout with sidebar
│   │   ├── AddCandidateModal.tsx  # Resume upload + AI screening
│   │   ├── CallOutcomeModal.tsx   # Call outcome tracking
│   │   └── ResumeConverterModal.tsx # CGP template converter
│   ├── services/                  # External integrations
│   │   ├── aiScreening.ts         # Claude AI screening
│   │   ├── emailMonitoring.ts     # Outlook polling
│   │   ├── microsoftAuth.ts       # Microsoft OAuth
│   │   ├── resumeConverter.ts     # Resume format conversion
│   │   ├── conversations.ts       # Conversation history (NEW)
│   │   ├── knowledgebase.ts       # Bot knowledgebase management (NEW)
│   │   └── googleSheets.ts        # Google Sheets integration (NEW)
│   ├── hooks/
│   │   └── useData.ts             # React Query hooks (CRUD)
│   ├── lib/
│   │   ├── supabase.ts            # Supabase client (refactored)
│   │   └── demoData.ts            # Demo data for development (NEW)
│   ├── types/
│   │   ├── index.ts               # TypeScript interfaces
│   │   └── botConfig.ts           # Bot configuration types (NEW)
│   ├── constants/
│   │   └── index.ts               # Centralized constants (NEW)
│   ├── assets/
│   │   └── cgp-logo.svg           # Brand logo
│   ├── App.tsx                    # React Router setup
│   ├── main.tsx                   # Entry point
│   └── index.css                  # Tailwind imports
├── supabase/
│   ├── functions/                 # Edge functions
│   │   ├── parse-resume/          # Resume parsing with Claude
│   │   ├── screen-resume/         # AI resume screening
│   │   ├── fetch-job-url/         # Fetch job posting from URL
│   │   └── sync-google-sheet/     # Sync job scoring to Google Sheets
│   └── migrations/                # Database migrations (NEW)
│       ├── 20241229_create_conversations_table.sql
│       ├── 20241229_create_knowledgebase_table.sql
│       ├── 20241229_add_vector_embeddings.sql
│       └── 20241229_auto_cleanup_conversations.sql
├── supabase-migrations/
│   └── create_job_scoring_table.sql
├── telegram-bot/                  # Bot services
│   ├── src/                       # TypeScript bot source
│   │   ├── bot.ts                 # Telegraf bot setup
│   │   ├── config.ts              # Configuration
│   │   ├── handlers/              # Message handlers
│   │   └── utils/                 # Utilities (conversationMemory.ts)
│   ├── shared/                    # Python utilities
│   │   ├── database.py            # Supabase operations
│   │   ├── ai_screening.py        # Claude integration
│   │   ├── resume_parser.py       # PDF parsing
│   │   ├── google_sheets.py       # Sheets logging
│   │   ├── spam_protection.py     # Whitelist/blacklist
│   │   ├── knowledgebase.py       # Dynamic knowledgebase with RAG (NEW)
│   │   ├── knowledgebase_db.py    # Knowledgebase database operations (NEW)
│   │   ├── embeddings.py          # Vector embeddings generation (NEW)
│   │   └── training_handlers.py   # Bot training commands (NEW)
│   ├── main.py                    # Telegram bot entry
│   ├── whatsapp_bot.py            # WhatsApp bot (FastAPI)
│   ├── cleanup_jobs.py            # Database cleanup utility (NEW)
│   ├── requirements.txt           # Python dependencies
│   ├── package.json               # Node dependencies
│   ├── Dockerfile.whatsapp        # WhatsApp bot container (NEW)
│   └── railway.whatsapp.json      # Railway deployment config (NEW)
├── public/                        # Static assets
│   ├── favicon.svg
│   ├── 404.html                   # SPA redirect for GitHub Pages
│   └── template.docx.b64          # Word template (base64)
├── .github/
│   └── workflows/
│       ├── deploy.yml             # GitHub Pages deployment
│       └── deploy-functions.yml   # Supabase edge functions deployment (NEW)
├── docs/                          # Documentation
│   ├── JOB_SCORING_SETUP.md       # Job scoring setup guide (NEW)
│   └── CLEANUP_JOBS.md            # Seeded jobs cleanup guide (NEW)
├── package.json                   # Main app dependencies
├── vite.config.ts                 # Vite configuration
├── tailwind.config.js             # Tailwind + CGP brand colors
├── tsconfig.json                  # TypeScript config
├── CODEBASE.md                    # This file
├── CHANGELOG.md                   # Running log of changes
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
  source: 'Seek' | 'FastJobs' | 'Indeed' | 'LinkedIn' | 'Direct' | 'Referral' | 'Email' | 'WhatsApp' | 'Telegram' | 'Others';
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

### CallOutcome (NEW)
8 possible call outcome types:

```typescript
type CallOutcome =
  | 'interested'
  | 'not_interested'
  | 'callback_requested'
  | 'no_answer'
  | 'wrong_number'
  | 'voicemail'
  | 'busy'
  | 'other';
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

### Bot Configuration Types (NEW)

```typescript
interface JobPost {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  location: string[];
  salary_range?: string;
  employment_type: string;
  is_active: boolean;
  url?: string;
  scoring_requirements?: string;
  scoring_guide?: string;
  citizenship_requirements?: string[];
}

interface CompanyProfile {
  name: string;
  description: string;
  industry: string;
  values: string[];
  benefits: string[];
  culture: string;
  operating_hours?: { start: string; end: string };
}

interface CommunicationStyle {
  tone: string;
  language: string;
  greeting_style: string;
  sign_off_style: string;
  emoji_usage: 'none' | 'minimal' | 'moderate' | 'frequent';
  formality: 'casual' | 'professional' | 'formal';
}

interface ConversationObjective {
  id: string;
  name: string;
  description: string;
  priority: number;
  is_active: boolean;
}
```

### Conversation Types (NEW)

```typescript
interface ConversationMessage {
  id: string;
  platform: 'telegram' | 'whatsapp';
  user_id: string;
  candidate_id?: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: Record<string, any>;
  created_at: string;
}

interface ConversationState {
  id: string;
  platform: string;
  user_id: string;
  candidate_id?: string;
  stage: string;
  form_completed: boolean;
  resume_received: boolean;
  created_at: string;
  updated_at: string;
}
```

---

## Key Files Reference

| File | Lines | Description |
|------|-------|-------------|
| `src/pages/BotConfig.tsx` | ~2,425 | Bot configuration dashboard with 6 tabs (NEW) |
| `src/pages/CandidateDetail.tsx` | ~1,188 | Complex candidate profile with all interactions |
| `src/hooks/useData.ts` | ~733 | All React Query hooks for CRUD operations |
| `src/lib/demoData.ts` | ~656 | Demo data for development (NEW) |
| `src/components/ResumeConverterModal.tsx` | ~628 | Resume to CGP template conversion |
| `src/pages/Settings.tsx` | ~608 | Integration configs, Microsoft OAuth |
| `src/pages/Candidates.tsx` | ~580 | Candidate list with search/filters |
| `src/pages/Tasks.tsx` | ~531 | Task management page |
| `src/services/knowledgebase.ts` | ~490 | Bot knowledgebase management (NEW) |
| `src/pages/JobScoring.tsx` | ~456 | Job scoring criteria management (NEW) |
| `src/pages/Activities.tsx` | ~439 | Chronological activity log |
| `src/components/AddCandidateModal.tsx` | ~443 | Resume upload with AI screening |
| `src/services/aiScreening.ts` | ~418 | Claude AI resume screening |
| `src/pages/Dashboard.tsx` | ~402 | Overview metrics and today's actions |
| `src/services/emailMonitoring.ts` | ~375 | Microsoft Outlook polling service |
| `src/services/resumeConverter.ts` | ~367 | Resume format conversion |
| `src/services/conversations.ts` | ~283 | Conversation history management (NEW) |
| `src/components/CallOutcomeModal.tsx` | ~259 | Call outcome tracking |
| `src/types/index.ts` | ~251 | All TypeScript interfaces and types |
| `src/pages/Interviews.tsx` | ~247 | Interview calendar grouped by day |
| `src/services/microsoftAuth.ts` | ~244 | Microsoft OAuth flow |
| `src/services/googleSheets.ts` | ~190 | Google Sheets integration (NEW) |
| `src/pages/Pipeline.tsx` | ~167 | Kanban board with drag-and-drop |
| `src/constants/index.ts` | ~163 | Centralized constants (NEW) |
| `src/components/Layout.tsx` | ~157 | Main sidebar layout |
| `src/types/botConfig.ts` | ~139 | Bot configuration types (NEW) |
| `src/lib/supabase.ts` | ~130 | Supabase client (refactored) |

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
/bot-config          → BotConfig (NEW)
/job-scoring         → Redirects to /bot-config (NEW)
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

### Conversations (conversations.ts) (NEW)

Manages conversation history between bots and candidates.

**Key Functions:**
```typescript
getConversationsList(): Promise<ConversationSummary[]>
getConversationMessages(platform, userId): Promise<ConversationMessage[]>
deleteConversation(platform, userId): Promise<void>
```

### Knowledgebase (knowledgebase.ts) (NEW)

Manages dynamic bot training knowledge.

**Categories:**
- `role` - Job posts/descriptions
- `company` - Company profile information
- `faq` - Frequently asked questions
- `style` - Communication style guidelines
- `objective` - Conversation objectives

**Key Functions:**
```typescript
// Job Posts
getJobPosts(): Promise<JobPost[]>
createJobPost(data): Promise<JobPost>
updateJobPost(id, data): Promise<void>
toggleJobActive(id, isActive): Promise<void>
deleteJobPost(id): Promise<void>

// Company Profile
getCompanyProfile(): Promise<CompanyProfile>
saveCompanyProfile(data): Promise<void>

// Communication Style
getCommunicationStyle(): Promise<CommunicationStyle>
saveCommunicationStyle(data): Promise<void>

// Objectives
getObjectives(): Promise<ConversationObjective[]>
saveObjectives(objectives): Promise<void>
```

### Google Sheets (googleSheets.ts) (NEW)

Manages job scoring criteria sync with Google Sheets.

**Key Functions:**
```typescript
parseGoogleSheetUrl(url): { spreadsheetId, sheetName } | null
getGoogleSheetConfig(): GoogleSheetConfig | null
saveGoogleSheetConfig(config): void
fetchJobScoringFromGoogleSheet(config): Promise<JobScoringCriteria[]>
updateJobScoringToGoogleSheet(criteria): Promise<void>
downloadCSV(criteria): void
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

-- Conversations table (NEW)
CREATE TABLE conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  user_id TEXT NOT NULL,
  candidate_id UUID REFERENCES candidates(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation states table (NEW)
CREATE TABLE conversation_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  user_id TEXT NOT NULL,
  candidate_id UUID REFERENCES candidates(id),
  stage TEXT,
  form_completed BOOLEAN DEFAULT FALSE,
  resume_received BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledgebase table (NEW)
CREATE TABLE knowledgebase (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, key)
);

-- Job scoring table (NEW)
CREATE TABLE job_scoring (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_title TEXT NOT NULL,
  requirements TEXT,
  scoring_guide TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Vector Embeddings (NEW)

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to knowledgebase
ALTER TABLE knowledgebase ADD COLUMN embedding vector(1536);

-- Create HNSW index for fast similarity search
CREATE INDEX ON knowledgebase USING hnsw (embedding vector_cosine_ops);

-- Semantic search function
CREATE FUNCTION search_knowledgebase(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  filter_category text DEFAULT NULL
)
RETURNS TABLE (id uuid, category text, key text, value jsonb, similarity float)
AS $$
  SELECT id, category, key, value,
    1 - (embedding <=> query_embedding) as similarity
  FROM knowledgebase
  WHERE is_active = true
    AND (filter_category IS NULL OR category = filter_category)
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$ LANGUAGE sql;
```

### Auto-Cleanup Jobs (NEW)

```sql
-- Cleanup old conversations (runs daily at 3 AM UTC)
SELECT cron.schedule(
  'cleanup-old-conversations',
  '0 3 * * *',
  $$SELECT cleanup_old_conversations()$$
);
```

### Security & Triggers

```sql
-- Enable Row Level Security
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledgebase ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_scoring ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for authenticated users)
CREATE POLICY "Allow all" ON candidates FOR ALL USING (true);
CREATE POLICY "Allow all" ON activities FOR ALL USING (true);
CREATE POLICY "Allow all" ON interviews FOR ALL USING (true);
CREATE POLICY "Allow all" ON conversations FOR ALL USING (true);
CREATE POLICY "Allow all" ON conversation_states FOR ALL USING (true);
CREATE POLICY "Allow all" ON knowledgebase FOR ALL USING (true);
CREATE POLICY "Allow all" ON job_scoring FOR ALL USING (true);

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
| `/conversations` | GET, POST, DELETE | Conversation history (NEW) |
| `/conversation_states` | GET, POST, PATCH | Conversation states (NEW) |
| `/knowledgebase` | GET, POST, PATCH, DELETE | Bot knowledge (NEW) |
| `/job_scoring` | GET, POST, PATCH, DELETE | Job scoring criteria (NEW) |

### Supabase Edge Functions (NEW)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/functions/v1/parse-resume` | POST | Parse resume with Claude |
| `/functions/v1/screen-resume` | POST | AI resume screening |
| `/functions/v1/fetch-job-url` | POST | Fetch job posting from URL |
| `/functions/v1/sync-google-sheet` | POST | Sync job scoring to Google Sheets |

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

## Bot System & Knowledgebase (NEW)

### Bot Configuration Dashboard

The BotConfig page (`/bot-config`) provides a comprehensive interface for managing bot behavior:

**Tabs:**
1. **Job Posts** - Manage active job postings with CRUD operations
2. **Company Profile** - Configure company information for bot responses
3. **Communication Style** - Set tone, formality, emoji usage
4. **Objectives** - Define conversation goals and priorities
5. **System Prompt** - Edit the main bot system prompt
6. **Conversations** - View and manage conversation history

### Knowledgebase Categories

| Category | Purpose | Storage |
|----------|---------|---------|
| `role` | Job descriptions & requirements | JSONB with vector embedding |
| `company` | Company profile & culture | JSONB |
| `faq` | Common Q&A | JSONB with vector embedding |
| `style` | Communication guidelines | JSONB |
| `objective` | Conversation goals | JSONB |

### RAG (Retrieval-Augmented Generation)

The bot uses vector embeddings for semantic search:
1. User message is converted to embedding via OpenAI
2. Similarity search finds relevant knowledge entries
3. Context is injected into Claude prompt
4. Response is generated with relevant information

### Bot Python Modules (telegram-bot/shared/)

| Module | Lines | Purpose |
|--------|-------|---------|
| `knowledgebase.py` | 1,327 | Dynamic knowledgebase with RAG |
| `database.py` | 739 | Supabase operations |
| `ai_screening.py` | 626 | Claude integration |
| `knowledgebase_db.py` | 610 | Knowledgebase DB operations |
| `training_handlers.py` | 540 | Bot training commands |
| `embeddings.py` | 440 | Vector embeddings generation |
| `resume_parser.py` | 152 | PDF parsing |
| `spam_protection.py` | 104 | Whitelist/blacklist |
| `google_sheets.py` | 77 | Sheets logging |

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

# OpenAI (for embeddings)
OPENAI_API_KEY=sk-...
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

### Constants (src/constants/index.ts)

Centralized configuration for:
- API endpoints
- Graph endpoints
- AI configuration
- Google Sheets configuration
- Email monitoring settings
- Microsoft auth settings
- Dashboard configuration
- Brand colors
- AI score thresholds
- Date formats

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

**Demo Mode**: When Supabase is not configured, the app runs with demo data stored in `src/lib/demoData.ts`. This allows testing without a database connection.

**Realtime Updates**: The `useRealtimeSubscription` hook subscribes to Supabase channels for live updates across all tables.

**Error Handling**: Services use try/catch with meaningful error messages. API errors are thrown and handled by React Query.

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

**Add a new knowledgebase category:**
1. Add category to `knowledgebase.ts` service
2. Create UI in `BotConfig.tsx`
3. Update bot Python modules to use new category

---

*This documentation should be kept updated as the codebase evolves.*
*See CHANGELOG.md for a running log of changes.*
