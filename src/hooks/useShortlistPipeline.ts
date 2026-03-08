import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ShortlistRun {
  id: string;
  status: string;
  progress: any;
  created_at: string;
  updated_at: string;
}

export function useShortlistRuns() {
  return useQuery({
    queryKey: ["shortlist-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shortlist_runs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ShortlistRun[];
    },
    refetchInterval: 5000,
  });
}

export function useStartShortlistRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: run, error: insertErr } = await supabase
        .from("shortlist_runs")
        .insert({})
        .select()
        .single();
      if (insertErr) throw insertErr;

      try {
        const { data, error } = await supabase.functions.invoke("run-shortlist", {
          body: { shortlistRunId: run.id },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        return { runId: run.id, ...data };
      } catch (e) {
        console.warn("run-shortlist edge function not available yet:", e);
        return { runId: run.id };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shortlist-runs"] }),
  });
}

export function usePauseShortlistRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (shortlistRunId: string) => {
      const { error } = await supabase
        .from("shortlist_runs")
        .update({ status: "paused", updated_at: new Date().toISOString() })
        .eq("id", shortlistRunId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shortlist-runs"] }),
  });
}
