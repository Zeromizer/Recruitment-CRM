// Google Sheets Integration Service

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

// Update Google Sheets using the API (requires OAuth or service account)
export async function updateJobScoringToGoogleSheet(
  spreadsheetId: string,
  criteria: JobScoringCriteria[],
  range: string = 'Sheet1!A2:C'
): Promise<void> {
  try {
    // This requires backend implementation with proper authentication
    // For now, we'll use a backend proxy endpoint
    const response = await fetch('/api/google-sheets/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        spreadsheetId,
        range,
        values: criteria.map(c => [c.jobTitle, c.requirements, c.scoringGuide]),
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update Google Sheets');
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
