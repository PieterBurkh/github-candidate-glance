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
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "lovable-shortlist" };
  if (GITHUB_TOKEN) h.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return h;
}

async function ghFetch(url: string): Promise<Response> {
  return fetch(url, { headers: ghHeaders() });
}

async function fetchFileContent(fullName: string, path: string, branch: string): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${fullName}/${branch}/${path}`;
  const res = await fetch(url, { headers: { "User-Agent": "lovable-shortlist" } });
  if (!res.ok) { await res.text(); return null; }
  return res.text();
}

// Select up to 4 best repos: most starred, most recently pushed, most maintained
function selectTopRepos(repos: any[]): any[] {
  const nonFork = repos.filter((r: any) => !r.fork && !r.archived);
  if (nonFork.length === 0) return repos.slice(0, 4);

  const selected: any[] = [];
  const seen = new Set<string>();

  // Top starred
  const byStars = [...nonFork].sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0));
  for (const r of byStars.slice(0, 2)) {
    if (!seen.has(r.full_name)) { selected.push(r); seen.add(r.full_name); }
  }

  // Most recently pushed
  const byPush = [...nonFork].sort((a, b) => new Date(b.pushed_at || 0).getTime() - new Date(a.pushed_at || 0).getTime());
  for (const r of byPush.slice(0, 2)) {
    if (!seen.has(r.full_name) && selected.length < 4) { selected.push(r); seen.add(r.full_name); }
  }

  // Fill remaining
  for (const r of nonFork) {
    if (selected.length >= 4) break;
    if (!seen.has(r.full_name)) { selected.push(r); seen.add(r.full_name); }
  }

  return selected;
}

interface RepoEvidence {
  full_name: string;
  stars: number;
  language: string | null;
  description: string | null;
  readme_excerpt: string | null;
  package_deps: string[] | null;
  tsconfig_strict: boolean | null;
  changelog_excerpt: string | null;
  has_storybook: boolean;
  has_ci: boolean;
  has_tests: boolean;
  topics: string[];
}

async function buildRepoEvidence(repo: any): Promise<RepoEvidence> {
  const fullName = repo.full_name;
  const branch = repo.default_branch || "main";

  // Fetch tree to check presence of dirs
  const treeRes = await ghFetch(`https://api.github.com/repos/${fullName}/git/trees/${branch}?recursive=1`);
  let treePaths = new Set<string>();
  if (treeRes.ok) {
    const treeData = await treeRes.json();
    treePaths = new Set((treeData.tree || []).map((t: any) => t.path));
  } else {
    await treeRes.text();
  }

  const has_storybook = [...treePaths].some(p => p.startsWith(".storybook/"));
  const has_ci = [...treePaths].some(p => p.startsWith(".github/workflows/"));
  const has_tests = [...treePaths].some(p =>
    p.includes("__tests__/") || p.includes(".test.") || p.includes(".spec.") ||
    p.startsWith("test/") || p.startsWith("tests/")
  );

  // Fetch artifacts in parallel
  const [readmeRaw, pkgRaw, tsconfigRaw, changelogRaw] = await Promise.all([
    fetchFileContent(fullName, "README.md", branch),
    fetchFileContent(fullName, "package.json", branch),
    fetchFileContent(fullName, "tsconfig.json", branch),
    fetchFileContent(fullName, "CHANGELOG.md", branch),
  ]);

  const readme_excerpt = readmeRaw ? readmeRaw.slice(0, 4000) : null;

  let package_deps: string[] | null = null;
  try {
    if (pkgRaw) {
      const pkg = JSON.parse(pkgRaw);
      package_deps = [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.devDependencies || {}),
      ];
    }
  } catch {}

  let tsconfig_strict: boolean | null = null;
  try {
    if (tsconfigRaw) {
      const tsc = JSON.parse(tsconfigRaw);
      tsconfig_strict = !!tsc?.compilerOptions?.strict;
    }
  } catch {}

  let changelog_excerpt: string | null = null;
  if (changelogRaw) {
    const lines = changelogRaw.split("\n");
    // Get first 2 version entries (headers starting with ## or #)
    const headers: number[] = [];
    lines.forEach((l, i) => { if (/^#{1,2}\s/.test(l)) headers.push(i); });
    const endIdx = headers.length >= 3 ? headers[2] : lines.length;
    changelog_excerpt = lines.slice(0, Math.min(endIdx, 60)).join("\n");
  }

  return {
    full_name: fullName,
    stars: repo.stargazers_count || 0,
    language: repo.language,
    description: repo.description,
    readme_excerpt,
    package_deps,
    tsconfig_strict,
    changelog_excerpt,
    has_storybook,
    has_ci,
    has_tests,
    topics: repo.topics || [],
  };
}

// 12-criterion rubric LLM call
const MUST_HAVE_CRITERIA = [
  "react_typescript",
  "rich_app_architecture",
  "docs_versioning",
  "performance_profiling",
  "technical_leadership",
  "english_communication",
] as const;

const NICE_TO_HAVE_CRITERIA = [
  "bpmn_uml_uis",
  "wcag_accessibility",
  "semver_library_maintenance",
  "crdts",
  "wasm",
  "canvas_webgl",
] as const;

function buildCriterionSchema(name: string, description: string) {
  return {
    type: "object",
    properties: {
      score: { type: "number", description: "0, 0.25, 0.5, 0.75, or 1.0" },
      evidence: { type: "string", description: "1-2 sentences citing specific repos/files" },
    },
    required: ["score", "evidence"],
    additionalProperties: false,
  };
}

async function llmScoreCandidate(login: string, repoEvidences: RepoEvidence[], profile: any): Promise<any> {
  const evidenceBlock = repoEvidences.map(r => {
    let block = `## ${r.full_name} (★${r.stars}, ${r.language || "unknown"})
Description: ${r.description || "none"}
Topics: ${r.topics.join(", ") || "none"}
Has CI: ${r.has_ci}, Has Tests: ${r.has_tests}, Has Storybook: ${r.has_storybook}
TS Strict: ${r.tsconfig_strict ?? "unknown"}`;
    if (r.package_deps) block += `\nDependencies: ${r.package_deps.join(", ")}`;
    if (r.readme_excerpt) block += `\nREADME excerpt:\n${r.readme_excerpt}`;
    if (r.changelog_excerpt) block += `\nCHANGELOG excerpt:\n${r.changelog_excerpt}`;
    return block;
  }).join("\n\n---\n\n");

  const systemPrompt = `You are a senior technical recruiter evaluating a GitHub developer for a frontend engineering role.

You will receive evidence from their top repositories. Score each criterion on a 5-point scale: 0 (no evidence), 0.25 (weak), 0.50 (moderate), 0.75 (strong), 1.00 (exceptional).

**MUST-HAVE criteria (these matter most):**
1. react_typescript — Evidence of React + TypeScript usage in real apps (not tutorials/templates)
2. rich_app_architecture — Complex UI patterns: state management, routing, component composition, data fetching
3. docs_versioning — READMEs, CHANGELOGs, semantic versioning, release management
4. performance_profiling — Evidence of perf optimization: code splitting, memoization, lazy loading, bundle analysis
5. technical_leadership — Maintained repos with contributors, PR reviews, architectural decisions, mentorship signals
6. english_communication — Quality of READMEs, docs, commit messages, issue discussions in English

**NICE-TO-HAVE criteria:**
7. bpmn_uml_uis — Evidence of building process/workflow editors, diagram tools, or complex visual UIs
8. wcag_accessibility — WCAG 2.2 compliance signals: aria labels, a11y testing, screen reader support
9. semver_library_maintenance — Maintaining npm packages with proper semver, release cycles, deprecation handling
10. crdts — CRDTs, operational transforms, real-time collaboration, conflict resolution
11. wasm — WebAssembly usage, Rust/C++ to WASM compilation, performance-critical modules
12. canvas_webgl — Canvas 2D, WebGL, Three.js, PixiJS, data viz, custom rendering

**Assessment requirement:**
- Provide an assessment: 2-3 sentences explaining why you gave this overall score — what stood out (good or bad) in the candidate's repos, citing specific repositories or patterns observed.

**Anti-gaming rules:**
- Downweight template/boilerplate repos (create-react-app defaults, tutorial code)
- Stars/forks are context only, not direct score contributors
- Forks without substantial modifications score 0
- Look for ORIGINAL work and real complexity`;

  const userPrompt = `Developer: ${login}
Profile: ${profile.name || "unknown"} | ${profile.bio || "no bio"} | ${profile.followers || 0} followers | ${profile.public_repos || 0} repos
Location: ${profile.location || "unknown"} | Company: ${profile.company || "unknown"}

Evidence from ${repoEvidences.length} repositories:

${evidenceBlock}`;

  const response = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "submit_candidate_scores",
          description: "Submit the 12-criterion evaluation scores with evidence.",
          parameters: {
            type: "object",
            properties: {
              react_typescript: buildCriterionSchema("react_typescript", ""),
              rich_app_architecture: buildCriterionSchema("rich_app_architecture", ""),
              docs_versioning: buildCriterionSchema("docs_versioning", ""),
              performance_profiling: buildCriterionSchema("performance_profiling", ""),
              technical_leadership: buildCriterionSchema("technical_leadership", ""),
              english_communication: buildCriterionSchema("english_communication", ""),
              bpmn_uml_uis: buildCriterionSchema("bpmn_uml_uis", ""),
              wcag_accessibility: buildCriterionSchema("wcag_accessibility", ""),
              semver_library_maintenance: buildCriterionSchema("semver_library_maintenance", ""),
              crdts: buildCriterionSchema("crdts", ""),
              wasm: buildCriterionSchema("wasm", ""),
              canvas_webgl: buildCriterionSchema("canvas_webgl", ""),
              summary: { type: "string", description: "1-2 sentence overall assessment" },
              assessment: { type: "string", description: "2-3 sentences explaining why you gave this overall score — what stood out (good or bad) in the candidate's repos, citing specific repositories or patterns observed." },
            },
            required: [
              "react_typescript", "rich_app_architecture", "docs_versioning",
              "performance_profiling", "technical_leadership", "english_communication",
              "bpmn_uml_uis", "wcag_accessibility", "semver_library_maintenance",
              "crdts", "wasm", "canvas_webgl", "summary", "assessment",
            ],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "submit_candidate_scores" } },
    }),
  });

  if (response.status === 429) throw new Error("LLM_RATE_LIMITED");
  if (response.status === 402) throw new Error("LLM_PAYMENT_REQUIRED");
  if (!response.ok) {
    const t = await response.text();
    throw new Error(`LLM error ${response.status}: ${t}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No tool call in LLM response");

  return typeof toolCall.function.arguments === "string"
    ? JSON.parse(toolCall.function.arguments)
    : toolCall.function.arguments;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { login } = await req.json();
    if (!login) throw new Error("login required");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch user profile
    const profileRes = await ghFetch(`https://api.github.com/users/${login}`);
    if (profileRes.status === 403 || profileRes.status === 429) {
      return new Response(JSON.stringify({ error: "GITHUB_RATE_LIMITED" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!profileRes.ok) {
      const t = await profileRes.text();
      throw new Error(`GitHub user fetch failed: ${profileRes.status} ${t}`);
    }
    const profile = await profileRes.json();

    // 2. Fetch repos
    const reposRes = await ghFetch(`https://api.github.com/users/${login}/repos?per_page=30&sort=pushed`);
    if (reposRes.status === 403 || reposRes.status === 429) {
      return new Response(JSON.stringify({ error: "GITHUB_RATE_LIMITED" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const allRepos = reposRes.ok ? await reposRes.json() : [];

    // 3. Select top 4 repos
    const topRepos = selectTopRepos(Array.isArray(allRepos) ? allRepos : []);

    // 4. Build evidence for each repo (sequential to respect rate limits)
    const repoEvidences: RepoEvidence[] = [];
    for (const repo of topRepos) {
      try {
        const ev = await buildRepoEvidence(repo);
        repoEvidences.push(ev);
      } catch (e) {
        console.error(`Evidence build failed for ${repo.full_name}:`, e);
      }
    }

    if (repoEvidences.length === 0) {
      // No evidence — mark as NO
      const { data: person } = await supabase.from("people").select("id").eq("login", login).maybeSingle();
      if (person) {
        await supabase.from("people").update({
          shortlist_status: "NO", overall_score: 0, updated_at: new Date().toISOString(),
        }).eq("id", person.id);
      }
      return new Response(JSON.stringify({ login, status: "NO", reason: "no_evidence" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. LLM scoring with retry
    let scores: any;
    let retries = 0;
    while (true) {
      try {
        scores = await llmScoreCandidate(login, repoEvidences, profile);
        break;
      } catch (e) {
        if (retries < 2 && (e.message.includes("RATE_LIMITED") || e.message.includes("429"))) {
          retries++;
          await new Promise(r => setTimeout(r, 3000 * retries));
        } else {
          throw e;
        }
      }
    }

    // 6. Compute overall_pct
    const mustScores = MUST_HAVE_CRITERIA.map(c => scores[c]?.score ?? 0);
    const niceScores = NICE_TO_HAVE_CRITERIA.map(c => scores[c]?.score ?? 0);
    const mustAvg = mustScores.reduce((a, b) => a + b, 0) / mustScores.length;
    const niceAvg = niceScores.reduce((a, b) => a + b, 0) / niceScores.length;
    const overallPct = Math.round(100 * (0.80 * mustAvg + 0.20 * niceAvg));

    // 7. Determine status
    let shortlistStatus: string;
    if (overallPct >= 65 && mustAvg >= 0.60) {
      shortlistStatus = "SHORTLIST";
    } else if (overallPct >= 65) {
      shortlistStatus = "NEEDS_REVIEW";
    } else {
      shortlistStatus = "NO";
    }

    // 8. Upsert people record
    const profileData = {
      name: profile.name, avatar_url: profile.avatar_url, html_url: profile.html_url,
      bio: profile.bio, blog: profile.blog, email: profile.email,
      twitter_username: profile.twitter_username, public_repos: profile.public_repos,
      followers: profile.followers, company: profile.company, location: profile.location,
      is_real_person: true,
    };

    const { data: existingPerson } = await supabase.from("people").select("id").eq("login", login).maybeSingle();
    let personId: string;

    if (existingPerson) {
      personId = existingPerson.id;
      await supabase.from("people").update({
        profile: profileData, overall_score: overallPct, shortlist_status: shortlistStatus,
        updated_at: new Date().toISOString(),
      }).eq("id", personId);
    } else {
      const { data: newPerson, error: personErr } = await supabase.from("people").insert({
        login, profile: profileData, overall_score: overallPct, shortlist_status: shortlistStatus,
      }).select("id").single();
      if (personErr) throw new Error(`Person insert failed: ${personErr.message}`);
      personId = newPerson.id;
    }

    // 9. Insert person_evidence with full rubric
    const evidencePayload = {
      must_haves: Object.fromEntries(MUST_HAVE_CRITERIA.map(c => [c, scores[c]])),
      nice_to_haves: Object.fromEntries(NICE_TO_HAVE_CRITERIA.map(c => [c, scores[c]])),
      must_avg: Math.round(mustAvg * 100) / 100,
      nice_avg: Math.round(niceAvg * 100) / 100,
      overall_pct: overallPct,
      summary: scores.summary || "",
      assessment: scores.assessment || "",
      repos_evaluated: repoEvidences.map(r => r.full_name),
    };

    await supabase.from("person_evidence").insert({
      person_id: personId,
      criterion: "shortlist_rubric",
      score: overallPct,
      evidence: evidencePayload,
    });

    return new Response(JSON.stringify({
      login, shortlist_status: shortlistStatus, overall_pct: overallPct,
      must_avg: Math.round(mustAvg * 100) / 100, nice_avg: Math.round(niceAvg * 100) / 100,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("enrich-candidate error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
