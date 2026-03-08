import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { useDynamicLonglist } from "@/hooks/useLonglistPipeline";
import { Button } from "@/components/ui/button";
import { NavBar } from "@/components/NavBar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function LonglistResultsPage() {
  const [sortBy, setSortBy] = useState<"score" | "confidence">("score");
  const { data: candidates, isLoading } = useDynamicLonglist();

  const sorted = [...(candidates || [])].sort((a, b) =>
    sortBy === "score" ? b.pre_score - a.pre_score : b.pre_confidence - a.pre_confidence
  );

  const summarizeSignals = (repoSignals: any) => {
    if (!repoSignals || typeof repoSignals !== "object") return "";
    const allLibs = new Set<string>();
    let hasCI = false;
    let hasTests = false;
    let hasStorybook = false;
    for (const sig of Object.values(repoSignals) as any[]) {
      (sig.complex_libs || []).forEach((l: string) => allLibs.add(l));
      (sig.testing || []).forEach((l: string) => allLibs.add(l));
      if (sig.has_ci) hasCI = true;
      if (sig.has_tests_dir) hasTests = true;
      if (sig.storybook) hasStorybook = true;
    }
    const parts: string[] = [];
    if (hasCI) parts.push("CI");
    if (hasTests) parts.push("Tests");
    if (hasStorybook) parts.push("Storybook");
    if (allLibs.size > 0) parts.push(...[...allLibs].slice(0, 3));
    return parts.join(", ");
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Longlist</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {sorted.length} candidates scoring 70–82
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Sort by Score</SelectItem>
                <SelectItem value="confidence">Sort by Confidence</SelectItem>
              </SelectContent>
            </Select>
          </div>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Sort by Score</SelectItem>
                <SelectItem value="confidence">Sort by Confidence</SelectItem>
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
                  <TableHead>Login</TableHead>
                  <TableHead className="w-20 text-right">Score</TableHead>
                  <TableHead className="w-24 text-right">Confidence</TableHead>
                  <TableHead className="w-24">Tier</TableHead>
                  <TableHead>Key Signals</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((c) => {
                  const hydration = c.hydration as any;
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
                      <TableCell className="text-right font-mono text-sm">{c.pre_score}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{Math.round(c.pre_confidence * 100)}%</TableCell>
                      <TableCell>
                        <Badge variant={c.computed_tier === "exploit" ? "default" : "secondary"} className="text-[10px]">
                          {c.computed_tier}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {summarizeSignals(c.repo_signals)}
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
