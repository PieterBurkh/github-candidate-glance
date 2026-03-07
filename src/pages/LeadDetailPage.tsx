import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Building,
  Users,
  Code,
  Shield,
  Wrench,
  Palette,
  LayoutDashboard,
} from "lucide-react";
import { usePersonDetail, usePersonEvidence } from "@/hooks/useSignalPipeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { NavBar } from "@/components/NavBar";

const CATEGORY_META: Record<string, { label: string; icon: any }> = {
  architecture: { label: "Architecture", icon: LayoutDashboard },
  type_safety: { label: "Type Safety", icon: Shield },
  code_quality: { label: "Code Quality", icon: Code },
  tooling: { label: "Tooling", icon: Wrench },
  styling: { label: "Styling", icon: Palette },
};

function CategoryBreakdown({ categories }: { categories: Record<string, any> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Object.entries(CATEGORY_META).map(([key, meta]) => {
        const cat = categories?.[key];
        if (!cat) return null;
        const Icon = meta.icon;
        return (
          <Card key={key}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{meta.label}</span>
                <span className="ml-auto text-sm font-bold text-foreground">
                  {(cat.score * 100).toFixed(0)}%
                </span>
              </div>
              <Progress value={cat.score * 100} className="h-2 mb-3" />
              {cat.evidence?.length > 0 && (
                <div className="space-y-2">
                  {cat.evidence.map((ev: any, idx: number) => (
                    <div key={idx} className="text-xs border border-border rounded p-2 bg-muted/30">
                      <p className="font-mono text-muted-foreground mb-1">{ev.file}</p>
                      {ev.snippet && (
                        <pre className="text-[10px] bg-muted p-1.5 rounded overflow-x-auto mb-1 text-foreground">
                          {ev.snippet}
                        </pre>
                      )}
                      <p className="text-muted-foreground">{ev.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function LeadDetailPage() {
  const { login } = useParams<{ login: string }>();
  const { data: person, isLoading } = usePersonDetail(login || "");
  const { data: evidence } = usePersonEvidence(person?.id || "");

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
        <Link to="/">
          <Button variant="ghost" size="sm" className="gap-1.5 mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>

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
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {p.email}
                    </span>
                  )}
                </div>

                <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {p.followers?.toLocaleString() || 0} followers
                  </span>
                  <span>{p.public_repos || 0} repos</span>
                </div>
              </div>

              <div className="text-center">
                <p className="text-3xl font-bold text-foreground">
                  {(person.overall_score * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground">Overall</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Evidence */}
        <h2 className="text-lg font-semibold text-foreground mb-3">Signal Evidence</h2>
        {evidence && evidence.length > 0 ? (
          <div className="space-y-6">
            {evidence.map((ev) => {
              const isNewFormat = ev.criterion === "code_quality" && (ev.evidence as any)?.categories;
              const categories = isNewFormat ? (ev.evidence as any).categories : null;
              const summary = isNewFormat ? (ev.evidence as any).summary : null;

              return (
                <div key={ev.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge className="text-xs">{ev.criterion === "code_quality" ? "Code Quality (LLM)" : ev.criterion}</Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {(ev.score * 100).toFixed(0)}%
                      </span>
                      <Progress value={ev.score * 100} className="h-2 w-20" />
                    </div>
                  </div>

                  {summary && (
                    <p className="text-sm text-muted-foreground italic">{summary}</p>
                  )}

                  {categories ? (
                    <CategoryBreakdown categories={categories} />
                  ) : (
                    /* Legacy format */
                    <Card>
                      <CardContent className="p-4">
                        <div className="space-y-1.5">
                          {(Array.isArray(ev.evidence) ? ev.evidence : []).map((e: any, idx: number) => (
                            <a
                              key={idx}
                              href={e.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
                            >
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              <span>{e.label}</span>
                            </a>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No evidence collected yet.</p>
        )}
      </div>
    </div>
  );
}
