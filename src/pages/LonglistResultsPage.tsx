import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useDynamicLonglist } from "@/hooks/useLonglistPipeline";
import { useShortlistEnrichment } from "@/hooks/useShortlistData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NavBar } from "@/components/NavBar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const MIN_UNSORTED = 200;
const SCORE_THRESHOLD = 70;

type FilterMode = "all" | "sorted" | "unsorted";

export default function LonglistResultsPage() {
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const { data: allCandidates, isLoading: loadingCandidates } = useDynamicLonglist();
  const { enrichmentMap, isLoading: loadingEnrichment } = useShortlistEnrichment();

  const { display, sortedCount, unsortedCount } = useMemo(() => {
    if (!allCandidates) return { display: [], sortedCount: 0, unsortedCount: 0 };

    const sorted: typeof allCandidates = [];
    const unsortedAll: typeof allCandidates = [];

    for (const c of allCandidates) {
      if (enrichmentMap[c.login]) {
        sorted.push(c);
      } else {
        unsortedAll.push(c);
      }
    }

    // unsortedAll is already sorted by pre_score desc (from hook)
    // Take all >= threshold, then fill to MIN_UNSORTED
    let unsortedSelected: typeof allCandidates;
    const aboveThreshold = unsortedAll.filter(c => c.pre_score >= SCORE_THRESHOLD);
    if (aboveThreshold.length >= MIN_UNSORTED) {
      unsortedSelected = aboveThreshold;
    } else {
      unsortedSelected = unsortedAll.slice(0, Math.max(MIN_UNSORTED, aboveThreshold.length));
    }

    // Sort: sorted first (by shortlist score desc), then unsorted (by pre_score desc)
    const sortedGroup = [...sorted].sort((a, b) => {
      const sa = enrichmentMap[a.login]?.overall_score ?? 0;
      const sb = enrichmentMap[b.login]?.overall_score ?? 0;
      return sb - sa;
    });

    const merged = [...sortedGroup, ...unsortedSelected];

    return {
      display: merged,
      sortedCount: sorted.length,
      unsortedCount: unsortedSelected.length,
    };
  }, [allCandidates, enrichmentMap]);

  const filtered = useMemo(() => {
    if (filterMode === "all") return display;
    if (filterMode === "sorted") return display.filter(c => !!enrichmentMap[c.login]);
    return display.filter(c => !enrichmentMap[c.login]);
  }, [display, filterMode, enrichmentMap]);

  const isLoading = loadingCandidates || loadingEnrichment;

  const getAssessment = (login: string): string => {
    const entry = enrichmentMap[login];
    if (!entry?.evidence) return "";
    const rubric = entry.evidence.find((ev: any) => ev.criterion === "shortlist_rubric");
    return (rubric?.evidence as any)?.assessment || "";
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Longlist</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {sortedCount} sorted · {unsortedCount} unsorted
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={filterMode} onValueChange={(v) => setFilterMode(v as FilterMode)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="sorted">Sorted</SelectItem>
                <SelectItem value="unsorted">Unsorted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Loading…</div>
        ) : filtered.length > 0 ? (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Login</TableHead>
                  <TableHead className="w-20 text-center">Sorted</TableHead>
                  <TableHead className="w-28 text-right">Shortlist Score</TableHead>
                  <TableHead>Assessment</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const hydration = c.hydration as any;
                  const enrichment = enrichmentMap[c.login];
                  const isSorted = !!enrichment;
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {hydration?.avatar_url && (
                            <img src={hydration.avatar_url} className="h-6 w-6 rounded-full" alt="" />
                          )}
                          <div>
                            <span className="font-medium text-foreground">{c.login}</span>
                            {hydration?.name && (
                              <span className="text-xs text-muted-foreground ml-1.5">({hydration.name})</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={isSorted ? "default" : "secondary"} className="text-xs">
                          {isSorted ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {isSorted ? `${Math.round(enrichment.overall_score * 100)}%` : "–"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">
                        {isSorted ? summarizeAssessment(c.login) : "–"}
                      </TableCell>
                      <TableCell>
                        {hydration?.html_url && (
                          <Button variant="ghost" size="icon" asChild className="h-7 w-7">
                            <a href={hydration.html_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">No longlist candidates yet. Run a longlist build first.</p>
          </div>
        )}
      </div>
    </div>
  );
}
