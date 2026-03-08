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
const BATCH_SIZE = 50;
const CONCURRENCY = 10;
const PAGE_SIZE = 500;
const INLINE_EXPLOIT_THRESHOLD = 80;

function createSb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

async function githubFetch(url: string): Promise<Response | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "lovable-longlist-builder",
  };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (res.status === 403 || res.status === 429) {
    console.warn("GitHub rate limit hit");
    return null;
  }
  return res;
}

function scoreCandidate(user: any, userRepos: any[]) {
  const sorted = userRepos
    .filter((r: any) => !r.fork && !r.archived)
    .sort((a: any, b: any) => (b.stargazers_count || 0) - (a.stargazers_count || 0));

  const selected: any[] = [];
  const seen = new Set<string>();

  for (const r of sorted.slice(0, 4)) {
    if (!seen.has(r.full_name)) { selected.push(r); seen.add(r.full_name); }
  }
  const byPush = [...sorted].sort((a: any, b: any) =>
    new Date(b.pushed_at || 0).getTime() - new Date(a.pushed_at || 0).getTime()
  );
  for (const r of byPush.slice(0, 2)) {
    if (!seen.has(r.full_name) && selected.length < 8) { selected.push(r); seen.add(r.full_name); }
  }
  for (const r of sorted) {
    if (selected.length >= 8) break;
    if (!seen.has(r.full_name)) { selected.push(r); seen.add(r.full_name); }
  }

  const candidateRepos = selected.map((r: any) => ({
    full_name: r.full_name,
    stars: r.stargazers_count || 0,
    language: r.language,
    description: r.description,
    pushed_at: r.pushed_at,
    topics: r.topics || [],
    has_pages: r.has_pages,
    size: r.size,
  }));

  let preScore = 0;
  let hasReact = false;
  let hasTS = false;
  const signals: Record<string, any> = {};
  const sixMonthsAgo = Date.now() - 6 * 30 * 24 * 60 * 60 * 1000;

  for (const repo of candidateRepos) {
    const rs: Record<string, any> = {};
    if (repo.language === "TypeScript") { hasTS = true; rs.typescript = true; }
    if (repo.language === "JavaScript") { rs.javascript = true; }
    const topics = (repo.topics || []) as string[];
    const ft = topics.filter((t: string) =>
      ["react", "reactjs", "next", "nextjs", "remix", "vite", "gatsby", "vue", "angular", "svelte"].includes(t.toLowerCase())
    );
    if (ft.length > 0) {
      rs.framework_topics = ft;
      if (topics.some((t: string) => ["react", "reactjs", "next", "nextjs", "remix", "vite", "gatsby"].includes(t.toLowerCase()))) hasReact = true;
    }
    const desc = (repo.description || "").toLowerCase();
    const cks = ["drag", "drop", "editor", "rich text", "animation", "3d", "chart", "graph", "dashboard", "cms", "state management"];
    const mk = cks.filter(k => desc.includes(k));
    if (mk.length > 0) rs.complex_keywords = mk;
    rs.stars = repo.stars;
    if (repo.pushed_at && new Date(repo.pushed_at).getTime() > sixMonthsAgo) rs.recent_activity = true;
    if (repo.size > 500) rs.non_trivial_size = true;
    if (repo.has_pages) rs.has_pages = true;
    signals[repo.full_name] = rs;
  }

  if (hasReact) preScore += 20;
  if (hasTS) preScore += 15;
  if (!hasTS && candidateRepos.some(r => r.language === "JavaScript")) preScore += 10;
  const totalStars = candidateRepos.reduce((s, r) => s + (r.stars || 0), 0);
  if (totalStars >= 100) preScore += 10;
  else if (totalStars >= 20) preScore += 5;
  if (user.followers >= 200) preScore += 10;
  else if (user.followers >= 50) preScore += 5;
  if (candidateRepos.some(r => r.pushed_at && new Date(r.pushed_at).getTime() > sixMonthsAgo)) preScore += 5;
  if (candidateRepos.filter(r => r.size > 500).length >= 3) preScore += 5;
  if (sorted.length > 5) preScore += 5;
  if (candidateRepos.some(r => r.has_pages)) preScore += 2;
  const tck = Object.values(signals).reduce((sum: number, s: any) => sum + (s.complex_keywords?.length || 0), 0);
  if (tck > 0) preScore += Math.min(tck * 3, 10);

  let preConfidence = 0.5;
  if (candidateRepos.length >= 4) preConfidence += 0.2;
  if (hasReact && hasTS) preConfidence += 0.2;
  if (totalStars >= 10) preConfidence += 0.1;
  preConfidence = Math.min(1, preConfidence);

  return {
    hydration: {
      name: user.name, avatar_url: user.avatar_url, html_url: user.html_url,
      bio: user.bio, blog: user.blog, email: user.email,
      twitter_username: user.twitter_username, public_repos: user.public_repos,
      followers: user.followers, company: user.company, location: user.location,
      created_at: user.created_at, updated_at: user.updated_at,
    },
    candidateRepos,
    signals,
    preScore,
    preConfidence: Math.round(preConfidence * 100) / 100,
  };
}

