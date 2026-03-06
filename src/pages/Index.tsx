import { useState, useMemo } from "react";
import { ArrowUpDown, RefreshCw, AlertTriangle } from "lucide-react";
import { useCandidates } from "@/hooks/useCandidates";
import { CandidateCard } from "@/components/CandidateCard";
import { CandidateCardSkeleton } from "@/components/CandidateCardSkeleton";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type SortBy = "stars" | "forks";

const Index = () => {
  const { data, isLoading, isError, error, refetch, isFetching } = useCandidates();
  const [sortBy, setSortBy] = useState<SortBy>("stars");

  const sorted = useMemo(() => {
    if (!data?.candidates) return [];
    return [...data.candidates].sort((a, b) => {
      if (sortBy === "stars") {
        return (b.topStarredRepo?.stars ?? 0) - (a.topStarredRepo?.stars ?? 0);
      }
      return (b.topForkedRepo?.forks ?? 0) - (a.topForkedRepo?.forks ?? 0);
    });
  }, [data?.candidates, sortBy]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Senior Frontend Engineer
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Candidates discovered via GitHub — developers with strong TypeScript &amp; JavaScript
            profiles, assessed for React, TypeScript, HTML &amp; CSS expertise.
          </p>
        </div>
      </header>

      {/* Toolbar */}
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowUpDown className="h-4 w-4" />
            <span className="hidden sm:inline">Sort by</span>
            <ToggleGroup
              type="single"
              value={sortBy}
              onValueChange={(v) => v && setSortBy(v as SortBy)}
              size="sm"
            >
              <ToggleGroupItem value="stars" className="text-xs">Stars</ToggleGroupItem>
              <ToggleGroupItem value="forks" className="text-xs">Forks</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        {isError && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Failed to load candidates</p>
              <p className="text-xs opacity-80">{error?.message}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto">
              Retry
            </Button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <CandidateCardSkeleton key={i} />)
            : sorted.map((c) => <CandidateCard key={c.login} candidate={c} />)}
        </div>

        {!isLoading && sorted.length === 0 && !isError && (
          <p className="mt-12 text-center text-sm text-muted-foreground">
            No candidates found. Try refreshing.
          </p>
        )}
      </main>
    </div>
  );
};

export default Index;
