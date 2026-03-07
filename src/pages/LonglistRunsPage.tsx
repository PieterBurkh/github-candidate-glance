import { useState } from "react";
import {
  Play, Loader2, CheckCircle2, Clock, Plus, Pause, XCircle,
} from "lucide-react";
import { useLonglistRuns, useStartLonglistRun, useResumeLonglistRun } from "@/hooks/useLonglistPipeline";
import { useRuns } from "@/hooks/useSignalPipeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NavBar } from "@/components/NavBar";

const statusConfig: Record<string, { icon: typeof Clock; className: string; label: string }> = {
  pending: { icon: Clock, className: "text-muted-foreground", label: "Pending" },
  running: { icon: Loader2, className: "text-primary animate-spin", label: "Running" },
  paused: { icon: Pause, className: "text-amber-600", label: "Paused" },
  done: { icon: CheckCircle2, className: "text-green-600", label: "Done" },
  failed: { icon: XCircle, className: "text-destructive", label: "Failed" },
};

export default function LonglistRunsPage() {
  const { data: longlistRuns, isLoading } = useLonglistRuns();
  const { data: initialRuns } = useRuns();
  const startRun = useStartLonglistRun();
  const resumeRun = useResumeLonglistRun();
  const [showForm, setShowForm] = useState(false);
  const [sourceRunId, setSourceRunId] = useState<string>("all");

  const handleStart = async () => {
    await startRun.mutateAsync(sourceRunId === "all" ? undefined : sourceRunId);
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Longlist Runs</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Process initial list accounts through deterministic filtering stages
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Longlist Run
          </Button>
        </div>

        {showForm && (
          <Card className="mb-6">
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Source Initial List Run</label>
                <Select value={sourceRunId} onValueChange={setSourceRunId}>
                  <SelectTrigger className="w-72">
                    <SelectValue placeholder="Select source run" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All initial list runs</SelectItem>
                    {(initialRuns || []).map((run) => (
                      <SelectItem key={run.id} value={run.id}>
                        {new Date(run.created_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })} — {run.repo_count} repos
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleStart} disabled={startRun.isPending} className="gap-1.5">
                  {startRun.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Start
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse"><CardContent className="p-6 h-20" /></Card>
            ))}
          </div>
        ) : longlistRuns && longlistRuns.length > 0 ? (
          <div className="space-y-3">
            {longlistRuns.map((run) => {
              const config = statusConfig[run.status] || statusConfig.pending;
              const StatusIcon = config.icon;
              const p = run.progress || {};
              const canResume = run.status === "paused";

              return (
                <Card key={run.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <StatusIcon className={`h-5 w-5 ${config.className}`} />
                      <div>
                        <p className="font-medium text-sm text-foreground">
                          {new Date(run.created_at).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">{config.label}</Badge>
                          {p.total && (
                            <span className="text-xs text-muted-foreground">
                              {p.total} candidates
                            </span>
                          )}
                          {p.scored != null && (
                            <span className="text-xs text-muted-foreground">
                              {p.scored} scored
                            </span>
                          )}
                          {p.selected != null && (
                            <span className="text-xs text-green-600 font-medium">
                              {p.selected} selected
                            </span>
                          )}
                          {p.discarded != null && (
                            <span className="text-xs text-muted-foreground">
                              {p.discarded} discarded
                            </span>
                          )}
                          {p.pending != null && p.pending > 0 && (
                            <span className="text-xs text-amber-600">
                              {p.pending} pending
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canResume && (
                        <Button
                          variant="default" size="sm" className="gap-1.5"
                          onClick={() => resumeRun.mutate(run.id)}
                          disabled={resumeRun.isPending}
                        >
                          {resumeRun.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                          Resume
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">No longlist runs yet. Start one above.</p>
          </div>
        )}
      </div>
    </div>
  );
}
