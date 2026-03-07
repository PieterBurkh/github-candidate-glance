import { useState, useMemo } from "react";
import { ArrowUpDown, ExternalLink, Star } from "lucide-react";
import { useAllRepos, useRunCount } from "@/hooks/useSignalPipeline";
import { NavBar } from "@/components/NavBar";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type SortField = "stars" | "pushed_at" | "full_name";
type SortDir = "asc" | "desc";

const NET_LABELS: Record<string, string> = {
  "core-stack": "Core Stack",
  "meta-frameworks": "Meta-frameworks",
  "component-libs": "Component Libs",
  versioning: "Versioning",
  performance: "Performance",
  a11y: "Accessibility",
  "complex-ui": "Complex UI",
  "crdt-realtime": "CRDT / Realtime",
  wasm: "WASM",
};

export default function GlobalLonglistPage() {
  const { data: repos, isLoading } = useAllRepos();
  const { data: runCount } = useRunCount();

  const [sortField, setSortField] = useState<SortField>("stars");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [netFilter, setNetFilter] = useState<string>("all");

  const allNets = useMemo(() => {
    const nets = new Set<string>();
    for (const r of repos || []) {
      for (const n of (r.metadata?.matched_nets as string[]) || []) {
        nets.add(n);
      }
    }
    return Array.from(nets).sort();
  }, [repos]);

  const filtered = useMemo(() => {
    let list = repos || [];
    if (netFilter !== "all") {
      list = list.filter((r) =>
        ((r.metadata?.matched_nets as string[]) || []).includes(netFilter)
      );
    }
    list = [...list].sort((a, b) => {
      let av: any, bv: any;
      if (sortField === "stars") {
        av = a.metadata?.stars ?? 0;
        bv = b.metadata?.stars ?? 0;
      } else if (sortField === "pushed_at") {
        av = a.metadata?.pushed_at ?? "";
        bv = b.metadata?.pushed_at ?? "";
      } else {
        av = a.full_name;
        bv = b.full_name;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [repos, netFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Initial List</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} unique repos from {runCount ?? "…"} runs
            {netFilter !== "all" && ` · filtered by ${NET_LABELS[netFilter] || netFilter}`}
          </p>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <Select value={netFilter} onValueChange={setNetFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by net" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Nets</SelectItem>
              {allNets.map((n) => (
                <SelectItem key={n} value={n}>{NET_LABELS[n] || n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Loading repos…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">No repos found yet. Run a search first.</div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort("full_name")}>
                      Repo <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>
                    <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort("stars")}>
                      <Star className="h-3 w-3" /> Stars <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>
                    <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort("pushed_at")}>
                      Last Push <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Matched Nets</TableHead>
                  <TableHead>Runs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((repo) => (
                  <TableRow key={repo.full_name}>
                    <TableCell>
                      <a href={repo.metadata?.html_url || `https://github.com/${repo.full_name}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-medium text-primary hover:underline">
                        {repo.full_name} <ExternalLink className="h-3 w-3 opacity-50" />
                      </a>
                      {repo.metadata?.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-md">{repo.metadata.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{repo.owner_login}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        <Star className="h-3 w-3 text-primary" />
                        {(repo.metadata?.stars ?? 0).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{repo.metadata?.language || "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {repo.metadata?.pushed_at ? new Date(repo.metadata.pushed_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {((repo.metadata?.matched_nets as string[]) || []).map((n) => (
                          <Badge key={n} variant="secondary" className="text-[10px]">{NET_LABELS[n] || n}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{repo.run_ids?.length ?? 1}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
