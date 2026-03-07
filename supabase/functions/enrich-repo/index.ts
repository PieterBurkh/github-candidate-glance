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
  const res = await fetch(url, { headers });
  return res;
}

async function fetchFileContent(fullName: string, path: string, branch: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${fullName}/contents/${path}?ref=${branch}`;
  const res = await githubFetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.encoding === "base64" && data.content) {
    return atob(data.content.replace(/\n/g, ""));
  }
  return null;
}

async function fetchDirListing(fullName: string, path: string, branch: string): Promise<string[]> {
  const url = `https://api.github.com/repos/${fullName}/contents/${path}?ref=${branch}`;
  const res = await githubFetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((item: any) => item.name);
}

interface Evidence {
  url: string;
  label: string;
  snippet?: string;
}

const TEMPLATE_KEYWORDS = [
  "starter", "template", "boilerplate", "course", "tutorial",
  "example", "demo", "scaffold", "seed", "skeleton",
];

const STYLING_LIBS = [
  "styled-components", "@emotion/react", "@emotion/styled",
  "vanilla-extract", "@stitches/react", "linaria",
];

const BOT_LOGINS = [
  "dependabot", "renovate-bot", "github-actions", "greenkeeper",
  "snyk-bot", "codecov-commenter", "semantic-release-bot",
  "allcontributors", "imgbot", "stale",
];

function isBot(login: string, profileType: string): boolean {
  if (profileType === "Bot") return true;
  if (login.endsWith("[bot]")) return true;
  if (BOT_LOGINS.includes(login.toLowerCase())) return true;
  return false;
}

function isRealPerson(profile: any, login: string): { isReal: boolean; reason?: string } {
  if (profile.type === "Organization") return { isReal: false, reason: "organization" };
  if (isBot(login, profile.type || "")) return { isReal: false, reason: "bot" };
  return { isReal: true };
}

