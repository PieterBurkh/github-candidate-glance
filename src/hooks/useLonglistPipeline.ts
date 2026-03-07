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
      // Create the run record
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
