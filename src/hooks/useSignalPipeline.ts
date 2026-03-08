import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 1000;

async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => any
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

export interface Run {
  id: string;
  status: string;
  search_params: any;
  created_at: string;
  updated_at: string;
  repo_count?: number;
}

export interface Repo {
  id: string;
  run_id: string;
  full_name: string;
  metadata: any;
  owner_login: string;
  created_at: string;
}

export interface RepoSignal {
  id: string;
  repo_id: string;
  criterion: string;
  signal_value: number;
  confidence: number;
  evidence: { url: string; label: string; snippet?: string }[];
  notes: string | null;
  created_at: string;
}

export interface Person {
  id: string;
  login: string;
  profile: {
    name?: string;
    avatar_url?: string;
    html_url?: string;
    bio?: string;
    blog?: string;
    email?: string;
    twitter_username?: string;
    public_repos?: number;
    followers?: number;
    company?: string;
    location?: string;
  };
  overall_score: number;
  review_status: string;
  shortlist_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonEvidence {
  id: string;
  person_id: string;
  repo_id: string | null;
  criterion: string;
  score: number;
  evidence: { url: string; label: string; snippet?: string }[];
  created_at: string;
}

// --- Runs ---
export function useRuns() {
  return useQuery({
    queryKey: ["runs"],
    queryFn: async () => {
      const runs = await fetchAllRows<any>((from, to) =>
        supabase.from("runs").select("*").order("created_at", { ascending: false }).range(from, to)
      );
      if (runs.length === 0) return [] as Run[];

      // Get repo counts per run
      const repos = await fetchAllRows<{ run_id: string }>((from, to) =>
        supabase.from("repos").select("run_id").range(from, to)
      );

      const countMap = new Map<string, number>();
      for (const r of repos) {
        countMap.set(r.run_id, (countMap.get(r.run_id) || 0) + 1);
      }

      return runs.map((r: any) => ({
        ...r,
        repo_count: countMap.get(r.id) || 0,
      })) as Run[];
    },
    refetchInterval: 5000, // Poll for status updates
  });
}

export function useStartRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { nets?: string[]; minStars?: number; pushedAfter?: string; perPage?: number; maxPages?: number }) => {
      const { data, error } = await supabase.functions.invoke("search-repos", {
        body: params,
      });
      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data as { runId: string; repoCount: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["runs"] }),
  });
}

export function useResumeRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (runId: string) => {
      const { data, error } = await supabase.functions.invoke("search-repos", {
        body: { runId },
      });
      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data as { runId: string; repoCount: number; timedOut: boolean };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["runs"] }),
  });
}

export function usePauseRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (runId: string) => {
      const { error } = await supabase
        .from("runs")
        .update({ status: "pausing", updated_at: new Date().toISOString() })
        .eq("id", runId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["runs"] }),
  });
}

export function useRunEnrichment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (runId: string) => {
      const { data, error } = await supabase.functions.invoke("run-enrichment", {
        body: { runId },
      });
      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["runs"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

// --- Leads (people with scores) ---
export function useLeads(runId?: string) {
  return useQuery({
    queryKey: ["leads", runId],
    queryFn: async () => {
      // Get people who have evidence linked to repos from this run
      if (runId) {
        const repos = await fetchAllRows<{ id: string }>((from, to) =>
          supabase.from("repos").select("id").eq("run_id", runId).range(from, to)
        );
        const repoIds = repos.map((r) => r.id);
        if (repoIds.length === 0) return [] as Person[];

        const evidence = await fetchAllRows<{ person_id: string }>((from, to) =>
          supabase.from("person_evidence").select("person_id").in("repo_id", repoIds).range(from, to)
        );
        const personIds = [...new Set(evidence.map((e) => e.person_id))];
        if (personIds.length === 0) return [] as Person[];

        const people = await fetchAllRows<Person>((from, to) =>
          supabase.from("people").select("*").in("id", personIds).order("overall_score", { ascending: false }).range(from, to)
        );
        return people;
      }

      // All people
      const people = await fetchAllRows<Person>((from, to) =>
        supabase.from("people").select("*").order("overall_score", { ascending: false }).range(from, to)
      );
      return people;
    },
    refetchInterval: 10000,
  });
}

// --- Lead detail ---
export function usePersonDetail(login: string) {
  return useQuery({
    queryKey: ["person", login],
    queryFn: async () => {
      const { data: person, error } = await supabase
        .from("people")
        .select("*")
        .eq("login", login)
        .single();
      if (error) throw error;
      return person as Person;
    },
    enabled: !!login,
  });
}

export function usePersonEvidence(personId: string) {
  return useQuery({
    queryKey: ["person-evidence", personId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("person_evidence")
        .select("*")
        .eq("person_id", personId)
        .order("score", { ascending: false });
      if (error) throw error;
      return (data || []) as PersonEvidence[];
    },
    enabled: !!personId,
  });
}

// --- All repos (global longlist) ---
export function useAllRepos() {
  return useQuery({
    queryKey: ["all-repos"],
    queryFn: async () => {
      const data = await fetchAllRows<Repo>((from, to) =>
        supabase.from("repos").select("*").order("created_at", { ascending: false }).range(from, to)
      );

      // Deduplicate by full_name, keeping entry with most matched_nets
      const map = new Map<string, Repo & { run_ids: string[] }>();
      for (const r of (data || []) as Repo[]) {
        const existing = map.get(r.full_name);
        const nets = (r.metadata?.matched_nets as string[]) || [];
        if (!existing) {
          map.set(r.full_name, { ...r, run_ids: [r.run_id] });
        } else {
          existing.run_ids.push(r.run_id);
          const existingNets = (existing.metadata?.matched_nets as string[]) || [];
          const merged = [...new Set([...existingNets, ...nets])];
          existing.metadata = { ...existing.metadata, matched_nets: merged };
        }
      }
      return Array.from(map.values());
    },
  });
}

export function useRunCount() {
  return useQuery({
    queryKey: ["run-count"],
    queryFn: async () => {
      const data = await fetchAllRows<{ id: string }>((from, to) =>
        supabase.from("runs").select("id").range(from, to)
      );
      return data.length;
    },
  });
}

// --- Run repos (longlist) ---
export function useRunRepos(runId: string) {
  return useQuery({
    queryKey: ["run-repos", runId],
    queryFn: async () => {
      const data = await fetchAllRows<Repo>((from, to) =>
        supabase.from("repos").select("*").eq("run_id", runId).order("created_at", { ascending: false }).range(from, to)
      );
      return data;
    },
    enabled: !!runId,
  });
}

// --- Repo detail ---
export function useRepoDetail(fullName: string) {
  return useQuery({
    queryKey: ["repo", fullName],
    queryFn: async () => {
      const { data: repo, error } = await supabase
        .from("repos")
        .select("*")
        .eq("full_name", fullName)
        .limit(1)
        .single();
      if (error) throw error;
      return repo as Repo;
    },
    enabled: !!fullName,
  });
}

export function useRepoSignals(repoId: string) {
  return useQuery({
    queryKey: ["repo-signals", repoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repo_signals")
        .select("*")
        .eq("repo_id", repoId);
      if (error) throw error;
      return (data || []) as RepoSignal[];
    },
    enabled: !!repoId,
  });
}
