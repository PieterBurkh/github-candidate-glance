import { useState } from "react";
import {
  Play, Loader2, CheckCircle2, Clock, Plus, Pause, XCircle,
} from "lucide-react";
import { useLonglistRuns, useStartLonglistRun, useResumeLonglistRun } from "@/hooks/useLonglistPipeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  const startRun = useStartLonglistRun();
  const resumeRun = useResumeLonglistRun();

  const handleStart = async () => {
    await startRun.mutateAsync(undefined);
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Longlist Runs</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Process all accounts from the Initial list through deterministic filtering
            </p>
          </div>
          <Button onClick={handleStart} disabled={startRun.isPending} className="gap-1.5">
            {startRun.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            New Longlist Run
          </Button>
        </div>

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
                          {p.rate_limited && (
                            <span className="text-xs text-destructive font-medium">
                              ⏳ Rate limited — resets {p.reset_at
                                ? `at ${new Date(p.reset_at * 1000).toLocaleTimeString()}`
                                : `in ~${p.wait_minutes || '?'} min`}
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
