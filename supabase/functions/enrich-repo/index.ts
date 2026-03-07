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

// --- GitHub helpers ---

function githubHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "lovable-repo-scanner",
  };
  if (GITHUB_TOKEN) h.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return h;
}

async function githubFetch(url: string) {
  return fetch(url, { headers: githubHeaders() });
}

interface TreeEntry {
  path: string;
  type: "blob" | "tree";
  size?: number;
  sha: string;
}

async function fetchRepoTree(fullName: string, branch: string): Promise<TreeEntry[]> {
  const url = `https://api.github.com/repos/${fullName}/git/trees/${branch}?recursive=1`;
  const res = await githubFetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.tree || []) as TreeEntry[];
}

async function fetchFileRaw(fullName: string, path: string, branch: string): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${fullName}/${branch}/${path}`;
  const res = await fetch(url, { headers: { "User-Agent": "lovable-repo-scanner" } });
  if (!res.ok) return null;
  return res.text();
}

// --- Repo classification ---

type RepoKind = "app" | "library" | "monorepo" | "unknown";

function classifyRepo(tree: TreeEntry[], packageJson: any): RepoKind {
  const paths = new Set(tree.map((t) => t.path));

  // Monorepo hints
  const hasPackages = tree.some((t) => t.type === "tree" && (t.path === "packages" || t.path === "apps"));
  if (hasPackages) return "monorepo";

  // Library hints
  const hasExports = packageJson?.exports || packageJson?.main || packageJson?.module;
  const deps = { ...(packageJson?.dependencies || {}), ...(packageJson?.devDependencies || {}) };
  const hasBundler = deps["rollup"] || deps["tsup"] || deps["esbuild"] || deps["microbundle"];
  if (hasExports && hasBundler) return "library";

  // App hints
  const appIndicators = [
    "next.config.js", "next.config.ts", "next.config.mjs",
    "vite.config.ts", "vite.config.js",
    "nuxt.config.ts", "angular.json",
  ];
  if (appIndicators.some((f) => paths.has(f))) return "app";
  if (tree.some((t) => t.path.startsWith("pages/") || t.path.startsWith("app/") || t.path.startsWith("src/pages/"))) return "app";

  return "unknown";
}

// --- Evidence Pack Builder ---

const HARD_EXCLUDES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb", "bun.lock",
]);

const EXCLUDE_DIRS = ["node_modules", "dist", "build", ".next", "coverage", ".git", "__pycache__", "vendor"];
const EXCLUDE_EXTENSIONS = [".map", ".min.js", ".min.css", ".lock", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".eot", ".mp4", ".webm"];

function shouldExclude(path: string): boolean {
  if (HARD_EXCLUDES.has(path)) return true;
  const parts = path.split("/");
  if (parts.some((p) => EXCLUDE_DIRS.includes(p))) return true;
  if (EXCLUDE_EXTENSIONS.some((ext) => path.endsWith(ext))) return true;
  if (path.endsWith(".d.ts") && path.includes("dist")) return true;
  if (path.includes("generated") || path.includes("__generated__")) return true;
  return false;
}

interface EvidenceFile {
  path: string;
  content: string;
}

function selectFiles(tree: TreeEntry[], repoKind: RepoKind): string[] {
  const blobs = tree.filter((t) => t.type === "blob" && !shouldExclude(t.path));
  const selected: string[] = [];
  const MAX_FILES = 20;

  // Priority 1: Always include config files
  const alwaysInclude = [
    "package.json", "tsconfig.json",
    ".eslintrc.js", ".eslintrc.json", ".eslintrc.cjs", "eslint.config.js", "eslint.config.ts", "eslint.config.mjs",
    ".prettierrc", ".prettierrc.js", ".prettierrc.json", "prettier.config.js",
    "vite.config.ts", "vite.config.js",
    "next.config.js", "next.config.ts", "next.config.mjs",
    "webpack.config.js", "webpack.config.ts",
    "vitest.config.ts", "jest.config.js", "jest.config.ts",
    "playwright.config.ts", "cypress.config.ts",
    "tailwind.config.ts", "tailwind.config.js",
  ];
  for (const f of alwaysInclude) {
    if (blobs.some((b) => b.path === f) && selected.length < MAX_FILES) {
      selected.push(f);
    }
  }

  // Priority 2: Entry points
  const entryPoints = [
    "src/main.tsx", "src/main.ts", "src/index.tsx", "src/index.ts",
    "app/layout.tsx", "app/layout.ts",
    "pages/_app.tsx", "pages/_app.ts",
    "src/App.tsx", "src/App.ts",
  ];
  for (const f of entryPoints) {
    if (blobs.some((b) => b.path === f) && !selected.includes(f) && selected.length < MAX_FILES) {
      selected.push(f);
    }
  }

  // Priority 3: Router/routes
  const routerFiles = blobs.filter((b) =>
    (b.path.includes("router") || b.path.includes("routes") || b.path.includes("Router")) &&
    (b.path.endsWith(".tsx") || b.path.endsWith(".ts"))
  ).sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, 1);
  for (const f of routerFiles) {
    if (!selected.includes(f.path) && selected.length < MAX_FILES) selected.push(f.path);
  }

  // Priority 4: Components (largest non-index files)
  const components = blobs.filter((b) =>
    (b.path.includes("/components/") || b.path.includes("/Components/")) &&
    (b.path.endsWith(".tsx") || b.path.endsWith(".ts")) &&
    !b.path.includes("index.") && !b.path.includes(".test.") && !b.path.includes(".spec.")
  ).sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, 3);
  for (const f of components) {
    if (!selected.includes(f.path) && selected.length < MAX_FILES) selected.push(f.path);
  }

  // Priority 5: Hooks
  const hooks = blobs.filter((b) =>
    (b.path.includes("/hooks/") || b.path.includes("/hook/")) &&
    (b.path.endsWith(".tsx") || b.path.endsWith(".ts")) &&
    !b.path.includes(".test.")
  ).sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, 2);
  for (const f of hooks) {
    if (!selected.includes(f.path) && selected.length < MAX_FILES) selected.push(f.path);
  }

  // Priority 6: State management
  const stateFiles = blobs.filter((b) =>
    (b.path.includes("store") || b.path.includes("slice") || b.path.includes("context") || b.path.includes("provider")) &&
    (b.path.endsWith(".tsx") || b.path.endsWith(".ts")) &&
    !b.path.includes(".test.")
  ).sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, 2);
  for (const f of stateFiles) {
    if (!selected.includes(f.path) && selected.length < MAX_FILES) selected.push(f.path);
  }

  // Priority 7: Test files (1-2 to assess test quality)
  const testFiles = blobs.filter((b) =>
    (b.path.includes(".test.") || b.path.includes(".spec.") || b.path.includes("__tests__")) &&
    (b.path.endsWith(".tsx") || b.path.endsWith(".ts"))
  ).sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, 1);
  for (const f of testFiles) {
    if (!selected.includes(f.path) && selected.length < MAX_FILES) selected.push(f.path);
  }

  // Priority 8: CSS files
  const cssFiles = blobs.filter((b) =>
    (b.path.endsWith(".css") || b.path.endsWith(".scss")) &&
    !b.path.includes("node_modules") && !b.path.includes(".min.")
  ).sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, 1);
  for (const f of cssFiles) {
    if (!selected.includes(f.path) && selected.length < MAX_FILES) selected.push(f.path);
  }

  return selected;
}

function truncateContent(content: string, maxLines = 300): string {
  const lines = content.split("\n");
  if (lines.length <= maxLines) return content;
  // First 200 + last 100
  const head = lines.slice(0, 200).join("\n");
  const tail = lines.slice(-100).join("\n");
  return `${head}\n\n// ... [${lines.length - 300} lines truncated] ...\n\n${tail}`;
}

