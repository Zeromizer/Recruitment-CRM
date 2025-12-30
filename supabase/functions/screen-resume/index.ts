import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fallback job roles when none provided
const FALLBACK_JOB_ROLES = [
  {
    title: 'General Application',
    requirements: 'Evaluate based on overall experience and skills',
    scoringGuide: '8-10: Excellent experience, 6-7: Good fit, 4-5: Average, 1-3: Poor fit',
  },
  {
    title: 'Administrative / Office Support',
    requirements: 'Office administration, data entry, customer service, MS Office proficiency',
    scoringGuide: '8-10: 3+ years admin experience, 6-7: 1-2 years, 4-5: Entry level',
  },
  {
    title: 'Customer Service / Call Centre',
    requirements: 'Customer handling, communication skills, problem solving',
    scoringGuide: '8-10: 3+ years CS experience, 6-7: 1-2 years, 4-5: Entry level',
  },
  {
    title: 'Warehouse / Logistics',
    requirements: 'Warehouse operations, forklift license preferred, inventory management',
    scoringGuide: '8-10: 3+ years warehouse experience, 6-7: 1-2 years, 4-5: Entry level',
  },
  {
    title: 'F&B / Retail',
    requirements: 'Service oriented, able to work shifts, customer facing experience',
    scoringGuide: '8-10: 2+ years experience, 6-7: 1 year, 4-5: Entry level',
  },
  {
    title: 'Engineering / Technical',
    requirements: 'Technical diploma/degree, relevant certifications, hands-on experience',
    scoringGuide: '8-10: 5+ years technical experience, 6-7: 2-4 years, 4-5: Entry level',
  },
];

interface JobRole {
  title: string;
  requirements: string;
  scoringGuide: string;
}

function formatJobRolesForPrompt(roles: JobRole[]): string {
  return roles
    .map((role) => `${role.title}, ${role.requirements}, ${role.scoringGuide}`)
    .join('\n');
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { pdfBase64, emailSubject, mediaType, jobRoles } = await req.json();

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not configured in Supabase");
    }

    if (!pdfBase64) {
      throw new Error("No resume provided");
    }

    // Use provided job roles or fallback
    const roles = jobRoles && jobRoles.length > 0 ? jobRoles : FALLBACK_JOB_ROLES;
    const jobRolesString = formatJobRolesForPrompt(roles);

    const prompt = `You are analyzing a resume for a staffing agency. Your task is to evaluate the candidate.

APPLYING FOR: ${emailSubject || 'General Application'}

AVAILABLE JOB ROLES (format: Job Title, Requirements, Scoring Guide):
${jobRolesString}

INSTRUCTIONS:
1. Identify which job role the candidate is applying for based on the application title. Match to one of the available roles.
2. If the application title does not clearly indicate a role, select the most suitable role based on the candidate's experience.
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
    "job_applied": "Role from application",
    "job_matched": "Best matching role from your list",
    "score": 7,
    "citizenship_status": "Singapore Citizen|PR|Unknown|Foreigner",
    "recommendation": "Top Candidate|Review|Rejected",
    "summary": "Brief evaluation including citizenship verification"
}

Use the scoring guide for the matched role. Score 1-10.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: mediaType || "application/pdf",
                  data: pdfBase64,
                },
              },
              {
                type: "text",
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
      throw new Error("No response from Claude API");
    }

    // Parse the JSON response
    let parsed;
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(content);
      }
    } catch {
      throw new Error(`Failed to parse AI response: ${content.substring(0, 200)}`);
    }

    // Map citizenship status to expected format (handle variations from AI)
    let citizenshipStatus: string;
    const rawCitizenship = (parsed.citizenship_status || '').toLowerCase().trim();

    if (rawCitizenship === 'singapore citizen' || rawCitizenship === 'singaporean' || rawCitizenship === 'sc' || rawCitizenship === 'singapore citizens') {
      citizenshipStatus = 'SC';
    } else if (rawCitizenship === 'pr' || rawCitizenship === 'permanent resident') {
      citizenshipStatus = 'PR';
    } else if (rawCitizenship === 'foreigner' || rawCitizenship === 'foreign' || rawCitizenship.includes('pass holder') || rawCitizenship.includes('work permit')) {
      citizenshipStatus = 'Foreign';
    } else {
      citizenshipStatus = 'Not Identified';
    }

    const screeningResult = {
      candidate_name: parsed.candidate_name || 'Unknown',
      candidate_email: parsed.candidate_email || null,
      candidate_phone: parsed.candidate_phone || null,
      job_applied: parsed.job_applied || emailSubject || 'General',
      job_matched: parsed.job_matched || 'General Application',
      score: parsed.score || 5,
      citizenship_status: citizenshipStatus,
      recommendation: parsed.recommendation || 'Review',
      summary: parsed.summary || 'Resume screened successfully',
    };

    return new Response(JSON.stringify(screeningResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Screen resume error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
