import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface JobScoringCriteria {
  jobTitle: string;
  requirements: string;
  scoringGuide: string;
}

interface SyncRequest {
  criteria: JobScoringCriteria[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const appsScriptUrl = Deno.env.get("GOOGLE_APPS_SCRIPT_URL");

    if (!appsScriptUrl) {
      throw new Error("GOOGLE_APPS_SCRIPT_URL not configured in Supabase secrets");
    }

    const body: SyncRequest = await req.json();

    if (!body.criteria || !Array.isArray(body.criteria)) {
      throw new Error("Invalid request: criteria array is required");
    }

    console.log(`Syncing ${body.criteria.length} job criteria to Google Sheets`);

    // Forward the request to Google Apps Script (server-to-server, no CORS issues)
    const response = await fetch(appsScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        criteria: body.criteria.map((c) => ({
          jobTitle: c.jobTitle,
          requirements: c.requirements,
          scoringGuide: c.scoringGuide,
        })),
      }),
    });

    // Google Apps Script may return redirects for authentication
    if (response.status === 302 || response.status === 301) {
      throw new Error("Google Apps Script redirect - check deployment settings (should be 'Anyone' access)");
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Apps Script error:", errorText);
      throw new Error(`Google Apps Script returned ${response.status}: ${errorText}`);
    }

    // Try to parse response as JSON
    let result;
    const responseText = await response.text();

    try {
      result = JSON.parse(responseText);
    } catch {
      // If not JSON, check if it looks like a success message
      if (responseText.toLowerCase().includes("success") || responseText === "") {
        result = { success: true, message: "Data synced to Google Sheets" };
      } else {
        console.error("Unexpected response:", responseText);
        throw new Error(`Unexpected response from Google Apps Script: ${responseText.substring(0, 200)}`);
      }
    }

    if (result.error) {
      throw new Error(result.error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully synced ${body.criteria.length} job criteria`,
        ...result,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Sync Google Sheet error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
