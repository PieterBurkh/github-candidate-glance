import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Users, Star, Download, Linkedin, Mail } from "lucide-react";
import { useLonglistCandidates } from "@/hooks/useLonglistPipeline";
import { useShortlistEnrichment, useUpdateReviewStatus } from "@/hooks/useShortlistData";
import { categorizeLocation, extractLinkedIn, type LocationCategory } from "@/lib/categorizeLocation";
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

const REVIEW_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "on_hold", label: "On hold" },
  { value: "rejected", label: "Rejected" },
] as const;

function reviewBadgeVariant(status: string) {
  switch (status) {
    case "shortlisted": return "default";
    case "on_hold": return "secondary";
    case "rejected": return "destructive";
    default: return "outline";
  }
}

function reviewLabel(status: string) {
  return REVIEW_OPTIONS.find(o => o.value === status)?.label ?? "Pending";
}

export default function LeadsPage() {
  const [tierFilter, setTierFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [reviewFilter, setReviewFilter] = useState<string>("");
  const [locationFilter, setLocationFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"score" | "enriched">("enriched");
  const { data: candidates, isLoading } = useLonglistCandidates(undefined, tierFilter || undefined);
  const { enrichmentMap, isLoading: enrichLoading } = useShortlistEnrichment();
  const updateReview = useUpdateReviewStatus();

  const enrichedOnly = (candidates || []).filter(c => {
    const e = enrichmentMap[c.login];
    if (!e) return false;
    if (statusFilter && e.shortlist_status !== statusFilter) return false;
    if (reviewFilter && e.review_status !== reviewFilter) return false;
    if (locationFilter) {
      const loc = categorizeLocation(e.profile?.location);
      if (loc !== locationFilter) return false;
    }
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

  const downloadCsv = useCallback(() => {
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const headers = ["rank","login","name","pre_score","tier","status","review_status","location","location_category","email","linkedin","followers","repos","enriched_score","assessment","outreach_draft"];
    const rows = sorted.map((c, idx) => {
      const h = c.hydration as any;
      const e = enrichmentMap[c.login];
      const prof = e?.profile || {};
      const rubric = e?.evidence?.find((ev: any) => ev.criterion === "shortlist_rubric")?.evidence as any;
      const linkedIn = extractLinkedIn(prof);
      return [
        idx + 1,
        c.login,
        escape(h?.name || ""),
        c.pre_score,
        c.selection_tier || "",
        e?.shortlist_status || "pending",
        e?.review_status || "pending",
        escape(prof.location || ""),
        categorizeLocation(prof.location),
        prof.email || "",
        linkedIn || "",
        h?.followers ?? "",
        h?.public_repos ?? "",
        e ? e.overall_score : "",
        escape(rubric?.assessment || ""),
        escape(rubric?.outreach_draft || ""),
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shortlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sorted, enrichmentMap]);

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
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={reviewFilter || "all"} onValueChange={(v) => setReviewFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All reviews" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All reviews</SelectItem>
                {REVIEW_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Select value={locationFilter || "all"} onValueChange={(v) => setLocationFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                <SelectItem value="Germany">Germany</SelectItem>
                <SelectItem value="UK">UK</SelectItem>
                <SelectItem value="Rest of Europe">Rest of Europe</SelectItem>
                <SelectItem value="Rest of World">Rest of World</SelectItem>
                <SelectItem value="N/A">N/A</SelectItem>
              </SelectContent>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Sort by Pre-score</SelectItem>
                <SelectItem value="enriched">Sort by Score</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={downloadCsv} disabled={sorted.length === 0}>
              <Download className="h-4 w-4 mr-1.5" />
              CSV
            </Button>
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
                  <TableHead className="w-36">Review</TableHead>
                  <TableHead className="w-28">Location</TableHead>
                  <TableHead className="w-20">Email</TableHead>
                  <TableHead className="w-20">LinkedIn</TableHead>
                  <TableHead className="w-20 text-right">Followers</TableHead>
                  <TableHead className="w-20 text-right">Repos</TableHead>
                  <TableHead className="w-24 text-right">Score</TableHead>
                  <TableHead className="min-w-[280px]">Assessment</TableHead>
                  <TableHead className="min-w-[220px]">Outreach</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((c, idx) => {
                  const h = c.hydration as any;
                  const enrichment = enrichmentMap[c.login];
                  const rubric = enrichment?.evidence?.find((e: any) => e.criterion === "shortlist_rubric")?.evidence as any;
                  const currentReview = enrichment?.review_status || "pending";
                  const prof = enrichment?.profile || {} as any;
                  const locCategory = categorizeLocation(prof?.location);
                  const linkedIn = extractLinkedIn(prof);

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
                      <TableCell>
                        <Select
                          value={currentReview}
                          onValueChange={(v) => updateReview.mutate({ login: c.login, status: v })}
                        >
                          <SelectTrigger className="h-7 w-[120px] text-xs border-0 bg-transparent px-0 focus:ring-0">
                            <Badge variant={reviewBadgeVariant(currentReview)} className="text-[10px]">
                              {reviewLabel(currentReview)}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {REVIEW_OPTIONS.map(o => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                          <span className="font-mono text-sm font-semibold text-foreground">
                            {enrichment.overall_score}%
                          </span>
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
                        {rubric?.outreach_draft ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-[11px] text-muted-foreground line-clamp-2 cursor-help max-w-[220px]">
                                {rubric.outreach_draft}
                              </p>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-sm text-xs">
                              {rubric.outreach_draft}
                            </TooltipContent>
                          </Tooltip>
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