interface CandidateUpdate {
  id: string;
  stage: string;
  discard_reason?: string;
  hydration?: any;
  candidate_repos?: any;
  repo_signals?: any;
  pre_score?: number;
  pre_confidence?: number;
}

async function processOneCandidate(candidate: { id: string; login: string }): Promise<CandidateUpdate | "rate_limited"> {
  const [userRes, reposRes] = await Promise.all([
    githubFetch(`https://api.github.com/users/${candidate.login}`),
    githubFetch(`https://api.github.com/users/${candidate.login}/repos?per_page=100&sort=stars&direction=desc&type=owner`),
  ]);

  if (!userRes || !reposRes) return "rate_limited";

  if (userRes.status === 404) {
    return { id: candidate.id, stage: "discarded", discard_reason: "not_found" };
  }

  const user = await userRes.json();
  const userRepos = await reposRes.json();

  if (user.type === "Organization") {
    return { id: candidate.id, stage: "discarded", discard_reason: "organization" };
  }

  if ((user.public_repos || 0) === 0 || !Array.isArray(userRepos) || userRepos.length === 0) {
    return { id: candidate.id, stage: "discarded", discard_reason: "no_repos" };
  }

  const result = scoreCandidate(user, userRepos);
  return {
    id: candidate.id,
    stage: "scored",
    hydration: result.hydration,
    candidate_repos: result.candidateRepos,
    repo_signals: result.signals,
    pre_score: result.preScore,
    pre_confidence: result.preConfidence,
  };
}

