import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
      const { data: runs, error } = await supabase
        .from("runs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Get repo counts per run
      const runIds = (runs || []).map((r: any) => r.id);
      if (runIds.length === 0) return [] as Run[];

      const { data: repos } = await supabase
        .from("repos")
        .select("run_id");

      const countMap = new Map<string, number>();
      for (const r of repos || []) {
        countMap.set(r.run_id, (countMap.get(r.run_id) || 0) + 1);
      }

      return (runs || []).map((r: any) => ({
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
        const { data: repos } = await supabase
          .from("repos")
          .select("id")
          .eq("run_id", runId);
        const repoIds = (repos || []).map((r: any) => r.id);
        if (repoIds.length === 0) return [] as Person[];

        const { data: evidence } = await supabase
          .from("person_evidence")
          .select("person_id")
          .in("repo_id", repoIds);
        const personIds = [...new Set((evidence || []).map((e: any) => e.person_id))];
        if (personIds.length === 0) return [] as Person[];

        const { data: people, error } = await supabase
          .from("people")
          .select("*")
          .in("id", personIds)
          .order("overall_score", { ascending: false });
        if (error) throw error;
        return (people || []) as Person[];
      }

      // All people
      const { data, error } = await supabase
        .from("people")
        .select("*")
        .order("overall_score", { ascending: false });
      if (error) throw error;
      return (data || []) as Person[];
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
      const { data, error } = await supabase
        .from("repos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

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
      const { data, error } = await supabase.from("runs").select("id");
      if (error) throw error;
      return (data || []).length;
    },
  });
}

// --- Run repos (longlist) ---
export function useRunRepos(runId: string) {
  return useQuery({
    queryKey: ["run-repos", runId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repos")
        .select("*")
        .eq("run_id", runId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Repo[];
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
