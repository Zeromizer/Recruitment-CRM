import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Extract text from PDF using Claude's vision API (for image-based PDFs)
async function extractTextFromPdfWithVision(pdfBase64: string, apiKey: string): Promise<string> {
  console.log("Using Claude vision API to extract text from image-based PDF...");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            },
            {
              type: "text",
              text: `Extract ALL text content from this resume/CV document.
Include everything: name, contact details, work experience, education, skills, certifications, etc.
Format it in a readable way, preserving the structure and sections.
Just output the extracted text, no commentary.`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Vision API error: ${error}`);
  }

  const result = await response.json();
  const extractedText = result.content?.[0]?.text || "";
  console.log(`Vision API extracted ${extractedText.length} characters from PDF`);

  return extractedText;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { resumeText: inputResumeText, pdfBase64, candidateInfo } = await req.json();

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    // If pdfBase64 is provided and resumeText is empty/short, use vision extraction
    let resumeText = inputResumeText || "";
    if (pdfBase64 && (!resumeText || resumeText.trim().length < 100)) {
      console.log(`Text extraction insufficient (${resumeText.length} chars), using vision API...`);
      resumeText = await extractTextFromPdfWithVision(pdfBase64, apiKey);
    }

    if (!resumeText || resumeText.trim().length < 50) {
      throw new Error("Could not extract sufficient text from resume");
    }

    // Truncate resume text if too long to avoid token limits
    const maxResumeLength = 15000;
    const truncatedResume = resumeText.length > maxResumeLength
      ? resumeText.substring(0, maxResumeLength) + "\n...[truncated]"
      : resumeText;

    const prompt = `You are a resume parser. Extract and structure the following resume into JSON format.

CANDIDATE INFO (use these exact values):
- Name: ${candidateInfo.candidateName}
- Nationality: ${candidateInfo.nationality}
- Gender: ${candidateInfo.gender}
- Expected Salary: ${candidateInfo.expectedSalary}
- Notice Period: ${candidateInfo.noticePeriod}

RESUME TEXT:
${truncatedResume}

Return ONLY valid JSON with this exact structure. No markdown code blocks, no explanations. Just the JSON object:

{
  "candidateName": "${candidateInfo.candidateName}",
  "nationality": "${candidateInfo.nationality}",
  "gender": "${candidateInfo.gender}",
  "expectedSalary": "${candidateInfo.expectedSalary}",
  "noticePeriod": "${candidateInfo.noticePeriod}",
  "education": [
    {"year": "YYYY", "qualification": "Degree Name", "institution": "University Name"}
  ],
  "workExperience": [
    {"title": "Job Title", "period": "Mon YYYY - Mon YYYY", "company": "Company Name", "responsibilities": ["Task 1", "Task 2"]}
  ],
  "languages": ["English"]
}

IMPORTANT RULES:
1. Extract ALL work experiences from the resume (most recent first)
2. Extract ALL education entries
3. Each responsibility should be a concise bullet point (max 200 characters)
4. Keep responsibility descriptions short and clear
5. Extract languages as separate items: ["English", "Mandarin", "Cantonese"]
6. If no languages mentioned, use ["English"]
7. Do NOT include any text before or after the JSON object
8. Ensure all strings are properly escaped (no unescaped quotes or newlines)`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${error}`);
    }

    const result = await response.json();
    let jsonStr = result.content?.[0]?.text?.trim();

    if (!jsonStr) {
      throw new Error("No response from Claude API");
    }

    // Clean up response - remove markdown code blocks if present
    jsonStr = jsonStr.replace(/^```json\s*/i, '');
    jsonStr = jsonStr.replace(/^```\s*/i, '');
    jsonStr = jsonStr.replace(/\s*```$/i, '');
    jsonStr = jsonStr.trim();

    // Try to extract JSON object if there's extra text
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    // Parse and validate
    let parsedResume;
    try {
      parsedResume = JSON.parse(jsonStr);
    } catch (parseError) {
      // Try to fix common JSON issues
      // Replace unescaped newlines in strings
      jsonStr = jsonStr.replace(/([^\\])\\n/g, '$1\\\\n');
      // Try parsing again
      try {
        parsedResume = JSON.parse(jsonStr);
      } catch {
        console.error("JSON parse error. Raw response:", jsonStr.substring(0, 500));
        throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
      }
    }

    // Validate required fields
    if (!parsedResume.candidateName) {
      parsedResume.candidateName = candidateInfo.candidateName;
    }
    if (!parsedResume.nationality) {
      parsedResume.nationality = candidateInfo.nationality;
    }
    if (!parsedResume.gender) {
      parsedResume.gender = candidateInfo.gender;
    }
    if (!parsedResume.expectedSalary) {
      parsedResume.expectedSalary = candidateInfo.expectedSalary;
    }
    if (!parsedResume.noticePeriod) {
      parsedResume.noticePeriod = candidateInfo.noticePeriod;
    }
    if (!Array.isArray(parsedResume.education)) {
      parsedResume.education = [];
    }
    if (!Array.isArray(parsedResume.workExperience)) {
      parsedResume.workExperience = [];
    }
    if (!Array.isArray(parsedResume.languages)) {
      parsedResume.languages = ["English"];
    }

    return new Response(JSON.stringify(parsedResume), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Parse resume error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
