import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Building,
  Users,
  Copy,
  Check,
  Download,
} from "lucide-react";
import { usePersonDetail, usePersonEvidence } from "@/hooks/useSignalPipeline";
import { useUpdateReviewStatus } from "@/hooks/useShortlistData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { NavBar } from "@/components/NavBar";
import { RubricBreakdown } from "@/components/RubricBreakdown";
import { categorizeLocation } from "@/lib/categorizeLocation";

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

function OutreachCard({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Card className="mb-6">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Outreach Draft</CardTitle>
        <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={handleCopy}>
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{text}</p>
      </CardContent>
    </Card>
  );
}

const MUST_HAVE_KEYS = ["react_typescript", "rich_app_architecture", "performance_profiling", "docs_versioning"];
const NICE_TO_HAVE_KEYS = ["bpmn_uml_uis", "wcag_accessibility", "semver_library_maintenance", "crdts", "wasm", "canvas_webgl"];

function escapeCsv(val: string) {
  if (/[",\n\r]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
}

export default function LeadDetailPage() {
  const { login } = useParams<{ login: string }>();
  const { data: person, isLoading } = usePersonDetail(login || "");
  const { data: evidence } = usePersonEvidence(person?.id || "");
  const updateReview = useUpdateReviewStatus();

  const handleDownloadCsv = () => {
    if (!person) return;
    const p = person.profile;
    const rubric = evidence?.find(ev => ev.criterion === "shortlist_rubric");
    const rd = rubric ? (rubric.evidence as any) : null;

    const headers: string[] = [
      "login", "name", "email", "location", "location_category", "company", "blog",
      "followers", "public_repos", "overall_score",
      "assessment", "outreach_draft",
      ...MUST_HAVE_KEYS.flatMap(k => [`mh_${k}_score`, `mh_${k}_evidence`]),
      ...NICE_TO_HAVE_KEYS.flatMap(k => [`nth_${k}_score`, `nth_${k}_evidence`]),
      "repos_evaluated",
    ];

    const v = (x: any) => escapeCsv(String(x ?? ""));
    const row: string[] = [
      v(person.login), v(p.name), v(p.email), v(p.location),
      v(categorizeLocation(p.location)), v(p.company), v(p.blog),
      v(p.followers), v(p.public_repos),
      v(person.overall_score.toFixed(1)),
      v(rd?.assessment), v(rd?.outreach_draft),
      ...MUST_HAVE_KEYS.flatMap(k => {
        const e = rd?.must_haves?.[k];
        return [v(e?.score != null ? (e.score * 100).toFixed(0) : ""), v(e?.evidence)];
      }),
      ...NICE_TO_HAVE_KEYS.flatMap(k => {
        const e = rd?.nice_to_haves?.[k];
        return [v(e?.score != null ? (e.score * 100).toFixed(0) : ""), v(e?.evidence)];
      }),
      v((rd?.repos_evaluated as string[] | undefined)?.join("; ")),
    ];

    const csv = headers.map(escapeCsv).join(",") + "\n" + row.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${person.login}-candidate.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <p className="text-muted-foreground">Lead not found.</p>
        </div>
      </div>
    );
  }

  const p = person.profile;

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex items-center gap-2 mb-4">
          <Link to="/shortlist">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadCsv}>
            <Download className="h-4 w-4" />
            Download CSV
          </Button>
        </div>

        {/* Profile header */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-start gap-6">
              <Avatar className="h-20 w-20 ring-2 ring-border">
                <AvatarImage src={p.avatar_url} alt={person.login} />
                <AvatarFallback className="text-xl font-bold">
                  {person.login.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-foreground">
                    {p.name || person.login}
                  </h1>
                  <a
                    href={p.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <p className="text-sm text-muted-foreground">@{person.login}</p>
                {p.bio && <p className="mt-2 text-sm text-foreground">{p.bio}</p>}

                <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                  {p.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {p.location}
                      <Badge variant="outline" className="text-[10px] ml-1">
                        {categorizeLocation(p.location)}
                      </Badge>
                    </span>
                  )}
                  {p.company && (
                    <span className="flex items-center gap-1">
                      <Building className="h-3 w-3" /> {p.company}
                    </span>
                  )}
                  {p.blog && (
                    <a
                      href={p.blog.startsWith("http") ? p.blog : `https://${p.blog}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-primary"
                    >
                      <Globe className="h-3 w-3" /> {p.blog}
                    </a>
                  )}
                  {p.email && (
                    <a href={`mailto:${p.email}`} className="flex items-center gap-1 hover:text-primary">
                      <Mail className="h-3 w-3" /> {p.email}
                    </a>
                  )}
                </div>

                <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {p.followers?.toLocaleString() || 0} followers
                  </span>
                  <span>{p.public_repos || 0} repos</span>
                </div>
              </div>

              <div className="text-center space-y-2">
                <p className="text-3xl font-bold text-foreground">
                  {Math.round(person.overall_score)}%
                </p>
                <p className="text-xs text-muted-foreground">Overall</p>
                <Select
                  value={person.review_status || "pending"}
                  onValueChange={(val) => updateReview.mutate({ login: person.login, status: val })}
                >
                  <SelectTrigger className="h-7 w-[120px] text-xs border-0 bg-transparent px-0 focus:ring-0">
                    <Badge variant={reviewBadgeVariant(person.review_status || "pending")} className="text-[10px]">
                      {reviewLabel(person.review_status || "pending")}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {REVIEW_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assessment */}
        {(() => {
          const rubric = evidence?.find(ev => ev.criterion === "shortlist_rubric");
          const assessment = rubric ? (rubric.evidence as any)?.assessment : null;
          if (!assessment) return null;
          return (
            <Card className="mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{assessment}</p>
              </CardContent>
            </Card>
          );
        })()}

        {/* Email + Outreach Draft */}
        {(() => {
          const rubric = evidence?.find(ev => ev.criterion === "shortlist_rubric");
          const outreach = rubric ? (rubric.evidence as any)?.outreach_draft : null;
          if (!outreach && !p.email) return null;
          return (
            <>
              {p.email && (
                <Card className="mb-6">
                  <CardContent className="p-4 flex items-center justify-between">
                    <a href={`mailto:${p.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                      <Mail className="h-4 w-4" />
                      {p.email}
                    </a>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 h-7 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(p.email);
                      }}
                    >
                      <Copy className="h-3 w-3" />
                      Copy email
                    </Button>
                  </CardContent>
                </Card>
              )}
              {outreach && <OutreachCard text={outreach} />}
            </>
          );
        })()}

        {/* Rubric Breakdown */}
        {(() => {
          const rubric = evidence?.find(ev => ev.criterion === "shortlist_rubric");
          const rubricData = rubric ? (rubric.evidence as any) : null;
          if (rubricData?.must_haves || rubricData?.nice_to_haves) {
            return <RubricBreakdown rubricEvidence={rubricData} />;
          }
          return <p className="text-sm text-muted-foreground">No evaluation data yet.</p>;
        })()}
      </div>
    </div>
  );
}