function scoreCriterion1(
  packageJson: any | null,
  tsconfigExists: boolean,
  languages: Record<string, number>,
  topics: string[],
  rootFiles: string[],
  srcFiles: string[],
  description: string,
  readmeContent: string,
  pushedAt: string,
  fullName: string,
  defaultBranch: string
): { signalValue: number; confidence: number; evidence: Evidence[]; notes: string } {
  const evidence: Evidence[] = [];
  const baseUrl = `https://github.com/${fullName}/blob/${defaultBranch}`;

  // --- React Score ---
  let reactScore = 0;
  const deps = { ...(packageJson?.dependencies || {}), ...(packageJson?.devDependencies || {}) };
  if (deps["react"]) {
    reactScore = 1.0;
    evidence.push({ url: `${baseUrl}/package.json`, label: "react in package.json dependencies" });
  } else if (topics.some((t) => ["react", "reactjs", "react-native"].includes(t))) {
    const tsxBytes = (languages["TSX"] || 0);
    if (tsxBytes > 0) {
      reactScore = 0.7;
      evidence.push({ url: `https://github.com/${fullName}`, label: "React topic + TSX code present" });
    }
  }

  // --- TS Score ---
  let tsScore = 0;
  const tsBytes = (languages["TypeScript"] || 0) + (languages["TSX"] || 0);
  if (tsconfigExists && tsBytes >= 50000) {
    tsScore = 1.0;
    evidence.push({ url: `${baseUrl}/tsconfig.json`, label: `tsconfig.json present, ${(tsBytes / 1024).toFixed(0)}KB TS/TSX` });
  } else if (tsBytes >= 50000) {
    tsScore = 0.7;
    evidence.push({ url: `https://github.com/${fullName}`, label: `${(tsBytes / 1024).toFixed(0)}KB TS/TSX (no tsconfig)` });
  }

  // --- CSS Score ---
  let cssScore = 0;
  const cssEvidence: string[] = [];
  if (deps["tailwindcss"] || rootFiles.some((f) => f.startsWith("tailwind.config"))) {
    cssScore += 0.5;
    cssEvidence.push("Tailwind");
  }
  if (deps["postcss"] || rootFiles.some((f) => f.startsWith("postcss.config"))) {
    cssScore += 0.2;
    cssEvidence.push("PostCSS");
  }
  for (const lib of STYLING_LIBS) {
    if (deps[lib]) {
      cssScore += 0.3;
      cssEvidence.push(lib);
      break;
    }
  }
  if ((languages["CSS"] || 0) > 0 || (languages["SCSS"] || 0) > 0) {
    cssScore += 0.2;
    cssEvidence.push("CSS/SCSS present");
  }
  cssScore = Math.min(1.0, cssScore);
  if (cssEvidence.length > 0) {
    evidence.push({ url: `https://github.com/${fullName}`, label: `CSS: ${cssEvidence.join(", ")}` });
  }

  // --- Substantial gate ---
  const eighteenMonthsAgo = new Date();
  eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);
  const recentPush = new Date(pushedAt) >= eighteenMonthsAgo;

  const descLower = (description || "").toLowerCase();
  const readmeLower = (readmeContent || "").toLowerCase().slice(0, 2000);
  const isTemplate = TEMPLATE_KEYWORDS.some((kw) => descLower.includes(kw) || readmeLower.includes(kw));

  const hasStructure = srcFiles.some((f) => ["components", "pages", "app", "routes"].includes(f));

  const substantial = tsBytes >= 50000 && recentPush && !isTemplate;

  if (!substantial) {
    const reasons: string[] = [];
    if (tsBytes < 50000) reasons.push(`TS/TSX only ${(tsBytes / 1024).toFixed(0)}KB`);
    if (!recentPush) reasons.push("not pushed recently");
    if (isTemplate) reasons.push("template/starter keywords detected");
    return {
      signalValue: 0,
      confidence: 0.8,
      evidence,
      notes: `Failed substantial gate: ${reasons.join("; ")}`,
    };
  }

  evidence.push({ url: `https://github.com/${fullName}`, label: "Passed substantial gate" });

  const finalScore = 0.4 * reactScore + 0.4 * tsScore + 0.2 * cssScore;

  // Confidence based on hard proofs
  let conf = 0.5;
  if (deps["react"]) conf += 0.15;
  if (tsconfigExists) conf += 0.15;
  if (hasStructure) conf += 0.1;
  if (cssEvidence.length > 0) conf += 0.1;
  conf = Math.min(1.0, conf);

  return {
    signalValue: Math.round(finalScore * 100) / 100,
    confidence: Math.round(conf * 100) / 100,
    evidence,
    notes: `React=${reactScore} TS=${tsScore} CSS=${cssScore.toFixed(2)} | substantial=true${hasStructure ? " | app structure detected" : ""}`,
  };
}

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

    // Fetch languages
    const langRes = await githubFetch(`https://api.github.com/repos/${fullName}/languages`);
    const languages: Record<string, number> = langRes.ok ? await langRes.json() : {};

    // Fetch key files in parallel
    const [packageJsonRaw, tsconfigRaw, readmeRaw, rootFiles, srcFiles] = await Promise.all([
      fetchFileContent(fullName, "package.json", defaultBranch),
      fetchFileContent(fullName, "tsconfig.json", defaultBranch),
      fetchFileContent(fullName, "README.md", defaultBranch),
      fetchDirListing(fullName, "", defaultBranch),
      fetchDirListing(fullName, "src", defaultBranch),
    ]);

    let packageJson: any = null;
    try {
      if (packageJsonRaw) packageJson = JSON.parse(packageJsonRaw);
    } catch {}

    const tsconfigExists = tsconfigRaw !== null;

    // Update repo metadata with languages
    const updatedMetadata = { ...repo.metadata, languages };
    await supabase.from("repos").update({ metadata: updatedMetadata }).eq("id", repoId);

    // Score Criterion #1
    const result = scoreCriterion1(
      packageJson,
      tsconfigExists,
      languages,
      repo.metadata?.topics || [],
      rootFiles,
      srcFiles,
      repo.metadata?.description || "",
      readmeRaw || "",
      repo.metadata?.pushed_at || "",
      fullName,
      defaultBranch
    );

    // Upsert signal
    await supabase.from("repo_signals").insert({
      repo_id: repoId,
      criterion: "react_ts_css",
      signal_value: result.signalValue,
      confidence: result.confidence,
      evidence: result.evidence,
      notes: result.notes,
    });

    // Upsert person (only real people)
    const ownerLogin = repo.owner_login;
    if (ownerLogin) {
      // Fetch GitHub profile
      const profileRes = await githubFetch(`https://api.github.com/users/${ownerLogin}`);
      const profile = profileRes.ok ? await profileRes.json() : {};

      const { isReal, reason } = isRealPerson(profile, ownerLogin);
      if (!isReal) {
        console.log(`Skipping non-person: ${ownerLogin} (${reason})`);
        return new Response(
          JSON.stringify({ repoId, fullName, criterion: "react_ts_css", ...result, skippedPerson: true, reason }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Determine if profile is sparse (low confidence)
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
        await supabase
          .from("people")
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

      // Add person evidence
      await supabase.from("person_evidence").insert({
        person_id: personId,
        repo_id: repoId,
        criterion: "react_ts_css",
        score: result.signalValue,
        evidence: result.evidence,
      });
    }

    return new Response(
      JSON.stringify({ repoId, fullName, criterion: "react_ts_css", ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
