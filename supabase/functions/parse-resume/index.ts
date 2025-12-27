import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { resumeText, candidateInfo } = await req.json();

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const prompt = `You are a resume parser. Extract and structure the following resume into JSON format.

CANDIDATE INFO (use these exact values):
- Name: ${candidateInfo.candidateName}
- Nationality: ${candidateInfo.nationality}
- Gender: ${candidateInfo.gender}
- Expected Salary: ${candidateInfo.expectedSalary}
- Notice Period: ${candidateInfo.noticePeriod}

RESUME TEXT:
${resumeText}

Return ONLY valid JSON (no markdown, no code blocks). Start your response with { and end with }:
{
    "candidateName": "${candidateInfo.candidateName}",
    "nationality": "${candidateInfo.nationality}",
    "gender": "${candidateInfo.gender}",
    "expectedSalary": "${candidateInfo.expectedSalary}",
    "noticePeriod": "${candidateInfo.noticePeriod}",
    "education": [{"year": "2023", "qualification": "Degree Name", "institution": "University Name"}],
    "workExperience": [{"title": "Job Title", "period": "Jan 2022 - Present", "company": "Company Name", "responsibilities": ["Responsibility 1", "Responsibility 2"]}],
    "languages": ["English", "Mandarin", "Cantonese"]
}

RULES:
1. Extract ALL work experiences (most recent first)
2. Extract ALL education entries
3. Each responsibility should be a complete sentence
4. Extract ALL languages mentioned individually (e.g., "English, Mandarin, Cantonese" should be ["English", "Mandarin", "Cantonese"], not consolidated into "Chinese")
5. If no languages mentioned, default to ["English"]`;

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

    // Clean up response
    if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
    if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);

    const parsedResume = JSON.parse(jsonStr.trim());

    return new Response(JSON.stringify(parsedResume), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
