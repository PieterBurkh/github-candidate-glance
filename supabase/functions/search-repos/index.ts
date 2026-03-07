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
  starBands: string[];  // e.g. ["5..50","50..500",">=500"] or [">=1"]
  sorts: string[];      // e.g. ["stars","updated"]
}

const BASE = "archived:false fork:false";

const ALL_NETS: NetDef[] = [
  // A — Core stack
  {
    id: "core-stack",
    label: "Core Stack",
    queries: [
      `topic:react language:TypeScript ${BASE}`,
      `react typescript in:name,description,readme ${BASE}`,
    ],
    starBands: ["5..50", "50..500", ">=500"],
    sorts: ["stars", "updated"],
  },
  // B — Meta-frameworks
  {
    id: "meta-frameworks",
    label: "Meta-frameworks",
    queries: [
      `topic:nextjs language:TypeScript ${BASE}`,
      `vite react typescript in:name,description,readme ${BASE}`,
      `remix react typescript in:name,description,readme ${BASE}`,
    ],
    starBands: ["5..50", "50..500", ">=500"],
    sorts: ["stars", "updated"],
  },
  // C — Component libraries / docs
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
  // D — Versioning discipline
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
  // E — Performance
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
  // F — Accessibility
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
  // G — Complex UI patterns
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
  // H — CRDT / realtime
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
  // I — WASM
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      nets: requestedNets,
      perPage = 30,
      maxPages = 1,
    } = await req.json().catch(() => ({}));

    // Filter nets if specified, otherwise use all
    const netsToRun = requestedNets && requestedNets.length > 0
      ? ALL_NETS.filter((n) => requestedNets.includes(n.id))
      : ALL_NETS;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

    // Track repos: full_name -> repo data (merge matched_nets)
    const repoMap = new Map<string, {
      run_id: string;
      full_name: string;
      metadata: any;
      owner_login: string;
    }>();

    for (const net of netsToRun) {
      for (const query of net.queries) {
        for (const band of net.starBands) {
          for (const sort of net.sorts) {
            for (let page = 1; page <= maxPages; page++) {
              const q = `${query} stars:${band}`;
              const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=${sort}&order=desc&per_page=${perPage}&page=${page}`;

              const res = await githubFetch(url);
              if (!res.ok) {
                console.error(`Search failed [${net.id}] "${q}" sort=${sort}: ${res.status}`);
                // If rate-limited, wait and skip
                if (res.status === 403 || res.status === 429) {
                  await new Promise((r) => setTimeout(r, 5000));
                }
                continue;
              }

              const data = await res.json();
              for (const item of data.items || []) {
                // Skip non-User owners (organizations, bots)
                if (item.owner?.type !== "User") continue;

                const existing = repoMap.get(item.full_name);
                if (existing) {
                  // Merge net into matched_nets
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

              // Delay to respect rate limits
              await new Promise((r) => setTimeout(r, 300));
            }
          }
        }
      }
    }

    const repos = Array.from(repoMap.values());

    // Insert repos in batches
    const batchSize = 50;
    for (let i = 0; i < repos.length; i += batchSize) {
      const batch = repos.slice(i, i + batchSize);
      const { error } = await supabase.from("repos").insert(batch);
      if (error) console.error("Repo insert error:", error.message);
    }

    // Update run status
    await supabase
      .from("runs")
      .update({ status: "pending", updated_at: new Date().toISOString() })
      .eq("id", run.id);

    return new Response(
      JSON.stringify({ runId: run.id, repoCount: repos.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