async function buildEvidencePack(
  tree: TreeEntry[],
  fullName: string,
  branch: string,
  repoKind: RepoKind
): Promise<{ files: EvidenceFile[]; totalBytes: number; sampledCount: number }> {
  const selectedPaths = selectFiles(tree, repoKind);
  const TOKEN_BUDGET = 100_000; // ~100KB
  let totalBytes = 0;
  const files: EvidenceFile[] = [];

  // Fetch files in small batches to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < selectedPaths.length && totalBytes < TOKEN_BUDGET; i += batchSize) {
    const batch = selectedPaths.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((path) => fetchFileRaw(fullName, path, branch))
    );
    for (let j = 0; j < batch.length; j++) {
      if (results[j] && totalBytes < TOKEN_BUDGET) {
        const content = truncateContent(results[j]!);
        totalBytes += content.length;
        files.push({ path: batch[j], content });
      }
    }
  }

  return { files, totalBytes, sampledCount: files.length };
}

// --- LLM Review ---

interface CategoryScore {
  score: number;
  confidence: number;
  evidence: { file: string; snippet: string; comment: string }[];
}

interface LLMReviewResult {
  architecture: CategoryScore;
  type_safety: CategoryScore;
  code_quality: CategoryScore;
  tooling: CategoryScore;
  styling: CategoryScore;
  overall_score: number;
  summary: string;
}

