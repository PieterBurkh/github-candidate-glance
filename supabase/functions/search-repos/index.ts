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
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function githubFetch(url: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "lovable-repo-scanner",
  };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return fetch(url, { headers });
}

// ── Net definitions ──────────────────────────────────────────────────
interface NetDef {
  id: string;
  label: string;
  queries: string[];
  starBands: string[];
  sorts: string[];
}

const BASE = "archived:false fork:false";

const ALL_NETS: NetDef[] = [
  {
    id: "core-stack",
    label: "Core Stack",
    queries: [
      `topic:react language:TypeScript ${BASE}`,
      `react typescript in:name,description,readme ${BASE}`,
    ],
    starBands: ["5..20", "20..50", "50..200", "200..500", "500..2000", ">=2000"],
    sorts: ["stars", "updated"],
  },
  {
    id: "meta-frameworks",
    label: "Meta-frameworks",
    queries: [
      `topic:nextjs language:TypeScript ${BASE}`,
      `vite react typescript in:name,description,readme ${BASE}`,
      `remix react typescript in:name,description,readme ${BASE}`,
    ],
    starBands: ["5..20", "20..50", "50..200", "200..500", "500..2000", ">=2000"],
    sorts: ["stars", "updated"],
  },
  {
    id: "component-libs",
    label: "Component Libraries",
    queries: [
      `storybook react in:readme ${BASE}`,
      `docusaurus react in:readme ${BASE}`,
      `typedoc typescript in:readme ${BASE}`,
    ],
    starBands: [">=5"],
    sorts: ["stars", "updated"],
  },
  {
    id: "versioning",
    label: "Versioning",
    queries: [
      `changesets in:readme react ${BASE}`,
      `semantic-release in:readme ${BASE}`,
      `changelog in:readme react typescript ${BASE}`,
    ],
    starBands: [">=3"],
    sorts: ["stars", "updated"],
  },
  {
    id: "performance",
    label: "Performance",
    queries: [
      `web-vitals in:readme react ${BASE}`,
      `lighthouse in:readme react ${BASE}`,
      `profiler in:readme react ${BASE}`,
    ],
    starBands: [">=2"],
    sorts: ["stars", "updated"],
  },
  {
    id: "a11y",
    label: "Accessibility",
    queries: [
      `wcag in:readme react ${BASE}`,
      `aria in:readme react ${BASE}`,
      `a11y in:readme react ${BASE}`,
    ],
    starBands: [">=1"],
    sorts: ["stars", "updated"],
  },
  {
    id: "complex-ui",
    label: "Complex UI",
    queries: [
      `bpmn in:readme react ${BASE}`,
      `reactflow in:readme ${BASE}`,
      `xstate in:readme react ${BASE}`,
    ],
    starBands: [">=1"],
    sorts: ["stars", "updated"],
  },
  {
    id: "crdt-realtime",
    label: "CRDT / Realtime",
    queries: [
      `yjs in:readme react ${BASE}`,
      `automerge in:readme react ${BASE}`,
      `crdt in:readme ${BASE}`,
    ],
    starBands: [">=1"],
    sorts: ["stars", "updated"],
  },
  {
    id: "wasm",
    label: "WASM",
    queries: [
      `webassembly in:readme react ${BASE}`,
      `wasm-pack in:readme ${BASE}`,
      `wasm-bindgen in:readme ${BASE}`,
    ],
    starBands: [">=1"],
    sorts: ["stars", "updated"],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────

const SOFT_DEADLINE_MS = 100_000; // 100s — leave headroom for cleanup + self-invoke
const MAX_CALLS_PER_PASS = 40; // ~40 calls × 2.5s ≈ 100s
const FLUSH_INTERVAL = 20;
const MAX_GITHUB_PAGE = 34;
const BASE_DELAY_MS = 2500; // 2.5s between calls ≈ 24 req/min (under 30/min limit)

interface Cursor {
  netIdx: number;
  queryIdx: number;
  bandIdx: number;
  sortIdx: number;
  page: number;
}

function watermarkKey(netId: string, queryIdx: number, bandIdx: number, sortIdx: number): string {
  return `${netId}|${queryIdx}|${bandIdx}|${sortIdx}`;
}

async function flushRepos(
  supabase: ReturnType<typeof createClient>,
  repoMap: Map<string, any>,
  flushedKeys: Set<string>
) {
  const toInsert: any[] = [];
  for (const [key, val] of repoMap) {
    if (!flushedKeys.has(key)) {
      toInsert.push(val);
      flushedKeys.add(key);
    }
  }
  if (toInsert.length === 0) return;

  const batchSize = 50;
  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);
    const { error } = await supabase.from("repos").upsert(batch, {
      onConflict: "run_id,full_name",
      ignoreDuplicates: false,
    });
    if (error) {
      const { error: insertErr } = await supabase.from("repos").insert(batch);
      if (insertErr) console.error("Repo insert error:", insertErr.message);
    }
  }
}

