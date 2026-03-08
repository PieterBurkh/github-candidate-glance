import { useEffect, useRef, useState } from "react";
import { NavBar } from "@/components/NavBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { usePipelineRuns, useStartPipeline, useAdvancePipeline, type PipelineRun } from "@/hooks/usePipelineRuns";
import { formatDistanceToNow } from "date-fns";

const STAGES = ["initial_list", "longlist", "shortlist", "completed"] as const;
const STAGE_LABELS: Record<string, string> = {
  pending: "Pending",
  initial_list: "Initial List",
  longlist: "Longlist",
  shortlist: "Shortlist",
  completed: "Completed",
  failed: "Failed",
};

function stageBadgeVariant(stage: string) {
  if (stage === "completed") return "default" as const;
  if (stage === "failed") return "destructive" as const;
  return "secondary" as const;
}

function StageIndicator({ currentStage }: { currentStage: string }) {
  const currentIdx = STAGES.indexOf(currentStage as any);

  return (
    <div className="flex items-center gap-1">
      {STAGES.map((s, i) => {
        const isDone = currentStage === "completed" || i < currentIdx;
        const isCurrent = s === currentStage;
        const isFailed = currentStage === "failed";

        return (
          <div key={s} className="flex items-center gap-1">
            {i > 0 && (
              <div className={`h-0.5 w-4 ${isDone ? "bg-primary" : "bg-muted"}`} />
            )}
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  isDone
                    ? "bg-primary text-primary-foreground"
                    : isCurrent && !isFailed
                    ? "bg-primary/20 text-primary border-2 border-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : isCurrent && !isFailed ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  i + 1
                )}
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {STAGE_LABELS[s]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PipelineRunCard({ run }: { run: PipelineRun }) {
  const advance = useAdvancePipeline();
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const isActive = !["completed", "failed"].includes(run.stage);

  useEffect(() => {
    if (isActive) {
      // Advance every 15s
      intervalRef.current = setInterval(() => {
        advance.mutate(run.id);
      }, 15000);
      // Also advance immediately on mount
      advance.mutate(run.id);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [run.id, run.stage]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={stageBadgeVariant(run.stage)}>
            {STAGE_LABELS[run.stage] || run.stage}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
          </span>
        </div>
        {isActive && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => advance.mutate(run.id)}
            disabled={advance.isPending}
          >
            {advance.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Advance
          </Button>
        )}
      </div>

      <StageIndicator currentStage={run.stage} />

      {run.error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <XCircle className="h-4 w-4" />
          {run.error}
        </div>
      )}

      <div className="text-xs text-muted-foreground space-y-0.5">
        {run.run_id && <div>Initial List Run: <code className="text-foreground">{run.run_id.slice(0, 8)}…</code></div>}
        {run.longlist_run_id && <div>Longlist Run: <code className="text-foreground">{run.longlist_run_id.slice(0, 8)}…</code></div>}
        {run.shortlist_run_id && <div>Shortlist Run: <code className="text-foreground">{run.shortlist_run_id.slice(0, 8)}…</code></div>}
      </div>
    </Card>
  );
}

export default function PipelineRunsPage() {
  const { data: runs, isLoading } = usePipelineRuns();
  const startPipeline = useStartPipeline();
  const [perPage, setPerPage] = useState(6);
  const [maxPages, setMaxPages] = useState(1);

  const handleStart = () => {
    startPipeline.mutate({ per_page: perPage, max_pages: maxPages });
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pipeline Runs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            End-to-end candidate discovery: Initial List → Longlist → Shortlist
          </p>
        </div>

        {/* New run controls */}
        <Card className="p-4">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Repos per query page</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value))}
                className="w-28"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Max pages per query</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value))}
                className="w-28"
              />
            </div>
            <Button onClick={handleStart} disabled={startPipeline.isPending}>
              {startPipeline.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              New Pipeline Run
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            ~{perPage * maxPages * 9 * 2} repos max across all nets (9 nets × {maxPages} page(s) × {perPage} per page × multiple queries)
          </p>
        </Card>

        {/* Run list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : !runs?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No pipeline runs yet. Start one above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => (
              <PipelineRunCard key={run.id} run={run} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