async function llmReview(
  evidencePack: EvidenceFile[],
  metadata: { fullName: string; repoKind: RepoKind; stars: number; topics: string[]; languages: Record<string, number> }
): Promise<LLMReviewResult> {
  const filesBlock = evidencePack
    .map((f) => `--- FILE: ${f.path} ---\n${f.content}`)
    .join("\n\n");

  const systemPrompt = `You are a senior frontend code reviewer. You will receive a curated evidence pack of files sampled from a GitHub repository, along with repository metadata.

Your job is to score the code quality across 5 categories (each 0.0 to 1.0) and provide evidence citations with specific file references and short code snippets.

Categories:
1. **Architecture** (0-1): Project structure, separation of concerns, routing, module organization, clean boundaries
2. **Type Safety** (0-1): TypeScript usage quality, strictness settings, type coverage, proper typing vs excessive \`any\`
3. **Code Quality** (0-1): Naming conventions, patterns (hooks, composition), error handling, DRY, readability
4. **Tooling** (0-1): Linting setup, testing presence & quality, build config, formatting, CI indicators
5. **Styling** (0-1): CSS approach (Tailwind/CSS-in-JS/modules), consistency, design system usage, responsiveness

Scoring guidelines:
- 0.0-0.2: Poor/absent
- 0.3-0.4: Below average
- 0.5-0.6: Average/competent
- 0.7-0.8: Good, professional quality
- 0.9-1.0: Excellent, expert-level

For each category, provide 1-3 evidence citations pointing to specific files with short code excerpts (max 3 lines) and a brief comment explaining the score.

Be fair but discerning. Template/boilerplate repos with no custom logic should score low on Architecture and Code Quality. Real production apps with thoughtful patterns should score high.`;

  const userPrompt = `Repository: ${metadata.fullName}
Kind: ${metadata.repoKind}
Stars: ${metadata.stars}
Topics: ${metadata.topics.join(", ") || "none"}
Languages: ${Object.entries(metadata.languages).map(([k, v]) => `${k}: ${(v / 1024).toFixed(0)}KB`).join(", ")}

Evidence Pack (${evidencePack.length} files):

${filesBlock}`;

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
      tools: [
        {
          type: "function",
          function: {
            name: "submit_code_review",
            description: "Submit the structured code quality review with category scores and evidence.",
            parameters: {
              type: "object",
              properties: {
                architecture: {
                  type: "object",
                  properties: {
                    score: { type: "number", description: "0.0 to 1.0" },
                    confidence: { type: "number", description: "0.0 to 1.0" },
                    evidence: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          file: { type: "string" },
                          snippet: { type: "string", description: "Max 3 lines of code" },
                          comment: { type: "string" },
                        },
                        required: ["file", "snippet", "comment"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["score", "confidence", "evidence"],
                  additionalProperties: false,
                },
                type_safety: {
                  type: "object",
                  properties: {
                    score: { type: "number" },
                    confidence: { type: "number" },
                    evidence: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          file: { type: "string" },
                          snippet: { type: "string" },
                          comment: { type: "string" },
                        },
                        required: ["file", "snippet", "comment"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["score", "confidence", "evidence"],
                  additionalProperties: false,
                },
                code_quality: {
                  type: "object",
                  properties: {
                    score: { type: "number" },
                    confidence: { type: "number" },
                    evidence: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          file: { type: "string" },
                          snippet: { type: "string" },
                          comment: { type: "string" },
                        },
                        required: ["file", "snippet", "comment"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["score", "confidence", "evidence"],
                  additionalProperties: false,
                },
                tooling: {
                  type: "object",
                  properties: {
                    score: { type: "number" },
                    confidence: { type: "number" },
                    evidence: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          file: { type: "string" },
                          snippet: { type: "string" },
                          comment: { type: "string" },
                        },
                        required: ["file", "snippet", "comment"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["score", "confidence", "evidence"],
                  additionalProperties: false,
                },
                styling: {
                  type: "object",
                  properties: {
                    score: { type: "number" },
                    confidence: { type: "number" },
                    evidence: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          file: { type: "string" },
                          snippet: { type: "string" },
                          comment: { type: "string" },
                        },
                        required: ["file", "snippet", "comment"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["score", "confidence", "evidence"],
                  additionalProperties: false,
                },
                summary: { type: "string", description: "1-2 sentence overall assessment" },
              },
              required: ["architecture", "type_safety", "code_quality", "tooling", "styling", "summary"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "submit_code_review" } },
    }),
  });

  if (response.status === 429) {
    throw new Error("LLM rate limited (429)");
  }
  if (response.status === 402) {
    throw new Error("LLM payment required (402)");
  }
  if (!response.ok) {
    const t = await response.text();
    throw new Error(`LLM error ${response.status}: ${t}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No tool call in LLM response");

  const args = typeof toolCall.function.arguments === "string"
    ? JSON.parse(toolCall.function.arguments)
    : toolCall.function.arguments;

  // Compute weighted overall score
  const weights = { architecture: 0.25, type_safety: 0.2, code_quality: 0.3, tooling: 0.1, styling: 0.15 };
  const overall_score =
    weights.architecture * (args.architecture?.score || 0) +
    weights.type_safety * (args.type_safety?.score || 0) +
    weights.code_quality * (args.code_quality?.score || 0) +
    weights.tooling * (args.tooling?.score || 0) +
    weights.styling * (args.styling?.score || 0);

  return {
    architecture: args.architecture,
    type_safety: args.type_safety,
    code_quality: args.code_quality,
    tooling: args.tooling,
    styling: args.styling,
    overall_score: Math.round(overall_score * 100) / 100,
    summary: args.summary || "",
  };
}

// --- Person helpers ---

const BOT_LOGINS = new Set([
  "dependabot", "renovate-bot", "github-actions", "greenkeeper",
  "snyk-bot", "codecov-commenter", "semantic-release-bot",
  "allcontributors", "imgbot", "stale",
]);

function isRealPerson(profile: any, login: string): { isReal: boolean; reason?: string } {
  if (profile.type === "Organization") return { isReal: false, reason: "organization" };
  if (profile.type === "Bot" || login.endsWith("[bot]") || BOT_LOGINS.has(login.toLowerCase()))
    return { isReal: false, reason: "bot" };
  return { isReal: true };
}

// --- Main handler ---

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { repoId } = await req.json();
    if (!repoId) throw new Error("repoId required");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch repo record
    const { data: repo, error: repoErr } = await supabase
      .from("repos")
      .select("*")
      .eq("id", repoId)
      .single();
    if (repoErr || !repo) throw new Error(`Repo not found: ${repoErr?.message}`);

    const fullName = repo.full_name;
    const defaultBranch = repo.metadata?.default_branch || "main";

    // Step 1: Repo snapshot — fetch tree + languages in parallel
    const [tree, langRes] = await Promise.all([
      fetchRepoTree(fullName, defaultBranch),
      githubFetch(`https://api.github.com/repos/${fullName}/languages`),
    ]);

    const languages: Record<string, number> = langRes.ok ? await langRes.json() : {};

    // Update repo metadata with languages
    await supabase.from("repos").update({ metadata: { ...repo.metadata, languages } }).eq("id", repoId);

    // If tree is empty, skip LLM review
    if (tree.length === 0) {
      console.log(`Empty tree for ${fullName}, skipping`);
      return new Response(
        JSON.stringify({ repoId, fullName, skipped: true, reason: "empty tree" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch package.json for classification
    const packageJsonRaw = await fetchFileRaw(fullName, "package.json", defaultBranch);
    let packageJson: any = null;
    try { if (packageJsonRaw) packageJson = JSON.parse(packageJsonRaw); } catch {}

    // Step 2: Classify + build evidence pack
    const repoKind = classifyRepo(tree, packageJson);
    const evidencePack = await buildEvidencePack(tree, fullName, defaultBranch, repoKind);

    console.log(`${fullName}: kind=${repoKind}, sampled=${evidencePack.sampledCount} files, ${(evidencePack.totalBytes / 1024).toFixed(0)}KB`);

    if (evidencePack.files.length === 0) {
      console.log(`No files sampled for ${fullName}, skipping LLM`);
      return new Response(
        JSON.stringify({ repoId, fullName, skipped: true, reason: "no files sampled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: LLM Review with retry
    let review: LLMReviewResult;
    let retries = 0;
    while (true) {
      try {
        review = await llmReview(evidencePack.files, {
          fullName,
          repoKind,
          stars: repo.metadata?.stargazers_count || 0,
          topics: repo.metadata?.topics || [],
          languages,
        });
        break;
      } catch (e) {
        if (retries < 2 && (e.message.includes("429") || e.message.includes("rate"))) {
          retries++;
          console.log(`Retry ${retries} for ${fullName} after rate limit`);
          await new Promise((r) => setTimeout(r, 3000 * retries));
        } else {
          throw e;
        }
      }
    }

    // Step 4: Store results
    // Build evidence JSONB with category breakdowns
    const evidencePayload = {
      categories: {
        architecture: review.architecture,
        type_safety: review.type_safety,
        code_quality: review.code_quality,
        tooling: review.tooling,
        styling: review.styling,
      },
      summary: review.summary,
      sampled_files: evidencePack.files.map((f) => f.path),
    };

    // Upsert repo signal
    await supabase.from("repo_signals").insert({
      repo_id: repoId,
      criterion: "code_quality",
      signal_value: review.overall_score,
      confidence: Math.min(
        review.architecture.confidence,
        review.type_safety.confidence,
        review.code_quality.confidence,
        review.tooling.confidence,
        review.styling.confidence
      ),
      evidence: evidencePayload,
      notes: `kind=${repoKind} | sampled=${evidencePack.sampledCount} files | ${review.summary}`,
    });

    // Upsert person (only real people)
    const ownerLogin = repo.owner_login;
    if (ownerLogin) {
      const profileRes = await githubFetch(`https://api.github.com/users/${ownerLogin}`);
      const profile = profileRes.ok ? await profileRes.json() : {};

      const { isReal, reason } = isRealPerson(profile, ownerLogin);
      if (!isReal) {
        console.log(`Skipping non-person: ${ownerLogin} (${reason})`);
        return new Response(
          JSON.stringify({ repoId, fullName, criterion: "code_quality", overall_score: review.overall_score, skippedPerson: true, reason }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isSparse = !profile.name && !profile.bio && !profile.blog && (profile.followers || 0) === 0;
      const profileData = {
        name: profile.name,
        avatar_url: profile.avatar_url,
        html_url: profile.html_url,
        bio: profile.bio,
        blog: profile.blog,
        email: profile.email,
        twitter_username: profile.twitter_username,
        public_repos: profile.public_repos,
        followers: profile.followers,
        company: profile.company,
        location: profile.location,
        is_real_person: true,
        is_sparse_profile: isSparse,
      };

      const { data: existingPerson } = await supabase
        .from("people")
        .select("id, overall_score")
        .eq("login", ownerLogin)
        .maybeSingle();

      let personId: string;
      if (existingPerson) {
        personId = existingPerson.id;
        await supabase.from("people")
          .update({ profile: profileData, updated_at: new Date().toISOString() })
          .eq("id", personId);
      } else {
        const { data: newPerson, error: personErr } = await supabase
          .from("people")
          .insert({ login: ownerLogin, profile: profileData })
          .select("id")
          .single();
        if (personErr) throw new Error(`Person insert failed: ${personErr.message}`);
        personId = newPerson.id;
      }

      // Person evidence with category breakdown
      await supabase.from("person_evidence").insert({
        person_id: personId,
        repo_id: repoId,
        criterion: "code_quality",
        score: review.overall_score,
        evidence: evidencePayload,
      });
    }

    return new Response(
      JSON.stringify({ repoId, fullName, criterion: "code_quality", overall_score: review.overall_score, repoKind }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("enrich-repo error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
