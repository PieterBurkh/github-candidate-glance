import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PipelineRun {
  id: string;
  stage: string;
  config: Record<string, unknown>;
  run_id: string | null;
  longlist_run_id: string | null;
  shortlist_run_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export function usePipelineRuns() {
  return useQuery({
    queryKey: ["pipeline_runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_runs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PipelineRun[];
    },
    refetchInterval: 5000,
  });
}

export function usePipelineRunDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["pipeline_runs", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("pipeline_runs")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as PipelineRun;
    },
    enabled: !!id,
    refetchInterval: 5000,
  });
}

export function useStartPipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: { per_page?: number; max_pages?: number }) => {
      // Insert pipeline_runs record
      const { data: pr, error } = await supabase
        .from("pipeline_runs")
        .insert({ stage: "pending", config })
        .select("id")
        .single();
      if (error) throw error;

      // Invoke run-pipeline to kick off
      const { data: result, error: fnErr } = await supabase.functions.invoke(
        "run-pipeline",
        { body: { pipelineRunId: pr.id } }
      );
      if (fnErr) throw fnErr;
      return { pipelineRunId: pr.id, ...result };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline_runs"] }),
  });
}

export function useAdvancePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pipelineRunId: string) => {
      const { data, error } = await supabase.functions.invoke("run-pipeline", {
        body: { pipelineRunId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline_runs"] }),
  });
}
