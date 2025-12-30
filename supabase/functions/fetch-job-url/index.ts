import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface JobData {
  title: string;
  salary: string;
  location: string;
  work_type: string;
  day_shift: string;
  overnight_shift: string;
  responsibilities: string;
  requirements: string;
  keywords: string;
  citizenship_required: string;
  notes: string;
  scoring_requirements: string;
  scoring_guide: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      throw new Error("URL is required");
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    console.log(`Fetching job URL: ${url}`);

    // Use Jina Reader to fetch and render the page (handles JavaScript)
    // This service renders JS and returns clean markdown
    const jinaUrl = `https://r.jina.ai/${url}`;

    const fetchResponse = await fetch(jinaUrl, {
      headers: {
        "Accept": "text/plain",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!fetchResponse.ok) {
      // Fallback: try direct fetch with browser headers
      console.log("Jina Reader failed, trying direct fetch...");

      const directResponse = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate, br",
          "Connection": "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        },
      });

      if (!directResponse.ok) {
        throw new Error(`Failed to fetch URL: ${directResponse.status}`);
      }
    }

    const content = await fetchResponse.text();

    if (!content || content.length < 100) {
      throw new Error("Retrieved content is too short or empty");
    }

    console.log(`Fetched content length: ${content.length}`);

    // Use Claude to extract job details
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: `Extract job posting details from this content. The content may be in markdown format.

Look for:
- Job title
- Salary/pay range
- Location/address
- Work type (full-time, part-time, contract)
- Shift hours (day shift, overnight shift)
- Responsibilities/duties
- Requirements/qualifications
- Keywords (skills, job type, industry)
- Citizenship requirements (Singaporean, PR, etc.)

Also generate:
- scoring_requirements: A detailed paragraph summarizing the key requirements for AI resume screening
- scoring_guide: A scoring guide in format "Score 8-10: criteria. Score 5-7: criteria. Score 1-4: criteria."

Return ONLY a JSON object with these fields (use empty string if not found):
{
  "title": "job title",
  "salary": "salary range or amount",
  "location": "work location or address",
  "work_type": "full-time/part-time/contract",
  "day_shift": "day shift hours if mentioned",
  "overnight_shift": "night shift hours if mentioned",
  "responsibilities": "comma-separated list of main duties/responsibilities",
  "requirements": "comma-separated list of requirements/qualifications",
  "keywords": "comma-separated keywords (job type, skills, industry)",
  "citizenship_required": "SC for Singaporean only, PR for PR/Citizen, Any for no restriction",
  "notes": "any other important details",
  "scoring_requirements": "detailed paragraph of key requirements for AI screening",
  "scoring_guide": "Score 8-10: excellent criteria. Score 5-7: acceptable criteria. Score 1-4: poor fit criteria."
}

Return ONLY valid JSON, no explanation or markdown.

Content:
${content.substring(0, 80000)}`
        }],
      }),
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.text();
      throw new Error(`Claude API error: ${error}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.content?.[0]?.text;

    if (!aiContent) {
      throw new Error("No response from Claude");
    }

    // Parse JSON from response
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse job details from AI response");
    }

    const jobData: JobData = JSON.parse(jsonMatch[0]);

    // Validate we got at least a title
    if (!jobData.title || jobData.title.length < 3) {
      throw new Error("Could not extract job title from the page");
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: jobData,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Fetch job URL error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
