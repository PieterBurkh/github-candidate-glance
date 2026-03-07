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

const DEADLINE_MS = 140_000; // 140s, well within 150s edge function limit
const FLUSH_INTERVAL = 20; // flush to DB every N queries

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
      // Fallback: insert ignoring duplicates
      const { error: insertErr } = await supabase.from("repos").insert(batch);
      if (insertErr) console.error("Repo insert error:", insertErr.message);
    }
  }
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

  try {
    const {
      nets: requestedNets,
      perPage = 30,
      maxPages = 1,
    } = await req.json().catch(() => ({}));

    const netsToRun = requestedNets && requestedNets.length > 0
      ? ALL_NETS.filter((n) => requestedNets.includes(n.id))
      : ALL_NETS;

    // Create run
    const { data: run, error: runErr } = await supabase
      .from("runs")
      .insert({
        status: "running",
        search_params: {
          nets: netsToRun.map((n) => n.id),
          perPage,
          maxPages,
        },
      })
      .select("id")
      .single();
    if (runErr) throw new Error(`Failed to create run: ${runErr.message}`);
    runId = run.id;

    const deadline = Date.now() + DEADLINE_MS;
    const repoMap = new Map<string, any>();
    const flushedKeys = new Set<string>();
    let queryCount = 0;

    for (const net of netsToRun) {
      if (Date.now() > deadline) { timedOut = true; break; }

      for (const query of net.queries) {
        if (Date.now() > deadline) { timedOut = true; break; }

        for (const band of net.starBands) {
          if (Date.now() > deadline) { timedOut = true; break; }

          for (const sort of net.sorts) {
            if (Date.now() > deadline) { timedOut = true; break; }

            for (let page = 1; page <= maxPages; page++) {
              if (Date.now() > deadline) { timedOut = true; break; }

              const q = `${query} stars:${band}`;
              const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=${sort}&order=desc&per_page=${perPage}&page=${page}`;

              const res = await githubFetch(url);
              queryCount++;

              if (!res.ok) {
                console.error(`Search failed [${net.id}] "${q}" sort=${sort}: ${res.status}`);
                if (res.status === 403 || res.status === 429) {
                  await new Promise((r) => setTimeout(r, 2000));
                }
                continue;
              }

              const data = await res.json();
              for (const item of data.items || []) {
                if (item.owner?.type !== "User") continue;

                const existing = repoMap.get(item.full_name);
                if (existing) {
                  const nets = existing.metadata.matched_nets as string[];
                  if (!nets.includes(net.id)) nets.push(net.id);
                } else {
                  repoMap.set(item.full_name, {
                    run_id: run.id,
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

              // Flush periodically
              if (queryCount % FLUSH_INTERVAL === 0) {
                await flushRepos(supabase, repoMap, flushedKeys);
                totalRepos = repoMap.size;
                await supabase.from("runs").update({
                  updated_at: new Date().toISOString(),
                  search_params: {
                    nets: netsToRun.map((n) => n.id),
                    perPage,
                    maxPages,
                    repos_found: totalRepos,
                  },
                }).eq("id", run.id);
              }

              await new Promise((r) => setTimeout(r, 200));
            }
          }
        }
      }

      // Flush after each net
      await flushRepos(supabase, repoMap, flushedKeys);
    }

    // Final flush
    await flushRepos(supabase, repoMap, flushedKeys);
    totalRepos = repoMap.size;
    succeeded = true;

    return new Response(
      JSON.stringify({ runId: run.id, repoCount: totalRepos, timedOut }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    if (runId) {
      await supabase.from("runs").update({
        status: succeeded ? "completed" : "failed",
        updated_at: new Date().toISOString(),
        search_params: {
          timed_out: timedOut,
          repos_found: totalRepos,
        },
      }).eq("id", runId);
    }
  }
});