async function processLonglist(longlistRunId: string) {
  const startTime = Date.now();
  function timedOut() { return (Date.now() - startTime) > (DEADLINE_MS - 8000); }

  const sb = createSb();

  const { data: run, error: runErr } = await sb
    .from("longlist_runs").select("*").eq("id", longlistRunId).single();
  if (runErr) throw runErr;

  const progress = (run.progress || {}) as Record<string, any>;

  await sb.from("longlist_runs").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", longlistRunId);

  // ─── Seed candidates ───
  const { count: existingCount } = await sb
    .from("longlist_candidates").select("id", { count: "exact", head: true }).eq("longlist_run_id", longlistRunId);

  if (!existingCount || existingCount === 0) {
    // Fetch ALL owner_logins from repos, paginated to avoid 1000-row limit
    const allRepoLogins: string[] = [];
    let from = 0;
    while (true) {
      let query = sb.from("repos").select("owner_login");
      if (run.source_run_id) query = query.eq("run_id", run.source_run_id);
      const { data: page } = await query.range(from, from + PAGE_SIZE - 1);
      if (!page || page.length === 0) break;
      allRepoLogins.push(...page.map((r: any) => r.owner_login));
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    const allLogins = [...new Set(allRepoLogins)];

    // Deduplicate: exclude logins already processed in ANY previous longlist run
    const existingLogins = new Set<string>();
    for (let i = 0; i < allLogins.length; i += PAGE_SIZE) {
      const batch = allLogins.slice(i, i + PAGE_SIZE);
      const { data: existing } = await sb
        .from("longlist_candidates")
        .select("login")
        .in("login", batch)
        .neq("longlist_run_id", longlistRunId);
      if (existing) existing.forEach((r: any) => existingLogins.add(r.login));
    }

    const logins = allLogins.filter(l => !existingLogins.has(l));
    console.log(`Seeding: ${allLogins.length} total logins, ${existingLogins.size} already processed, ${logins.length} new`);

    for (let i = 0; i < logins.length; i += 500) {
      const batch = logins.slice(i, i + 500).map((login) => ({
        longlist_run_id: longlistRunId, login, stage: "pending",
      }));
      await sb.from("longlist_candidates").upsert(batch, { onConflict: "longlist_run_id,login" });
    }

    await sb.from("longlist_runs").update({
      progress: { ...progress, stage: "processing", cursor: 0, total: logins.length, seeded: logins.length },
      updated_at: new Date().toISOString(),
    }).eq("id", longlistRunId);
  }

  // ─── Process candidates in parallel ───
  let totalProcessed = 0;
  let rateLimited = false;

  while (!timedOut() && !rateLimited) {
    const { data: batch } = await sb
      .from("longlist_candidates").select("id, login")
      .eq("longlist_run_id", longlistRunId).eq("stage", "pending")
      .order("created_at", { ascending: true }).range(0, BATCH_SIZE - 1);

    if (!batch || batch.length === 0) break;

    // Process in chunks of CONCURRENCY
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      if (timedOut() || rateLimited) break;

      const chunk = batch.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(chunk.map(c => processOneCandidate(c)));

      const updates: CandidateUpdate[] = [];
      for (const r of results) {
        if (r.status === "rejected") continue;
        if (r.value === "rate_limited") { rateLimited = true; continue; }
        updates.push(r.value);
      }

      // Batch write all updates — inline exploit for high scorers
      const now = new Date().toISOString();
      await Promise.all(updates.map(u => {
        const payload: any = { stage: u.stage, updated_at: now };
        if (u.discard_reason) payload.discard_reason = u.discard_reason;
        if (u.hydration) payload.hydration = u.hydration;
        if (u.candidate_repos) payload.candidate_repos = u.candidate_repos;
        if (u.repo_signals) payload.repo_signals = u.repo_signals;
        if (u.pre_score !== undefined) payload.pre_score = u.pre_score;
        if (u.pre_confidence !== undefined) payload.pre_confidence = u.pre_confidence;
        if (u.stage === "scored" && (u.pre_score || 0) >= INLINE_EXPLOIT_THRESHOLD) {
          payload.selection_tier = "exploit";
        }
        return sb.from("longlist_candidates").update(payload).eq("id", u.id);
      }));

      totalProcessed += updates.length;
    }
  }

  // ─── Selection stage (global trigger) ───
  const { count: remaining } = await sb
    .from("longlist_candidates").select("id", { count: "exact", head: true })
    .eq("longlist_run_id", longlistRunId).in("stage", ["pending", "hydrated"]);

  if (remaining === 0 && !rateLimited && !timedOut()) {
    // Check if ALL candidates across ALL runs are processed
    const { count: globalPending } = await sb
      .from("longlist_candidates").select("id", { count: "exact", head: true })
      .in("stage", ["pending", "hydrated"]);

    if (globalPending === 0) {
      // Stage 3: Global selection across all runs
      // Count how many exploit candidates were already assigned inline across all runs
      const { count: inlineExploitCount } = await sb
        .from("longlist_candidates").select("id", { count: "exact", head: true })
        .eq("selection_tier", "exploit");

      const exploitSlots = Math.max(0, 800 - (inlineExploitCount || 0));

      // Get scored candidates without a selection_tier across ALL runs, ordered by score
      const { data: unassigned } = await sb
        .from("longlist_candidates").select("id, pre_score, pre_confidence, repo_signals")
        .eq("stage", "scored").is("selection_tier", null)
        .order("pre_score", { ascending: false }).range(0, 9999);

      if (unassigned && unassigned.length > 0) {
        // Fill remaining exploit slots
        if (exploitSlots > 0) {
          const fillExploitIds = unassigned.slice(0, exploitSlots).map((c) => c.id);
          for (let i = 0; i < fillExploitIds.length; i += 500) {
            await sb.from("longlist_candidates")
              .update({ selection_tier: "exploit", updated_at: new Date().toISOString() })
              .in("id", fillExploitIds.slice(i, i + 500));
          }
        }

        // Explore tier from remaining unassigned
        const afterExploit = unassigned.slice(exploitSlots);
        const exploreCandidates = afterExploit
          .filter((c) => {
            const sigs = c.repo_signals as Record<string, any>;
            return Object.values(sigs).reduce((sum: number, s: any) =>
              sum + (s.framework_topics?.length || 0) + (s.complex_keywords?.length || 0) + (s.recent_activity ? 1 : 0), 0) >= 2;
          }).slice(0, 200);

        if (exploreCandidates.length > 0) {
          const exploreIds = exploreCandidates.map((c) => c.id);
          for (let i = 0; i < exploreIds.length; i += 500) {
            await sb.from("longlist_candidates")
              .update({ selection_tier: "explore", updated_at: new Date().toISOString() })
              .in("id", exploreIds.slice(i, i + 500));
          }
        }

        // Leave remaining scored candidates as-is (no selection_tier)
        // Client-side dynamic selection handles ranking
      }

      console.log(`Global Stage 3: ${inlineExploitCount} inline exploit + ${exploitSlots} slots filled`);

      // Global stats
      const { count: globalTotal } = await sb.from("longlist_candidates").select("id", { count: "exact", head: true });
      const { count: globalSelected } = await sb.from("longlist_candidates").select("id", { count: "exact", head: true }).not("selection_tier", "is", null);
      const { count: globalDiscarded } = await sb.from("longlist_candidates").select("id", { count: "exact", head: true }).eq("stage", "discarded");

      await sb.from("longlist_runs").update({
        status: "done",
        progress: { stage: "done", total: globalTotal, selected: globalSelected, discarded: globalDiscarded },
        updated_at: new Date().toISOString(),
      }).eq("id", longlistRunId);

      console.log(`Longlist run ${longlistRunId} triggered global Stage 3: ${globalSelected} selected / ${globalTotal} total`);
      return;
    }

    // Current run is done but global pool still has pending — mark this run done without Stage 3
    const { count: runTotal } = await sb.from("longlist_candidates").select("id", { count: "exact", head: true }).eq("longlist_run_id", longlistRunId);
    const { count: runScored } = await sb.from("longlist_candidates").select("id", { count: "exact", head: true }).eq("longlist_run_id", longlistRunId).eq("stage", "scored");

    await sb.from("longlist_runs").update({
      status: "done",
      progress: { stage: "done_awaiting_selection", total: runTotal, scored: runScored, globalPending: globalPending },
      updated_at: new Date().toISOString(),
    }).eq("id", longlistRunId);

    console.log(`Longlist run ${longlistRunId} done (awaiting global Stage 3, ${globalPending} still pending globally)`);
    return;
  }

  // Not finished — pause
  const { count: totalCandidates } = await sb.from("longlist_candidates").select("id", { count: "exact", head: true }).eq("longlist_run_id", longlistRunId);
  const { count: scoredCount } = await sb.from("longlist_candidates").select("id", { count: "exact", head: true }).eq("longlist_run_id", longlistRunId).eq("stage", "scored");
  const { count: discardedNow } = await sb.from("longlist_candidates").select("id", { count: "exact", head: true }).eq("longlist_run_id", longlistRunId).eq("stage", "discarded");
  const { count: pendingNow } = await sb.from("longlist_candidates").select("id", { count: "exact", head: true }).eq("longlist_run_id", longlistRunId).eq("stage", "pending");

  await sb.from("longlist_runs").update({
    status: "paused",
    progress: { stage: "processing", total: totalCandidates, scored: scoredCount, discarded: discardedNow, pending: pendingNow, processed: totalProcessed },
    updated_at: new Date().toISOString(),
  }).eq("id", longlistRunId);

  console.log(`Longlist run ${longlistRunId} paused: ${totalProcessed} processed this round, ${pendingNow} pending`);

  // Auto-continue only if we made progress; stop if rate-limited with 0 progress
  if (totalProcessed > 0 || !rateLimited) {
    const functionUrl = `${SUPABASE_URL}/functions/v1/build-longlist`;
    fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ longlistRunId }),
    }).catch(err => console.error("Auto-continue failed:", err));

    console.log(`Auto-continuing longlist run ${longlistRunId}...`);
  } else {
    // Rate-limited and 0 progress — check reset time and stop
    try {
      const rlHeaders: Record<string, string> = { "User-Agent": "lovable-longlist-builder" };
      if (GITHUB_TOKEN) rlHeaders.Authorization = `Bearer ${GITHUB_TOKEN}`;
      const rlRaw = await fetch("https://api.github.com/rate_limit", { headers: rlHeaders });
      const rlData = await rlRaw.json();
      const resetAt = rlData?.rate?.reset;
      const waitMs = resetAt ? (resetAt * 1000 - Date.now()) : 3600_000;
      const waitMin = Math.ceil(waitMs / 60000);

      await sb.from("longlist_runs").update({
        status: "paused",
        progress: { stage: "rate_limited", total: totalCandidates, scored: scoredCount, discarded: discardedNow, pending: pendingNow, rate_limited: true, reset_at: resetAt, wait_minutes: waitMin },
        updated_at: new Date().toISOString(),
      }).eq("id", longlistRunId);

      console.log(`Rate limited. Resets in ${waitMin} minutes. Stopping auto-continue for ${longlistRunId}.`);
    } catch (rlErr) {
      console.error("Failed to fetch rate limit info:", rlErr);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { longlistRunId } = await req.json();
    if (!longlistRunId) throw new Error("longlistRunId required");

    EdgeRuntime.waitUntil(
      processLonglist(longlistRunId).catch(async (error) => {
        console.error(`Longlist run ${longlistRunId} failed:`, error);
        const sb = createSb();
        await sb.from("longlist_runs").update({
          status: "failed",
          progress: { error: error.message },
          updated_at: new Date().toISOString(),
        }).eq("id", longlistRunId);
      })
    );

    return new Response(JSON.stringify({ status: "accepted", longlistRunId }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("build-longlist error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
