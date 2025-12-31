# Changelog

All notable changes to the Recruitment CRM project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- _(Add new features here before pushing)_

### Changed
- _(Add modifications here before pushing)_

### Fixed
- _(Add bug fixes here before pushing)_

### Removed
- _(Add removed features here before pushing)_

---

## [2024-12-31] - Bot Configuration & Knowledgebase System

### Added
- **BotConfig Page** (`src/pages/BotConfig.tsx`) - Comprehensive bot configuration dashboard with 6 tabs:
  - Job Posts management with CRUD operations
  - Company Profile configuration
  - Communication Style settings
  - Objectives configuration
  - System Prompt editor
  - Conversations viewer with message history
- **JobScoring Page** (`src/pages/JobScoring.tsx`) - Job scoring criteria management synced with Google Sheets
- **Conversations Service** (`src/services/conversations.ts`) - Manage bot conversation history
- **Knowledgebase Service** (`src/services/knowledgebase.ts`) - Dynamic bot training knowledge management
- **Google Sheets Service** (`src/services/googleSheets.ts`) - Job scoring sync with Google Sheets
- **Bot Config Types** (`src/types/botConfig.ts`) - TypeScript interfaces for bot configuration
- **Constants File** (`src/constants/index.ts`) - Centralized application constants
- **Demo Data File** (`src/lib/demoData.ts`) - Separated demo data from supabase.ts
- **Database Migrations**:
  - `20241229_create_conversations_table.sql` - Conversations and states tables
  - `20241229_create_knowledgebase_table.sql` - Knowledgebase table
  - `20241229_add_vector_embeddings.sql` - pgvector support for semantic search
  - `20241229_auto_cleanup_conversations.sql` - Auto-cleanup cron job
  - `create_job_scoring_table.sql` - Job scoring criteria table
- **Supabase Edge Functions**:
  - `parse-resume/` - Resume parsing with Claude
  - `screen-resume/` - AI resume screening
  - `fetch-job-url/` - Fetch job posting from URL
  - `sync-google-sheet/` - Sync job scoring to Google Sheets
- **Telegram Bot Enhancements**:
  - `knowledgebase.py` - Dynamic knowledgebase with RAG
  - `knowledgebase_db.py` - Knowledgebase database operations
  - `embeddings.py` - Vector embeddings generation
  - `training_handlers.py` - Bot training commands
  - `cleanup_jobs.py` - Database cleanup utility
  - `Dockerfile.whatsapp` - WhatsApp bot containerization
  - `railway.whatsapp.json` - Railway deployment config
- **Documentation**:
  - `JOB_SCORING_SETUP.md` - Job scoring setup guide
  - `CLEANUP_JOBS.md` - Seeded jobs cleanup guide
- **GitHub Workflow**: `deploy-functions.yml` - Supabase edge functions deployment
- **New Routes**: `/bot-config`, `/job-scoring` (redirects to /bot-config)
- **CallOutcome Type** - 8 call outcome types with labels and colors
- **Source Type**: Added "Others" to candidate sources

### Changed
- **Candidates.tsx** - Enhanced filtering and search (~580 lines, +218)
- **CandidateDetail.tsx** - Additional features (~1,188 lines, +124)
- **Tasks.tsx** - Expanded task management (~531 lines, +75)
- **supabase.ts** - Refactored to separate demo data (~130 lines, -636)
- **types/index.ts** - Added CallOutcome type and mappings (~251 lines, +13)

### Database
- Added `conversations` table for bot message history
- Added `conversation_states` table for conversation progress
- Added `knowledgebase` table with JSONB storage
- Added `job_scoring` table for AI screening criteria
- Added pgvector extension for semantic search
- Added vector embeddings column to knowledgebase
- Added HNSW index for fast similarity search
- Added `search_knowledgebase()` SQL function
- Added daily cleanup cron job for old conversations

---

## How to Use This Changelog

### Before Each Push

1. **Document your changes** in the `[Unreleased]` section above
2. Use the appropriate category:
   - **Added** - New features
   - **Changed** - Changes to existing functionality
   - **Fixed** - Bug fixes
   - **Removed** - Removed features
3. Be specific about what files were affected
4. Include brief descriptions of what and why

### Example Entry Format

```markdown
### Added
- **Feature Name** (`path/to/file.tsx`) - Brief description of what it does
- New hook `useNewFeature()` for handling X functionality

### Changed
- **ComponentName.tsx** - Updated to support new Y feature
- Refactored Z service to improve performance

### Fixed
- Fixed bug where X would crash when Y happened (#issue-number)
```

### When Releasing

1. Move all `[Unreleased]` items to a new dated section
2. Add the date in format `[YYYY-MM-DD]`
3. Add a brief title summarizing the release
4. Clear the `[Unreleased]` section for new changes

---

## Tips for Claude Code

When you start a new session with Claude Code:

1. **Ask Claude to read this file first**: "Read CHANGELOG.md to see recent changes"
2. **After making changes**: Ask Claude to update the `[Unreleased]` section
3. **Before pushing**: Review the changelog entries with Claude
4. **Commit the changelog**: Include CHANGELOG.md in your commits

### Quick Commands for Claude

- "Update the changelog with the changes we just made"
- "What were the recent changes to this project?" (reads CHANGELOG.md)
- "Prepare the changelog for a release"
- "Add [feature X] to the unreleased changelog"

---

*This changelog helps track project evolution and provides context for future development sessions.*
