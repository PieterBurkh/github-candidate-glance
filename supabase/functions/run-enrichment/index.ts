import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { runId } = await req.json();
    if (!runId) throw new Error("runId required");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Mark run as running
    await supabase.from("runs").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", runId);

    // Fetch all repos for this run
    const { data: allRepos, error: reposErr } = await supabase
      .from("repos")
      .select("id, full_name, metadata")
      .eq("run_id", runId);
    if (reposErr) throw new Error(`Failed to fetch repos: ${reposErr.message}`);

    // Filter out org-owned repos to save API calls
    const repos = (allRepos || []).filter((r: any) => {
      const ownerType = r.metadata?.owner_type;
      return !ownerType || ownerType === "User";
    });

    const enrichUrl = `${SUPABASE_URL}/functions/v1/enrich-repo`;
    const batchSize = 3;
    let enriched = 0;
    let failed = 0;

    for (let i = 0; i < repos.length; i += batchSize) {
      const batch = repos.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((repo) =>
          fetch(enrichUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ repoId: repo.id }),
          }).then(async (r) => {
            if (!r.ok) {
              const body = await r.text();
              throw new Error(`${repo.full_name}: ${r.status} ${body}`);
            }
            return r.json();
          })
        )
      );

      for (const r of results) {
        if (r.status === "fulfilled") enriched++;
        else {
          failed++;
          console.error("Enrich failed:", r.reason);
        }
      }

      // Rate limit pause between batches
      if (i + batchSize < repos.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // Person rollup: for each person, compute max score across their repos
    const { data: allEvidence } = await supabase
      .from("person_evidence")
      .select("person_id, criterion, score");

    if (allEvidence) {
      const personScores = new Map<string, number>();
      for (const ev of allEvidence) {
        const current = personScores.get(ev.person_id) || 0;
        if (ev.score > current) personScores.set(ev.person_id, ev.score);
      }

      for (const [personId, score] of personScores) {
        await supabase
          .from("people")
          .update({ overall_score: score, updated_at: new Date().toISOString() })
          .eq("id", personId);
      }
    }

    // Mark run complete
    await supabase
      .from("runs")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", runId);

    return new Response(
      JSON.stringify({ runId, total: repos.length, enriched, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    // Try to mark run as failed
    try {
      const { runId } = await req.clone().json().catch(() => ({}));
      if (runId) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase.from("runs").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", runId);
      }
    } catch {}

    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
