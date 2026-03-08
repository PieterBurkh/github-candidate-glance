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

async function githubFetch(url: string) {
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

const DEADLINE_MS = 300_000; // 5 minutes — allows time for rate-limit pacing
const FLUSH_INTERVAL = 20;
const MAX_GITHUB_PAGE = 34; // GitHub caps at 1,000 results; at perPage=30 that's ~34 pages

interface Cursor {
  netIdx: number;
  queryIdx: number;
  bandIdx: number;
  sortIdx: number;
  page: number;
}

// Watermark key for a specific query combination
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

// ── Load watermarks from the most recent completed/paused run ────────
async function loadWatermarks(
  supabase: ReturnType<typeof createClient>
): Promise<Record<string, number>> {
  const { data: lastRun } = await supabase
    .from("runs")
    .select("search_params")
    .in("status", ["completed", "paused"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!lastRun?.search_params) return {};
  const params = lastRun.search_params as Record<string, any>;
  return (params.page_watermarks as Record<string, number>) || {};
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let runId: string | null = null;
  let timedOut = false;
  let totalRepos = 0;
  let succeeded = false;
  let netsToRun: NetDef[] = [];
  let perPage = 30;
  let maxPages = 1;
  let savedParams: any = {};

  // ── Shared cursor state for finally block ──
  let lastCursor: Cursor | null = null;
  let resumeCount = 0;
  // Track watermarks updated during this run
  let currentWatermarks: Record<string, number> = {};

  try {
    const body = await req.json().catch(() => ({}));
    const resumeRunId = body.runId as string | undefined;
    let cursor: Cursor | null = null;
    let preloadedKeys: Set<string> | undefined;

    // Load watermarks from the most recent completed run
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

      runId = existingRun.id;
      savedParams = existingRun.search_params || {};
      cursor = savedParams.cursor || null;
      perPage = savedParams.perPage || 30;
      maxPages = savedParams.maxPages || 1;
      resumeCount = (savedParams.resume_count || 0) + 1;

      // If this run already has watermarks in progress, use those
      if (savedParams.page_watermarks) {
        currentWatermarks = { ...priorWatermarks, ...savedParams.page_watermarks };
      }

      const netIds = savedParams.nets || [];
      netsToRun = netIds.length > 0
        ? ALL_NETS.filter((n) => netIds.includes(n.id))
        : ALL_NETS;

      // Set status to running
      await supabase.from("runs").update({
        status: "running",
        updated_at: new Date().toISOString(),
        search_params: {
          ...savedParams,
          resume_count: resumeCount,
          last_checkpoint_at: new Date().toISOString(),
          phase: "resuming",
        },
      }).eq("id", runId);

      // Load already-flushed repo keys to avoid duplicates
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

      console.log(`Resuming run ${runId}: cursor=${JSON.stringify(cursor)}, preloaded=${preloadedKeys.size} repos, resumeCount=${resumeCount}`);
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

    // Also copy cursor into lastCursor so we have a starting point for finally
    lastCursor = cursor;

    const deadline = Date.now() + DEADLINE_MS;
    const repoMap = new Map<string, any>();
    const flushedKeys = new Set<string>();

    // If resuming, seed flushedKeys with already-saved repos
    if (preloadedKeys) {
      for (const key of preloadedKeys) {
        flushedKeys.add(key);
      }
    }

    let queryCount = 0;
    let consecutiveErrors = 0;
    let skippedExhausted = 0;
    const MAX_CONSECUTIVE_ERRORS = 20;

    for (let netIdx = 0; netIdx < netsToRun.length; netIdx++) {
      const net = netsToRun[netIdx];
      if (Date.now() > deadline) { timedOut = true; break; }

      for (let queryIdx = 0; queryIdx < net.queries.length; queryIdx++) {
        const query = net.queries[queryIdx];
        if (Date.now() > deadline) { timedOut = true; break; }

        for (let bandIdx = 0; bandIdx < net.starBands.length; bandIdx++) {
          const band = net.starBands[bandIdx];
          if (Date.now() > deadline) { timedOut = true; break; }

          for (let sortIdx = 0; sortIdx < net.sorts.length; sortIdx++) {
            const sort = net.sorts[sortIdx];
            if (Date.now() > deadline) { timedOut = true; break; }

            // ── Watermark logic: determine start page ──
            const wmKey = watermarkKey(net.id, queryIdx, bandIdx, sortIdx);
            const lastFetchedPage = priorWatermarks[wmKey] || 0;
            const maxAllowedPage = Math.floor(1000 / perPage); // GitHub hard cap
            const startPage = lastFetchedPage + 1;

            // Skip exhausted combinations
            if (startPage > maxAllowedPage) {
              skippedExhausted++;
              continue;
            }

            const endPage = Math.min(startPage + maxPages - 1, maxAllowedPage);

            for (let page = startPage; page <= endPage; page++) {
              if (Date.now() > deadline) { timedOut = true; break; }

              // Check if user requested a pause
              const { data: statusCheck } = await supabase
                .from("runs")
                .select("status")
                .eq("id", runId)
                .single();
              if (statusCheck?.status === "paused") {
                console.log(`Run ${runId} pause requested by user`);
                timedOut = true;
                break;
              }

              // Skip iterations before cursor position (for resume)
              if (shouldSkip(cursor, netIdx, queryIdx, bandIdx, sortIdx, page)) {
                continue;
              }

              // Update lastCursor BEFORE the API call
              lastCursor = { netIdx, queryIdx, bandIdx, sortIdx, page };

              const q = `${query} stars:${band}`;
              const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=${sort}&order=desc&per_page=${perPage}&page=${page}`;

              // Proactive rate-limit pacing: 2s between calls ≈ 30 req/min
              if (queryCount > 0) {
                await new Promise((r) => setTimeout(r, 2000));
              }

              const res = await githubFetch(url);
              queryCount++;

              if (!res.ok) {
                console.error(`Search failed [${net.id}] "${q}" sort=${sort} page=${page}: ${res.status}`);
                consecutiveErrors++;

                if (res.status === 403 || res.status === 429) {
                  if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                    console.error(`Too many consecutive errors (${consecutiveErrors}), checkpointing and pausing`);
                    timedOut = true;
                    lastCursor = { netIdx, queryIdx, bandIdx, sortIdx, page: page + 1 };
                    break;
                  }
                  await new Promise((r) => setTimeout(r, 2000));
                }
                continue;
              }

              // Reset consecutive error counter on success
              consecutiveErrors = 0;

              const data = await res.json();
              const items = data.items || [];

              // If GitHub returned no items, this combination is exhausted beyond this page
              if (items.length === 0) {
                currentWatermarks[wmKey] = maxAllowedPage; // Mark exhausted
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

              // Update watermark to this page
              currentWatermarks[wmKey] = Math.max(currentWatermarks[wmKey] || 0, page);

              // After the page completes, advance lastCursor to next page
              lastCursor = { netIdx, queryIdx, bandIdx, sortIdx, page: page + 1 };

              // Flush periodically
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

              // If fewer results than perPage, no more pages for this combination
              if (items.length < perPage) {
                currentWatermarks[wmKey] = maxAllowedPage; // Mark exhausted
                console.log(`Exhausted: ${wmKey} at page ${page} (partial page: ${items.length}/${perPage})`);
                break;
              }

              await new Promise((r) => setTimeout(r, 200));
            }
            if (timedOut) break;
          }
          if (timedOut) break;
        }
        if (timedOut) break;
      }

      // Flush after each net
      if (!timedOut) {
        await flushRepos(supabase, repoMap, flushedKeys);
      }
      if (timedOut) break;
    }

    // Final flush
    await flushRepos(supabase, repoMap, flushedKeys);
    totalRepos = new Set([...flushedKeys, ...repoMap.keys()]).size;
    succeeded = true;

    console.log(`Run complete: ${totalRepos} repos, ${skippedExhausted} exhausted combos skipped, ${queryCount} API calls`);

    return new Response(
      JSON.stringify({ runId, repoCount: totalRepos, timedOut, skippedExhausted, queryCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    if (runId) {
      const finalStatus = succeeded
        ? (timedOut ? "paused" : "completed")
        : "failed";

      const finalParams: any = {
        ...savedParams,
        repos_found: totalRepos,
        resume_count: resumeCount,
        page_watermarks: currentWatermarks,
        last_checkpoint_at: new Date().toISOString(),
      };

      if (timedOut && succeeded) {
        finalParams.cursor = lastCursor;
        finalParams.timed_out = true;
        finalParams.phase = "paused_with_cursor";
        console.log(`Run ${runId} paused with cursor: ${JSON.stringify(lastCursor)}`);
      } else if (succeeded) {
        delete finalParams.cursor;
        finalParams.timed_out = false;
        finalParams.phase = "completed";
      } else {
        finalParams.cursor = lastCursor;
        finalParams.timed_out = false;
        finalParams.phase = "failed";
      }

      await supabase.from("runs").update({
        status: finalStatus,
        updated_at: new Date().toISOString(),
        search_params: finalParams,
      }).eq("id", runId);
    }
  }
});
