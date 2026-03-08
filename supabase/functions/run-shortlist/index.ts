import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DEADLINE_MS = 140_000;
const BATCH_SIZE = 5;
const PAGE_SIZE = 500;

function createSb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

async function processShortlist(shortlistRunId: string) {
  const startTime = Date.now();
  function timedOut() { return (Date.now() - startTime) > (DEADLINE_MS - 10000); }

  const sb = createSb();

  await sb.from("shortlist_runs").update({
    status: "running", updated_at: new Date().toISOString(),
  }).eq("id", shortlistRunId);

  // Fetch high-scoring candidates that haven't been shortlist-enriched yet
  // A candidate is "done" if there's a people record with shortlist_status != 'pending'

  // Step 1: Get all candidates scoring 70+ ordered by score desc (paginated)
  const allCandidates: { login: string; pre_score: number }[] = [];
  let from = 0;
  while (true) {
    const { data: page } = await sb.from("longlist_candidates")
      .select("login, pre_score")
      .gte("pre_score", 70)
      .order("pre_score", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (!page || page.length === 0) break;
    allCandidates.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  // Deduplicate by login, keep highest score
  const seen = new Map<string, number>();
  for (const c of allCandidates) {
    if (!seen.has(c.login) || c.pre_score > seen.get(c.login)!) {
      seen.set(c.login, c.pre_score);
    }
  }
  const uniqueLogins = [...seen.keys()]; // already in score-descending order

  // Step 2: Find which logins already have a people record (already enriched)
  const processedLogins = new Set<string>();
  for (let i = 0; i < uniqueLogins.length; i += PAGE_SIZE) {
    const batch = uniqueLogins.slice(i, i + PAGE_SIZE);
    const { data: done } = await sb.from("people")
      .select("login")
      .in("login", batch);
    if (done) done.forEach((p: any) => processedLogins.add(p.login));
  }

  const pendingLogins = uniqueLogins.filter(l => !processedLogins.has(l));
  const totalCandidates = uniqueLogins.length;

  console.log(`Shortlist run ${shortlistRunId}: ${totalCandidates} total, ${processedLogins.size} already done, ${pendingLogins.length} pending`);

  if (pendingLogins.length === 0) {
    await sb.from("shortlist_runs").update({
      status: "done",
      progress: { total: totalCandidates, enriched: totalCandidates },
      updated_at: new Date().toISOString(),
    }).eq("id", shortlistRunId);
    return;
  }

  // Step 3: Process in batches
  let enriched = 0;
  let failed = 0;
  let rateLimited = false;
  const enrichUrl = `${SUPABASE_URL}/functions/v1/enrich-candidate`;

  for (let i = 0; i < pendingLogins.length; i += BATCH_SIZE) {
    if (timedOut() || rateLimited) break;

    // Cooperative pause check
    const { data: runCheck } = await sb.from("shortlist_runs").select("status").eq("id", shortlistRunId).single();
    if (runCheck?.status === "paused") {
      console.log(`Shortlist run ${shortlistRunId} paused by user. Stopping.`);
      return;
    }

    const batch = pendingLogins.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(login =>
        fetch(enrichUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ login }),
        }).then(async (r) => {
          if (r.status === 429) {
            const body = await r.text();
            throw new Error("GITHUB_RATE_LIMITED");
          }
          if (!r.ok) {
            const body = await r.text();
            throw new Error(`${login}: ${r.status} ${body}`);
          }
          return r.json();
        })
      )
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        if (r.value?.error === "GITHUB_RATE_LIMITED") {
          rateLimited = true;
        } else {
          enriched++;
        }
      } else {
        if (r.reason?.message?.includes("RATE_LIMITED")) {
          rateLimited = true;
        } else {
          failed++;
          console.error("Enrich failed:", r.reason);
        }
      }
    }

    // Update progress after each batch
    await sb.from("shortlist_runs").update({
      progress: { total: totalCandidates, enriched: processedLogins.size + enriched, failed },
      updated_at: new Date().toISOString(),
    }).eq("id", shortlistRunId);

    // Pause between batches
    if (i + BATCH_SIZE < pendingLogins.length && !timedOut() && !rateLimited) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  // Check if more work remains
  const remainingCount = pendingLogins.length - enriched - failed;

  if (remainingCount <= 0 && !rateLimited) {
    // Done
    const stats = await getStats(sb);
    await sb.from("shortlist_runs").update({
      status: "done",
      progress: { ...stats, total: totalCandidates },
      updated_at: new Date().toISOString(),
    }).eq("id", shortlistRunId);
    console.log(`Shortlist run ${shortlistRunId} done`);
    return;
  }

  if (rateLimited && enriched === 0) {
    // Rate limited with zero progress — pause and store reset info
    try {
      const rlHeaders: Record<string, string> = { "User-Agent": "lovable-shortlist" };
      if (GITHUB_TOKEN) rlHeaders.Authorization = `Bearer ${GITHUB_TOKEN}`;
      const rlRaw = await fetch("https://api.github.com/rate_limit", { headers: rlHeaders });
      const rlData = await rlRaw.json();
      const resetAt = rlData?.rate?.reset;
      const waitMs = resetAt ? (resetAt * 1000 - Date.now()) : 3600_000;
      const waitMin = Math.ceil(waitMs / 60000);

      await sb.from("shortlist_runs").update({
        status: "paused",
        progress: { total: totalCandidates, enriched: processedLogins.size, failed, rate_limited: true, reset_at: resetAt, wait_minutes: waitMin },
        updated_at: new Date().toISOString(),
      }).eq("id", shortlistRunId);
      console.log(`Rate limited. Resets in ${waitMin} min. Pausing ${shortlistRunId}.`);
    } catch (e) {
      console.error("Failed to fetch rate limit info:", e);
      await sb.from("shortlist_runs").update({
        status: "paused",
        progress: { total: totalCandidates, enriched: processedLogins.size, failed, rate_limited: true },
        updated_at: new Date().toISOString(),
      }).eq("id", shortlistRunId);
    }
    return;
  }

  // More work or timed out — self-chain
  await sb.from("shortlist_runs").update({
    status: "running",
    progress: { total: totalCandidates, enriched: processedLogins.size + enriched, failed },
    updated_at: new Date().toISOString(),
  }).eq("id", shortlistRunId);

  const functionUrl = `${SUPABASE_URL}/functions/v1/run-shortlist`;
  fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ shortlistRunId }),
  }).catch(err => console.error("Self-chain failed:", err));

  console.log(`Self-chaining shortlist run ${shortlistRunId}...`);
}

async function getStats(sb: any) {
  const { count: shortlisted } = await sb.from("people").select("id", { count: "exact", head: true }).eq("shortlist_status", "SHORTLIST");
  const { count: needs_review } = await sb.from("people").select("id", { count: "exact", head: true }).eq("shortlist_status", "NEEDS_REVIEW");
  const { count: rejected } = await sb.from("people").select("id", { count: "exact", head: true }).eq("shortlist_status", "NO");
  return { shortlisted: shortlisted || 0, needs_review: needs_review || 0, rejected: rejected || 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shortlistRunId } = await req.json();
    if (!shortlistRunId) throw new Error("shortlistRunId required");

    EdgeRuntime.waitUntil(
      processShortlist(shortlistRunId).catch(async (error) => {
        console.error(`Shortlist run ${shortlistRunId} failed:`, error);
        const sb = createSb();
        await sb.from("shortlist_runs").update({
          status: "failed",
          progress: { error: error.message },
          updated_at: new Date().toISOString(),
        }).eq("id", shortlistRunId);
      })
    );

    return new Response(JSON.stringify({ status: "accepted", shortlistRunId }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("run-shortlist error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
