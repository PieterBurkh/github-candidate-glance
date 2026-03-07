import { useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Users, Star } from "lucide-react";
import { useLonglistCandidates } from "@/hooks/useLonglistPipeline";
import { useShortlistEnrichment } from "@/hooks/useShortlistData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { NavBar } from "@/components/NavBar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";

export default function LeadsPage() {
  const [tierFilter, setTierFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"score" | "enriched">("enriched");
  const { data: candidates, isLoading } = useLonglistCandidates(undefined, tierFilter || undefined);
  const { enrichmentMap, isLoading: enrichLoading } = useShortlistEnrichment();

  const enrichedOnly = (candidates || []).filter(c => {
    const e = enrichmentMap[c.login];
    if (!e) return false;
    if (statusFilter && e.shortlist_status !== statusFilter) return false;
    return true;
  });

  const sorted = [...enrichedOnly].sort((a, b) => {
    if (sortBy === "enriched") {
      const eA = enrichmentMap[a.login]?.overall_score ?? -1;
      const eB = enrichmentMap[b.login]?.overall_score ?? -1;
      if (eA !== eB) return eB - eA;
    }
    return b.pre_score - a.pre_score;
  });

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Shortlist</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {sorted.length} enriched candidates
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="SHORTLIST">Shortlist</SelectItem>
                <SelectItem value="NEEDS_REVIEW">Needs Review</SelectItem>
                <SelectItem value="NO">No</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tierFilter || "all"} onValueChange={(v) => setTierFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All tiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tiers</SelectItem>
                <SelectItem value="exploit">Exploit</SelectItem>
                <SelectItem value="explore">Explore</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Sort by Pre-score</SelectItem>
                <SelectItem value="enriched">Sort by Enriched</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Loading…</div>
        ) : sorted.length > 0 ? (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead className="w-20 text-right">Pre-score</TableHead>
                  <TableHead className="w-24">Tier</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-20 text-right">Followers</TableHead>
                  <TableHead className="w-20 text-right">Repos</TableHead>
                  <TableHead className="w-24 text-right">Enriched</TableHead>
                  <TableHead className="min-w-[280px]">Assessment</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((c, idx) => {
                  const h = c.hydration as any;
                  const enrichment = enrichmentMap[c.login];
                  const rubric = enrichment?.evidence?.find((e: any) => e.criterion === "shortlist_rubric")?.evidence as any;

                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {h?.avatar_url && (
                            <img src={h.avatar_url} className="h-7 w-7 rounded-full" alt="" />
                          )}
                          <div>
                            <Link
                              to={`/leads/${c.login}`}
                              className="font-medium text-foreground hover:text-primary transition-colors"
                            >
                              {h?.name || c.login}
                            </Link>
                            {h?.name && (
                              <span className="text-xs text-muted-foreground ml-1.5">@{c.login}</span>
                            )}
                            {h?.bio && (
                              <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-[200px]">
                                {h.bio}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{c.pre_score}</TableCell>
                      <TableCell>
                        <Badge
                          variant={c.selection_tier === "exploit" ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {c.selection_tier}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const status = enrichment?.shortlist_status || "pending";
                          const variant = status === "SHORTLIST" ? "default" : status === "NEEDS_REVIEW" ? "secondary" : "outline";
                          return (
                            <Badge variant={variant} className="text-[10px]">
                              {status === "NEEDS_REVIEW" ? "Needs Review" : status.charAt(0) + status.slice(1).toLowerCase()}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {h?.followers != null ? (
                          <span className="flex items-center justify-end gap-1 text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {h.followers.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {h?.public_repos != null ? (
                          <span className="text-muted-foreground">{h.public_repos}</span>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {enrichment ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="font-mono text-sm font-semibold text-foreground">
                              {(enrichment.overall_score * 100).toFixed(0)}%
                            </span>
                            <Progress value={enrichment.overall_score * 100} className="h-1.5 w-12" />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Pending</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {rubric?.assessment ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-[11px] text-muted-foreground line-clamp-3 cursor-help max-w-[280px]">
                                {rubric.assessment}
                              </p>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-sm text-xs">
                              {rubric.assessment}
                            </TooltipContent>
                          </Tooltip>
                        ) : enrichment ? (
                          <span className="text-xs text-muted-foreground italic">Pending</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">–</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {h?.html_url && (
                          <Button variant="ghost" size="icon" asChild className="h-7 w-7">
                            <a href={h.html_url} target="_blank" rel="noopener noreferrer">
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
            <p className="text-muted-foreground text-sm">
              No enriched candidates yet. Run enrichment on longlist candidates to populate the shortlist.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
