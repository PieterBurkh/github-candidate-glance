import { ExternalLink, Star, GitFork, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Candidate } from "@/hooks/useCandidates";

const techLabels = [
  { key: "react" as const, label: "React" },
  { key: "typescript" as const, label: "TypeScript" },
  { key: "html" as const, label: "HTML" },
  { key: "css" as const, label: "CSS" },
];

export function CandidateCard({ candidate }: { candidate: Candidate }) {
  const hasError = !!candidate.error;

  return (
    <Card className="group relative overflow-hidden transition-shadow hover:shadow-lg">
      <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-3">
        <Avatar className="h-12 w-12 ring-2 ring-border">
          <AvatarImage src={candidate.avatar_url} alt={candidate.login} />
          <AvatarFallback className="text-sm font-bold">
            {candidate.login.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <a
            href={candidate.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-foreground hover:text-primary transition-colors"
          >
            <span className="truncate">{candidate.name || candidate.login}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </a>
          {candidate.name && (
            <p className="text-xs text-muted-foreground">@{candidate.login}</p>
          )}
          {candidate.bio && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{candidate.bio}</p>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Expertise badges */}
        <div className="flex flex-wrap gap-1.5">
          {techLabels.map(({ key, label }) => (
            <Badge
              key={key}
              variant={candidate.expertise[key] ? "default" : "outline"}
              className={
                candidate.expertise[key]
                  ? "text-[10px]"
                  : "text-[10px] opacity-40"
              }
            >
              {candidate.expertise[key] ? "✓" : "✗"} {label}
            </Badge>
          ))}
        </div>

        {hasError ? (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>Couldn't fetch repos — try refreshing</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-sm">
            {/* Top starred */}
            <div className="space-y-0.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Top Stars
              </p>
              {candidate.topStarredRepo ? (
                <a
                  href={candidate.topStarredRepo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-foreground hover:text-primary transition-colors"
                >
                  <Star className="h-3 w-3 text-amber-500" />
                  <span className="font-semibold">{candidate.topStarredRepo.stars.toLocaleString()}</span>
                  <span className="truncate text-muted-foreground max-w-[80px]">
                    {candidate.topStarredRepo.name}
                  </span>
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>

            {/* Top forked */}
            <div className="space-y-0.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Top Forks
              </p>
              {candidate.topForkedRepo ? (
                <a
                  href={candidate.topForkedRepo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-foreground hover:text-primary transition-colors"
                >
                  <GitFork className="h-3 w-3 text-primary" />
                  <span className="font-semibold">{candidate.topForkedRepo.forks.toLocaleString()}</span>
                  <span className="truncate text-muted-foreground max-w-[80px]">
                    {candidate.topForkedRepo.name}
                  </span>
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
          </div>
        )}

        {/* Meta info */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground border-t border-border pt-2">
          <span>{candidate.public_repos} repos</span>
          <span>{candidate.followers.toLocaleString()} followers</span>
        </div>
      </CardContent>
    </Card>
  );
}
