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
  List,
  Pause,
  AlertTriangle,
} from "lucide-react";
import { useRuns, useStartRun, useRunEnrichment, useResumeRun, usePauseRun } from "@/hooks/useSignalPipeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { NavBar } from "@/components/NavBar";

const ALL_NETS = [
  { id: "core-stack", label: "Core Stack" },
  { id: "meta-frameworks", label: "Meta-frameworks" },
  { id: "component-libs", label: "Component Libs" },
  { id: "versioning", label: "Versioning" },
  { id: "performance", label: "Performance" },
  { id: "a11y", label: "Accessibility" },
  { id: "complex-ui", label: "Complex UI" },
  { id: "crdt-realtime", label: "CRDT / Realtime" },
  { id: "wasm", label: "WASM" },
];

const statusConfig: Record<string, { icon: typeof Clock; className: string; label: string }> = {
  pending: { icon: Clock, className: "text-muted-foreground", label: "Pending" },
  running: { icon: Loader2, className: "text-primary animate-spin", label: "Running" },
  paused: { icon: Pause, className: "text-amber-600", label: "Paused" },
  timed_out: { icon: Clock, className: "text-amber-600", label: "Timed Out" },
  completed: { icon: CheckCircle2, className: "text-green-600", label: "Completed" },
  failed: { icon: XCircle, className: "text-destructive", label: "Failed" },
};

export default function RunsPage() {
  const { data: runs, isLoading } = useRuns();
  const startRun = useStartRun();
  const runEnrichment = useRunEnrichment();
  const resumeRun = useResumeRun();
  const [showForm, setShowForm] = useState(false);
  const [perPage, setPerPage] = useState(100);
  const [maxPages, setMaxPages] = useState(10);
  const [selectedNets, setSelectedNets] = useState<string[]>(ALL_NETS.map((n) => n.id));

  const toggleNet = (netId: string) => {
    setSelectedNets((prev) =>
      prev.includes(netId) ? prev.filter((n) => n !== netId) : [...prev, netId]
    );
  };

  const handleNewRun = async () => {
    await startRun.mutateAsync({ nets: selectedNets, perPage, maxPages });
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Initial List Runs</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Discover repos via job-mapped nets, extract signals, identify leads
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
              <div className="flex gap-4">
                <div className="space-y-2">
                  <Label>Results Per Query</Label>
                  <Input
                    type="number"
                    value={perPage}
                    onChange={(e) => setPerPage(Number(e.target.value))}
                    className="w-32"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Pages</Label>
                  <Input
                    type="number"
                    value={maxPages}
                    onChange={(e) => setMaxPages(Number(e.target.value))}
                    className="w-32"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Search Nets</Label>
                <p className="text-xs text-muted-foreground">
                  Each net targets a specific signal — README keywords, topics, frameworks
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {ALL_NETS.map((net) => (
                    <label
                      key={net.id}
                      className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors"
                    >
                      <Checkbox
                        checked={selectedNets.includes(net.id)}
                        onCheckedChange={() => toggleNet(net.id)}
                      />
                      {net.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleNewRun}
                  disabled={startRun.isPending || selectedNets.length === 0}
                  className="gap-1.5"
                >
                  {startRun.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Search
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
              const isLegacyTimedOut = run.status === "completed" && (run.search_params as any)?.timed_out === true;
              const effectiveStatus = isLegacyTimedOut ? "timed_out" : run.status;
              const config = statusConfig[effectiveStatus] || statusConfig.pending;
              const StatusIcon = config.icon;
              const nets = (run.search_params as any)?.nets as string[] | undefined;
              const canResume = effectiveStatus === "paused" || isLegacyTimedOut;
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
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">
                            {config.label}
                          </Badge>
                          {isLegacyTimedOut && (
                            <Badge variant="secondary" className="text-[10px] text-amber-600 gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Incomplete — resume to finish
                            </Badge>
                          )}
                          {effectiveStatus === "paused" && (
                            <Badge variant="secondary" className="text-[10px] text-amber-600">
                              Partial — resume to continue
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {(run.search_params as any)?.repos_found ?? run.repo_count ?? 0} repos
                          </span>
                          {nets && (
                            <span className="text-xs text-muted-foreground">
                              {nets.length} nets
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link to={`/runs/${run.id}/longlist`}>
                        <Button variant="ghost" size="sm" className="gap-1.5">
                          <List className="h-3.5 w-3.5" />
                          Initial list
                        </Button>
                      </Link>
                      {canResume && (
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => resumeRun.mutate(run.id)}
                          disabled={resumeRun.isPending}
                        >
                          {resumeRun.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                          Resume
                        </Button>
                      )}
                      {(run.status === "pending" || (run.status === "completed" && !isLegacyTimedOut)) && (
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
                      {run.status === "completed" && !isLegacyTimedOut && (
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
