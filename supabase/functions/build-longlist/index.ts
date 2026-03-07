import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
const BATCH_SIZE = 5; // concurrent candidates
const DB_FLUSH_SIZE = 50; // flush DB every N candidates

serve(async (req) => {
  const startTime = Date.now();
  function timeLeft() { return DEADLINE_MS - (Date.now() - startTime); }
  function timedOut() { return timeLeft() < 8000; }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { longlistRunId } = await req.json();
    if (!longlistRunId) throw new Error("longlistRunId required");

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the run
    const { data: run, error: runErr } = await sb
      .from("longlist_runs")
      .select("*")
      .eq("id", longlistRunId)
      .single();
    if (runErr) throw runErr;

    const progress = (run.progress || {}) as Record<string, any>;

    // Update status to running
    await sb.from("longlist_runs").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", longlistRunId);

    // ─── STAGE 0: Seed candidates from repos ───
    const { count: existingCount } = await sb
      .from("longlist_candidates")
      .select("id", { count: "exact", head: true })
      .eq("longlist_run_id", longlistRunId);

    if (!existingCount || existingCount === 0) {
      let query = sb.from("repos").select("owner_login");
      if (run.source_run_id) {
        query = query.eq("run_id", run.source_run_id);
      }
      const { data: repos } = await query;
      const logins = [...new Set((repos || []).map((r: any) => r.owner_login))];

      for (let i = 0; i < logins.length; i += 500) {
        const batch = logins.slice(i, i + 500).map((login) => ({
          longlist_run_id: longlistRunId,
          login,
          stage: "pending",
        }));
        await sb.from("longlist_candidates").upsert(batch, { onConflict: "longlist_run_id,login" });
      }

      await sb.from("longlist_runs").update({
        progress: { ...progress, stage: "processing", cursor: 0, total: logins.length, seeded: logins.length },
        updated_at: new Date().toISOString(),
      }).eq("id", longlistRunId);
    }

    // ─── STAGE 1+2 combined: Hydrate + lightweight score in one pass ───
    let totalProcessed = 0;
    let rateLimited = false;
    const pendingUpdates: any[] = [];

    async function flushUpdates() {
      if (pendingUpdates.length === 0) return;
      // Upsert in chunks
      const toFlush = pendingUpdates.splice(0, pendingUpdates.length);
      for (let i = 0; i < toFlush.length; i += 100) {
        const chunk = toFlush.slice(i, i + 100);
        // We need individual updates since each row has different data
        await Promise.all(chunk.map((u: any) =>
          sb.from("longlist_candidates").update(u.data).eq("id", u.id)
        ));
      }
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

    async function processCandidate(candidate: any): Promise<{ processed: boolean; discarded: boolean; rateLimited: boolean }> {
      // Fetch user profile + repos in parallel
      const [userRes, reposRes] = await Promise.all([
        githubFetch(`https://api.github.com/users/${candidate.login}`),
        githubFetch(`https://api.github.com/users/${candidate.login}/repos?per_page=100&sort=stars&direction=desc&type=owner`),
      ]);

      if (!userRes || !reposRes) return { processed: false, discarded: false, rateLimited: true };

      // User not found
      if (userRes.status === 404) {
        pendingUpdates.push({ id: candidate.id, data: { stage: "discarded", discard_reason: "not_found", updated_at: new Date().toISOString() } });
        return { processed: true, discarded: true, rateLimited: false };
      }

      const user = await userRes.json();
      const userRepos = await reposRes.json();

      // Discard orgs
      if (user.type === "Organization") {
        pendingUpdates.push({ id: candidate.id, data: { stage: "discarded", discard_reason: "organization", updated_at: new Date().toISOString() } });
        return { processed: true, discarded: true, rateLimited: false };
      }

      // Discard no repos
      if ((user.public_repos || 0) === 0 || !Array.isArray(userRepos) || userRepos.length === 0) {
        pendingUpdates.push({ id: candidate.id, data: { stage: "discarded", discard_reason: "no_repos", updated_at: new Date().toISOString() } });
        return { processed: true, discarded: true, rateLimited: false };
      }

      // Hydration data
      const hydration = {
        name: user.name,
        avatar_url: user.avatar_url,
        html_url: user.html_url,
        bio: user.bio,
        blog: user.blog,
        email: user.email,
        twitter_username: user.twitter_username,
        public_repos: user.public_repos,
        followers: user.followers,
        company: user.company,
        location: user.location,
        created_at: user.created_at,
        updated_at: user.updated_at,
      };

      // Select up to 8 repos (non-fork, non-archived)
      const sorted = (userRepos as any[])
        .filter((r: any) => !r.fork && !r.archived)
        .sort((a: any, b: any) => (b.stargazers_count || 0) - (a.stargazers_count || 0));

      const selected: any[] = [];
      const seen = new Set<string>();

      // Top 4 by stars
      for (const r of sorted.slice(0, 4)) {
        if (!seen.has(r.full_name)) { selected.push(r); seen.add(r.full_name); }
      }
      // Most recently pushed (up to 2)
      const byPush = [...sorted].sort((a: any, b: any) =>
        new Date(b.pushed_at || 0).getTime() - new Date(a.pushed_at || 0).getTime()
      );
      for (const r of byPush.slice(0, 2)) {
        if (!seen.has(r.full_name) && selected.length < 8) { selected.push(r); seen.add(r.full_name); }
      }
      // Fill to 8
      for (const r of sorted) {
        if (selected.length >= 8) break;
        if (!seen.has(r.full_name)) { selected.push(r); seen.add(r.full_name); }
      }

      // Build candidate_repos metadata
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

      // ─── Lightweight scoring from metadata only ───
      let preScore = 0;
      let hasReact = false;
      let hasTS = false;
      const signals: Record<string, any> = {};
      const sixMonthsAgo = Date.now() - 6 * 30 * 24 * 60 * 60 * 1000;

      for (const repo of candidateRepos) {
        const repoSignals: Record<string, any> = {};

        // Language detection
        if (repo.language === "TypeScript") { hasTS = true; repoSignals.typescript = true; }
        if (repo.language === "JavaScript") { repoSignals.javascript = true; }

        // Topic-based React/framework detection
        const topics = (repo.topics || []) as string[];
        const frameworkTopics = topics.filter((t: string) =>
          ["react", "reactjs", "next", "nextjs", "remix", "vite", "gatsby", "vue", "angular", "svelte"].includes(t.toLowerCase())
        );
        if (frameworkTopics.length > 0) {
          repoSignals.framework_topics = frameworkTopics;
          if (topics.some((t: string) => ["react", "reactjs", "next", "nextjs", "remix", "vite", "gatsby"].includes(t.toLowerCase()))) {
            hasReact = true;
          }
        }

        // Description keyword matching for complex libs
        const desc = (repo.description || "").toLowerCase();
        const complexKeywords = ["drag", "drop", "editor", "rich text", "animation", "3d", "chart", "graph", "dashboard", "cms", "state management"];
        const matchedKeywords = complexKeywords.filter(k => desc.includes(k));
        if (matchedKeywords.length > 0) repoSignals.complex_keywords = matchedKeywords;

        // Stars
        repoSignals.stars = repo.stars;

        // Recent activity
        if (repo.pushed_at && new Date(repo.pushed_at).getTime() > sixMonthsAgo) {
          repoSignals.recent_activity = true;
        }

        // Size (non-trivial)
        if (repo.size > 500) repoSignals.non_trivial_size = true;

        // GitHub Pages
        if (repo.has_pages) repoSignals.has_pages = true;

        signals[repo.full_name] = repoSignals;
      }

      // Score computation
      if (hasReact) preScore += 20;
      if (hasTS) preScore += 15;

      // Any JS repo (if not already TS)
      if (!hasTS && candidateRepos.some(r => r.language === "JavaScript")) preScore += 10;

      // Stars across repos
      const totalStars = candidateRepos.reduce((s, r) => s + (r.stars || 0), 0);
      if (totalStars >= 100) preScore += 10;
      else if (totalStars >= 20) preScore += 5;

      // Followers
      if (user.followers >= 200) preScore += 10;
      else if (user.followers >= 50) preScore += 5;

      // Recent activity bonus
      const recentRepos = candidateRepos.filter(r => r.pushed_at && new Date(r.pushed_at).getTime() > sixMonthsAgo);
      if (recentRepos.length > 0) preScore += 5;

      // Non-trivial size repos
      const nonTrivialCount = candidateRepos.filter(r => r.size > 500).length;
      if (nonTrivialCount >= 3) preScore += 5;

      // Multiple non-fork repos
      if (sorted.length > 5) preScore += 5;

      // GitHub Pages
      if (candidateRepos.some(r => r.has_pages)) preScore += 2;

      // Complex keywords in descriptions
      const totalComplexKeywords = Object.values(signals).reduce((sum: number, s: any) => sum + (s.complex_keywords?.length || 0), 0);
      if (totalComplexKeywords > 0) preScore += Math.min(totalComplexKeywords * 3, 10);

      // Confidence based on data quality
      let preConfidence = 0.5; // baseline
      if (candidateRepos.length >= 4) preConfidence += 0.2;
      if (hasReact && hasTS) preConfidence += 0.2;
      if (totalStars >= 10) preConfidence += 0.1;
      preConfidence = Math.min(1, preConfidence);

      pendingUpdates.push({
        id: candidate.id,
        data: {
          stage: "scored",
          hydration,
          candidate_repos: candidateRepos,
          repo_signals: signals,
          pre_score: preScore,
          pre_confidence: Math.round(preConfidence * 100) / 100,
          updated_at: new Date().toISOString(),
        },
      });

      return { processed: true, discarded: false, rateLimited: false };
    }

    // Process candidates in parallel batches
    while (!timedOut() && !rateLimited) {
      const { data: batch } = await sb
        .from("longlist_candidates")
        .select("id, login, stage")
        .eq("longlist_run_id", longlistRunId)
        .eq("stage", "pending")
        .order("created_at", { ascending: true })
        .range(0, BATCH_SIZE - 1);

      if (!batch || batch.length === 0) break;

      const results = await Promise.all(batch.map(c => processCandidate(c)));

      for (const r of results) {
        if (r.rateLimited) rateLimited = true;
        if (r.processed) totalProcessed++;
      }

      // Flush if buffer is large enough
      if (pendingUpdates.length >= DB_FLUSH_SIZE) {
        await flushUpdates();
      }
    }

    // Final flush
    await flushUpdates();

    // ─── STAGE 3: Selection (only when all candidates are scored/discarded) ───
    const { count: remaining } = await sb
      .from("longlist_candidates")
      .select("id", { count: "exact", head: true })
      .eq("longlist_run_id", longlistRunId)
      .in("stage", ["pending", "hydrated"]);

    if (remaining === 0 && !rateLimited && !timedOut()) {
      const { data: scored } = await sb
        .from("longlist_candidates")
        .select("id, pre_score, pre_confidence, repo_signals")
        .eq("longlist_run_id", longlistRunId)
        .eq("stage", "scored")
        .order("pre_score", { ascending: false })
        .range(0, 9999);

      if (scored && scored.length > 0) {
        // Exploit: top 800 by score
        const exploitIds = scored.slice(0, 800).map((c) => c.id);
        for (let i = 0; i < exploitIds.length; i += 500) {
          await sb.from("longlist_candidates")
            .update({ selection_tier: "exploit", updated_at: new Date().toISOString() })
            .in("id", exploitIds.slice(i, i + 500));
        }

        // Explore: from remaining scored, pick up to 200 with diverse signals
        const remainingScored = scored.slice(800);
        const exploreCandidates = remainingScored
          .filter((c) => {
            const sigs = c.repo_signals as Record<string, any>;
            const signalCount = Object.values(sigs)
              .reduce((sum: number, s: any) =>
                sum + (s.framework_topics?.length || 0) + (s.complex_keywords?.length || 0) + (s.recent_activity ? 1 : 0), 0);
            return signalCount >= 2;
          })
          .slice(0, 200);

        if (exploreCandidates.length > 0) {
          const exploreIds = exploreCandidates.map((c) => c.id);
          for (let i = 0; i < exploreIds.length; i += 500) {
            await sb.from("longlist_candidates")
              .update({ selection_tier: "explore", updated_at: new Date().toISOString() })
              .in("id", exploreIds.slice(i, i + 500));
          }
        }

        // Discard the rest
        await sb.from("longlist_candidates")
          .update({ stage: "discarded", discard_reason: "below_threshold", selection_tier: null, updated_at: new Date().toISOString() })
          .eq("longlist_run_id", longlistRunId)
          .eq("stage", "scored")
          .is("selection_tier", null);
      }

      // Mark run as done
      const { count: totalCount } = await sb.from("longlist_candidates").select("id", { count: "exact", head: true }).eq("longlist_run_id", longlistRunId);
      const { count: selectedCount } = await sb.from("longlist_candidates").select("id", { count: "exact", head: true }).eq("longlist_run_id", longlistRunId).not("selection_tier", "is", null);
      const { count: discardedCount } = await sb.from("longlist_candidates").select("id", { count: "exact", head: true }).eq("longlist_run_id", longlistRunId).eq("stage", "discarded");

      await sb.from("longlist_runs").update({
        status: "done",
        progress: { stage: "done", total: totalCount, selected: selectedCount, discarded: discardedCount },
        updated_at: new Date().toISOString(),
      }).eq("id", longlistRunId);

      return new Response(JSON.stringify({ status: "done", selected: selectedCount, total: totalCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Not finished — save progress and pause
    const { count: totalCandidates } = await sb.from("longlist_candidates").select("id", { count: "exact", head: true }).eq("longlist_run_id", longlistRunId);
    const { count: scoredCount } = await sb.from("longlist_candidates").select("id", { count: "exact", head: true }).eq("longlist_run_id", longlistRunId).eq("stage", "scored");
    const { count: discardedNow } = await sb.from("longlist_candidates").select("id", { count: "exact", head: true }).eq("longlist_run_id", longlistRunId).eq("stage", "discarded");
    const { count: pendingNow } = await sb.from("longlist_candidates").select("id", { count: "exact", head: true }).eq("longlist_run_id", longlistRunId).eq("stage", "pending");

    await sb.from("longlist_runs").update({
      status: "paused",
      progress: { stage: "processing", total: totalCandidates, scored: scoredCount, discarded: discardedNow, pending: pendingNow, processed: totalProcessed },
      updated_at: new Date().toISOString(),
    }).eq("id", longlistRunId);

    return new Response(JSON.stringify({ status: "paused", processed: totalProcessed, scored: scoredCount, pending: pendingNow, rateLimited }), {
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
