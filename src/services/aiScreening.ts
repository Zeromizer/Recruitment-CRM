// AI Screening Service
// Migrated from Power Automate workflow

const GOOGLE_SHEETS_SPREADSHEET_ID = '1jT-Xosd4W3ev7WTGiRHxupW_a7xBQ_Y0mn2ncoX65al';
const GOOGLE_SHEETS_RANGE = 'Sheet1!A2:C';

export interface JobRole {
  title: string;
  requirements: string;
  scoringGuide: string;
}

export interface ScreeningResult {
  candidate_name: string;
  candidate_email: string | null;
  candidate_phone: string | null;
  job_applied: string;
  job_matched: string;
  score: number;
  citizenship_status: 'SC' | 'PR' | 'Not Identified' | 'Foreign';
  recommendation: 'Top Candidate' | 'Review' | 'Rejected';
  summary: string;
}

export interface ScreeningInput {
  pdfBase64: string;
  emailSubject: string;
  source: string;
}

// Fetch job roles from Google Sheets
export async function fetchJobRoles(): Promise<JobRole[]> {
  const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;

  if (!apiKey) {
    throw new Error('Google Sheets API key not configured');
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_SPREADSHEET_ID}/values/${GOOGLE_SHEETS_RANGE}?key=${apiKey}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch job roles: ${response.statusText}`);
  }

  const data = await response.json();
  const values: string[][] = data.values || [];

  return values.map((row) => ({
    title: row[0] || '',
    requirements: row[1] || '',
    scoringGuide: row[2] || '',
  }));
}

// Format job roles for the AI prompt
function formatJobRolesForPrompt(roles: JobRole[]): string {
  return roles
    .map((role) => `${role.title}, ${role.requirements}, ${role.scoringGuide}`)
    .join('\n');
}

// Call Claude API for AI screening
export async function screenResume(
  pdfBase64: string,
  emailSubject: string,
  jobRoles: JobRole[]
): Promise<ScreeningResult> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('Anthropic API key not configured');
  }

  const jobRolesString = formatJobRolesForPrompt(jobRoles);

  const prompt = `The candidate applied via email with subject: ${emailSubject}. Here are the available job roles with their requirements and scoring guides (format: Job Title, Requirements, Scoring Guide): ${jobRolesString}. First, identify which job role the candidate is applying for based on the email subject. Match it to one of the available roles. If the email subject does not clearly indicate a role, select the most suitable role based on the candidates experience. Then analyze this resume against that specific roles requirements and scoring guide. IMPORTANT: Extract the candidates email address and phone number from the resume if available. IMPORTANT CITIZENSHIP REQUIREMENT: Candidates MUST be Singapore Citizens or Permanent Residents. Look for indicators such as: NRIC number (starts with S or T for citizens, F or G for PRs), National Service or NS completion, Singapore address, local education (Singapore polytechnics like Ngee Ann or Temasek, universities like NUS NTU SMU SIT SUSS, or local schools), or explicit mention of citizenship or PR status. If no clear indicator of Singapore Citizen or PR status is found, set recommendation to Rejected regardless of qualifications. CRITICAL: Your response must be ONLY a JSON object. Do not include any text, explanation, or markdown before or after the JSON. Start your response with { and end with }. The JSON must contain these fields: candidate_name (string), candidate_email (string or null if not found), candidate_phone (string or null if not found), job_applied (the role from email subject), job_matched (the role matched from your list), score (number 1-10), citizenship_status (Singapore Citizen or PR or Unknown or Foreigner), recommendation (Top Candidate or Review or Rejected), summary (brief evaluation including citizenship verification note). Use the scoring guide for the matched role.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${error}`);
  }

  const result = await response.json();
  const content = result.content?.[0]?.text;

  if (!content) {
    throw new Error('No response from Claude API');
  }

  // Parse the JSON response
  try {
    const parsed = JSON.parse(content);

    // Map citizenship status to our format
    let citizenshipStatus: 'SC' | 'PR' | 'Not Identified' | 'Foreign';
    if (parsed.citizenship_status === 'Singapore Citizen') {
      citizenshipStatus = 'SC';
    } else if (parsed.citizenship_status === 'PR') {
      citizenshipStatus = 'PR';
    } else if (parsed.citizenship_status === 'Foreigner') {
      citizenshipStatus = 'Foreign';
    } else {
      citizenshipStatus = 'Not Identified';
    }

    return {
      candidate_name: parsed.candidate_name,
      candidate_email: parsed.candidate_email,
      candidate_phone: parsed.candidate_phone,
      job_applied: parsed.job_applied,
      job_matched: parsed.job_matched,
      score: parsed.score,
      citizenship_status: citizenshipStatus,
      recommendation: parsed.recommendation,
      summary: parsed.summary,
    };
  } catch {
    throw new Error(`Failed to parse AI response: ${content}`);
  }
}

// Log screening result to Google Sheets
export async function logToGoogleSheets(
  result: ScreeningResult,
  emailSubject: string
): Promise<void> {
  const appsScriptUrl = import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL;

  if (!appsScriptUrl) {
    console.warn('Google Apps Script URL not configured, skipping logging');
    return;
  }

  const payload = {
    values: [
      new Date().toISOString(),
      result.candidate_name,
      emailSubject,
      result.job_applied,
      result.job_matched,
      result.score,
      result.citizenship_status,
      result.recommendation,
      result.summary,
    ],
  };

  try {
    await fetch(appsScriptUrl, {
      method: 'POST',
      mode: 'no-cors', // Apps Script may have CORS restrictions
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn('Failed to log to Google Sheets:', error);
    // Don't throw - logging is optional
  }
}

// Convert File to base64
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Full screening workflow
export async function performFullScreening(input: ScreeningInput): Promise<ScreeningResult> {
  // Step 1: Fetch job roles from Google Sheets
  const jobRoles = await fetchJobRoles();

  if (jobRoles.length === 0) {
    throw new Error('No job roles found in Google Sheets');
  }

  // Step 2: Screen the resume with Claude AI
  const result = await screenResume(input.pdfBase64, input.emailSubject, jobRoles);

  // Step 3: Log to Google Sheets (optional, doesn't block)
  logToGoogleSheets(result, input.emailSubject).catch(console.warn);

  return result;
}
