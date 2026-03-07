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
  const [sortBy, setSortBy] = useState<"score" | "enriched">("score");
  const { data: candidates, isLoading } = useLonglistCandidates(undefined, tierFilter || undefined);
  const { enrichmentMap, isLoading: enrichLoading } = useShortlistEnrichment();

  const sorted = [...(candidates || [])].sort((a, b) => {
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
              {sorted.length} candidates from longlist · enriched with LLM code review
            </p>
          </div>
          <div className="flex items-center gap-3">
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
                  <TableHead className="w-20 text-right">Followers</TableHead>
                  <TableHead className="w-20 text-right">Repos</TableHead>
                  <TableHead className="w-24 text-right">Enriched</TableHead>
                  <TableHead className="min-w-[250px]">LLM Commentary</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((c, idx) => {
                  const h = c.hydration as any;
                  const enrichment = enrichmentMap[c.login];
                  const evidence = enrichment?.evidence;
                  const codeQualityEv = evidence?.find((e: any) => e.criterion === "code_quality");
                  const categories = codeQualityEv?.evidence?.categories as Record<string, any> | undefined;
                  const summary = codeQualityEv?.evidence?.summary as string | undefined;

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
                        {categories ? (
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(categories).map(([key, cat]: [string, any]) => (
                              <Tooltip key={key}>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant={cat.score >= 0.7 ? "default" : cat.score >= 0.4 ? "secondary" : "outline"}
                                    className="text-[9px] cursor-help"
                                  >
                                    {key.replace(/_/g, " ")}: {(cat.score * 100).toFixed(0)}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-xs text-xs">
                                  {cat.evidence?.[0]?.comment || "No comment"}
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        ) : summary ? (
                          <p className="text-xs text-muted-foreground line-clamp-2">{summary}</p>
                        ) : enrichment ? (
                          <span className="text-xs text-muted-foreground italic">No category data</span>
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
              No shortlist candidates yet. Run a longlist build first to populate candidates.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
