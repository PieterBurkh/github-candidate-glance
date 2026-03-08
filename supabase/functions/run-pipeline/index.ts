import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function createSb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

/** Fire-and-forget: trigger an edge function without waiting for completion */
function fireAndForget(name: string, body: Record<string, unknown>) {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(body),
  }).catch((err) => console.error(`fire-and-forget ${name} error:`, err));
}

async function advancePipeline(pipelineRunId: string) {
  const sb = createSb();

  const { data: pr, error } = await sb.from("pipeline_runs")
    .select("*").eq("id", pipelineRunId).single();
  if (error || !pr) throw new Error("Pipeline run not found");

  const stage = pr.stage;
  const config = (pr.config || {}) as Record<string, unknown>;

  const update = async (fields: Record<string, unknown>) => {
    await sb.from("pipeline_runs").update({
      ...fields,
      updated_at: new Date().toISOString(),
    }).eq("id", pipelineRunId);
  };

  // ── PENDING → create run record optimistically, then fire search-repos ──
  if (stage === "pending") {
    const perPage = (config.per_page as number) || 6;
    const maxPages = (config.max_pages as number) || 1;

    // Create the runs record directly so we have the ID immediately
    const { data: newRun, error: runErr } = await sb.from("runs")
      .insert({ status: "running", search_params: { perPage, maxPages } })
      .select("id").single();
    if (runErr) throw new Error(`Failed to create run: ${runErr.message}`);

    // Optimistically update stage BEFORE triggering the long-running function
    await update({ stage: "initial_list", run_id: newRun.id });

    // Fire-and-forget: search-repos will update the run record when done
    fireAndForget("search-repos", { runId: newRun.id, perPage, maxPages });

    return { stage: "initial_list", runId: newRun.id };
  }

  // ── INITIAL_LIST → check runs status, then kick off build-longlist ──
  if (stage === "initial_list") {
    const { data: run } = await sb.from("runs")
      .select("status, search_params").eq("id", pr.run_id).single();
    if (!run) throw new Error("Linked run not found");

    if (run.status === "running") return { stage: "initial_list", waiting: true };

    if (run.status === "paused") {
      const params = run.search_params as Record<string, unknown>;
      const hasCursor = params?.cursor != null;
      const resumeCount = (params?.resume_count as number) || 0;

      // Fail-fast: if timed_out but no cursor saved, something is broken
      if (params?.timed_out && !hasCursor) {
        await update({
          stage: "failed",
          error: `Initial list stalled: timed out ${resumeCount} times but cursor is null. Cannot resume.`,
        });
        return { stage: "failed", error: "cursor_null_after_timeout" };
      }

      fireAndForget("search-repos", { runId: pr.run_id });
      return { stage: "initial_list", resumed: true, resumeCount };
    }

    if (run.status === "failed") {
      await update({ stage: "failed", error: "Initial list run failed" });
      return { stage: "failed" };
    }

    // completed → create longlist run and kick off build-longlist
    const { data: llRun, error: llErr } = await sb.from("longlist_runs")
      .insert({ status: "pending", progress: {}, source_run_id: pr.run_id })
      .select("id").single();
    if (llErr) throw new Error(`Failed to create longlist run: ${llErr.message}`);

    // Optimistic update before firing
    await update({ stage: "longlist", longlist_run_id: llRun.id });
    fireAndForget("build-longlist", { longlistRunId: llRun.id });

    return { stage: "longlist", longlistRunId: llRun.id };
  }

  // ── LONGLIST → check longlist_runs status, then kick off run-shortlist ──
  if (stage === "longlist") {
    const { data: llRun } = await sb.from("longlist_runs")
      .select("status, progress").eq("id", pr.longlist_run_id).single();
    if (!llRun) throw new Error("Linked longlist run not found");

    if (llRun.status === "running") return { stage: "longlist", waiting: true };

    if (llRun.status === "paused") {
      const progress = llRun.progress as Record<string, unknown>;
      if (progress?.rate_limited) {
        return { stage: "longlist", rate_limited: true, progress };
      }
      fireAndForget("build-longlist", { longlistRunId: pr.longlist_run_id });
      return { stage: "longlist", resumed: true };
    }

    if (llRun.status === "failed") {
      await update({ stage: "failed", error: "Longlist run failed" });
      return { stage: "failed" };
    }

    // done → create shortlist run and kick off run-shortlist
    const { data: slRun, error: slErr } = await sb.from("shortlist_runs")
      .insert({ status: "pending", progress: {} })
      .select("id").single();
    if (slErr) throw new Error(`Failed to create shortlist run: ${slErr.message}`);

    await update({ stage: "shortlist", shortlist_run_id: slRun.id });
    fireAndForget("run-shortlist", {
      shortlistRunId: slRun.id,
      longlistRunId: pr.longlist_run_id,
    });

    return { stage: "shortlist", shortlistRunId: slRun.id };
  }

  // ── SHORTLIST → check shortlist_runs status ──
  if (stage === "shortlist") {
    const { data: slRun } = await sb.from("shortlist_runs")
      .select("status, progress").eq("id", pr.shortlist_run_id).single();
    if (!slRun) throw new Error("Linked shortlist run not found");

    if (slRun.status === "running") return { stage: "shortlist", waiting: true };

    if (slRun.status === "paused") {
      const progress = slRun.progress as Record<string, unknown>;
      if (progress?.rate_limited) {
        return { stage: "shortlist", rate_limited: true, progress };
      }
      fireAndForget("run-shortlist", {
        shortlistRunId: pr.shortlist_run_id,
        longlistRunId: pr.longlist_run_id,
      });
      return { stage: "shortlist", resumed: true };
    }

    if (slRun.status === "failed") {
      await update({ stage: "failed", error: "Shortlist run failed" });
      return { stage: "failed" };
    }

    // done
    await update({ stage: "completed" });
    return { stage: "completed" };
  }

  return { stage, status: "no_action" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pipelineRunId } = await req.json();
    if (!pipelineRunId) throw new Error("pipelineRunId required");

    const result = await advancePipeline(pipelineRunId);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("run-pipeline error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
