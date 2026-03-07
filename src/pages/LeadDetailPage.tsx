import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Building,
  Star,
  Users,
} from "lucide-react";
import { usePersonDetail, usePersonEvidence } from "@/hooks/useSignalPipeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { NavBar } from "@/components/NavBar";

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
          <div className="space-y-3">
            {evidence.map((ev) => (
              <Card key={ev.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className="text-xs">{ev.criterion}</Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {(ev.score * 100).toFixed(0)}%
                      </span>
                      <Progress value={ev.score * 100} className="h-2 w-20" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {(ev.evidence || []).map((e: any, idx: number) => (
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
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No evidence collected yet.</p>
        )}
      </div>
    </div>
  );
}
