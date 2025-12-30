// Google Sheets Integration Service

import type { JobPost } from '../types/botConfig';

export interface JobScoringCriteria {
  id?: string;
  jobTitle: string;
  requirements: string;
  scoringGuide: string;
  updated_at?: string;
}

export interface GoogleSheetConfig {
  spreadsheetId: string;
  sheetName: string;
  range: string;
}

// Parse Google Sheets URL to extract spreadsheet ID
export function parseGoogleSheetUrl(url: string): string | null {
  // Format: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit...
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// Get Google Sheet config from local storage or database
export function getGoogleSheetConfig(): GoogleSheetConfig | null {
  const config = localStorage.getItem('googleSheetConfig');
  return config ? JSON.parse(config) : null;
}

// Save Google Sheet config
export function saveGoogleSheetConfig(config: GoogleSheetConfig): void {
  localStorage.setItem('googleSheetConfig', JSON.stringify(config));
}

// Fetch data from Google Sheets using public API
export async function fetchJobScoringFromGoogleSheet(
  spreadsheetId: string,
  range: string = 'Sheet1!A:C'
): Promise<JobScoringCriteria[]> {
  try {
    // Use Google Sheets public API (requires sheet to be publicly readable)
    // or use a backend proxy with API key
    const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;

    if (!apiKey) {
      throw new Error('Google Sheets API key not configured');
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to fetch from Google Sheets');
    }

    const data = await response.json();
    const rows = data.values || [];

    // Skip header row and map to JobScoringCriteria
    const criteria: JobScoringCriteria[] = rows.slice(1).map((row: string[], index: number) => ({
      id: `job-${index}`,
      jobTitle: row[0] || '',
      requirements: row[1] || '',
      scoringGuide: row[2] || '',
    }));

    return criteria;
  } catch (error) {
    console.error('Error fetching from Google Sheets:', error);
    throw error;
  }
}

// Update Google Sheets using Supabase Edge Function proxy (avoids CORS issues)
export async function updateJobScoringToGoogleSheet(
  criteria: JobScoringCriteria[]
): Promise<void> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase not configured');
    }

    // Use Supabase Edge Function as proxy to avoid CORS issues
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/sync-google-sheet`;

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        criteria: criteria.map(c => ({
          jobTitle: c.jobTitle,
          requirements: c.requirements,
          scoringGuide: c.scoringGuide,
        })),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update Google Sheets: ${errorText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to update Google Sheets');
    }
  } catch (error) {
    console.error('Error updating Google Sheets:', error);
    throw error;
  }
}

// Alternative: Export to CSV for manual upload
export function exportToCSV(criteria: JobScoringCriteria[]): string {
  const header = 'Job Title,Requirements,Scoring Guide\n';
  const rows = criteria.map(c => {
    const jobTitle = `"${c.jobTitle.replace(/"/g, '""')}"`;
    const requirements = `"${c.requirements.replace(/"/g, '""')}"`;
    const scoringGuide = `"${c.scoringGuide.replace(/"/g, '""')}"`;
    return `${jobTitle},${requirements},${scoringGuide}`;
  }).join('\n');

  return header + rows;
}

export function downloadCSV(criteria: JobScoringCriteria[], filename: string = 'job-scoring.csv'): void {
  const csv = exportToCSV(criteria);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

// Citizenship code to label mapping
const CITIZENSHIP_LABELS: Record<string, string> = {
  'SC': 'Singapore Citizen',
  'PR': 'Singapore PR',
  'MY_CHINESE': 'Malaysian Chinese',
  'Foreigner': 'Foreigner (with valid pass)',
};

// Convert JobPost to JobScoringCriteria for Google Sheets sync
export function jobPostToScoringCriteria(job: JobPost): JobScoringCriteria {
  let requirements = job.scoring_requirements || '';

  // Append citizenship requirements if specified
  if (job.citizenship_required && job.citizenship_required.length > 0) {
    const citizenshipLabels = job.citizenship_required
      .map(code => CITIZENSHIP_LABELS[code] || code)
      .join(', ');

    // Add citizenship info at the end of requirements
    const citizenshipText = `\n\nCitizenship Requirement: ${citizenshipLabels}`;
    requirements = requirements + citizenshipText;
  }

  return {
    id: job.id,
    jobTitle: job.title,
    requirements: requirements,
    scoringGuide: job.scoring_guide || '',
    updated_at: job.updated_at,
  };
}

// Sync job posts (with scoring data) to Google Sheets
export async function syncJobPostsToGoogleSheet(jobs: JobPost[]): Promise<void> {
  // Filter jobs that have scoring data and convert to criteria format
  const criteria = jobs
    .filter(job => job.is_active && (job.scoring_requirements || job.scoring_guide))
    .map(jobPostToScoringCriteria);

  if (criteria.length === 0) {
    throw new Error('No active jobs with scoring criteria to sync');
  }

  await updateJobScoringToGoogleSheet(criteria);
}
