import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Star, Users } from "lucide-react";
import { useLeads } from "@/hooks/useSignalPipeline";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { NavBar } from "@/components/NavBar";

export default function LeadsPage() {
  const { runId } = useParams<{ runId: string }>();
  const { data: leads, isLoading } = useLeads(runId);

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Runs
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Leads</h1>
            <p className="text-sm text-muted-foreground">
              {leads?.length || 0} candidates ranked by signal strength
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : leads && leads.filter((p: any) => p.profile?.is_real_person !== false).length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {leads.filter((p: any) => p.profile?.is_real_person !== false).map((person) => (
              <Link key={person.id} to={`/leads/${person.login}`}>
                <Card className="group hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-3">
                    <Avatar className="h-12 w-12 ring-2 ring-border">
                      <AvatarImage
                        src={person.profile.avatar_url}
                        alt={person.login}
                      />
                      <AvatarFallback className="text-sm font-bold">
                        {person.login.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {person.profile.name || person.login}
                      </p>
                      <p className="text-xs text-muted-foreground">@{person.login}</p>
                      {person.profile.bio && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {person.profile.bio}
                        </p>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Overall Score</span>
                        <span className="font-semibold text-foreground">
                          {(person.overall_score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <Progress value={person.overall_score * 100} className="h-2" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {person.overall_score > 0 && (
                        <Badge className="text-[10px]">React+TS</Badge>
                      )}
                      {person.profile.followers && person.profile.followers > 100 && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Users className="h-2.5 w-2.5" />
                          {person.profile.followers.toLocaleString()}
                        </Badge>
                      )}
                      {person.profile.public_repos && (
                        <Badge variant="outline" className="text-[10px]">
                          {person.profile.public_repos} repos
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-border text-[10px] text-muted-foreground">
                      {person.profile.location && <span>{person.profile.location}</span>}
                      {person.profile.company && <span>· {person.profile.company}</span>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">
              No leads found yet. Run enrichment to discover candidates.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
