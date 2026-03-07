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
const startTime = Date.now();
function timeLeft() { return DEADLINE_MS - (Date.now() - startTime); }
function timedOut() { return timeLeft() < 5000; }

async function githubFetch(url: string) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "lovable-longlist-builder",
  };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (res.status === 403 || res.status === 429) {
    console.warn("GitHub rate limit hit, pausing");
    return null;
  }
  return res;
}

serve(async (req) => {
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
    const cursor = progress.cursor || 0; // index into candidate list
    const currentStage = progress.stage || "init";

    // Update status to running
    await sb.from("longlist_runs").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", longlistRunId);

    // ─── STAGE 0: Seed candidates from repos ───
    if (currentStage === "init" || currentStage === "seeding") {
      // Check if candidates already seeded
      const { count } = await sb.from("longlist_candidates").select("id", { count: "exact", head: true }).eq("longlist_run_id", longlistRunId);
      
      if (!count || count === 0) {
        // Get unique logins from repos
        let query = sb.from("repos").select("owner_login");
        if (run.source_run_id) {
          query = query.eq("run_id", run.source_run_id);
        }
        const { data: repos } = await query;
        const logins = [...new Set((repos || []).map((r: any) => r.owner_login))];

        // Batch insert candidates
        const batchSize = 500;
        for (let i = 0; i < logins.length; i += batchSize) {
          const batch = logins.slice(i, i + batchSize).map((login) => ({
            longlist_run_id: longlistRunId,
            login,
            stage: "pending",
          }));
          await sb.from("longlist_candidates").upsert(batch, { onConflict: "longlist_run_id,login" });
        }

        await sb.from("longlist_runs").update({
          progress: { ...progress, stage: "hydrating", cursor: 0, total: logins.length, seeded: logins.length },
          updated_at: new Date().toISOString(),
        }).eq("id", longlistRunId);
      }
    }

    // ─── STAGE 1: Hydrate + select repos ───
    // Get pending/partial candidates
    const { data: candidates } = await sb
      .from("longlist_candidates")
      .select("*")
      .eq("longlist_run_id", longlistRunId)
      .in("stage", ["pending", "hydrated", "repos_selected"])
      .order("created_at", { ascending: true })
      .range(0, 999);

    let processed = 0;
    let discarded = 0;
    let rateLimited = false;

    for (const candidate of (candidates || [])) {
      if (timedOut()) break;

      if (candidate.stage === "pending") {
        // Hydrate: fetch user info from GitHub
        const userRes = await githubFetch(`https://api.github.com/users/${candidate.login}`);
        if (!userRes) { rateLimited = true; break; }
        
        if (userRes.status === 404) {
          await sb.from("longlist_candidates").update({
            stage: "discarded", discard_reason: "not_found", updated_at: new Date().toISOString(),
          }).eq("id", candidate.id);
          discarded++;
          processed++;
          continue;
        }

        const user = await userRes.json();

        // Discard orgs
        if (user.type === "Organization") {
          await sb.from("longlist_candidates").update({
            stage: "discarded", discard_reason: "organization", updated_at: new Date().toISOString(),
          }).eq("id", candidate.id);
          discarded++;
          processed++;
          continue;
        }

        // Discard inactive (no public repos, no recent activity)
        if ((user.public_repos || 0) === 0) {
          await sb.from("longlist_candidates").update({
            stage: "discarded", discard_reason: "no_repos", updated_at: new Date().toISOString(),
          }).eq("id", candidate.id);
          discarded++;
          processed++;
          continue;
        }

        // Store hydration
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

        // Fetch repos for this user (up to 100, sorted by stars)
        const reposRes = await githubFetch(`https://api.github.com/users/${candidate.login}/repos?per_page=100&sort=stars&direction=desc&type=owner`);
        if (!reposRes) { rateLimited = true; break; }
        const userRepos = await reposRes.json();

        if (!Array.isArray(userRepos) || userRepos.length === 0) {
          await sb.from("longlist_candidates").update({
            stage: "discarded", discard_reason: "no_accessible_repos",
            hydration, updated_at: new Date().toISOString(),
          }).eq("id", candidate.id);
          discarded++;
          processed++;
          continue;
        }

        // Select up to 8 repos: top by stars, most recent, any with "pinned" topics
        const sorted = userRepos
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

        await sb.from("longlist_candidates").update({
          stage: "hydrated",
          hydration,
          candidate_repos: candidateRepos,
          updated_at: new Date().toISOString(),
        }).eq("id", candidate.id);
        processed++;
      }

      if (timedOut()) break;

      // ─── STAGE 2: Parse repos for signals ───
      if (candidate.stage === "hydrated" || (candidate.stage === "pending" && processed > 0)) {
        // Re-fetch if we just updated
        const { data: fresh } = await sb.from("longlist_candidates").select("*").eq("id", candidate.id).single();
        if (!fresh || fresh.stage !== "hydrated") continue;

        const repos = (fresh.candidate_repos || []) as any[];
        const signals: Record<string, any> = {};
        let hasReact = false;
        let hasTS = false;
        let totalDepthScore = 0;

        for (const repo of repos) {
          if (timedOut()) break;

          const repoSignals: Record<string, any> = {};

          // Check language
          if (repo.language === "TypeScript") hasTS = true;

          // Check topics for React
          const topics = (repo.topics || []) as string[];
          if (topics.some((t: string) => ["react", "reactjs", "next", "nextjs", "remix", "vite"].includes(t.toLowerCase()))) {
            hasReact = true;
          }

          // Fetch package.json
          const pkgRes = await githubFetch(`https://api.github.com/repos/${repo.full_name}/contents/package.json`);
          if (!pkgRes) { rateLimited = true; break; }
          
          if (pkgRes.status === 200) {
            try {
              const pkgFile = await pkgRes.json();
              const content = atob(pkgFile.content.replace(/\n/g, ""));
              const pkg = JSON.parse(content);
              const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

              // React detection
              if (allDeps["react"] || allDeps["next"] || allDeps["remix"] || allDeps["gatsby"]) {
                hasReact = true;
              }

              // TypeScript detection
              if (allDeps["typescript"]) hasTS = true;

              // Complex UI libs
              const complexLibs = ["@dnd-kit/core", "react-dnd", "react-beautiful-dnd", "xstate", "@xstate/react",
                "framer-motion", "react-spring", "d3", "three", "react-three-fiber", "@react-three/fiber",
                "prosemirror", "tiptap", "@tiptap/core", "slate", "lexical", "react-flow-renderer", "reactflow",
                "zustand", "jotai", "recoil", "mobx", "@tanstack/react-query", "@tanstack/react-table",
                "react-hook-form", "react-virtualized", "react-window", "@tanstack/react-virtual"];
              const foundComplex = Object.keys(allDeps).filter((d) => complexLibs.includes(d));
              repoSignals.complex_libs = foundComplex;
              if (foundComplex.length > 0) totalDepthScore += foundComplex.length * 2;

              // Testing
              const testLibs = ["jest", "vitest", "@testing-library/react", "cypress", "playwright", "@playwright/test"];
              const foundTests = Object.keys(allDeps).filter((d) => testLibs.includes(d));
              repoSignals.testing = foundTests;
              if (foundTests.length > 0) totalDepthScore += 3;

              // CI/CD signals from scripts
              const scripts = pkg.scripts || {};
              if (scripts.test) totalDepthScore += 1;
              if (scripts.lint) totalDepthScore += 1;
              if (scripts["type-check"] || scripts.typecheck) totalDepthScore += 1;

              // Storybook
              if (allDeps["@storybook/react"] || allDeps["storybook"] || scripts.storybook) {
                repoSignals.storybook = true;
                totalDepthScore += 3;
              }

              // Anti-boilerplate: check for custom configs
              repoSignals.dep_count = Object.keys(allDeps).length;
            } catch {
              // Invalid package.json, skip
            }
          }

          // Check for CI, tests dir, changelog via tree (lightweight)
          const treeRes = await githubFetch(`https://api.github.com/repos/${repo.full_name}/git/trees/HEAD?recursive=0`);
          if (!treeRes) { rateLimited = true; break; }

          if (treeRes.status === 200) {
            const tree = await treeRes.json();
            const paths = ((tree.tree || []) as any[]).map((t: any) => t.path?.toLowerCase() || "");

            if (paths.some((p: string) => p.includes(".github") || p.includes("ci") || p === ".circleci")) {
              repoSignals.has_ci = true;
              totalDepthScore += 2;
            }
            if (paths.some((p: string) => p.includes("changelog") || p.includes("changes"))) {
              repoSignals.has_changelog = true;
              totalDepthScore += 1;
            }
            if (paths.some((p: string) => p === "src" || p === "lib" || p === "packages")) {
              repoSignals.has_src = true;
            }
            if (paths.some((p: string) => p.includes("test") || p.includes("spec") || p === "__tests__")) {
              repoSignals.has_tests_dir = true;
              totalDepthScore += 2;
            }
            if (paths.some((p: string) => p === "tsconfig.json")) {
              hasTS = true;
            }
          }

          signals[repo.full_name] = repoSignals;
        }

        if (rateLimited) break;

        // Compute pre-score
        let preScore = 0;
        let preConfidence = 0;

        if (hasReact) preScore += 20;
        if (hasTS) preScore += 15;
        preScore += Math.min(totalDepthScore, 40); // cap depth contribution

        // Stars bonus (across selected repos)
        const totalStars = repos.reduce((s: number, r: any) => s + (r.stars || 0), 0);
        if (totalStars >= 100) preScore += 10;
        else if (totalStars >= 20) preScore += 5;

        // Followers bonus
        const hydration = fresh.hydration as any;
        if (hydration?.followers >= 50) preScore += 5;
        if (hydration?.followers >= 200) preScore += 5;

        // Confidence based on how much data we got
        const parsedRepos = Object.keys(signals).length;
        preConfidence = Math.min(1, parsedRepos / Math.max(repos.length, 1));
        if (hasReact && hasTS) preConfidence = Math.min(1, preConfidence + 0.2);

        await sb.from("longlist_candidates").update({
          stage: "scored",
          repo_signals: signals,
          pre_score: preScore,
          pre_confidence: Math.round(preConfidence * 100) / 100,
          updated_at: new Date().toISOString(),
        }).eq("id", candidate.id);
        processed++;
      }
    }

    // ─── STAGE 3: Selection (only when all candidates are scored/discarded) ───
    const { count: remaining } = await sb
      .from("longlist_candidates")
      .select("id", { count: "exact", head: true })
      .eq("longlist_run_id", longlistRunId)
      .in("stage", ["pending", "hydrated", "repos_selected"]);

    if (remaining === 0 && !rateLimited && !timedOut()) {
      // All processed — do selection
      const { data: scored } = await sb
        .from("longlist_candidates")
        .select("id, pre_score, pre_confidence, hydration, repo_signals")
        .eq("longlist_run_id", longlistRunId)
        .eq("stage", "scored")
        .order("pre_score", { ascending: false });

      if (scored && scored.length > 0) {
        // Exploit: top 800 by score
        const exploitIds = scored.slice(0, 800).map((c) => c.id);
        if (exploitIds.length > 0) {
          // Batch update in chunks
          for (let i = 0; i < exploitIds.length; i += 500) {
            await sb.from("longlist_candidates")
              .update({ selection_tier: "exploit", updated_at: new Date().toISOString() })
              .in("id", exploitIds.slice(i, i + 500));
          }
        }

        // Explore: from remaining scored, pick up to 200 with diverse profiles
        const remainingScored = scored.slice(800);
        // Stratified: high depth (many signals) but lower star count
        const exploreCandidates = remainingScored
          .filter((c) => {
            const signalCount = Object.values(c.repo_signals as Record<string, any>)
              .reduce((sum: number, s: any) => sum + (s.complex_libs?.length || 0) + (s.testing?.length || 0) + (s.has_ci ? 1 : 0), 0);
            return signalCount >= 3; // at least some depth signals
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
    const { count: pendingNow } = await sb.from("longlist_candidates").select("id", { count: "exact", head: true }).eq("longlist_run_id", longlistRunId).in("stage", ["pending", "hydrated"]);

    await sb.from("longlist_runs").update({
      status: "paused",
      progress: { stage: "hydrating", total: totalCandidates, scored: scoredCount, discarded: discardedNow, pending: pendingNow, processed },
      updated_at: new Date().toISOString(),
    }).eq("id", longlistRunId);

    return new Response(JSON.stringify({ status: "paused", processed, scored: scoredCount, pending: pendingNow, rateLimited }), {
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
