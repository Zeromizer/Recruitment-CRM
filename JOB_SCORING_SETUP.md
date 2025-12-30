# Job Scoring Integration with Google Sheets

This feature allows you to manage AI screening criteria in your CRM while syncing with Google Sheets for use with Power Automate workflows.

## Setup Instructions

### 1. Create Supabase Table

Run the SQL migration in your Supabase dashboard:

```bash
# Or run in Supabase SQL Editor:
cat supabase-migrations/create_job_scoring_table.sql
```

### 2. Configure Google Sheets API

#### Option A: Public Sheet (Simplest)

1. Open your Google Sheet
2. Click **Share** → **Get link**
3. Set to **Anyone with the link can view**
4. Copy the URL

#### Option B: API Key (More Secure)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable **Google Sheets API**
4. Create credentials → API Key
5. Add to `.env`:

```env
VITE_GOOGLE_SHEETS_API_KEY=your_api_key_here
```

### 3. Set Up Your Google Sheet

Your Google Sheet should have these columns:

| Column A | Column B | Column C |
|----------|----------|----------|
| Job Title | Requirements | Scoring Guide |
| Procurement Manager | Minimum 5 years... | Score 8-10: 5+ years... |
| Logistics Driver | Valid Class 3... | Score 8-10: Valid Class 3... |

**Important**: First row should be headers (will be skipped during sync)

### 4. Configure in CRM

1. Navigate to **Job Scoring** in the sidebar
2. Click **Configure** button
3. Paste your Google Sheet URL
4. Click **Save Configuration**

## Using the Feature

### Sync from Google Sheets

1. Click **Sync from Google Sheet** button
2. Data will be fetched and displayed in the table
3. Review the imported criteria
4. Click **Save to Database** to persist changes

### Edit Criteria

- Edit any field directly in the table
- Changes are highlighted but not saved automatically
- Click **Save to Database** when ready

### Export to CSV

- Click **Export CSV** to download current criteria
- Useful for backup or manual Google Sheets upload

### Bidirectional Sync

**Google Sheets → CRM:**
- Use "Sync from Google Sheet" button
- Overwrites CRM data with latest from sheet

**CRM → Google Sheets:**
- Currently requires manual export via CSV
- Upload CSV to Google Sheets
- *Note: Direct API write requires OAuth setup (advanced)*

## Power Automate Integration

Your Power Automate workflow can access the same Google Sheet:

1. **Trigger**: When a new resume is submitted
2. **Action**: Get rows from Google Sheets (job_scoring)
3. **Action**: Pass to AI screening API with scoring criteria
4. **Action**: Match candidate to best job based on score

## Advanced: Full Bidirectional Sync

For automatic CRM → Google Sheets sync, you'll need:

1. **Google Service Account** (for server-side API access)
2. **Backend API endpoint** to handle OAuth
3. **Scheduled sync** (e.g., every 5 minutes)

Contact your developer to implement this using:
- `@googleapis/sheets` npm package
- Service account JSON key
- Backend endpoint in `src/services/googleSheets.ts`

## Troubleshooting

### "Failed to fetch from Google Sheets"

- Ensure sheet is publicly readable
- Check API key is valid (if using Option B)
- Verify URL is correct format

### "Supabase not configured"

- Check `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Ensure database table `job_scoring` exists

### Sync Not Working

1. Open browser console (F12)
2. Look for errors
3. Check network tab for failed requests
4. Verify Google Sheet permissions

## Data Privacy

- Google Sheets data is only fetched when you click "Sync"
- No automatic background syncing
- Data stored in your Supabase database
- API key (if used) should be kept secure

## Tips

- Keep Google Sheet URL in your CRM settings for easy access
- Update Google Sheet for quick changes
- Sync to CRM before running AI screening
- Export CSV regularly as backup
- Use clear, specific scoring criteria for better AI matching
