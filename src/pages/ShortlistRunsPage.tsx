import {
  Play, Loader2, CheckCircle2, Clock, Plus, Pause, XCircle,
} from "lucide-react";
import { useShortlistRuns, useStartShortlistRun, useResumeShortlistRun, usePauseShortlistRun } from "@/hooks/useShortlistPipeline";
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

export function ShortlistRunsContent() {
  const { data: runs, isLoading } = useShortlistRuns();
  const startRun = useStartShortlistRun();
  const resumeRun = useResumeShortlistRun();
  const pauseRun = usePauseShortlistRun();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Shortlist Runs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Evaluate longlist candidates with LLM-powered evidence packs
          </p>
        </div>
        <Button onClick={() => startRun.mutateAsync()} disabled={startRun.isPending} className="gap-1.5">
          {startRun.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          New Shortlist Run
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-6 h-20" /></Card>
          ))}
        </div>
      ) : runs && runs.length > 0 ? (
        <div className="space-y-3">
          {runs.map((run) => {
            const config = statusConfig[run.status] || statusConfig.pending;
            const StatusIcon = config.icon;
            const p = run.progress || {};
            const canResume = run.status === "paused";
            const canPause = run.status === "running";

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
                        {p.total != null && (
                          <span className="text-xs text-muted-foreground">{p.total} candidates</span>
                        )}
                        {p.enriched != null && (
                          <span className="text-xs text-muted-foreground">{p.enriched} enriched</span>
                        )}
                        {p.failed != null && p.failed > 0 && (
                          <span className="text-xs text-destructive">{p.failed} failed</span>
                        )}
                        {p.rate_limited && (
                          <span className="text-xs text-destructive font-medium">
                            ⏳ Rate limited — resets {p.reset_at
                              ? `at ${new Date(p.reset_at * 1000).toLocaleTimeString()}`
                              : `in ~${p.wait_minutes || "?"} min`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canPause && (
                      <Button
                        variant="outline" size="sm" className="gap-1.5"
                        onClick={() => pauseRun.mutate(run.id)}
                        disabled={pauseRun.isPending}
                      >
                        {pauseRun.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />}
                        Pause
                      </Button>
                    )}
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
          <p className="text-muted-foreground text-sm">No shortlist runs yet. Start one above.</p>
        </div>
      )}
    </div>
  );
}

export default function ShortlistRunsPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <ShortlistRunsContent />
    </div>
  );
}