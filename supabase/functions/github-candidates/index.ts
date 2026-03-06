import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CandidateRepo {
  name: string;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics: string[];
}

interface Candidate {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  public_repos: number;
  followers: number;
  expertise: {
    react: boolean;
    typescript: boolean;
    html: boolean;
    css: boolean;
  };
  topStarredRepo: { name: string; url: string; stars: number } | null;
  topForkedRepo: { name: string; url: string; forks: number } | null;
  error?: string;
}

const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");

async function githubFetch(url: string) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "lovable-candidate-scanner",
  };
  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }
  return fetch(url, { headers });
}

async function processUser(username: string): Promise<Candidate> {
  // Fetch profile
  const profileRes = await githubFetch(`https://api.github.com/users/${username}`);
  if (!profileRes.ok) {
    const body = await profileRes.text();
    return {
      login: username,
      name: null,
      avatar_url: "",
      html_url: `https://github.com/${username}`,
      bio: null,
      public_repos: 0,
      followers: 0,
      expertise: { react: false, typescript: false, html: false, css: false },
      topStarredRepo: null,
      topForkedRepo: null,
      error: `Profile fetch failed: ${profileRes.status}`,
    };
  }
  const profile = await profileRes.json();

  // Fetch repos (up to 100, sorted by stars)
  const reposRes = await githubFetch(
    `https://api.github.com/users/${username}/repos?per_page=100&sort=stars&direction=desc`
  );
  if (!reposRes.ok) {
    const body = await reposRes.text();
    return {
      login: profile.login,
      name: profile.name,
      avatar_url: profile.avatar_url,
      html_url: profile.html_url,
      bio: profile.bio,
      public_repos: profile.public_repos,
      followers: profile.followers,
      expertise: { react: false, typescript: false, html: false, css: false },
      topStarredRepo: null,
      topForkedRepo: null,
      error: `Repos fetch failed: ${reposRes.status}`,
    };
  }
  const repos: CandidateRepo[] = await reposRes.json();

  // Compute expertise
  const expertise = { react: false, typescript: false, html: false, css: false };
  for (const repo of repos) {
    const lang = (repo.language || "").toLowerCase();
    const topics = (repo.topics || []).map((t: string) => t.toLowerCase());

    if (lang === "typescript" || topics.includes("typescript")) expertise.typescript = true;
    if (topics.includes("react") || topics.includes("reactjs") || topics.includes("react-native")) expertise.react = true;
    if (lang === "html" || topics.includes("html") || topics.includes("html5")) expertise.html = true;
    if (lang === "css" || topics.includes("css") || topics.includes("css3") || topics.includes("tailwindcss") || topics.includes("sass") || topics.includes("scss")) expertise.css = true;
  }

  // Also check if any repo uses JavaScript + has react topic (common pattern)
  if (!expertise.react) {
    for (const repo of repos) {
      const lang = (repo.language || "").toLowerCase();
      if ((lang === "javascript" || lang === "typescript") && repo.topics?.some((t: string) => t.toLowerCase().includes("react"))) {
        expertise.react = true;
        break;
      }
    }
  }

  // Find top starred and top forked
  let topStarred: CandidateRepo | null = null;
  let topForked: CandidateRepo | null = null;
  for (const repo of repos) {
    if (!topStarred || repo.stargazers_count > topStarred.stargazers_count) topStarred = repo;
    if (!topForked || repo.forks_count > topForked.forks_count) topForked = repo;
  }

  return {
    login: profile.login,
    name: profile.name,
    avatar_url: profile.avatar_url,
    html_url: profile.html_url,
    bio: profile.bio,
    public_repos: profile.public_repos,
    followers: profile.followers,
    expertise,
    topStarredRepo: topStarred
      ? { name: topStarred.name, url: topStarred.html_url, stars: topStarred.stargazers_count }
      : null,
    topForkedRepo: topForked
      ? { name: topForked.name, url: topForked.html_url, forks: topForked.forks_count }
      : null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { page = 1, perPage = 20 } = await req.json().catch(() => ({}));

    // Search for users who code in TypeScript and JavaScript with decent following
    const searchQuery = "language:typescript language:javascript followers:>50 repos:>10";
    const searchUrl = `https://api.github.com/search/users?q=${encodeURIComponent(searchQuery)}&sort=followers&order=desc&per_page=${perPage}&page=${page}`;

    const searchRes = await githubFetch(searchUrl);
    if (!searchRes.ok) {
      const errBody = await searchRes.text();
      return new Response(
        JSON.stringify({ error: `GitHub search failed: ${searchRes.status}`, details: errBody }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const searchData = await searchRes.json();
    const usernames: string[] = searchData.items.map((u: any) => u.login);
    const totalCount = searchData.total_count;

    // Process users in parallel (batches of 5 to be gentle on rate limits)
    const candidates: Candidate[] = [];
    const batchSize = 5;
    for (let i = 0; i < usernames.length; i += batchSize) {
      const batch = usernames.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(processUser));
      candidates.push(...results);
    }

    return new Response(
      JSON.stringify({ candidates, totalCount, page, perPage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
