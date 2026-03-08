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

export interface LonglistRun {
  id: string;
  source_run_id: string | null;
  status: string;
  progress: any;
  created_at: string;
  updated_at: string;
}

export interface LonglistCandidate {
  id: string;
  longlist_run_id: string;
  login: string;
  stage: string;
  discard_reason: string | null;
  hydration: any;
  candidate_repos: any;
  repo_signals: any;
  pre_score: number;
  pre_confidence: number;
  selection_tier: string | null;
  created_at: string;
  updated_at: string;
}

export function useLonglistRuns() {
  return useQuery({
    queryKey: ["longlist-runs"],
    queryFn: async () => {
      const data = await fetchAllRows<LonglistRun>((from, to) =>
        supabase.from("longlist_runs").select("*").order("created_at", { ascending: false }).range(from, to)
      );
      return data;
    },
    refetchInterval: 5000,
  });
}

export function useStartLonglistRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sourceRunId?: string) => {
      // Create the run record — always processes all repos from Initial list
      const { data: run, error: insertErr } = await supabase
        .from("longlist_runs")
        .insert({ source_run_id: sourceRunId || null })
        .select()
        .single();
      if (insertErr) throw insertErr;

      // Invoke the edge function
      const { data, error } = await supabase.functions.invoke("build-longlist", {
        body: { longlistRunId: run.id },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return { runId: run.id, ...data };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["longlist-runs"] }),
  });
}

export function useResumeLonglistRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (longlistRunId: string) => {
      const { data, error } = await supabase.functions.invoke("build-longlist", {
        body: { longlistRunId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["longlist-runs"] }),
  });
}

export function useLonglistCandidates(longlistRunId?: string, tierFilter?: string) {
  return useQuery({
    queryKey: ["longlist-candidates", longlistRunId, tierFilter],
    queryFn: async () => {
      if (longlistRunId) {
        let query = supabase
          .from("longlist_candidates")
          .select("*")
          .eq("longlist_run_id", longlistRunId)
          .not("selection_tier", "is", null)
          .order("pre_score", { ascending: false });

        if (tierFilter) {
          query = query.eq("selection_tier", tierFilter);
        }

        const data = await fetchAllRows<LonglistCandidate>((from, to) =>
          query.range(from, to)
        );
        return data;
      }

      // All selected candidates across all runs
      let query = supabase
        .from("longlist_candidates")
        .select("*")
        .not("selection_tier", "is", null)
        .order("pre_score", { ascending: false });

      if (tierFilter) {
        query = query.eq("selection_tier", tierFilter);
      }

      const data = await fetchAllRows<LonglistCandidate>((from, to) =>
        query.range(from, to)
      );
      return data;
    },
    refetchInterval: 10000,
  });
}

export type DynamicLonglistCandidate = LonglistCandidate & { computed_tier: "exploit" | "explore" };

function countQualitySignals(repoSignals: any): number {
  if (!repoSignals || typeof repoSignals !== "object") return 0;
  let count = 0;
  for (const sig of Object.values(repoSignals) as any[]) {
    if (sig.has_ci) count++;
    if (sig.has_tests_dir) count++;
    if (sig.storybook) count++;
    count += (sig.complex_libs || []).length;
    count += (sig.testing || []).length;
  }
  return count;
}

export function useDynamicLonglist(tierFilter?: string) {
  return useQuery({
    queryKey: ["dynamic-longlist", tierFilter],
    queryFn: async () => {
      const query = supabase
        .from("longlist_candidates")
        .select("*")
        .eq("stage", "scored")
        .gt("pre_score", 0)
        .order("pre_score", { ascending: false });

      const allScored = await fetchAllRows<LonglistCandidate>((from, to) =>
        query.range(from, to)
      );

      // Deduplicate by login (keep highest score)
      const seen = new Map<string, LonglistCandidate>();
      for (const c of allScored) {
        const existing = seen.get(c.login);
        if (!existing || c.pre_score > existing.pre_score) {
          seen.set(c.login, c);
        }
      }
      const unique = [...seen.values()].sort((a, b) => b.pre_score - a.pre_score);

      // Top 400 → exploit
      const exploit: DynamicLonglistCandidate[] = unique.slice(0, 400).map(c => ({ ...c, computed_tier: "exploit" as const }));

      // From remainder, pick top 100 by signal diversity → explore
      const remainder = unique.slice(400);
      remainder.sort((a, b) => countQualitySignals(b.repo_signals) - countQualitySignals(a.repo_signals));
      const explore: DynamicLonglistCandidate[] = remainder.slice(0, 100).map(c => ({ ...c, computed_tier: "explore" as const }));

      let result = [...exploit, ...explore];

      if (tierFilter) {
        result = result.filter(c => c.computed_tier === tierFilter);
      }

      // Sort final result by pre_score desc
      result.sort((a, b) => b.pre_score - a.pre_score);

      return result;
    },
    refetchInterval: 10000,
  });
}
