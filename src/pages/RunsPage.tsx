import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Zap,
  ArrowRight,
} from "lucide-react";
import { useRuns, useStartRun, useRunEnrichment } from "@/hooks/useSignalPipeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { NavBar } from "@/components/NavBar";

const statusConfig: Record<string, { icon: typeof Clock; className: string; label: string }> = {
  pending: { icon: Clock, className: "text-muted-foreground", label: "Pending" },
  running: { icon: Loader2, className: "text-primary animate-spin", label: "Running" },
  completed: { icon: CheckCircle2, className: "text-green-600", label: "Completed" },
  failed: { icon: XCircle, className: "text-destructive", label: "Failed" },
};

export default function RunsPage() {
  const { data: runs, isLoading } = useRuns();
  const startRun = useStartRun();
  const runEnrichment = useRunEnrichment();
  const [showForm, setShowForm] = useState(false);
  const [minStars, setMinStars] = useState(10);
  const [perPage, setPerPage] = useState(30);

  const handleNewRun = async () => {
    const result = await startRun.mutateAsync({ minStars, perPage });
    setShowForm(false);
    // Auto-start enrichment
    runEnrichment.mutate(result.runId);
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Search Runs</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Discover repos, extract signals, identify leads
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Run
          </Button>
        </div>

        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Configure Search</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Stars</Label>
                  <Input
                    type="number"
                    value={minStars}
                    onChange={(e) => setMinStars(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Results Per Query</Label>
                  <Input
                    type="number"
                    value={perPage}
                    onChange={(e) => setPerPage(Number(e.target.value))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Searches: React+TS, Next.js+TS, Tailwind+React+TS repos on GitHub
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleNewRun}
                  disabled={startRun.isPending || runEnrichment.isPending}
                  className="gap-1.5"
                >
                  {startRun.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Search & Enrich
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6 h-20" />
              </Card>
            ))}
          </div>
        ) : runs && runs.length > 0 ? (
          <div className="space-y-3">
            {runs.map((run) => {
              const config = statusConfig[run.status] || statusConfig.pending;
              const StatusIcon = config.icon;
              return (
                <Card key={run.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <StatusIcon className={`h-5 w-5 ${config.className}`} />
                      <div>
                        <p className="font-medium text-sm text-foreground">
                          {new Date(run.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px]">
                            {config.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {run.repo_count} repos
                          </span>
                          {run.search_params?.minStars && (
                            <span className="text-xs text-muted-foreground">
                              ≥{run.search_params.minStars}★
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {run.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => runEnrichment.mutate(run.id)}
                          disabled={runEnrichment.isPending}
                        >
                          <Zap className="h-3.5 w-3.5" />
                          Enrich
                        </Button>
                      )}
                      {run.status === "completed" && (
                        <Link to={`/runs/${run.id}/leads`}>
                          <Button variant="outline" size="sm" className="gap-1.5">
                            View Leads
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">No runs yet. Start one above.</p>
          </div>
        )}
      </div>
    </div>
  );
}