function shouldSkip(
  cursor: Cursor | null,
  netIdx: number,
  queryIdx: number,
  bandIdx: number,
  sortIdx: number,
  page: number
): boolean {
  if (!cursor) return false;
  if (netIdx < cursor.netIdx) return true;
  if (netIdx > cursor.netIdx) return false;
  if (queryIdx < cursor.queryIdx) return true;
  if (queryIdx > cursor.queryIdx) return false;
  if (bandIdx < cursor.bandIdx) return true;
  if (bandIdx > cursor.bandIdx) return false;
  if (sortIdx < cursor.sortIdx) return true;
  if (sortIdx > cursor.sortIdx) return false;
  if (page < cursor.page) return true;
  return false;
}

async function loadWatermarks(
  supabase: ReturnType<typeof createClient>
): Promise<Record<string, number>> {
  const { data: lastRun } = await supabase
    .from("runs")
    .select("search_params")
    .in("status", ["completed", "paused", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!lastRun?.search_params) return {};
  const params = lastRun.search_params as Record<string, any>;
  return (params.page_watermarks as Record<string, number>) || {};
}

// ── Self-invoke to continue automatically ────────────────────────────
async function selfInvoke(runId: string) {
  const url = `${SUPABASE_URL}/functions/v1/search-repos`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ runId, _auto: true }),
    });
    // Consume body to prevent resource leak
    await res.text();
    console.log(`Self-invoked continuation for run ${runId}, status: ${res.status}`);
  } catch (e) {
    console.error(`Self-invoke failed for run ${runId}:`, e.message);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let runId: string | null = null;
  let shouldAutoContinue = false;
  let userPaused = false;
  let totalRepos = 0;
  let succeeded = false;
  let netsToRun: NetDef[] = [];
  let perPage = 30;
  let maxPages = 1;
  let savedParams: any = {};
  let lastCursor: Cursor | null = null;
  let resumeCount = 0;
  let currentWatermarks: Record<string, number> = {};

  try {
    const body = await req.json().catch(() => ({}));
    const resumeRunId = body.runId as string | undefined;
    const isAutoInvoke = body._auto === true;
    let cursor: Cursor | null = null;
    let preloadedKeys: Set<string> | undefined;

    const priorWatermarks = await loadWatermarks(supabase);
    currentWatermarks = { ...priorWatermarks };
    console.log(`Loaded ${Object.keys(priorWatermarks).length} prior watermarks`);

    if (resumeRunId) {
      // ── Resume existing run ──
      const { data: existingRun, error: loadErr } = await supabase
        .from("runs")
        .select("*")
        .eq("id", resumeRunId)
        .single();
      if (loadErr || !existingRun) throw new Error(`Run not found: ${resumeRunId}`);

      // If user explicitly paused and this is an auto-invoke, abort
      if (existingRun.status === "paused" && isAutoInvoke) {
        const phase = (existingRun.search_params as any)?.phase;
        if (phase === "user_paused") {
          console.log(`Run ${resumeRunId} was user-paused, skipping auto-continue`);
          return new Response(
            JSON.stringify({ runId: resumeRunId, skipped: true, reason: "user_paused" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      runId = existingRun.id;
      savedParams = existingRun.search_params || {};
      cursor = savedParams.cursor || null;
      perPage = savedParams.perPage || 30;
      maxPages = savedParams.maxPages || 1;
      resumeCount = (savedParams.resume_count || 0) + 1;

      if (savedParams.page_watermarks) {
        currentWatermarks = { ...priorWatermarks, ...savedParams.page_watermarks };
      }

      const netIds = savedParams.nets || [];
      netsToRun = netIds.length > 0
        ? ALL_NETS.filter((n) => netIds.includes(n.id))
        : ALL_NETS;

      await supabase.from("runs").update({
        status: "running",
        updated_at: new Date().toISOString(),
        search_params: {
          ...savedParams,
          resume_count: resumeCount,
          last_checkpoint_at: new Date().toISOString(),
          phase: isAutoInvoke ? "auto_continuing" : "resuming",
        },
      }).eq("id", runId);

      // Load already-flushed repo keys
      const PAGE_SIZE = 1000;
      const flushedRepos: { full_name: string }[] = [];
      let from = 0;
      while (true) {
        const { data } = await supabase
          .from("repos")
          .select("full_name")
          .eq("run_id", runId)
          .range(from, from + PAGE_SIZE - 1);
        if (!data || data.length === 0) break;
        flushedRepos.push(...data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      preloadedKeys = new Set(flushedRepos.map((r) => r.full_name));
      totalRepos = savedParams.repos_found || preloadedKeys.size;

      console.log(`Resuming run ${runId}: cursor=${JSON.stringify(cursor)}, preloaded=${preloadedKeys.size} repos, resumeCount=${resumeCount}, auto=${isAutoInvoke}`);
    } else {
      // ── New run ──
      const requestedNets = body.nets;
      perPage = body.perPage || 30;
      maxPages = body.maxPages || 1;

      netsToRun = requestedNets && requestedNets.length > 0
        ? ALL_NETS.filter((n) => requestedNets.includes(n.id))
        : ALL_NETS;

      savedParams = {
        nets: netsToRun.map((n) => n.id),
        perPage,
        maxPages,
        resume_count: 0,
        phase: "starting",
        page_watermarks: currentWatermarks,
      };

      const { data: run, error: runErr } = await supabase
        .from("runs")
        .insert({ status: "running", search_params: savedParams })
        .select("id")
        .single();
      if (runErr) throw new Error(`Failed to create run: ${runErr.message}`);
      runId = run.id;
    }

    lastCursor = cursor;

    const startTime = Date.now();
    const repoMap = new Map<string, any>();
    const flushedKeys = new Set<string>();

    if (preloadedKeys) {
      for (const key of preloadedKeys) {
        flushedKeys.add(key);
      }
    }

    let queryCount = 0;
    let consecutiveErrors = 0;
    let skippedExhausted = 0;
    let chunkDone = false; // signals we hit a chunk limit and should auto-continue

    for (let netIdx = 0; netIdx < netsToRun.length; netIdx++) {
      const net = netsToRun[netIdx];
      if (chunkDone) break;

      for (let queryIdx = 0; queryIdx < net.queries.length; queryIdx++) {
        const query = net.queries[queryIdx];
        if (chunkDone) break;

        for (let bandIdx = 0; bandIdx < net.starBands.length; bandIdx++) {
          const band = net.starBands[bandIdx];
          if (chunkDone) break;

          for (let sortIdx = 0; sortIdx < net.sorts.length; sortIdx++) {
            const sort = net.sorts[sortIdx];
            if (chunkDone) break;

            const wmKey = watermarkKey(net.id, queryIdx, bandIdx, sortIdx);
            const lastFetchedPage = priorWatermarks[wmKey] || 0;
            const maxAllowedPage = Math.floor(1000 / perPage);
            const startPage = lastFetchedPage + 1;

            if (startPage > maxAllowedPage) {
              skippedExhausted++;
              continue;
            }

            const endPage = Math.min(startPage + maxPages - 1, maxAllowedPage);

            for (let page = startPage; page <= endPage; page++) {
              // ── Chunk guards ──
              if (queryCount >= MAX_CALLS_PER_PASS) {
                console.log(`Chunk limit reached (${queryCount} calls), will auto-continue`);
                chunkDone = true;
                shouldAutoContinue = true;
                break;
              }
              if (Date.now() - startTime > SOFT_DEADLINE_MS) {
                console.log(`Time budget reached (${Math.round((Date.now() - startTime) / 1000)}s), will auto-continue`);
                chunkDone = true;
                shouldAutoContinue = true;
                break;
              }

              // Check if user requested a pause
              const { data: statusCheck } = await supabase
                .from("runs")
                .select("status, search_params")
                .eq("id", runId)
                .single();
              if (statusCheck?.status === "paused") {
                const phase = (statusCheck.search_params as any)?.phase;
                if (phase === "user_paused") {
                  console.log(`Run ${runId} pause requested by user`);
                  userPaused = true;
                  chunkDone = true;
                  break;
                }
              }

              if (shouldSkip(cursor, netIdx, queryIdx, bandIdx, sortIdx, page)) {
                continue;
              }

              lastCursor = { netIdx, queryIdx, bandIdx, sortIdx, page };

              const q = `${query} stars:${band}`;
              const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=${sort}&order=desc&per_page=${perPage}&page=${page}`;

              if (queryCount > 0) {
                await new Promise((r) => setTimeout(r, BASE_DELAY_MS));
              }

              const res = await githubFetch(url);
              queryCount++;

              if (!res.ok) {
                console.error(`Search failed [${net.id}] "${q}" sort=${sort} page=${page}: ${res.status}`);
                // Consume body
                await res.text().catch(() => {});
                consecutiveErrors++;

                if (res.status === 403 || res.status === 429) {
                  // Check rate limit headers
                  const remaining = parseInt(res.headers.get("x-ratelimit-remaining") || "999", 10);
                  const resetEpoch = parseInt(res.headers.get("x-ratelimit-reset") || "0", 10);
                  const retryAfter = parseInt(res.headers.get("retry-after") || "0", 10);

                  if (remaining === 0 && resetEpoch > 0) {
                    const waitMs = (resetEpoch * 1000) - Date.now();
                    if (waitMs > 30_000) {
                      // Rate limit won't reset soon — checkpoint and auto-continue later
                      console.log(`Rate limit resets in ${Math.round(waitMs / 1000)}s, checkpointing for auto-continue`);
                      chunkDone = true;
                      shouldAutoContinue = true;
                      lastCursor = { netIdx, queryIdx, bandIdx, sortIdx, page };
                      break;
                    }
                    // Wait for reset if it's short
                    console.log(`Rate limit resets in ${Math.round(waitMs / 1000)}s, waiting...`);
                    await new Promise((r) => setTimeout(r, Math.min(waitMs + 2000, 35_000)));
                    consecutiveErrors = 0;
                  } else if (retryAfter > 0) {
                    if (retryAfter > 30) {
                      console.log(`Retry-After: ${retryAfter}s, checkpointing for auto-continue`);
                      chunkDone = true;
                      shouldAutoContinue = true;
                      lastCursor = { netIdx, queryIdx, bandIdx, sortIdx, page };
                      break;
                    }
                    await new Promise((r) => setTimeout(r, retryAfter * 1000 + 1000));
                    consecutiveErrors = 0;
                  } else if (consecutiveErrors >= 5) {
                    // After 5 consecutive errors without clear headers, yield and auto-continue
                    console.log(`${consecutiveErrors} consecutive errors, checkpointing for auto-continue`);
                    chunkDone = true;
                    shouldAutoContinue = true;
                    lastCursor = { netIdx, queryIdx, bandIdx, sortIdx, page };
                    break;
                  } else {
                    // Short backoff
                    await new Promise((r) => setTimeout(r, 5000));
                  }
                }
                continue;
              }

              consecutiveErrors = 0;

              const data = await res.json();
              const items = data.items || [];

              if (items.length === 0) {
                currentWatermarks[wmKey] = maxAllowedPage;
                console.log(`Exhausted: ${wmKey} at page ${page} (no results)`);
                break;
              }

              for (const item of items) {
                if (item.owner?.type !== "User") continue;

                const existing = repoMap.get(item.full_name);
                if (existing) {
                  const nets = existing.metadata.matched_nets as string[];
                  if (!nets.includes(net.id)) nets.push(net.id);
                } else {
                  repoMap.set(item.full_name, {
                    run_id: runId,
                    full_name: item.full_name,
                    owner_login: item.owner?.login || "",
                    metadata: {
                      stars: item.stargazers_count,
                      forks: item.forks_count,
                      topics: item.topics || [],
                      language: item.language,
                      description: item.description,
                      created_at: item.created_at,
                      pushed_at: item.pushed_at,
                      html_url: item.html_url,
                      default_branch: item.default_branch,
                      owner_type: item.owner?.type || "Unknown",
                      matched_nets: [net.id],
                    },
                  });
                }
              }

              currentWatermarks[wmKey] = Math.max(currentWatermarks[wmKey] || 0, page);
              lastCursor = { netIdx, queryIdx, bandIdx, sortIdx, page: page + 1 };

              if (queryCount % FLUSH_INTERVAL === 0) {
                await flushRepos(supabase, repoMap, flushedKeys);
                totalRepos = new Set([...flushedKeys, ...repoMap.keys()]).size;
                await supabase.from("runs").update({
                  updated_at: new Date().toISOString(),
                  search_params: {
                    ...savedParams,
                    repos_found: totalRepos,
                    cursor: lastCursor,
                    page_watermarks: currentWatermarks,
                    last_checkpoint_at: new Date().toISOString(),
                    phase: `net:${net.id}`,
                    resume_count: resumeCount,
                  },
                }).eq("id", runId);
              }

              if (items.length < perPage) {
                currentWatermarks[wmKey] = maxAllowedPage;
                console.log(`Exhausted: ${wmKey} at page ${page} (partial page: ${items.length}/${perPage})`);
                break;
              }

              await new Promise((r) => setTimeout(r, 200));
            }
            if (chunkDone) break;
          }
          if (chunkDone) break;
        }
        if (chunkDone) break;
      }

      if (!chunkDone) {
        await flushRepos(supabase, repoMap, flushedKeys);
      }
      if (chunkDone) break;
    }

    // Final flush
    await flushRepos(supabase, repoMap, flushedKeys);
    totalRepos = new Set([...flushedKeys, ...repoMap.keys()]).size;
    succeeded = true;

    const allDone = !chunkDone && !userPaused;
    console.log(`Pass complete: ${totalRepos} repos, ${skippedExhausted} exhausted combos skipped, ${queryCount} API calls, allDone=${allDone}, autoContinue=${shouldAutoContinue}`);

    return new Response(
      JSON.stringify({ runId, repoCount: totalRepos, autoContinuing: shouldAutoContinue, completed: allDone, skippedExhausted, queryCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    if (runId) {
      let finalStatus: string;
      let finalPhase: string;

      if (!succeeded) {
        finalStatus = "failed";
        finalPhase = "failed";
      } else if (userPaused) {
        finalStatus = "paused";
        finalPhase = "user_paused";
      } else if (shouldAutoContinue) {
        // Keep as "running" — we'll self-invoke to continue
        finalStatus = "running";
        finalPhase = "auto_continuing";
      } else {
        finalStatus = "completed";
        finalPhase = "completed";
      }

      const finalParams: any = {
        ...savedParams,
        repos_found: totalRepos,
        resume_count: resumeCount,
        page_watermarks: currentWatermarks,
        last_checkpoint_at: new Date().toISOString(),
        phase: finalPhase,
      };

      if (finalPhase === "completed") {
        delete finalParams.cursor;
        finalParams.timed_out = false;
      } else {
        finalParams.cursor = lastCursor;
        finalParams.timed_out = finalPhase !== "completed";
      }

      await supabase.from("runs").update({
        status: finalStatus,
        updated_at: new Date().toISOString(),
        search_params: finalParams,
      }).eq("id", runId);

      // Auto-continue: fire-and-forget self-invocation
      if (shouldAutoContinue && !userPaused) {
        console.log(`Queuing auto-continuation for run ${runId}`);
        // Small delay before self-invoke to let rate limits recover
        await new Promise((r) => setTimeout(r, 5000));
        selfInvoke(runId).catch((e) => console.error("selfInvoke error:", e));
      }
    }
  }
});
