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

// Default query packs for Criterion #1
const DEFAULT_QUERIES = [
  "topic:react language:TypeScript archived:false fork:false",
  "topic:nextjs language:TypeScript archived:false fork:false",
  "topic:tailwindcss topic:react language:TypeScript archived:false fork:false",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      queries = DEFAULT_QUERIES,
      minStars = 5,
      pushedAfter = "",
      perPage = 30,
      maxPages = 1,
    } = await req.json().catch(() => ({}));

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Create run
    const { data: run, error: runErr } = await supabase
      .from("runs")
      .insert({ status: "running", search_params: { queries, minStars, pushedAfter, perPage, maxPages } })
      .select("id")
      .single();
    if (runErr) throw new Error(`Failed to create run: ${runErr.message}`);

    const seen = new Set<string>();
    const repos: { run_id: string; full_name: string; metadata: any; owner_login: string }[] = [];

    for (const baseQuery of queries) {
      for (let page = 1; page <= maxPages; page++) {
        let q = baseQuery;
        if (minStars > 0) q += ` stars:>=${minStars}`;
        if (pushedAfter) q += ` pushed:>=${pushedAfter}`;

        const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${perPage}&page=${page}`;
        const res = await githubFetch(url);
        if (!res.ok) {
          console.error(`Search failed for query "${q}": ${res.status}`);
          continue;
        }
        const data = await res.json();
        for (const item of data.items || []) {
          if (seen.has(item.full_name)) continue;
          // Skip non-User owners (organizations, bots)
          if (item.owner?.type !== "User") continue;
          seen.add(item.full_name);
          repos.push({
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
            },
          });
        }
        // Small delay between pages
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    // Insert repos in batches
    const batchSize = 50;
    for (let i = 0; i < repos.length; i += batchSize) {
      const batch = repos.slice(i, i + batchSize);
      const { error } = await supabase.from("repos").insert(batch);
      if (error) console.error("Repo insert error:", error.message);
    }

    // Update run status
    await supabase.from("runs").update({ status: "pending", updated_at: new Date().toISOString() }).eq("id", run.id);

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
