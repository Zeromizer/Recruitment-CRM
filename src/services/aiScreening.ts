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

  const prompt = `You are analyzing a resume for a staffing agency. Your task is to evaluate the candidate.

EMAIL SUBJECT: ${emailSubject}

AVAILABLE JOB ROLES (format: Job Title, Requirements, Scoring Guide):
${jobRolesString}

INSTRUCTIONS:
1. Identify which job role the candidate is applying for based on the email subject. Match to one of the available roles.
2. If the email subject does not clearly indicate a role, select the most suitable role based on the candidate's experience.
3. Analyze the resume against that role's requirements and scoring guide.
4. Extract contact information (email, phone) if visible.

CITIZENSHIP REQUIREMENT:
Most roles require Singapore Citizens or Permanent Residents. Look for these indicators:

STRONG INDICATORS (treat as Singapore Citizen):
- NRIC number starting with S or T
- National Service (NS/NSF) completion or mention
- Local education: ITE, Secondary school, Primary school, O Levels, N Levels, PSLE
- Singapore polytechnics (Ngee Ann, Temasek, Republic, Singapore Poly, Nanyang Poly)
- Local universities (NUS, NTU, SMU, SIT, SUSS, SUTD)

PR INDICATORS:
- NRIC number starting with F or G
- Explicit mention of PR status

If local education (ITE, Secondary/Primary school, O/N Levels, PSLE) is found, assume Singapore Citizen unless explicitly stated otherwise.
Only mark as "Unknown" if no local education or citizenship indicators are found - let the recruiter decide.

RESPONSE FORMAT:
Return ONLY a JSON object with no other text. Start with { and end with }:
{
    "candidate_name": "Full name from resume",
    "candidate_email": "email@example.com or null",
    "candidate_phone": "+65 XXXX XXXX or null",
    "job_applied": "Role from email subject",
    "job_matched": "Best matching role from your list",
    "score": 7,
    "citizenship_status": "Singapore Citizen|PR|Unknown|Foreigner",
    "recommendation": "Top Candidate|Review|Rejected",
    "summary": "Brief evaluation including citizenship verification"
}

Use the scoring guide for the matched role. Score 1-10.`;

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
